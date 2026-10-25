import { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { Video, ChatSource, reprocessVideo, isUpload, uploadFilename, extractYouTubeId } from '../lib/api';
import {
  subscribe, getMessages, isSending, getDraft, setDraft, appendMessage, ask, clearConversation,
} from '../lib/conversations';
import {
  FiSend, FiLoader, FiExternalLink, FiMessageSquare,
  FiAlertCircle, FiUser, FiFileText, FiPlay, FiRefreshCw, FiTrash2, FiCheck, FiX,
  FiTv, FiZap, FiInfo,
} from 'react-icons/fi';
import Wordmark from './Wordmark';

interface ChatPanelProps {
  video: Video;
}

const DEFAULT_SUGGESTIONS = [
  'What is this video about?',
  'Summarize the key takeaways.',
  'What are the most important conclusions?',
];

/**
 * Timed sources are rendered as jump links straight to that second on YouTube,
 * or synchronized with the inline video player.
 */
function Sources({
  sources,
  onSeek,
}: {
  sources: ChatSource[];
  onSeek?: (seconds: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;

  const timed = sources.filter((s) => s.timestamp);
  const byTime = [...timed].sort((a, b) => (a.start_seconds ?? 0) - (b.start_seconds ?? 0));

  return (
    <div className="mt-2.5">
      {byTime.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <span className="text-xs text-text-muted mr-0.5">
            {byTime.some((s) => s.url) ? 'Jump to moment:' : 'Spoken at:'}
          </span>
          {byTime.map((s) => (
            <div key={s.chunk_index} className="inline-flex items-center">
              {s.start_seconds != null && onSeek ? (
                <button
                  type="button"
                  onClick={() => onSeek(s.start_seconds!)}
                  title={`Play at ${s.timestamp} in player · ${(s.similarity * 100).toFixed(0)}% match`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-l-md bg-accent-muted border border-accent/30 text-xs text-accent hover:bg-accent hover:text-white transition-colors duration-150 font-mono"
                >
                  <FiPlay className="w-2.5 h-2.5" />
                  {s.timestamp}
                </button>
              ) : (
                <span
                  title={`${(s.similarity * 100).toFixed(0)}% match`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-l-md bg-bg-tertiary border border-border-light text-xs text-text-secondary font-mono"
                >
                  {s.timestamp}
                </span>
              )}
              {s.url && (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open externally on YouTube"
                  className="inline-flex items-center px-1.5 py-0.5 rounded-r-md bg-accent-muted/60 border-y border-r border-accent/30 text-accent hover:bg-accent hover:text-white transition-colors text-[10px]"
                >
                  <FiExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors duration-150"
      >
        <FiFileText className="w-3 h-3" />
        {sources.length} transcript excerpt{sources.length === 1 ? '' : 's'} used
        {byTime.length === 0 && ' · no timestamps recorded'}
      </button>

      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {sources.map((s) => (
            <span
              key={s.chunk_index}
              className="px-2 py-0.5 rounded-md bg-bg-tertiary border border-border-light text-xs text-text-secondary font-mono"
            >
              {s.timestamp ? s.timestamp : `#${s.chunk_index}`} · {(s.similarity * 100).toFixed(0)}% match
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Makes URLs the model writes in prose clickable. */
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
  const messages = useSyncExternalStore(subscribe, () => getMessages(video.id));
  const sending = useSyncExternalStore(subscribe, () => isSending(video.id));
  const input = useSyncExternalStore(subscribe, () => getDraft(video.id));
  const [reindexing, setReindexing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [seekSeconds, setSeekSeconds] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isReady = video.status === 'done';
  const youtubeId = !isUpload(video) ? extractYouTubeId(video.youtube_url) : null;
  const suggestions = video.suggestedQuestions && video.suggestedQuestions.length > 0
    ? video.suggestedQuestions
    : DEFAULT_SUGGESTIONS;

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
        content: 'Transcript re-indexed with exact timestamps. Ask any question to get direct jump links.',
      });
    } catch (err: any) {
      appendMessage(video.id, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: err?.message || 'Re-indexing failed.',
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
    ask(video.id, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleSeek = (seconds: number) => {
    setSeekSeconds(seconds);
    if (!showPlayer) setShowPlayer(true);
  };

  return (
    <div className="flex flex-col h-screen min-w-0 bg-bg-primary">
      {/* Wordmark banner */}
      <div className="flex items-center justify-between px-6 h-9 border-b border-border-light shrink-0">
        <Wordmark variant="compact" />
        {video.is_demo && (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-full font-semibold">
            <FiZap className="w-2.5 h-2.5" />
            JUDGE DEMO SANDBOX
          </span>
        )}
      </div>

      {/* Header */}
      <header className="flex items-center gap-3 px-6 h-14 border-b border-border shrink-0 bg-bg-secondary/40">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary truncate">
              {video.title || (isUpload(video) ? uploadFilename(video) : 'Untitled Video')}
            </h2>
            {video.duration && (
              <span className="text-[10px] text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded font-mono shrink-0">
                {video.duration}
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted truncate">
            {isReady
              ? video.summary || (isUpload(video)
                ? 'Uploaded media file · Transcribed with word timings'
                : 'Ask anything about what is said in this video')
              : `Status: ${video.status}`}
          </p>
        </div>

        {/* Video Player Toggle (if YouTube video) */}
        {youtubeId && (
          <button
            onClick={() => setShowPlayer((prev) => !prev)}
            title={showPlayer ? 'Hide embedded video player' : 'Show embedded video player'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 shrink-0 border ${
              showPlayer
                ? 'bg-brand/20 text-brand border-brand/40'
                : 'bg-surface text-text-secondary hover:text-text-primary border-border hover:border-border-light'
            }`}
          >
            <FiTv className="w-3.5 h-3.5" />
            <span>{showPlayer ? 'Close Player' : 'Watch Video'}</span>
          </button>
        )}

        {/* Clear conversation */}
        {isReady && messages.length > 0 && (
          confirmingClear ? (
            <div className="flex items-center gap-1 shrink-0 bg-surface px-2 py-1 rounded-lg border border-border">
              <span className="text-xs text-text-secondary mr-1">Clear chat?</span>
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
              title="Clear the conversation history"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors duration-150 shrink-0"
            >
              <FiTrash2 className="w-3.5 h-3.5" />
            </button>
          )
        )}

        {missingTimestamps && (
          <button
            onClick={reindex}
            disabled={reindexing}
            title="Re-index to generate deep timestamp links"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-accent hover:bg-accent-muted disabled:opacity-50 transition-colors duration-150 shrink-0"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${reindexing ? 'animate-spin' : ''}`} />
            {reindexing ? 'Re-indexing…' : 'Add Timecodes'}
          </button>
        )}

        {/* Watch externally */}
        {!isUpload(video) && (
          <a
            href={video.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open on YouTube"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors duration-150 shrink-0"
          >
            <FiExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">YouTube</span>
          </a>
        )}
      </header>

      {/* Embedded Video Player Drawer */}
      {showPlayer && youtubeId && (
        <div className="w-full bg-black/90 border-b border-border p-4 flex flex-col items-center shrink-0 transition-all duration-200">
          <div className="w-full max-w-2xl aspect-video rounded-xl overflow-hidden shadow-2xl border border-border">
            <iframe
              key={`player-${youtubeId}-${seekSeconds ?? 0}`}
              src={`https://www.youtube.com/embed/${youtubeId}?start=${seekSeconds ?? 0}&autoplay=1`}
              title={video.title || 'Video Player'}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="mt-2 flex items-center justify-between w-full max-w-2xl text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <FiInfo className="w-3.5 h-3.5 text-brand" />
              Clicking any timecode chip below immediately syncs this player to that second.
            </span>
            <button
              onClick={() => setShowPlayer(false)}
              className="text-text-muted hover:text-text-primary text-xs underline"
            >
              Hide Player
            </button>
          </div>
        </div>
      )}

      {/* Main chat body */}
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
                  {video.error_message || 'An error occurred during transcript retrieval.'}
                </p>
              </>
            ) : (
              <>
                <div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-text-primary font-medium mb-1">
                  Transcribing and indexing video…
                </p>
                <p className="text-xs text-text-muted">
                  The chat panel opens automatically when indexing finishes.
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
                <div className="flex flex-col items-center text-center py-10">
                  <div className="w-12 h-12 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-4 text-brand">
                    <FiMessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-semibold text-text-primary mb-1">
                    Interrogate this video transcript
                  </h3>
                  <p className="text-xs text-text-muted max-w-md mb-6 leading-relaxed">
                    Ask any question in plain language. Every answer is grounded directly in the spoken transcript and cites exact timecodes with instant jump links.
                  </p>

                  <div className="w-full max-w-xl">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-2.5">
                      Suggested Questions:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-text-secondary hover:text-text-primary hover:border-brand/40 hover:bg-brand/5 transition-all duration-150 text-left"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className="mb-6 last:mb-0">
                  {m.role === 'user' ? (
                    <div className="flex gap-3">
                      <div className="w-7 h-7 rounded-lg bg-bg-tertiary flex items-center justify-center shrink-0 border border-border">
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
                          m.failed ? 'bg-status-error/15' : 'bg-brand text-white shadow-sm'
                        }`}
                      >
                        {m.failed ? (
                          <FiAlertCircle className="w-3.5 h-3.5 text-status-error" />
                        ) : (
                          <FiMessageSquare className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div
                          className={`text-sm leading-relaxed whitespace-pre-wrap ${
                            m.failed ? 'text-status-error' : 'text-text-primary'
                          }`}
                        >
                          <LinkifiedText text={m.content} />
                        </div>
                        {m.sources && <Sources sources={m.sources} onSeek={handleSeek} />}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {sending && (
                <div className="flex gap-3 mb-6">
                  <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shrink-0 shadow-sm">
                    <FiLoader className="w-3.5 h-3.5 text-white animate-spin" />
                  </div>
                  <p className="text-sm text-text-muted pt-1">Scanning transcript and matching timestamps…</p>
                </div>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="px-6 pb-6 shrink-0">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end gap-2 bg-surface border border-border rounded-xl px-4 py-3 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand/30 transition-all duration-200 shadow-sm">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setDraft(video.id, e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask any question about this video (e.g. 'What are the main points?' or 'How many times did they say friction?')..."
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none resize-none max-h-32 leading-relaxed"
                  disabled={sending}
                />
                <button
                  onClick={() => send(input)}
                  disabled={sending || !input.trim()}
                  title="Send question"
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-95 shrink-0"
                >
                  {sending ? (
                    <FiLoader className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <FiSend className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted px-1">
                <span>Answers cite exact spoken seconds with jump links</span>
                <span>Enter ↵ to ask · Shift+Enter for new line</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
