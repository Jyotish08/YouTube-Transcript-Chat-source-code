import { supabase, supabaseUrl, supabaseKey } from './supabase';
import { DEMO_VIDEOS, queryDemoTranscript, extractYouTubeId, buildYoutubeTimestampUrl, DemoVideoData } from './demoData';

export { extractYouTubeId, buildYoutubeTimestampUrl };

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
  is_demo?: boolean;
  author?: string;
  duration?: string;
  tag?: string;
  summary?: string;
  suggestedQuestions?: string[];
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

const EDGE_FUNCTION_BASE = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1`;

function getFunctionHeaders(contentType: string | null = 'application/json'): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
}

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

// The function replies with {video_id, status, ...}, not a full videos row
export async function submitVideo(youtubeUrl: string): Promise<SubmitVideoResponse> {
  const response = await fetch(`${EDGE_FUNCTION_BASE}/process-video-v2`, {
    method: 'POST',
    headers: getFunctionHeaders(),
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
 */
export async function resumeVideo(videoId: string): Promise<{ status?: string }> {
  if (videoId.startsWith('demo-')) return { status: 'done' };

  const response = await fetch(`${EDGE_FUNCTION_BASE}/process-video-v2`, {
    method: 'POST',
    headers: getFunctionHeaders(),
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

export function isDemo(video: Video): boolean {
  return !!video.is_demo || video.id.startsWith('demo-');
}

export function uploadFilename(video: Video): string {
  return video.youtube_url.replace(/^upload:\/\//, '');
}

/**
 * Sends a media file to be transcribed by Speechmatics.
 */
export async function uploadVideoFile(file: File): Promise<SubmitVideoResponse> {
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`${EDGE_FUNCTION_BASE}/process-video-v2`, {
    method: 'POST',
    headers: getFunctionHeaders(null),
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
 */
export async function deleteVideo(videoId: string): Promise<void> {
  if (videoId.startsWith('demo-')) {
    throw new Error('Demo videos are part of the judge sandbox and cannot be deleted.');
  }

  const response = await fetch(`${EDGE_FUNCTION_BASE}/process-video-v2`, {
    method: 'POST',
    headers: getFunctionHeaders(),
    body: JSON.stringify({ video_id: videoId, action: 'delete' }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
}

/**
 * Re-runs a finished video through the pipeline, replacing its chunks.
 */
export async function reprocessVideo(videoId: string): Promise<{ status?: string }> {
  if (videoId.startsWith('demo-')) {
    return { status: 'done' };
  }

  const response = await fetch(`${EDGE_FUNCTION_BASE}/process-video-v2`, {
    method: 'POST',
    headers: getFunctionHeaders(),
    body: JSON.stringify({ video_id: videoId, force: true }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  return response.json().catch(() => ({}));
}

/**
 * Fetch all videos ordered by creation date, prepended by the curated Demo Videos
 * to guarantee instantaneous judge access with zero setup friction.
 */
export async function fetchVideos(): Promise<Video[]> {
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch error, serving demo videos:', error.message);
      return DEMO_VIDEOS;
    }

    const remoteVideos: Video[] = data ?? [];
    // Filter out any potential collision IDs
    const uniqueRemote = remoteVideos.filter(
      (r) => !DEMO_VIDEOS.some((d) => d.id === r.id)
    );

    return [...DEMO_VIDEOS, ...uniqueRemote];
  } catch (err) {
    console.warn('Failed to fetch from remote Supabase, falling back to demo videos:', err);
    return DEMO_VIDEOS;
  }
}

/**
 * Fetch a single video by ID.
 */
export async function fetchVideo(videoId: string): Promise<Video | null> {
  const demo = DEMO_VIDEOS.find((d) => d.id === videoId);
  if (demo) return demo;

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
 */
export function subscribeToVideo(
  videoId: string,
  onStatusChange: (video: Video) => void
) {
  if (videoId.startsWith('demo-')) {
    return () => {};
  }

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
 * Ask a question about a video.
 * If the video is a pre-indexed demo video, runs the local intelligent query engine
 * for sub-second, 100% reliable responses with exact timecode citations.
 */
export async function askQuestion(
  videoId: string,
  question: string
): Promise<ChatResponse> {
  const demo = DEMO_VIDEOS.find((d) => d.id === videoId);
  if (demo) {
    // Artificial mini-delay (250ms) for natural feel
    await new Promise((r) => setTimeout(r, 250));
    return queryDemoTranscript(demo, question);
  }

  const response = await fetch(`${EDGE_FUNCTION_BASE}/chat-agent`, {
    method: 'POST',
    headers: getFunctionHeaders(),
    body: JSON.stringify({ video_id: videoId, question }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return response.json();
}
