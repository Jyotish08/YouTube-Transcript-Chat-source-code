import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** ------------------------------------------------------------------ */
/**  Bright Data Web Unlocker helpers                                  */
/** ------------------------------------------------------------------ */

interface BrightDataBody {
  zone: string;
  url: string;
  format: 'raw' | 'json';
  method: 'GET' | 'POST';
  body?: string;
}

interface BrightDataResponse {
  status_code: number;
  body: string;
}

async function fetchViaBrightData(
  targetUrl: string,
  options?: { method?: 'GET' | 'POST'; format?: 'raw' | 'json'; body?: string },
): Promise<BrightDataResponse> {
  const apiKey = Deno.env.get('BRIGHTDATA_API_KEY');
  if (!apiKey) throw new Error('BRIGHTDATA_API_KEY not set');
  const zone = Deno.env.get('BRIGHTDATA_ZONE') || 'web_unlocker1';
  const payload: BrightDataBody = { zone, url: targetUrl, format: options?.format ?? 'raw', method: options?.method ?? 'GET' };
  if (options?.body) payload.body = options.body;
  const payloadStr = JSON.stringify(payload);

  // Use native fetch (HTTP/2). Avoid node:https which is unreliable in Supabase Edge Runtime.
  const resp = await fetch('https://api.brightdata.com/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: payloadStr,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Bright Data API HTTP ${resp.status}: ${text.slice(0, 300)}`);
  }
  const responseText = await resp.text();
  if (!responseText || !responseText.trim()) {
    throw new Error('Bright Data returned empty response');
  }
  const result: BrightDataResponse = JSON.parse(responseText);
  if (result.status_code !== 200) {
    throw new Error(`Bright Data target HTTP ${result.status_code}: ${result.body.slice(0, 200)}`);
  }
  return result;
}

/** ------------------------------------------------------------------ */
/**  YouTube player response extraction                                */
/** ------------------------------------------------------------------ */

interface AudioFormat {
  url?: string;
  signatureCipher?: string;
  cipher?: string;
  itag: number;
  mimeType: string;
  bitrate: number;
  contentLength?: string;
}

interface PlayerResponse {
  streamingData?: {
    adaptiveFormats: AudioFormat[];
    expiresInSeconds?: string;
  };
  videoDetails?: {
    title: string;
    videoId: string;
    lengthSeconds: string;
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: Array<{
        languageCode: string;
        baseUrl: string;
        name?: { simpleText?: string };
      }>;
    };
  };
  playabilityStatus?: {
    status: string;
    reason?: string;
  };
}

function extractPlayerResponse(html: string): PlayerResponse | null {
  const patterns = [
    /ytInitialPlayerResponse\s*=\s*({.+?});\s*(?:\n|<)/,
    /"ytInitialPlayerResponse":\s*({.+?}),\s*"/,
    /window\.ytInitialPlayerResponse\s*=\s*({.+?});/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try { return JSON.parse(match[1]); } catch { continue; }
    }
  }
  return null;
}

interface ResolvedStream {
  itag: number;
  mimeType: string;
  bitrate: number;
  urls: string[];
  contentLength?: string;
}

function extractAudioStreams(player: PlayerResponse): ResolvedStream[] {
  const formats = player.streamingData?.adaptiveFormats ?? [];
  const streams: ResolvedStream[] = [];

  for (const fmt of formats) {
    if (!fmt.mimeType?.startsWith('audio/')) continue;

    const urls: string[] = [];
    if (fmt.url) urls.push(fmt.url);

    const cipherStr = fmt.signatureCipher || fmt.cipher;
    if (cipherStr) {
      const params = new URLSearchParams(cipherStr);
      const cipherUrl = params.get('url');
      const signature = params.get('s') || params.get('sig') || '';

      if (cipherUrl) {
        const sp = params.get('sp') || 'sig';
        const sep = cipherUrl.includes('?') ? '&' : '?';
        urls.push(`${cipherUrl}${sep}${sp}=${signature}`);

        // Try common decipher operations
        for (const decipher of [
          (s: string) => s.split('').reverse().join(''),
          (s: string) => s.slice(2),
          (s: string) => s.slice(3),
          (s: string) => s.slice(0, -2),
          (s: string) => s.slice(0, -3),
          (s: string) => s[s.length - 1] + s.slice(1, -1) + s[0],
          (s: string) => s.slice(1),
        ]) {
          urls.push(`${cipherUrl}${sep}${sp}=${decipher(signature)}`);
        }
      }
    }

    if (urls.length > 0) {
      streams.push({
        itag: fmt.itag,
        mimeType: fmt.mimeType,
        bitrate: fmt.bitrate,
        urls,
        contentLength: fmt.contentLength,
      });
    }
  }

  streams.sort((a, b) => b.bitrate - a.bitrate);
  return streams;
}

/** ------------------------------------------------------------------ */
/**  Audio download helpers                                            */
/** ------------------------------------------------------------------ */

async function tryDownloadAudio(urls: string[]): Promise<{ data: Uint8Array; mimeType: string } | null> {
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120_000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      });
      clearTimeout(timer);

      if (!response.ok) {
        console.warn(`[process-video] Download attempt: HTTP ${response.status}`);
        continue;
      }

      const mimeType = response.headers.get('content-type') || 'audio/mp4';
      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      if (data.length < 1024) {
        console.warn(`[process-video] Audio too small (${data.length} bytes)`);
        continue;
      }

      console.log(`[process-video] Audio: ${(data.length / 1024 / 1024).toFixed(1)} MB (${mimeType})`);
      return { data, mimeType };
    } catch (err: any) {
      console.warn(`[process-video] Download fail: ${err.message?.slice(0, 100)}`);
      continue;
    }
  }
  return null;
}

/** ------------------------------------------------------------------ */
/**  Speechmatics batch transcription helpers                          */
/** ------------------------------------------------------------------ */

async function submitToSpeechmatics(audioUrl: string): Promise<string> {
  const apiKey = Deno.env.get('SPEECHMATICS_API_KEY');
  if (!apiKey) throw new Error('SPEECHMATICS_API_KEY not set');

  console.log('[process-video] Submitting to Speechmatics batch API...');

  const response = await fetch('https://asr.api.speechmatics.com/v2/jobs/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data_links: [audioUrl],
      config: {
        type: 'transcription',
        transcription_config: {
          language: 'en',
          enable_entities: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Speechmatics submit (${response.status}): ${text.slice(0, 300)}`);
  }

  const job: { id: string } = await response.json();
  console.log(`[process-video] Speechmatics job: ${job.id}`);
  return job.id;
}

async function pollSpeechmaticsJob(jobId: string, timeoutMs = 300_000): Promise<string> {
  const apiKey = Deno.env.get('SPEECHMATICS_API_KEY');
  if (!apiKey) throw new Error('SPEECHMATICS_API_KEY not set');

  const startTime = Date.now();
  const pollInterval = 3000;

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`https://asr.api.speechmatics.com/v2/jobs/${jobId}/`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        console.warn(`[process-video] Poll HTTP ${response.status}, retrying...`);
        await new Promise((r) => setTimeout(r, pollInterval));
        continue;
      }

      const status = await response.json();
      const jobStatus = status.job?.status || status.status;
      console.log(`[process-video] Speechmatics: ${jobStatus}`);

      if (jobStatus === 'done') {
        const transcriptResponse = await fetch(
          `https://asr.api.speechmatics.com/v2/jobs/${jobId}/transcript?format=txt`,
          { headers: { Authorization: `Bearer ${apiKey}` } },
        );
        if (!transcriptResponse.ok) {
          throw new Error(`Transcript fetch: HTTP ${transcriptResponse.status}`);
        }
        const text = await transcriptResponse.text();
        console.log(`[process-video] Transcript: ${text.length} chars`);
        return text;
      }

      if (jobStatus === 'error') {
        throw new Error(`Speechmatics failed: ${status.job?.error?.message || 'Unknown'}`);
      }

      await new Promise((r) => setTimeout(r, pollInterval));
    } catch (err: any) {
      if (err.message?.includes('Speechmatics failed')) throw err;
      console.warn(`[process-video] Poll error: ${err.message?.slice(0, 100)}`);
      await new Promise((r) => setTimeout(r, pollInterval));
    }
  }
  throw new Error(`Speechmatics job ${jobId} timed out`);
}

/** ------------------------------------------------------------------ */
/**  Embedding generation                                              */
/** ------------------------------------------------------------------ */

async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = Deno.env.get('AIMLAPI_KEY');
  if (!apiKey) throw new Error('AIMLAPI_KEY not set');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch('https://api.aimlapi.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: text, dimensions: 1536 }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`AI/ML API (${response.status}): ${errText.slice(0, 200)}`);
      }
      const result = await response.json();
      return result.data[0].embedding;
    } catch (err: any) {
      if (attempt === 3) throw err;
      const delay = 1000 * Math.pow(2, attempt - 1) + Math.random() * 1000;
      console.warn(`[process-video] Embedding retry ${attempt}/3: ${err.message?.slice(0, 100)}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Max embedding retries exceeded');
}

/** ------------------------------------------------------------------ */
/**  Transcript chunking                                               */
/** ------------------------------------------------------------------ */

function splitTranscript(text: string, maxSize: number): string[] {
  if (!text.trim()) return [];
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let current = '';
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const candidate = current ? current + ' ' + trimmed : trimmed;
    if (candidate.length > maxSize && current.length > 0) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** ------------------------------------------------------------------ */
/**  Main video processing pipeline                                    */
/** ------------------------------------------------------------------ */

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function processChunk(
  supabase: ReturnType<typeof createClient>,
  videoId: string,
  chunkText: string,
  chunkIndex: number,
) {
  try {
    const { data: transcript, error: insertErr } = await supabase
      .from('transcripts')
      .insert({ video_id: videoId, chunk_index: chunkIndex, content: chunkText, status: 'processing' })
      .select()
      .single();

    if (insertErr || !transcript) {
      console.error(`[process-video] Chunk ${chunkIndex} insert: ${insertErr?.message}`);
      return;
    }

    try {
      const embedding = await generateEmbedding(chunkText);
      await supabase.from('transcripts').update({ embedding, status: 'done' }).eq('id', transcript.id);
      console.log(`[process-video] Chunk ${chunkIndex + 1} embedded`);
    } catch (ee: any) {
      console.error(`[process-video] Chunk ${chunkIndex} embed failed: ${ee.message}`);
      await supabase.from('transcripts').update({ status: 'done' }).eq('id', transcript.id);
    }
  } catch (err: any) {
    console.error(`[process-video] processChunk: ${err.message}`);
  }
}

async function processVideo(
  supabase: ReturnType<typeof createClient>,
  videoId: string,
  youtubeUrl: string,
) {
  try {
    console.log(`[process-video] ==== Starting video ${videoId} ====`);
    await supabase.from('videos').update({ status: 'downloading' }).eq('id', videoId);

    const videoIdStr = extractVideoId(youtubeUrl);
    if (!videoIdStr) throw new Error(`Could not extract video ID from URL: ${youtubeUrl}`);
    console.log(`[process-video] youtubeId=${videoIdStr}`);

    // ---- STEP 1: Fetch YouTube page via Bright Data Web Unlocker ----
    console.log('[process-video] Fetching via Bright Data Web Unlocker...');
    const watchUrl = `https://www.youtube.com/watch?v=${videoIdStr}`;
    let brightDataResult = await fetchViaBrightData(watchUrl, { method: 'GET' });

    // ---- STEP 2: Extract player response ----
    let playerResponse = extractPlayerResponse(brightDataResult.body);

    if (!playerResponse) {
      console.log('[process-video] Retrying without JS render...');
      brightDataResult = await fetchViaBrightData(watchUrl, { method: 'GET' });
      playerResponse = extractPlayerResponse(brightDataResult.body);
    }

    if (!playerResponse) {
      console.log('[process-video] Trying InnerTube API via Bright Data...');
      const innerTubeBody = {
        context: {
          client: {
            hl: 'en', gl: 'US', clientName: 'WEB',
            clientVersion: '2.20260623.01.00', platform: 'DESKTOP',
          },
        },
        videoId: videoIdStr, contentCheckOk: true, racyCheckOk: true,
      };
      try {
        const itResult = await fetchViaBrightData(
          `https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8`,
          { method: 'POST', format: 'json', body: JSON.stringify(innerTubeBody) },
        );
        if (itResult.body) {
          try { playerResponse = JSON.parse(itResult.body); } catch { /* body might already be parsed */ }
        }
      } catch (err: any) {
        console.warn(`[process-video] InnerTube via BD: ${err.message}`);
      }
    }

    if (!playerResponse) {
      throw new Error('Could not retrieve YouTube player response. Video may be private, deleted, or region-restricted.');
    }

    const title = playerResponse.videoDetails?.title || 'Unknown Title';
    console.log(`[process-video] Title: "${title}"`);

    // ---- STEP 3: Extract audio streams ----
    const audioStreams = extractAudioStreams(playerResponse);
    console.log(`[process-video] Found ${audioStreams.length} audio streams`);

    if (audioStreams.length === 0) {
      // Fallback: captions
      console.log('[process-video] No audio streams, trying captions...');
      const captionTracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (captionTracks && captionTracks.length > 0) {
        const track = captionTracks.find((t) => t.languageCode === 'en') || captionTracks[0];
        if (track.baseUrl) {
          const capResp = await fetch(track.baseUrl + '&fmt=json3', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          if (capResp.ok) {
            const data = await capResp.json();
            const textParts: string[] = [];
            for (const event of data.events || []) {
              if (event.segs) for (const seg of event.segs) if (seg.utf8) textParts.push(seg.utf8);
            }
            const captionText = textParts.join(' ').replace(/\s+/g, ' ').trim();
            if (captionText) {
              console.log(`[process-video] ${captionText.length} chars from captions`);
              await supabase.from('videos').update({ title, status: 'transcribing' }).eq('id', videoId);
              const chunks = splitTranscript(captionText, 1000);
              for (let i = 0; i < chunks.length; i++) await processChunk(supabase, videoId, chunks[i], i);
              await supabase.from('videos').update({ status: 'done' }).eq('id', videoId);
              console.log(`[process-video] ==== Video ${videoId} DONE (captions) ====`);
              return;
            }
          }
        }
      }
      throw new Error('No audio streams or captions available for this video.');
    }

    // ---- STEP 4: Download audio ----
    const bestStream = audioStreams[0];
    console.log(`[process-video] Downloading audio: itag=${bestStream.itag}, ${bestStream.bitrate}bps`);
    await supabase.from('videos').update({ title, status: 'downloading' }).eq('id', videoId);

    const audio = await tryDownloadAudio(bestStream.urls);
    if (!audio) throw new Error('Failed to download audio from all URL candidates.');

    // ---- STEP 5: Upload to Supabase Storage ----
    const fileName = `${videoIdStr}_${Date.now()}.m4a`;
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, audio.data, { contentType: audio.mimeType, cacheControl: '3600' });

    if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`);

    const { data: { publicUrl } } = supabase.storage.from('audio').getPublicUrl(fileName);
    console.log(`[process-video] Audio uploaded: ${publicUrl}`);

    // ---- STEP 6: Transcribe with Speechmatics ----
    await supabase.from('videos').update({ status: 'transcribing' }).eq('id', videoId);

    const speechmaticsJobId = await submitToSpeechmatics(publicUrl);
    await supabase.from('videos').update({ speechmatics_job_id: speechmaticsJobId }).eq('id', videoId);

    const transcriptText = await pollSpeechmaticsJob(speechmaticsJobId);
    console.log(`[process-video] Transcript: ${transcriptText.length} chars`);

    // ---- STEP 7: Process transcript ----
    await supabase.from('videos').update({ status: 'processing' }).eq('id', videoId);

    const chunks = splitTranscript(transcriptText, 1000);
    console.log(`[process-video] ${chunks.length} chunks to embed`);

    for (let i = 0; i < chunks.length; i++) {
      await processChunk(supabase, videoId, chunks[i], i);
    }

    await supabase.from('videos').update({ status: 'done' }).eq('id', videoId);
    console.log(`[process-video] ==== Video ${videoId} DONE (Speechmatics) ====`);
  } catch (error: any) {
    console.error(`[process-video] ==== Video ${videoId} FAILED ====`);
    console.error(error.stack || error.message);
    await supabase.from('videos').update({ status: 'error', error_message: error.message }).eq('id', videoId);
  }
}

/** ------------------------------------------------------------------ */
/**  Edge Function entrypoint                                          */
/** ------------------------------------------------------------------ */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const youtubeUrl: string = body?.youtube_url?.trim();
    if (!youtubeUrl) {
      return new Response(JSON.stringify({ error: 'youtube_url is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseSecretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    if (!supabaseUrl || !supabaseSecretKeys.default) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseSecretKeys.default);

    const { data: video, error: insertError } = await supabase
      .from('videos')
      .insert({ youtube_url: youtubeUrl, status: 'pending' })
      .select()
      .single();

    if (insertError || !video) {
      throw new Error(`Failed to create video record: ${insertError?.message}`);
    }

    const videoId = video.id;
    console.log(`[process-video] Created record ${videoId}; background starting`);

    processVideo(supabase, videoId, youtubeUrl).catch((err) =>
      console.error(`[process-video] Background: ${err.stack || err.message}`)
    );

    return new Response(JSON.stringify({ video_id: videoId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(`[process-video] Handler: ${error.stack || error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});