import { useState, useRef } from 'react';
import { UPLOAD_MAX_BYTES, extractYouTubeId, Video } from '../lib/api';
import { DEMO_VIDEOS, DemoVideoData } from '../lib/demoData';
import type { SubmissionInput } from '../App';
import {
  FiLink, FiSend, FiLoader, FiUploadCloud, FiFilm, FiX, FiZap, FiPlay, FiCheckCircle,
} from 'react-icons/fi';
import Wordmark from './Wordmark';

interface VideoSubmissionProps {
  /** Hands the submission to App, which owns the request so this can unmount. */
  onSubmit: (input: SubmissionInput) => void;
  submitting: boolean;
  /** Filename or URL of the submission in flight, if any. */
  pendingLabel: string | null;
  /** Failure reported by App; local validation errors are kept separately. */
  error: string | null;
  onDismissError: () => void;
  onSelectDemo?: (demoVideo: Video) => void;
}

type Mode = 'url' | 'file';

const MAX_MB = UPLOAD_MAX_BYTES / 1024 / 1024;

export default function VideoSubmission({
  onSubmit, submitting, pendingLabel, error, onDismissError, onSelectDemo,
}: VideoSubmissionProps) {
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const shownError = localError ?? error;
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setError = setLocalError;
  const clearErrors = () => {
    setLocalError(null);
    if (error) onDismissError();
  };

  /** Defensive file picker */
  const pickFile = (candidate: File | null) => {
    if (!candidate) return;
    const isVideo = candidate.type.startsWith('video/') || /\.(mp4|m4v|mov|webm)$/i.test(candidate.name);
    if (!isVideo) {
      setError('Please provide an MP4 or video recording file.');
      return;
    }
    if (candidate.size > UPLOAD_MAX_BYTES) {
      setError(`${candidate.name} is ${(candidate.size / 1024 / 1024).toFixed(1)} MB — maximum supported size is ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setFile(candidate);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (mode === 'file') {
      if (!file) return;
      clearErrors();
      onSubmit({ kind: 'file', value: file });
      setFile(null);
      return;
    }

    const trimmed = url.trim();
    if (!trimmed) return;

    // Use robust YouTube extractor supporting standard, short, shorts, embed, mobile
    const videoId = extractYouTubeId(trimmed);
    if (!videoId) {
      setError('Please enter a valid YouTube video link (e.g. youtube.com/watch?v=... or youtu.be/...). Or test instantly with a demo below.');
      return;
    }

    clearErrors();
    // Normalize to standard watch URL
    const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;
    onSubmit({ kind: 'url', value: normalizedUrl });
    setUrl('');
  };

  const tabClass = (active: boolean) =>
    `flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors duration-150 ${
      active
        ? 'bg-surface text-text-primary border border-border shadow-sm'
        : 'text-text-secondary hover:text-text-primary border border-transparent'
    }`;

  return (
    <div className="flex-1 overflow-y-auto bg-bg-primary py-12 px-6">
      <div className="w-full max-w-2xl mx-auto">
        {/* Wordmark & 5-Second Hero */}
        <div className="mb-8">
          <Wordmark variant="hero" />
        </div>

        {/* --- JUDGE QUICK ACCESS SANDBOX --- */}
        <div className="mb-8 p-5 rounded-2xl bg-gradient-to-b from-surface to-bg-secondary border border-brand/30 shadow-xl shadow-brand/5">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-brand animate-pulse" />
              <span className="font-mono text-xs font-bold tracking-wider text-brand uppercase">
                Judge Quick Access · Instant Sandbox
              </span>
            </div>
            <span className="text-[11px] font-medium text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-full">
              Zero Wait · Pre-indexed Data
            </span>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed mb-4">
            Skip the 2-minute transcription wait! Experience the core interactive Q&A and exact timecode deep-linking immediately:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {DEMO_VIDEOS.map((demo) => {
              const isDevpost = demo.id === 'demo-devpost-judging';
              return (
                <button
                  key={demo.id}
                  type="button"
                  onClick={() => onSelectDemo?.(demo)}
                  className={`text-left p-3 rounded-xl border transition-all duration-200 group flex flex-col justify-between ${
                    isDevpost
                      ? 'bg-brand/10 border-brand/40 hover:border-brand hover:bg-brand/15'
                      : 'bg-bg-primary/80 border-border hover:border-border-light hover:bg-bg-hover'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className={`text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded ${
                        isDevpost ? 'bg-brand/20 text-brand' : 'bg-bg-tertiary text-text-muted'
                      }`}>
                        {demo.tag}
                      </span>
                      <span className="text-[10px] text-text-muted">{demo.duration}</span>
                    </div>
                    <p className="text-xs font-semibold text-text-primary group-hover:text-brand transition-colors line-clamp-2 leading-snug mb-1">
                      {demo.title}
                    </p>
                    <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">
                      {demo.author}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-accent font-medium">
                    <span className="inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <FiPlay className="w-2.5 h-2.5" />
                      Launch Chat
                    </span>
                    <FiCheckCircle className="w-3 h-3 text-status-done shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Submission Header */}
        <div className="mb-3">
          <h2 className="text-xs font-mono font-semibold tracking-wider text-text-secondary uppercase">
            Or Index A New Video
          </h2>
        </div>

        {/* Source picker */}
        <div className="flex gap-1 p-1 mb-4 bg-bg-secondary rounded-xl border border-border">
          <button
            type="button"
            onClick={() => { setMode('url'); clearErrors(); }}
            disabled={submitting}
            className={tabClass(mode === 'url')}
          >
            <FiLink className="w-3.5 h-3.5" />
            YouTube Link
          </button>
          <button
            type="button"
            onClick={() => { setMode('file'); clearErrors(); }}
            disabled={submitting}
            className={tabClass(mode === 'file')}
          >
            <FiUploadCloud className="w-3.5 h-3.5" />
            Upload Video File (MP4)
          </button>
        </div>

        {/* Submission in-flight or Input Form */}
        {submitting && pendingLabel ? (
          <div className="flex items-center gap-3 bg-surface border border-accent/40 rounded-xl px-4 py-4 shadow-lg">
            <FiLoader className="w-5 h-5 text-accent shrink-0 animate-spin" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary truncate">{pendingLabel}</p>
              <p className="text-xs text-text-muted">
                Processing in background — feel free to explore the demo sandboxes above while this completes.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {mode === 'url' ? (
              <div className="flex items-center gap-2 bg-surface border border-border rounded-xl px-4 py-3 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30 transition-all duration-200">
                <FiLink className="w-5 h-5 text-text-muted shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (shownError) clearErrors();
                  }}
                  placeholder="Paste any YouTube URL (e.g. youtube.com/watch?v=... or youtu.be/...)"
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                  disabled={submitting}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={submitting || !url.trim()}
                  title="Submit video for instant indexing"
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-95 shrink-0"
                >
                  {submitting ? (
                    <FiLoader className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <FiSend className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/*"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  disabled={submitting}
                />

                {file ? (
                  <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3">
                    <FiFilm className="w-5 h-5 text-accent shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-primary truncate">{file.name}</p>
                      <p className="text-xs text-text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    {!submitting && (
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        title="Choose another file"
                        className="flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors duration-150 shrink-0"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      title="Upload and transcribe"
                      className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-95 shrink-0"
                    >
                      {submitting ? (
                        <FiLoader className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <FiSend className="w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      pickFile(e.dataTransfer.files?.[0] ?? null);
                    }}
                    className={`w-full flex flex-col items-center gap-2 px-4 py-8 rounded-xl border border-dashed transition-colors duration-150 ${
                      dragging
                        ? 'border-accent bg-accent-muted'
                        : 'border-border bg-surface hover:border-border-light'
                    }`}
                  >
                    <FiUploadCloud className="w-6 h-6 text-text-muted" />
                    <span className="text-sm text-text-primary">Drop an MP4 video file here, or click to browse</span>
                    <span className="text-xs text-text-muted">Up to {MAX_MB} MB · Transcribed with word timings</span>
                  </button>
                )}
              </>
            )}
          </form>
        )}

        {/* Graceful defensive error alert */}
        {shownError && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-status-error/10 border border-status-error/25 flex items-start gap-2.5">
            <FiX className="w-4 h-4 text-status-error shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-status-error font-medium leading-relaxed">{shownError}</p>
            </div>
            <button
              type="button"
              onClick={clearErrors}
              className="text-status-error hover:opacity-80 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Sub-note */}
        <p className="mt-5 text-xs text-text-muted text-center leading-relaxed">
          {submitting
            ? 'Background processing is active — feel free to navigate to other videos.'
            : mode === 'file'
              ? 'Speechmatics speech-to-text transcribes the audio, so existing subtitles are not required.'
              : 'Works with any public YouTube video that has subtitles/captions.'}
        </p>
      </div>
    </div>
  );
}
