import { useState, useCallback, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import VideoSubmission from './components/VideoSubmission';
import ChatPanel from './components/ChatPanel';
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
  // away from the form does not unmount the request that is in flight. The
  // label is what the sidebar and the form show while it runs; keeping it here
  // means the form can be closed and reopened without losing the progress.
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The list lives here, not in the sidebar, so the selected video is always the
  // freshly polled row. Otherwise the chat panel would hold a stale copy and
  // never notice that processing finished.
  const selectedVideo = videos.find((v) => v.id === selectedVideoId) ?? null;

  // Read by the polling interval below, which must not be torn down and
  // recreated on every refresh yet still needs the current rows.
  const videosRef = useRef(videos);
  videosRef.current = videos;

  // Whether the submission form is the visible panel, read when a submission
  // resolves: if the user has moved to a chat by then, we must not drag them
  // out of it. A ref because the check happens inside a long-lived promise.
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

  // Keeps in-flight videos moving. Two jobs while any row is not yet done or
  // errored: refresh the list so badges and the chat panel reflect reality, and
  // nudge rows parked in 'transcribing', whose Bright Data snapshot outlived the
  // invocation that started it and needs picking up to finish.
  const pendingIds = videos
    .filter((v) => v.status !== 'done' && v.status !== 'error')
    .map((v) => v.id)
    .join(',');

  // A submission in flight counts as pending even before its row exists: that
  // is exactly the window in which the sidebar would otherwise show nothing.
  const submitting = pendingLabel !== null;

  useEffect(() => {
    if (!pendingIds && !submitting) return;

    let cancelled = false;
    const tick = async () => {
      const stuck = videosRef.current.filter((v) => v.status === 'transcribing');
      await Promise.all(stuck.map((v) => resumeVideo(v.id).catch(() => undefined)));
      if (!cancelled) await load();
    };

    const id = setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pendingIds, submitting, load]);

  // The Edge Function inserts the row before it starts transcribing, so a
  // couple of early refreshes surface it in the sidebar in seconds instead of
  // waiting out a full 10s tick with no sign that anything is happening.
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
      try {
        await deleteVideo(video.id);
        // Drop it locally right away so the row does not linger until the next
        // fetch, and fall back to the submission view if it was open.
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

  // Runs the whole submission, including the wait, without blocking the rest of
  // the app: the sidebar stays live and any finished video can be opened and
  // chatted with while this is still going.
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
        // Land in the new video's chat only if the user is still sitting on the
        // form. If they went off to read another video meanwhile, leave them
        // there — the sidebar row is how they get to this one.
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
          />
        ) : (
          <ChatPanel video={selectedVideo} />
        )}
      </main>
    </div>
  );
}
