// chat-agent/index.ts — RAG Q&A over a video transcript using OpenAI / Vercel AI Gateway
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function getAiConfig() {
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  const vercelKey = Deno.env.get('VERCEL_AI_GATEWAY_KEY');
  const apiKey = openAiKey || vercelKey;
  if (!apiKey) throw new Error('OPENAI_API_KEY or VERCEL_AI_GATEWAY_KEY not set');

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
    const { data: video } = await supabase.from('videos').select('title, status').eq('id', video_id).single();
    if (!video) return new Response(JSON.stringify({ error: 'Video not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (video.status !== 'done') return new Response(JSON.stringify({ error: `Video is still ${video.status}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Mention-count path
    if (isMentionCountQuestion(question)) {
      const keyword = extractKeyword(question);
      if (keyword) {
        const { data: allChunks } = await supabase.from('transcripts').select('content').eq('video_id', video_id).order('chunk_index');
        const count = countMentions(allChunks || [], keyword);
        return new Response(
          JSON.stringify({
            answer: `The word "${keyword}" is mentioned ${count} time${count === 1 ? '' : 's'} in the transcript.`,
            sources: [],
            video_title: video.title || 'Unknown',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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