import { ChatSource, askQuestion } from './api';

/**
 * One conversation per video, kept outside React.
 *
 * ChatPanel used to hold its messages in local state, so switching videos threw
 * the conversation away and a question still in flight lost its answer. Living
 * here, a conversation survives both: the panel only reads it.
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  failed?: boolean;
}

const STORAGE_KEY = 'askable.conversations.v1';
/** Conversations kept, least recently used dropped first. */
const MAX_CONVERSATIONS = 20;

type Conversations = Record<string, Message[]>;
type Drafts = Record<string, string>;

/** Shared so getMessages() keeps a stable reference for useSyncExternalStore. */
const EMPTY: Message[] = [];

function loadStored(): { messages: Conversations; drafts: Drafts } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { messages: {}, drafts: {} };
    const parsed = JSON.parse(raw);
    return {
      messages: parsed?.messages ?? {},
      drafts: parsed?.drafts ?? {},
    };
  } catch {
    // Corrupt or unavailable storage is not worth failing a chat over.
    return { messages: {}, drafts: {} };
  }
}

const stored = loadStored();
let messages: Conversations = stored.messages;
let drafts: Drafts = stored.drafts;
/** Video ids with an answer in flight; not persisted — a reload aborts them. */
const inFlight = new Set<string>();
const listeners = new Set<() => void>();

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, drafts }));
  } catch {
    // Over quota or storage disabled: the conversation still works in memory.
  }
}

/**
 * Debounced because every keystroke updates a draft, and serialising every
 * conversation on each one is not worth it. Whatever is still pending gets
 * written when the page goes away.
 */
function persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(flush, 300);
}

window.addEventListener('pagehide', flush);

function emit() {
  listeners.forEach((listener) => listener());
}

/**
 * Rewrites the key so insertion order tracks recency, which is what the trim
 * below relies on to drop the conversations nobody has touched in a while.
 */
function touch(videoId: string, next: Message[]) {
  const { [videoId]: _dropped, ...rest } = messages;
  messages = { ...rest, [videoId]: next };

  const ids = Object.keys(messages);
  if (ids.length > MAX_CONVERSATIONS) {
    messages = Object.fromEntries(ids.slice(-MAX_CONVERSATIONS).map((id) => [id, messages[id]]));
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getMessages(videoId: string): Message[] {
  return messages[videoId] ?? EMPTY;
}

export function isSending(videoId: string): boolean {
  return inFlight.has(videoId);
}

export function getDraft(videoId: string): string {
  return drafts[videoId] ?? '';
}

export function setDraft(videoId: string, text: string) {
  drafts = { ...drafts, [videoId]: text };
  persist();
  emit();
}

export function appendMessage(videoId: string, message: Message) {
  touch(videoId, [...getMessages(videoId), message]);
  persist();
  emit();
}

/** Drops a conversation, for when its video is deleted. */
export function clearConversation(videoId: string) {
  const { [videoId]: _messages, ...restMessages } = messages;
  const { [videoId]: _draft, ...restDrafts } = drafts;
  messages = restMessages;
  drafts = restDrafts;
  persist();
  emit();
}

/**
 * Asks a question and records the answer against its video.
 *
 * Runs to completion whether or not the panel is still mounted, so the answer
 * is waiting when the user comes back to that video.
 */
export async function ask(videoId: string, question: string) {
  const text = question.trim();
  if (!text || inFlight.has(videoId)) return;

  appendMessage(videoId, { id: `u-${Date.now()}`, role: 'user', content: text });
  setDraft(videoId, '');
  inFlight.add(videoId);
  emit();

  try {
    const res = await askQuestion(videoId, text);
    appendMessage(videoId, {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: res.answer,
      sources: res.sources ?? [],
    });
  } catch (err: any) {
    appendMessage(videoId, {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: err?.message || 'Something went wrong asking that question.',
      failed: true,
    });
  } finally {
    inFlight.delete(videoId);
    emit();
  }
}
