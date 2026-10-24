import { useState } from 'react';
import { Video, isUpload, uploadFilename } from '../lib/api';
import {
  FiPlus, FiLoader, FiCheckCircle, FiAlertCircle, FiClock,
  FiYoutube, FiSearch, FiMessageSquare, FiTrash2, FiExternalLink, FiX, FiCheck, FiFilm,
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
  pending: { icon: FiClock, label: 'Pending', color: 'text-status-pending bg-status-pending/15' },
  downloading: { icon: FiLoader, label: 'Fetching', color: 'text-status-processing bg-status-processing/15', spin: true },
  transcribing: { icon: FiLoader, label: 'Transcribing', color: 'text-status-processing bg-status-processing/15', spin: true },
  processing: { icon: FiLoader, label: 'Indexing', color: 'text-status-processing bg-status-processing/15', spin: true },
  done: { icon: FiCheckCircle, label: 'Ready', color: 'text-status-done bg-status-done/15' },
  error: { icon: FiAlertCircle, label: 'Error', color: 'text-status-error bg-status-error/15' },
};

function StatusBadge({ status }: { status: Video['status'] }) {
  // Fall back instead of destructuring undefined: an unknown status coming from
  // the database would otherwise crash the whole sidebar.
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
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
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
  // Inline two-step confirm rather than window.confirm: a native dialog blocks
  // the page and is easy to fire off by accident.
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
  const shown = term
    ? videos.filter((v) => videoLabel(v).toLowerCase().includes(term))
    : videos;

  const readyCount = videos.filter((v) => v.status === 'done').length;

  // The submission gets its own row only until its real one lands, which is
  // matched by label (the row carries upload://<filename> or the URL itself).
  // Otherwise the same video would be listed twice for a few seconds.
  const pendingRowLanded =
    pendingLabel !== null &&
    videos.some((v) => v.youtube_url === pendingLabel || videoLabel(v) === pendingLabel);
  const showPendingRow = pendingLabel !== null && !pendingRowLanded;

  return (
    <aside className="w-80 h-screen bg-bg-secondary border-r border-border flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <FiYoutube className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-text-primary leading-tight">Askable</p>
            <p className="text-xs text-text-muted leading-tight">
              {readyCount} ready to chat
            </p>
          </div>
        </div>
        <button
          onClick={onNewVideo}
          className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150 shrink-0 ${
            isSubmissionOpen
              ? 'bg-accent text-white'
              : 'hover:bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
          title="Add a video"
        >
          <FiPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Search — only worth the space once there are a few videos */}
      {videos.length > 4 && (
        <div className="px-3 py-2 border-b border-border-light shrink-0">
          <div className="flex items-center gap-2 bg-bg-primary border border-border rounded-lg px-2.5 py-1.5 focus-within:border-accent transition-colors duration-150">
            <FiSearch className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search videos"
              className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted outline-none min-w-0"
            />
          </div>
        </div>
      )}

      {/* Video list */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* A submission has no row of its own until the backend inserts one;
            this stands in for it so the work is never invisible. */}
        {showPendingRow && (
          <div className="flex items-center gap-2 px-4 py-3 border-l-2 border-transparent">
            <FiLoader className="w-3.5 h-3.5 text-status-processing animate-spin shrink-0" />
            <div className="min-w-0">
              <p className="text-sm text-text-primary truncate">{pendingLabel}</p>
              <p className="text-xs text-text-muted">Starting — you can keep chatting</p>
            </div>
          </div>
        )}

        {submitError && (
          <div className="px-4 py-3">
            <p className="text-xs text-status-error">{submitError}</p>
          </div>
        )}

        {loading && videos.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <FiLoader className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        )}

        {error && (
          <div className="px-4 py-3">
            <p className="text-xs text-status-error">{error}</p>
          </div>
        )}

        {!loading && !error && videos.length === 0 && !showPendingRow && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <FiYoutube className="w-8 h-8 text-text-muted mb-3" />
            <p className="text-sm text-text-secondary font-medium mb-1">No videos yet</p>
            <p className="text-xs text-text-muted">
              Click <span className="text-accent">+</span> to add a YouTube URL and start chatting.
            </p>
          </div>
        )}

        {!loading && videos.length > 0 && shown.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-text-muted">No videos match “{query}”.</p>
          </div>
        )}

        {shown.map((video) => {
          const isSelected = video.id === selectedVideoId && !isSubmissionOpen;
          const isReady = video.status === 'done';
          const isConfirming = confirmingId === video.id;
          const isDeleting = deletingId === video.id;

          // A div, not a button: the row holds a link and a delete button, and
          // nesting those inside a button is invalid and breaks their clicks.
          return (
            <div
              key={video.id}
              className={`group relative border-l-2 transition-colors duration-150 ${
                isSelected
                  ? 'border-accent bg-bg-hover'
                  : 'border-transparent hover:bg-bg-hover hover:border-border-light'
              } ${isDeleting ? 'opacity-50' : ''}`}
            >
              <button
                onClick={() => onSelectVideo(video)}
                disabled={isDeleting}
                className="w-full text-left px-4 py-3 pr-16"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-start gap-2">
                    {isUpload(video) && (
                      <FiFilm className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" title="Uploaded file" />
                    )}
                    <p className="flex-1 text-sm text-text-primary leading-snug line-clamp-2 min-w-0">
                      {videoLabel(video)}
                    </p>
                    {isReady && (
                      <FiMessageSquare
                        className={`w-3.5 h-3.5 shrink-0 mt-0.5 transition-opacity duration-150 ${
                          isSelected ? 'text-accent opacity-100' : 'text-text-muted opacity-0'
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={video.status} />
                    <span className="text-xs text-text-muted">{formatTime(video.created_at)}</span>
                  </div>
                </div>
              </button>

              {/* Row actions, kept outside the button above */}
              <div className="absolute top-2.5 right-2 flex items-center gap-0.5">
                {isConfirming ? (
                  <>
                    <span className="text-xs text-text-secondary mr-1">Delete?</span>
                    <button
                      onClick={() => remove(video)}
                      disabled={isDeleting}
                      title="Confirm delete"
                      className="flex items-center justify-center w-6 h-6 rounded-md text-status-error hover:bg-status-error/15 transition-colors duration-150"
                    >
                      {isDeleting
                        ? <FiLoader className="w-3.5 h-3.5 animate-spin" />
                        : <FiCheck className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setConfirmingId(null)}
                      disabled={isDeleting}
                      title="Cancel"
                      className="flex items-center justify-center w-6 h-6 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors duration-150"
                    >
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                    {/* Uploads have no page to open; upload:// is not a link. */}
                    {!isUpload(video) && (
                      <a
                        href={video.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Open on YouTube — ${video.youtube_url}`}
                        className="flex items-center justify-center w-6 h-6 rounded-md text-text-muted hover:text-accent hover:bg-bg-tertiary transition-colors duration-150"
                      >
                        <FiExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => setConfirmingId(video.id)}
                      title="Delete this video and its transcript"
                      className="flex items-center justify-center w-6 h-6 rounded-md text-text-muted hover:text-status-error hover:bg-status-error/15 transition-colors duration-150"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
