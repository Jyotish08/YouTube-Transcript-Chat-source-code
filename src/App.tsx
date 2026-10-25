import { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import VideoSubmission from './components/VideoSubmission';
import ChatPanel from './components/ChatPanel';
import ErrorBoundary from './components/ErrorBoundary';
import {
  Video, fetchVideos, resumeVideo, deleteVideo, submitVideo, uploadVideoFile,
} from './lib/api';
import { clearConversation } from './lib/conversations';

/** What the user handed over, before there is a video row to point at. */
export type SubmissionInput =
  | { kind: 'url'; value: string }
  | { kind: 'file'; value: File };

export default function App() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [showSubmission, setShowSubmission] = useState(true);

  // The submission runs here rather than inside VideoSubmission so that walking
  // away from the form does not unmount the request in flight.
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedVideo = videos.find((v) => v.id === selectedVideoId) ?? null;

  const videosRef = useRef(videos);
  videosRef.current = videos;

  const onSubmissionRef = useRef(showSubmission);
  onSubmissionRef.current = showSubmission;

  const load = useCallback(async () => {
    try {
      const fresh = await fetchVideos();
      setVideos(fresh);
      setError(null);
      return fresh;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  // Keep in-flight non-demo videos moving.
  const pendingIds = videos
    .filter((v) => !v.id.startsWith('demo-') && v.status !== 'done' && v.status !== 'error')
    .map((v) => v.id)
    .join(',');

  const submitting = pendingLabel !== null;

  useEffect(() => {
    if (!pendingIds && !submitting) return;

    let cancelled = false;
    const tick = async () => {
      const stuck = videosRef.current.filter((v) => !v.id.startsWith('demo-') && v.status === 'transcribing');
      await Promise.all(stuck.map((v) => resumeVideo(v.id).catch(() => undefined)));
      if (!cancelled) await load();
    };

    const id = setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pendingIds, submitting, load]);

  useEffect(() => {
    if (!submitting) return;
    const timers = [1_500, 4_000].map((ms) => setTimeout(() => { load(); }, ms));
    return () => timers.forEach(clearTimeout);
  }, [submitting, load]);

  const handleSelectVideo = useCallback((video: Video) => {
    setSelectedVideoId(video.id);
    setShowSubmission(false);
  }, []);

  const handleNewVideo = useCallback(() => {
    setShowSubmission(true);
    setSelectedVideoId(null);
  }, []);

  const handleDeleteVideo = useCallback(
    async (video: Video) => {
      if (video.id.startsWith('demo-')) {
        setError('Preloaded judge demo sessions cannot be deleted.');
        return;
      }

      try {
        await deleteVideo(video.id);
        setVideos((prev) => prev.filter((v) => v.id !== video.id));
        clearConversation(video.id);
        setSelectedVideoId((current) => {
          if (current !== video.id) return current;
          setShowSubmission(true);
          return null;
        });
      } catch (err: any) {
        setError(err.message || 'Could not delete that video');
      }
      await load();
    },
    [load],
  );

  const handleSubmit = useCallback(
    async (input: SubmissionInput) => {
      if (pendingLabel) return;
      setPendingLabel(input.kind === 'file' ? input.value.name : input.value);
      setSubmitError(null);

      try {
        const result = input.kind === 'file'
          ? await uploadVideoFile(input.value)
          : await submitVideo(input.value);

        const fresh = await load();
        if (result?.video_id && fresh?.some((v) => v.id === result.video_id) && onSubmissionRef.current) {
          setSelectedVideoId(result.video_id);
          setShowSubmission(false);
        }
      } catch (err: any) {
        setSubmitError(err.message || 'Failed to submit video');
      } finally {
        setPendingLabel(null);
      }
    },
    [load, pendingLabel],
  );

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-bg-primary">
        <Sidebar
          videos={videos}
          loading={loading}
          error={error}
          selectedVideoId={selectedVideoId}
          onSelectVideo={handleSelectVideo}
          onNewVideo={handleNewVideo}
          onDeleteVideo={handleDeleteVideo}
          isSubmissionOpen={showSubmission}
          pendingLabel={pendingLabel}
          submitError={submitError}
        />

        <main className="flex-1 flex flex-col min-w-0">
          {showSubmission || !selectedVideo ? (
            <VideoSubmission
              onSubmit={handleSubmit}
              submitting={submitting}
              pendingLabel={pendingLabel}
              error={submitError}
              onDismissError={() => setSubmitError(null)}
              onSelectDemo={handleSelectVideo}
            />
          ) : (
            <ChatPanel video={selectedVideo} />
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}
