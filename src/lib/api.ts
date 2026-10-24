import { supabase } from './supabase';

export interface Video {
  id: string;
  youtube_url: string;
  title: string | null;
  // 'processing' is set while the transcript is being chunked and embedded; it
  // also acts as the lock that stops a second resume call from re-ingesting.
  status: 'pending' | 'downloading' | 'transcribing' | 'processing' | 'done' | 'error';
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptMatch {
  id: string;
  video_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
}

export interface ChatSource {
  chunk_index: number;
  similarity: number;
  /** Present only for videos stored with timing; see isTimedChunk in chat-agent. */
  start_seconds?: number;
  /** m:ss, ready to display. */
  timestamp?: string;
  /** YouTube URL already pointing at start_seconds. */
  url?: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  video_title: string;
}

const EDGE_FUNCTION_BASE = 'https://tpiohvdmwkqndgifwngg.supabase.co/functions/v1';

/**
 * Submit a YouTube URL for processing.
 */
export interface SubmitVideoResponse {
  video_id: string;
  /** 'done' when the transcript landed within the request, else 'transcribing'. */
  status?: string;
  error_message?: string;
  /** Present when the Bright Data snapshot needs resumeVideo() to finish. */
  snapshot_id?: string;
  resumable?: boolean;
}

// The function replies with {video_id, status, ...}, not a full videos row, so
// the old Promise<Video> annotation was wrong.
export async function submitVideo(youtubeUrl: string): Promise<SubmitVideoResponse> {
  const response = await fetch(`${EDGE_FUNCTION_BASE}/process-video-v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ youtube_url: youtubeUrl }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Nudge a video that is waiting on a Bright Data snapshot.
 *
 * A collection can outlive the invocation that started it (measured 52s and
 * 126s for the same video), which leaves the row in 'transcribing' holding its
 * snapshot id. This picks it up and finishes the transcript. Safe to call
 * repeatedly: it returns {status: 'done'} once there is nothing left to do.
 */
export async function resumeVideo(videoId: string): Promise<{ status?: string }> {
  const response = await fetch(`${EDGE_FUNCTION_BASE}/process-video-v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: videoId }),
  });
  if (!response.ok) return {};
  return response.json().catch(() => ({}));
}

/** Largest file the Edge Function accepts; keep in step with UPLOAD_MAX_BYTES. */
export const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

/** Uploaded sources are stored as upload://<filename> instead of a video URL. */
export function isUpload(video: Video): boolean {
  return video.youtube_url.startsWith('upload://');
}

export function uploadFilename(video: Video): string {
  return video.youtube_url.replace(/^upload:\/\//, '');
}

/**
 * Sends a media file to be transcribed by Speechmatics.
 *
 * Multipart, not JSON: the bytes go straight through the function to
 * Speechmatics, since this project has no storage bucket to stage them in.
 */
export async function uploadVideoFile(file: File): Promise<SubmitVideoResponse> {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${EDGE_FUNCTION_BASE}/process-video-v2`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Deletes a video and its transcript chunks.
 *
 * Goes through the Edge Function rather than supabase.from('videos').delete():
 * RLS denies deletes to the anon key, and PostgREST reports success while
 * removing nothing, so a client-side delete fails silently.
 */
export async function deleteVideo(videoId: string): Promise<void> {
  const response = await fetch(`${EDGE_FUNCTION_BASE}/process-video-v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: videoId, action: 'delete' }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
}

/**
 * Re-runs a finished video through the pipeline, replacing its chunks.
 *
 * Needed for videos stored before chunks carried timestamps: their transcript
 * has no timing, so no jump links can be built until they are re-indexed.
 * Costs one Bright Data record per call.
 */
export async function reprocessVideo(videoId: string): Promise<{ status?: string }> {
  const response = await fetch(`${EDGE_FUNCTION_BASE}/process-video-v2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: videoId, force: true }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  return response.json().catch(() => ({}));
}

/**
 * Fetch all videos ordered by creation date.
 */
export async function fetchVideos(): Promise<Video[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Fetch a single video by ID.
 */
export async function fetchVideo(videoId: string): Promise<Video | null> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Subscribe to real-time video status changes.
 * Returns an unsubscribe function.
 */
export function subscribeToVideo(
  videoId: string,
  onStatusChange: (video: Video) => void
) {
  const channel = supabase
    .channel(`video-${videoId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'videos',
        filter: `id=eq.${videoId}`,
      },
      (payload) => {
        onStatusChange(payload.new as Video);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Ask a question about a video via the chat-agent Edge Function.
 */
export async function askQuestion(
  videoId: string,
  question: string
): Promise<ChatResponse> {
  const response = await fetch(`${EDGE_FUNCTION_BASE}/chat-agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: videoId, question }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return response.json();
}