import { useState, useRef } from 'react';
import { UPLOAD_MAX_BYTES } from '../lib/api';
import type { SubmissionInput } from '../App';
import {
  FiLink, FiSend, FiLoader, FiUploadCloud, FiFilm, FiX,
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
}

type Mode = 'url' | 'file';

const MAX_MB = UPLOAD_MAX_BYTES / 1024 / 1024;

export default function VideoSubmission({
  onSubmit, submitting, pendingLabel, error, onDismissError,
}: VideoSubmissionProps) {
  const [mode, setMode] = useState<Mode>('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  // Client-side rejections (wrong type, too big) never reach App, so they live
  // here; whichever error is newer is the one shown.
  const [localError, setLocalError] = useState<string | null>(null);
  const shownError = localError ?? error;
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setError = setLocalError;
  const clearErrors = () => {
    setLocalError(null);
    if (error) onDismissError();
  };

  /** Rejects here rather than after a 20 MB round trip that ends in a 413. */
  const pickFile = (candidate: File | null) => {
    if (!candidate) return;
    const isVideo = candidate.type.startsWith('video/') || /\.(mp4|m4v|mov|webm)$/i.test(candidate.name);
    if (!isVideo) {
      setError('That does not look like a video file. Use an MP4.');
      return;
    }
    if (candidate.size > UPLOAD_MAX_BYTES) {
      setError(`${candidate.name} is ${(candidate.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setFile(candidate);
  };

  // Hands off and returns: App keeps the request alive from here, so the fields
  // are cleared right away and this component is free to unmount.
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

    const isValid =
      /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/.test(trimmed);
    if (!isValid) {
      setError('Please enter a valid YouTube URL (youtube.com/watch?v=... or youtu.be/...)');
      return;
    }

    clearErrors();
    onSubmit({ kind: 'url', value: trimmed });
    setUrl('');
  };

  const tabClass = (active: boolean) =>
    `flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors duration-150 ${
      active
        ? 'bg-surface text-text-primary border border-border'
        : 'text-text-secondary hover:text-text-primary border border-transparent'
    }`;

  return (
    <div className="flex-1 flex items-center justify-center bg-bg-primary">
      <div className="w-full max-w-2xl mx-auto px-6">
        {/* Wordmark — the landing page carries it at full size. */}
        <div className="mb-10">
          <Wordmark variant="hero" />
        </div>

        {/* Source picker */}
        <div className="flex gap-1 p-1 mb-4 bg-bg-secondary rounded-xl">
          <button
            type="button"
            onClick={() => { setMode('url'); clearErrors(); }}
            disabled={submitting}
            className={tabClass(mode === 'url')}
          >
            <FiLink className="w-3.5 h-3.5" />
            YouTube URL
          </button>
          <button
            type="button"
            onClick={() => { setMode('file'); clearErrors(); }}
            disabled={submitting}
            className={tabClass(mode === 'file')}
          >
            <FiUploadCloud className="w-3.5 h-3.5" />
            Upload MP4
          </button>
        </div>

        {/* Driven by App's state, so leaving the form and coming back shows the
            same progress instead of an empty form. */}
        {submitting && pendingLabel ? (
          <div className="flex items-center gap-3 bg-surface border border-border rounded-xl px-4 py-3">
            <FiLoader className="w-5 h-5 text-accent shrink-0 animate-spin" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-text-primary truncate">{pendingLabel}</p>
              <p className="text-xs text-text-muted">Transcribing — this keeps running if you go elsewhere</p>
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
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                disabled={submitting}
                autoFocus
              />
              <button
                type="submit"
                disabled={submitting || !url.trim()}
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-95"
              >
                {submitting
                  ? <FiLoader className="w-4 h-4 text-white animate-spin" />
                  : <FiSend className="w-4 h-4 text-white" />}
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
                    className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 active:scale-95 shrink-0"
                  >
                    {submitting
                      ? <FiLoader className="w-4 h-4 text-white animate-spin" />
                      : <FiSend className="w-4 h-4 text-white" />}
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
                  <span className="text-sm text-text-primary">Drop an MP4 here, or click to choose</span>
                  <span className="text-xs text-text-muted">Up to {MAX_MB} MB · transcribed by Speechmatics</span>
                </button>
              )}
            </>
          )}
        </form>
        )}

        {/* Error */}
        {shownError && (
          <div className="mt-4 px-4 py-2.5 rounded-lg bg-status-error/10 border border-status-error/20">
            <p className="text-xs text-status-error font-medium">{shownError}</p>
          </div>
        )}

        {/* Tip — the request still waits for the transcript, so the tab has to
            stay open; only this view is free to be navigated away from. */}
        <p className="mt-6 text-xs text-text-muted text-center">
          {submitting
            ? 'Keep this tab open — but feel free to open another video and keep chatting meanwhile.'
            : mode === 'file'
              ? 'Speechmatics transcribes the audio, so no captions are needed.'
              : 'Works with any public YouTube video that has captions.'}
        </p>
      </div>
    </div>
  );
}
