// chat-agent/index.ts — RAG Q&A over a video transcript using AI/ML API, OpenAI, or Vercel AI Gateway
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getAiConfig() {
  const aimlKey = Deno.env.get('AIML_API_KEY') || Deno.env.get('AIMLAPI_KEY');
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  const vercelKey = Deno.env.get('VERCEL_AI_GATEWAY_KEY');
  const apiKey = aimlKey || openAiKey || vercelKey;
  if (!apiKey) throw new Error('AIML_API_KEY, OPENAI_API_KEY, or VERCEL_AI_GATEWAY_KEY not set');

  if (aimlKey) {
    return {
      apiKey,
      baseUrl: 'https://api.aimlapi.com/v1',
      embedModel: 'text-embedding-3-small',
      chatModel: 'gpt-4o-mini',
    };
  }

  const isDirectOpenAi = !!openAiKey;
  return {
    apiKey,
    baseUrl: isDirectOpenAi ? 'https://api.openai.com/v1' : 'https://ai-gateway.vercel.sh/v1',
    embedModel: isDirectOpenAi ? 'text-embedding-3-small' : 'openai/text-embedding-3-small',
    chatModel: isDirectOpenAi ? 'gpt-4o-mini' : 'openai/gpt-4o-mini',
  };
}

// --- Embedding ---

async function embed(text: string): Promise<number[]> {
  const { apiKey, baseUrl, embedModel } = getAiConfig();
  const resp = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: embedModel, input: text, dimensions: 1536 }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) { const e = await resp.text(); throw new Error(`Embed (${resp.status}): ${e.slice(0,200)}`); }
  const r = await resp.json();
  return r.data[0].embedding;
}

// --- Chat completion ---

async function chat(messages: { role: string; content: string }[]): Promise<string> {
  const { apiKey, baseUrl, chatModel } = getAiConfig();
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: chatModel, messages, temperature: 0.2 }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) { const e = await resp.text(); throw new Error(`Chat (${resp.status}): ${e.slice(0,200)}`); }
  const r = await resp.json();
  return r.choices[0].message.content as string;
}

// --- Mention count helper ---

function isMentionCountQuestion(q: string): boolean {
  return /how many times|how often|count (of|how many)|number of times/i.test(q);
}

function extractKeyword(q: string): string | null {
  const m = q.match(/(?:say|mention|use|appear|count(?:ed)?)\s+["']?([a-z0-9 _-]{2,40})["']?/i);
  return m ? m[1].trim() : null;
}

function countMentions(chunks: { content: string }[], keyword: string): number {
  const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  return chunks.reduce((acc, c) => acc + (c.content.match(pattern) || []).length, 0);
}

// --- Edge Function ---

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { video_id, question } = await req.json();
    if (!video_id || !question) return new Response(JSON.stringify({ error: 'video_id and question are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Fetch video metadata
    const { data: video } = await supabase.from('videos').select('title, status, youtube_url').eq('id', video_id).single();
    if (!video) return new Response(JSON.stringify({ error: 'Video not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (video.status !== 'done') return new Response(JSON.stringify({ error: `Video is still ${video.status}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Mention-count path: literal scan over every chunk with word boundaries and case-insensitivity
    if (isMentionCountQuestion(question)) {
      const keyword = extractKeyword(question);
      if (keyword) {
        const { data: allChunks } = await supabase
          .from('transcripts')
          .select('id, chunk_index, content')
          .eq('video_id', video_id)
          .order('chunk_index');

        const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        let totalCount = 0;
        const matchedSources: any[] = [];

        for (const c of (allChunks || [])) {
          const hits = c.content.match(pattern);
          if (hits && hits.length > 0) {
            totalCount += hits.length;
            const timeMatch = c.content.match(/\[(\d+:\d{2})\]/);
            const timestamp = timeMatch ? timeMatch[1] : undefined;
            let start_seconds: number | undefined = undefined;
            if (timestamp) {
              const [m, s] = timestamp.split(':').map(Number);
              start_seconds = m * 60 + s;
            }
            const ytId = extractYouTubeId(video.youtube_url || '');
            matchedSources.push({
              chunk_index: c.chunk_index,
              similarity: 1.0,
              timestamp,
              start_seconds,
              ...(ytId && start_seconds != null ? { url: `https://www.youtube.com/watch?v=${ytId}&t=${start_seconds}s` } : {}),
            });
          }
        }

        if (totalCount > 0) {
          const timestampList = matchedSources.filter((s) => s.timestamp).map((s) => `[${s.timestamp}]`).join(', ');
          return new Response(
            JSON.stringify({
              answer: `The word or phrase "${keyword}" is mentioned **${totalCount} time${totalCount === 1 ? '' : 's'}** across the transcript in this video${
                timestampList ? ` (at ${timestampList})` : ''
              }.`,
              sources: matchedSources,
              video_title: video.title || 'Unknown',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // If literal count is 0, fall through to the semantic search path below
        // so conceptual mentions or rephrased queries get answered accurately.
      }
    }

    // Semantic search path
    const queryEmbedding = await embed(question);
    const matchThreshold = parseFloat(Deno.env.get('MATCH_THRESHOLD') || '-1');

    const { data: matches, error: matchErr } = await supabase.rpc('match_transcripts', {
      query_embedding: queryEmbedding,
      match_video_id: video_id,
      match_threshold: matchThreshold,
      match_count: 8,
    });
    if (matchErr) throw new Error(`Vector search: ${matchErr.message}`);

    const context = (matches || []).map((m: any, i: number) => `[Source ${i + 1}] ${m.content}`).join('\n\n');
    const systemPrompt = `You are a helpful assistant that answers questions about a video transcript.
Answer the user's question based ONLY on the provided transcript excerpts.
If the answer isn't in the excerpts, say you couldn't find it in the transcript.
Be concise and cite sources by their [Source N] label.`;

    const answer = await chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Transcript excerpts:\n\n${context}\n\nQuestion: ${question}` },
    ]);

    const sources = (matches || []).map((m: any) => ({
      chunk_index: m.chunk_index,
      similarity: m.similarity,
      ...(m.start_seconds != null ? { start_seconds: m.start_seconds, timestamp: formatTime(m.start_seconds) } : {}),
    }));

    return new Response(
      JSON.stringify({ answer, sources, video_title: video.title || 'Unknown' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error(`[chat-agent] Error: ${err.stack || err.message}`);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const beMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (beMatch) return beMatch[1];
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  return null;
}
