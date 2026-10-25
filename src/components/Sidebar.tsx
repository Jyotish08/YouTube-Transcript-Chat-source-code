import { useState } from 'react';
import { Video, isUpload, uploadFilename, isDemo } from '../lib/api';
import {
  FiPlus, FiLoader, FiCheckCircle, FiAlertCircle, FiClock,
  FiYoutube, FiSearch, FiMessageSquare, FiTrash2, FiX, FiCheck, FiFilm, FiZap, FiStar,
} from 'react-icons/fi';

interface SidebarProps {
  videos: Video[];
  loading: boolean;
  error: string | null;
  selectedVideoId: string | null;
  onSelectVideo: (video: Video) => void;
  onNewVideo: () => void;
  onDeleteVideo: (video: Video) => Promise<void>;
  isSubmissionOpen: boolean;
  /** Submission in flight, shown here so it stays visible from the chat view. */
  pendingLabel: string | null;
  submitError: string | null;
}

const STATUS_CONFIG: Record<Video['status'], { icon: typeof FiClock; label: string; color: string; spin?: boolean }> = {
  pending: { icon: FiClock, label: 'Queued', color: 'text-status-pending bg-status-pending/15' },
  downloading: { icon: FiLoader, label: 'Retrieving', color: 'text-status-processing bg-status-processing/15', spin: true },
  transcribing: { icon: FiLoader, label: 'Transcribing', color: 'text-status-processing bg-status-processing/15', spin: true },
  processing: { icon: FiLoader, label: 'Indexing', color: 'text-status-processing bg-status-processing/15', spin: true },
  done: { icon: FiCheckCircle, label: 'Ready', color: 'text-status-done bg-status-done/15' },
  error: { icon: FiAlertCircle, label: 'Failed', color: 'text-status-error bg-status-error/15' },
};

function StatusBadge({ status, isDemoVideo }: { status: Video['status']; isDemoVideo?: boolean }) {
  if (isDemoVideo) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-brand bg-brand/10 border border-brand/20">
        <FiZap className="w-2.5 h-2.5" />
        <span>PRELOADED</span>
      </span>
    );
  }

  const { icon: Icon, label, color, spin } =
    STATUS_CONFIG[status] ?? { icon: FiClock, label: status, color: 'text-text-muted bg-bg-tertiary' };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <Icon className={`w-3 h-3 ${spin ? 'animate-spin' : ''}`} />
      <span>{label}</span>
    </span>
  );
}

function formatTime(dateString: string) {
  try {
    const date = new Date(dateString);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  } catch {
    return '';
  }
}

function videoLabel(video: Video) {
  if (video.title) return video.title;
  if (isUpload(video)) return uploadFilename(video);
  try {
    const url = new URL(video.youtube_url);
    return url.searchParams.get('v') || url.pathname.slice(1) || video.youtube_url;
  } catch {
    return video.youtube_url;
  }
}

export default function Sidebar({
  videos, loading, error, selectedVideoId, onSelectVideo, onNewVideo, onDeleteVideo, isSubmissionOpen,
  pendingLabel, submitError,
}: SidebarProps) {
  const [query, setQuery] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const remove = async (video: Video) => {
    setDeletingId(video.id);
    try {
      await onDeleteVideo(video);
      setConfirmingId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const term = query.trim().toLowerCase();
  const filtered = term
    ? videos.filter((v) => videoLabel(v).toLowerCase().includes(term))
    : videos;

  const demoVideos = filtered.filter((v) => isDemo(v));
  const userVideos = filtered.filter((v) => !isDemo(v));
  const readyCount = videos.filter((v) => v.status === 'done').length;

  const pendingRowLanded =
    pendingLabel !== null &&
    videos.some((v) => v.youtube_url === pendingLabel || videoLabel(v) === pendingLabel);
  const showPendingRow = pendingLabel !== null && !pendingRowLanded;

  const handleQuickJudgeAccess = () => {
    const devpostDemo = demoVideos.find((d) => d.id === 'demo-devpost-judging') || demoVideos[0];
    if (devpostDemo) {
      onSelectVideo(devpostDemo);
    } else {
      onNewVideo();
    }
  };

  return (
    <aside className="w-80 h-screen bg-bg-secondary border-r border-border flex flex-col shrink-0 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
        <button
          onClick={onNewVideo}
          className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-85 transition-opacity"
        >
          <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center shrink-0 shadow-sm">
            <FiYoutube className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-mono font-bold text-sm text-text-primary leading-tight">Askable</p>
            <p className="text-[11px] text-text-muted leading-tight">
              {readyCount} session{readyCount === 1 ? '' : 's'} ready
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleQuickJudgeAccess}
            title="Instant Judge Sandbox Mode"
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-brand/15 text-brand hover:bg-brand/25 text-[11px] font-mono font-semibold transition-colors border border-brand/30"
          >
            <FiZap className="w-3 h-3" />
            <span>Judge Demo</span>
          </button>

          <button
            onClick={onNewVideo}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150 shrink-0 ${
              isSubmissionOpen
                ? 'bg-accent text-white'
                : 'hover:bg-bg-hover text-text-secondary hover:text-text-primary'
            }`}
            title="Add a new video"
          >
            <FiPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      {videos.length > 3 && (
        <div className="px-3 py-2 border-b border-border-light shrink-0">
          <div className="flex items-center gap-2 bg-bg-primary border border-border rounded-lg px-2.5 py-1.5 focus-within:border-accent transition-colors duration-150">
            <FiSearch className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter sessions…"
              className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted outline-none min-w-0"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-text-muted hover:text-text-primary">
                <FiX className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Video list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
        {/* Pending Ingestion Row */}
        {showPendingRow && (
          <div className="flex items-center gap-2.5 px-4 py-3 mx-2 mb-2 rounded-lg bg-surface border border-accent/30 animate-pulse">
            <FiLoader className="w-3.5 h-3.5 text-accent animate-spin shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-text-primary truncate">{pendingLabel}</p>
              <p className="text-[10px] text-text-muted">Transcribing in background…</p>
            </div>
          </div>
        )}

        {submitError && (
          <div className="px-4 py-2 mx-2 mb-2 rounded-lg bg-status-error/10 border border-status-error/20">
            <p className="text-xs text-status-error">{submitError}</p>
          </div>
        )}

        {loading && videos.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <FiLoader className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        )}

        {error && (
          <div className="px-4 py-2 mx-2 mb-2 rounded-lg bg-status-error/10 border border-status-error/20">
            <p className="text-xs text-status-error">{error}</p>
          </div>
        )}

        {/* --- SECTION 1: FEATURED DEMO SESSIONS --- */}
        {demoVideos.length > 0 && (
          <div className="mb-4">
            <div className="px-4 py-1.5 flex items-center justify-between text-[10px] font-mono font-semibold tracking-wider text-text-muted uppercase">
              <span className="flex items-center gap-1.5">
                <FiStar className="w-3 h-3 text-brand" />
                Featured Demos (0s Wait)
              </span>
              <span className="text-[9px] text-brand bg-brand/10 px-1.5 py-0.2 rounded border border-brand/20">
                Instant
              </span>
            </div>

            {demoVideos.map((video) => {
              const isSelected = video.id === selectedVideoId && !isSubmissionOpen;
              const isDevpost = video.id === 'demo-devpost-judging';

              return (
                <div
                  key={video.id}
                  className={`group relative border-l-2 transition-colors duration-150 mx-1 rounded-r-lg ${
                    isSelected
                      ? 'border-brand bg-brand/10'
                      : isDevpost
                        ? 'border-transparent hover:bg-bg-hover hover:border-brand/40 bg-surface/40'
                        : 'border-transparent hover:bg-bg-hover hover:border-border-light'
                  }`}
                >
                  <button
                    onClick={() => onSelectVideo(video)}
                    className="w-full text-left px-3 py-2.5 pr-8"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start gap-1.5">
                        <p className={`flex-1 text-xs font-medium leading-snug line-clamp-2 min-w-0 ${
                          isSelected ? 'text-brand font-semibold' : 'text-text-primary'
                        }`}>
                          {videoLabel(video)}
                        </p>
                        <FiMessageSquare
                          className={`w-3 h-3 shrink-0 mt-0.5 transition-opacity duration-150 ${
                            isSelected ? 'text-brand opacity-100' : 'text-text-muted opacity-0 group-hover:opacity-60'
                          }`}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={video.status} isDemoVideo />
                        {video.duration && (
                          <span className="text-[10px] text-text-muted">{video.duration}</span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* --- SECTION 2: YOUR INGESTED VIDEOS --- */}
        <div>
          <div className="px-4 py-1.5 flex items-center justify-between text-[10px] font-mono font-semibold tracking-wider text-text-muted uppercase">
            <span>Your Ingested Videos</span>
            <span className="text-[10px]">{userVideos.length}</span>
          </div>

          {userVideos.length === 0 && !showPendingRow && (
            <div className="px-4 py-3 mx-2 my-1 rounded-lg bg-surface/30 border border-dashed border-border/70 text-center">
              <p className="text-[11px] text-text-secondary mb-1">No custom videos added yet</p>
              <button
                onClick={onNewVideo}
                className="text-[10px] text-accent hover:underline font-medium"
              >
                + Ingest a YouTube URL or MP4
              </button>
            </div>
          )}

          {userVideos.map((video) => {
            const isSelected = video.id === selectedVideoId && !isSubmissionOpen;
            const isReady = video.status === 'done';
            const isConfirming = confirmingId === video.id;
            const isDeleting = deletingId === video.id;

            return (
              <div
                key={video.id}
                className={`group relative border-l-2 transition-colors duration-150 mx-1 rounded-r-lg ${
                  isSelected
                    ? 'border-accent bg-bg-hover'
                    : 'border-transparent hover:bg-bg-hover hover:border-border-light'
                } ${isDeleting ? 'opacity-50' : ''}`}
              >
                <button
                  onClick={() => onSelectVideo(video)}
                  disabled={isDeleting}
                  className="w-full text-left px-3 py-2.5 pr-14"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-start gap-1.5">
                      {isUpload(video) && (
                        <FiFilm className="w-3 h-3 text-text-muted shrink-0 mt-0.5" title="Uploaded file" />
                      )}
                      <p className="flex-1 text-xs text-text-primary leading-snug line-clamp-2 min-w-0">
                        {videoLabel(video)}
                      </p>
                      {isReady && (
                        <FiMessageSquare
                          className={`w-3 h-3 shrink-0 mt-0.5 transition-opacity duration-150 ${
                            isSelected ? 'text-accent opacity-100' : 'text-text-muted opacity-0 group-hover:opacity-50'
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={video.status} />
                      <span className="text-[10px] text-text-muted">{formatTime(video.created_at)}</span>
                    </div>
                  </div>
                </button>

                {/* Row actions */}
                <div className="absolute top-2.5 right-2 flex items-center gap-0.5">
                  {isConfirming ? (
                    <>
                      <button
                        onClick={() => remove(video)}
                        disabled={isDeleting}
                        title="Confirm delete"
                        className="flex items-center justify-center w-5 h-5 rounded text-status-error hover:bg-status-error/15 transition-colors"
                      >
                        <FiCheck className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        disabled={isDeleting}
                        title="Cancel"
                        className="flex items-center justify-center w-5 h-5 rounded text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
                      >
                        <FiX className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmingId(video.id)}
                      disabled={isDeleting}
                      title="Delete video"
                      className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-6 h-6 rounded text-text-muted hover:text-status-error hover:bg-status-error/10 transition-all duration-150"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
