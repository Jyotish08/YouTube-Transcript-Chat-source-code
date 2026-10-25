// process-video-v2/index.ts — Ingestion pipeline using OpenAI / Vercel AI Gateway for embeddings
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// --- Embeddings via OpenAI / Vercel AI Gateway ---

async function generateEmbedding(text: string): Promise<number[]> {
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  const vercelKey = Deno.env.get('VERCEL_AI_GATEWAY_KEY');
  const apiKey = openAiKey || vercelKey;
  if (!apiKey) throw new Error('OPENAI_API_KEY or VERCEL_AI_GATEWAY_KEY not set');

  const isDirectOpenAi = !!openAiKey;
  const baseUrl = isDirectOpenAi ? 'https://api.openai.com/v1' : 'https://ai-gateway.vercel.sh/v1';
  const model = isDirectOpenAi ? 'text-embedding-3-small' : 'openai/text-embedding-3-small';

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: text, dimensions: 1536 }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!resp.ok) { const e = await resp.text(); throw new Error(`Embedding (${resp.status}): ${e.slice(0,200)}`); }
      const r = await resp.json();
      return r.data[0].embedding;
    } catch (err: any) {
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1) + Math.random() * 1000));
    }
  }
  throw new Error('Max embedding retries exceeded');
}

// --- Bright Data Dataset API: YouTube transcript ---

async function fetchTranscriptViaBrightData(youtubeUrl: string): Promise<{ title: string; transcript: string }> {
  const apiKey = Deno.env.get('BRIGHTDATA_API_KEY');
  if (!apiKey) throw new Error('BRIGHTDATA_API_KEY not set');
  const datasetId = Deno.env.get('BRIGHTDATA_DATASET_ID') || 'gd_lk56epmy2i5g7lzu0k';
  const timeoutMs = parseInt(Deno.env.get('DATASET_TIMEOUT_MS') || '110000', 10);

  const triggerResp = await fetch(
    `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${datasetId}&include_errors=true`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ url: youtubeUrl }]),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!triggerResp.ok) { const t = await triggerResp.text(); throw new Error(`BrightData trigger (${triggerResp.status}): ${t.slice(0,300)}`); }
  const { snapshot_id } = await triggerResp.json();
  if (!snapshot_id) throw new Error('BrightData: no snapshot_id returned');
  console.log(`[process-video-v2] BrightData snapshot: ${snapshot_id}`);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000));
    const pollResp = await fetch(
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}?format=json`,
      { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) }
    );
    if (!pollResp.ok) { console.warn(`[process-video-v2] BrightData poll HTTP ${pollResp.status}`); continue; }
    const ct = pollResp.headers.get('content-type') || '';
    if (!ct.includes('application/json')) continue;
    const data = await pollResp.json();
    if (Array.isArray(data) && data.length === 0) continue;
    if (data.status === 'running') continue;
    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      const title = item.title || item.video_title || 'Unknown Title';
      const transcript = item.transcript || item.subtitles || item.captions || item.text
        || (Array.isArray(item.transcript_segments) ? item.transcript_segments.map((s: any) => s.text).join(' ') : '');
      if (!transcript) throw new Error('BrightData returned empty transcript');
      return { title, transcript };
    }
    if (data.error) throw new Error(`BrightData: ${data.error}`);
  }
  throw new Error(`BrightData snapshot ${snapshot_id} timed out`);
}

// --- Speechmatics: uploaded file ---

async function transcribeWithSpeechmatics(fileBytes: Uint8Array, mimeType: string): Promise<string> {
  const apiKey = Deno.env.get('SPEECHMATICS_API_KEY');
  if (!apiKey) throw new Error('SPEECHMATICS_API_KEY not set');
  const timeoutMs = parseInt(Deno.env.get('SPEECHMATICS_TIMEOUT_MS') || '100000', 10);
  const language = Deno.env.get('SPEECHMATICS_LANGUAGE') || 'auto';

  const form = new FormData();
  form.append('data_file', new Blob([fileBytes], { type: mimeType }), 'upload.mp4');
  form.append('config', JSON.stringify({ type: 'transcription', transcription_config: { language, enable_entities: true } }));

  const submitResp = await fetch('https://asr.api.speechmatics.com/v2/jobs/', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(60_000),
  });
  if (!submitResp.ok) { const t = await submitResp.text(); throw new Error(`Speechmatics submit (${submitResp.status}): ${t.slice(0,300)}`); }
  const { id: jobId } = await submitResp.json();
  console.log(`[process-video-v2] Speechmatics job: ${jobId}`);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4000));
    const pollResp = await fetch(`https://asr.api.speechmatics.com/v2/jobs/${jobId}/`, {
      headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000),
    });
    if (!pollResp.ok) { console.warn(`[process-video-v2] SM poll HTTP ${pollResp.status}`); continue; }
    const status = await pollResp.json();
    const jobStatus = status.job?.status || status.status;
    console.log(`[process-video-v2] Speechmatics: ${jobStatus}`);
    if (jobStatus === 'done') {
      const tResp = await fetch(`https://asr.api.speechmatics.com/v2/jobs/${jobId}/transcript?format=txt`,
        { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
      if (!tResp.ok) throw new Error(`SM transcript fetch: HTTP ${tResp.status}`);
      return await tResp.text();
    }
    if (jobStatus === 'error') throw new Error(`Speechmatics failed: ${status.job?.error?.message || 'unknown'}`);
  }
  throw new Error(`Speechmatics job ${jobId} timed out`);
}

// --- Chunking ---

function splitTranscript(text: string, maxSize = 1000): string[] {
  if (!text.trim()) return [];
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let current = '';
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const candidate = current ? `${current} ${trimmed}` : trimmed;
    if (candidate.length > maxSize && current.length > 0) { chunks.push(current.trim()); current = trimmed; }
    else { current = candidate; }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function processChunks(supabase: ReturnType<typeof createClient>, videoId: string, chunks: string[]) {
  console.log(`[process-video-v2] Embedding ${chunks.length} chunks`);
  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    const { data: transcript, error: insertErr } = await supabase
      .from('transcripts').insert({ video_id: videoId, chunk_index: i, content: chunkText, status: 'processing' })
      .select().single();
    if (insertErr || !transcript) { console.error(`[process-video-v2] Chunk ${i} insert: ${insertErr?.message}`); continue; }
    try {
      const embedding = await generateEmbedding(chunkText);
      await supabase.from('transcripts').update({ embedding, status: 'done' }).eq('id', transcript.id);
      console.log(`[process-video-v2] Chunk ${i + 1}/${chunks.length} embedded`);
    } catch (ee: any) {
      console.error(`[process-video-v2] Chunk ${i} embed failed: ${ee.message}`);
      await supabase.from('transcripts').update({ status: 'done' }).eq('id', transcript.id);
    }
  }
}

// --- Edge Function entry ---

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const contentType = req.headers.get('content-type') || '';

    // Uploaded file (multipart)
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      if (!file) return new Response(JSON.stringify({ error: 'No file uploaded' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const maxBytes = parseInt(Deno.env.get('UPLOAD_MAX_BYTES') || '20971520', 10);
      if (file.size > maxBytes) return new Response(JSON.stringify({ error: `File too large (max ${maxBytes} bytes)` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: video, error: insertErr } = await supabase.from('videos').insert({ youtube_url: `upload://${file.name}`, status: 'pending' }).select().single();
      if (insertErr || !video) throw new Error(`Failed to create video record: ${insertErr?.message}`);
      const videoId = video.id;

      (async () => {
        try {
          await supabase.from('videos').update({ status: 'transcribing' }).eq('id', videoId);
          const fileBytes = new Uint8Array(await file.arrayBuffer());
          const transcriptText = await transcribeWithSpeechmatics(fileBytes, file.type || 'audio/mp4');
          await supabase.from('videos').update({ title: file.name.replace(/\.[^.]+$/, ''), status: 'processing' }).eq('id', videoId);
          await processChunks(supabase, videoId, splitTranscript(transcriptText));
          await supabase.from('videos').update({ status: 'done' }).eq('id', videoId);
        } catch (err: any) {
          console.error(`[process-video-v2] Upload ${videoId} FAILED: ${err.message}`);
          await supabase.from('videos').update({ status: 'error', error_message: err.message }).eq('id', videoId);
        }
      })();

      return new Response(JSON.stringify({ video_id: videoId, status: 'transcribing' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // JSON body
    const body = await req.json();

    // Delete action
    if (body?.action === 'delete' && body?.video_id) {
      await supabase.from('transcripts').delete().eq('video_id', body.video_id);
      await supabase.from('videos').delete().eq('id', body.video_id);
      return new Response(JSON.stringify({ status: 'deleted' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Status check / resume
    if (body?.video_id && !body?.youtube_url) {
      const { data: video } = await supabase.from('videos').select('*').eq('id', body.video_id).single();
      return new Response(JSON.stringify({ status: video?.status || 'unknown' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // New YouTube URL
    const youtubeUrl: string = body?.youtube_url?.trim();
    if (!youtubeUrl) return new Response(JSON.stringify({ error: 'youtube_url is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: video, error: insertErr } = await supabase.from('videos').insert({ youtube_url: youtubeUrl, status: 'pending' }).select().single();
    if (insertErr || !video) throw new Error(`Failed to create video record: ${insertErr?.message}`);
    const videoId = video.id;
    console.log(`[process-video-v2] Created record ${videoId}`);

    (async () => {
      try {
        await supabase.from('videos').update({ status: 'downloading' }).eq('id', videoId);
        const { title, transcript: transcriptText } = await fetchTranscriptViaBrightData(youtubeUrl);
        await supabase.from('videos').update({ title, status: 'processing' }).eq('id', videoId);
        await processChunks(supabase, videoId, splitTranscript(transcriptText));
        await supabase.from('videos').update({ status: 'done' }).eq('id', videoId);
        console.log(`[process-video-v2] ${videoId} DONE`);
      } catch (err: any) {
        console.error(`[process-video-v2] ${videoId} FAILED: ${err.message}`);
        await supabase.from('videos').update({ status: 'error', error_message: err.message }).eq('id', videoId);
      }
    })();

    return new Response(JSON.stringify({ video_id: videoId, status: 'pending' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error(`[process-video-v2] Handler error: ${err.stack || err.message}`);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});