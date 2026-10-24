import { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { Video, ChatSource, reprocessVideo, isUpload, uploadFilename } from '../lib/api';
import {
  subscribe, getMessages, isSending, getDraft, setDraft, appendMessage, ask, clearConversation,
} from '../lib/conversations';
import {
  FiSend, FiLoader, FiExternalLink, FiMessageSquare,
  FiAlertCircle, FiUser, FiFileText, FiPlay, FiRefreshCw, FiTrash2, FiCheck, FiX,
} from 'react-icons/fi';
import Wordmark from './Wordmark';

interface ChatPanelProps {
  video: Video;
}

const SUGGESTIONS = [
  'What is this video about?',
  'Summarize the key points.',
  '¿En qué momento menciona…?',
];

/**
 * Timed sources are rendered as jump links straight to that second on YouTube.
 * The timestamp and URL come from the stored chunk, not from the answer text, so
 * they cannot be off even if the model mistypes a time in its prose.
 */
function Sources({ sources }: { sources: ChatSource[] }) {
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;

  // An uploaded file has timestamps but nowhere to link to, so the moments are
  // still worth showing — just not as links.
  const timed = sources.filter((s) => s.timestamp);
  const byTime = [...timed].sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0));

  return (
    <div className="mt-2.5">
      {byTime.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span className="text-xs text-text-muted mr-0.5">
            {byTime.some((s) => s.url) ? 'Jump to:' : 'Said at:'}
          </span>
          {byTime.map((s) =>
            s.url ? (
              <a
                key={s.chunk_index}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open YouTube at ${s.timestamp} · ${(s.similarity * 100).toFixed(0)}% match`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent-muted border border-accent/30 text-xs text-accent hover:bg-accent hover:text-white transition-colors duration-150"
              >
                <FiPlay className="w-2.5 h-2.5" />
                {s.timestamp}
              </a>
            ) : (
              <span
                key={s.chunk_index}
                title={`${(s.similarity * 100).toFixed(0)}% match`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-tertiary border border-border-light text-xs text-text-secondary"
              >
                {s.timestamp}
              </span>
            ),
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors duration-150"
      >
        <FiFileText className="w-3 h-3" />
        {sources.length} transcript {sources.length === 1 ? 'chunk' : 'chunks'} used
        {byTime.length === 0 && ' · no timestamps stored'}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sources.map((s) => (
            <span
              key={s.chunk_index}
              className="px-2 py-0.5 rounded-md bg-bg-tertiary border border-border-light text-xs text-text-secondary"
            >
              {s.timestamp ? s.timestamp : `#${s.chunk_index}`} · {(s.similarity * 100).toFixed(0)}% match
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Makes URLs the model writes in its prose clickable. */
function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline break-all"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function ChatPanel({ video }: ChatPanelProps) {
  // The conversation lives in the store, not here, so it is still there after a
  // detour to another video — including an answer that landed while away.
  const messages = useSyncExternalStore(subscribe, () => getMessages(video.id));
  const sending = useSyncExternalStore(subscribe, () => isSending(video.id));
  const input = useSyncExternalStore(subscribe, () => getDraft(video.id));
  const [reindexing, setReindexing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isReady = video.status === 'done';

  // True once an answer came back with sources but no timestamps at all, meaning
  // this video was indexed before chunks carried timing. Keyed on `timestamp`,
  // not `url`: an uploaded file legitimately has timestamps and no link, and
  // keying on the link offered to re-index it forever.
  const missingTimestamps = messages.some(
    (m) => m.role === 'assistant' && m.sources && m.sources.length > 0 && !m.sources.some((s) => s.timestamp),
  );

  const reindex = async () => {
    setReindexing(true);
    try {
      await reprocessVideo(video.id);
      appendMessage(video.id, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: 'Re-indexed with timestamps. Ask again to get jump links.',
      });
    } catch (err: any) {
      appendMessage(video.id, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: err?.message || 'Re-index failed.',
        failed: true,
      });
    } finally {
      setReindexing(false);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (isReady) inputRef.current?.focus();
  }, [isReady, video.id]);

  const send = (text: string) => {
    if (!text.trim() || sending || !isReady) return;
    // Not awaited: the store owns the request, so leaving this video mid-answer
    // no longer throws the answer away.
    ask(video.id, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter makes a new line.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex flex-col h-screen min-w-0">
      {/* Wordmark — shrunk down, but present on every chat. */}
      <div className="flex items-center px-6 h-9 border-b border-border-light shrink-0">
        <Wordmark variant="compact" />
      </div>

      {/* Header */}
      <header className="flex items-center gap-3 px-6 h-14 border-b border-border shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-text-primary truncate">
            {video.title || (isUpload(video) ? uploadFilename(video) : 'Untitled video')}
          </h2>
          <p className="text-xs text-text-muted">
            {isReady
              ? isUpload(video)
                ? 'Uploaded file · transcribed by Speechmatics'
                : 'Ask anything about this transcript'
              : `Status: ${video.status}`}
          </p>
        </div>
        {/* Clear conversation — only when there are messages */}
        {isReady && messages.length > 0 && (
          confirmingClear ? (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-text-secondary mr-0.5">Clear chat?</span>
              <button
                onClick={() => { clearConversation(video.id); setConfirmingClear(false); }}
                title="Confirm clear"
                className="flex items-center justify-center w-6 h-6 rounded-md text-status-error hover:bg-status-error/15 transition-colors duration-150"
              >
                <FiCheck className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setConfirmingClear(false)}
                title="Cancel"
                className="flex items-center justify-center w-6 h-6 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors duration-150"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingClear(true)}
              title="Clear the conversation"
              className="flex items-center justify-center w-7 h-7 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors duration-150 shrink-0"
            >
              <FiTrash2 className="w-3.5 h-3.5" />
            </button>
          )
        )}
        {missingTimestamps && (
          <button
            onClick={reindex}
            disabled={reindexing}
            title="This video was indexed without timestamps. Re-index it to get jump links (uses one Bright Data record and takes 1–2 minutes)."
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-accent hover:bg-accent-muted disabled:opacity-50 transition-colors duration-150 shrink-0"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />
            {reindexing ? 'Re-indexing…' : 'Add timestamps'}
          </button>
        )}
        {/* Nothing to open for an uploaded file. */}
        {!isUpload(video) && (
          <a
            href={video.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors duration-150 shrink-0"
          >
            <FiExternalLink className="w-3.5 h-3.5" />
            Watch
          </a>
        )}
      </header>

      {/* Not chattable yet */}
      {!isReady ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            {video.status === 'error' ? (
              <>
                <FiAlertCircle className="w-8 h-8 text-status-error mx-auto mb-3" />
                <p className="text-sm text-text-primary font-medium mb-2">
                  This video could not be processed
                </p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {video.error_message || 'Unknown error'}
                </p>
              </>
            ) : (
              <>
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-text-primary font-medium mb-1">
                  Fetching the transcript…
                </p>
                <p className="text-xs text-text-muted">
                  Chat opens automatically when it finishes.
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-3xl mx-auto">
              {messages.length === 0 && (
                <div className="flex flex-col items-center text-center py-12">
                  <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center mb-4">
                    <FiMessageSquare className="w-5 h-5 text-accent" />
                  </div>
                  <p className="text-sm text-text-primary font-medium mb-1">
                    Chat with this transcript
                  </p>
                  <p className="text-xs text-text-muted mb-6">
                    Answers come only from what is said in the video.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-text-secondary hover:text-text-primary hover:border-border-light transition-colors duration-150"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className="mb-6 last:mb-0">
                  {m.role === 'user' ? (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-lg bg-bg-tertiary flex items-center justify-center shrink-0">
                        <FiUser className="w-3.5 h-3.5 text-text-secondary" />
                      </div>
                      <p className="text-sm text-text-primary leading-relaxed pt-1 whitespace-pre-wrap min-w-0">
                        {m.content}
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          m.failed ? 'bg-status-error/15' : 'bg-accent'
                        }`}
                      >
                        {m.failed ? (
                          <FiAlertCircle className="w-3.5 h-3.5 text-status-error" />
                        ) : (
                          <FiMessageSquare className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      <div className="min-w-0 pt-1">
                        <p
                          className={`text-sm leading-relaxed whitespace-pre-wrap ${
                            m.failed ? 'text-status-error' : 'text-text-primary'
                          }`}
                        >
                          <LinkifiedText text={m.content} />
                        </p>
                        {m.sources && <Sources sources={m.sources} />}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {sending && (
                <div className="flex gap-3 mb-6">
                  <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <FiLoader className="w-3.5 h-3.5 text-white animate-spin" />
                  </div>
                  <p className="text-sm text-text-muted pt-1">Searching the transcript…</p>
                </div>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="px-6 pb-6 shrink-0">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end gap-2 bg-surface border border-border rounded-xl px-4 py-3 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30 transition-all duration-200">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setDraft(video.id, e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about this video…"
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none resize-none max-h-32 leading-relaxed"
                  disabled={sending}
                />
                <button
                  onClick={() => send(input)}
                  disabled={sending || !input.trim()}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-95 shrink-0"
                >
                  {sending ? (
                    <FiLoader className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <FiSend className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-xs text-text-muted text-center">
                Each question is answered on its own — follow-ups don't carry context yet.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
