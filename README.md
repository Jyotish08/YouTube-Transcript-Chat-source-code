# Askable

**Make any video askable.**

You can Control-F a document. You can't Control-F a video. Askable turns any video into an interactive source you can interrogate in plain language — and every answer cites the exact second it came from, as a link that jumps you straight there.

Paste a YouTube URL or upload a video file. Askable fetches or generates the transcript, indexes it with timestamps, and gives you a dedicated conversational panel per video.

---

## Proof & Demonstration

- **App Screenshot**: [`docs/coverimage.png`](docs/coverimage.png)
- **Full Video Demo (1080p)**: [`docs/full-demo1080.mov`](docs/full-demo1080.mov) (complete walkthrough showing ingestion, real-time status, semantic Q&A, and exact mention counting)
- **Presentation Deck**: [`docs/presentation.pdf`](docs/presentation.pdf) (interactive web version: [`docs/pitch.html`](docs/pitch.html))
- **Interactive Architecture Topology**: [`docs/topologia.html`](docs/topologia.html) and [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **Longest Videos Tested**:
  - **52 minutes**: *"What Do Hackathon Judges Look For? 5 Live AI App Reviews"* by Joe Holmes, Devpost Learn ([`https://youtu.be/Xh8Ie_VuA_0`](https://youtu.be/Xh8Ie_VuA_0))
  - **42 minutes**: *"State of GPT"* by Andrej Karpathy, Microsoft Build ([`https://www.youtube.com/watch?v=bZQun8Y4L2A`](https://www.youtube.com/watch?v=bZQun8Y4L2A))
  - Successfully tested up to **2-hour** long recordings via Speechmatics ASR and Bright Data caption ingestion.
- **Instant Demo Sandbox**: The UI includes pre-indexed demo videos (`src/lib/demoData.ts`), allowing judges to test instant interrogation and jump links with zero setup friction or API keys.

---

## What it does

- **Two ingestion paths.** YouTube links go through Bright Data (captions); uploaded files go to Speechmatics ASR, so a video works with or without existing captions.
- **Answers with proof.** Every answer carries the transcript chunks it used, with timestamps rendered as `youtube.com/watch?v=…&t=NNs` deep links.
- **Exact mention counting.** "How many times do they say *government*?" cannot be answered accurately from the eight closest semantic chunks, because the model never sees the rest of the transcript. Askable detects counting questions and scans every segment literally, returning an exact count plus a jump link per hit.
  - **Match rules:** The scan is **case-insensitive** (`i` flag) and strictly enforces **whole-word boundaries** (`\b`). Searching for "government" matches "Government" or "GOVERNMENT", but intentionally does not match plurals ("governments") or partial words/stems ("governing").
  - **Semantic fallback:** If literal search finds 0 occurrences, the engine automatically falls back to semantic vector retrieval instead of incorrectly reporting "never mentioned".
- **Non-blocking ingestion.** Transcribe one video while chatting with another. Conversations and in-flight answers survive navigating away.

Deeper architecture notes live in [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## How it works

```
Browser (React + Vite)
   │  anon key only — never holds a third-party key
   ▼
Supabase
   ├── process-video-v2   (Edge Function, Deno)  → Bright Data · Speechmatics · AI/ML API
   ├── chat-agent         (Edge Function, Deno)  → AI/ML API
   ├── Postgres + pgvector                        (videos, transcripts)
   └── Realtime                                   (live status in the sidebar)
```

The browser only ever talks to Supabase. All third-party keys live as Edge Function environment variables and are never shipped to the client.

| Service | Role |
|---|---|
| **Supabase** | Edge Functions (Deno), Postgres + pgvector, Realtime. The only backend the browser touches. |
| **Bright Data** | YouTube transcript retrieval (Dataset API v3). Bypasses datacenter IP blocks without headless browsers. |
| **Speechmatics** | ASR for uploaded files — audio to text with word timings down to the millisecond. |
| **AI/ML API** | Embeddings (`text-embedding-3-small`, 1536 dims) and chat synthesis (`gpt-4o-mini`). (Also compatible with OpenAI and Vercel AI Gateway). |

---

## Requirements

- **Node.js 20+** (Vite 7 requires it)
- A **Supabase** project (free tier is enough)
- The **Supabase CLI** — `npm i -g supabase`
- Accounts and API keys for **Bright Data**, **Speechmatics** and **AI/ML API**

---

## API keys you need

All third-party credentials are set as **Supabase Edge Function secrets**, never in the frontend.

| Key | Where to get it | Used for |
|---|---|---|
| `BRIGHTDATA_API_KEY` | [brightdata.com](https://brightdata.com) → Account settings → API tokens | Fetching YouTube transcripts |
| `SPEECHMATICS_API_KEY` | [portal.speechmatics.com](https://portal.speechmatics.com) → API keys | Transcribing uploaded files |
| `AIML_API_KEY` | [aimlapi.com](https://aimlapi.com) → Dashboard → API keys | Embeddings (`text-embedding-3-small`) + answering model (`gpt-4o-mini`) |

*Note: For flexibility, the edge functions also support `OPENAI_API_KEY` or `VERCEL_AI_GATEWAY_KEY` as plug-and-play alternatives.*

`SUPABASE_URL` and `SUPABASE_SECRET_KEYS` are injected by the Supabase platform — you do not set those yourself.

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/Jyotish08/YouTube-Transcript-Chat-source-code.git
cd YouTube-Transcript-Chat-source-code
npm install
```

### 2. Create the database schema

Run this in the Supabase SQL editor:

```sql
create extension if not exists vector;

create table videos (
  id                  uuid primary key default gen_random_uuid(),
  youtube_url         text not null,          -- or upload://<filename> for uploads
  title               text,
  status              text not null default 'pending',
  error_message       text,
  speechmatics_job_id text,                   -- Bright Data snapshot id, or sm:<job id>
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table transcripts (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references videos(id) on delete cascade,
  chunk_index int not null,
  content     text not null,                  -- carries inline [m:ss] markers
  status      text not null default 'processing',
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);

create index on transcripts using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Vector search, scoped to one video.
create or replace function match_transcripts(
  query_embedding vector(1536),
  match_video_id  uuid,
  match_threshold float,
  match_count     int
)
returns table (id uuid, video_id uuid, chunk_index int, content text, similarity float)
language sql stable as $$
  select t.id, t.video_id, t.chunk_index, t.content,
         1 - (t.embedding <=> query_embedding) as similarity
  from transcripts t
  where t.video_id = match_video_id
    and t.embedding is not null
    and 1 - (t.embedding <=> query_embedding) > match_threshold
  order by t.embedding <=> query_embedding
  limit match_count;
$$;

-- The browser reads the video list with the anon key and nothing else.
-- Writes and deletes go through the Edge Functions, which use the service key.
alter table videos enable row level security;
alter table transcripts enable row level security;
create policy "anon reads videos" on videos for select to anon using (true);

-- Live status badges in the sidebar.
alter publication supabase_realtime add table videos;
```

No Storage bucket is required. Uploaded files stream straight through the Edge Function to Speechmatics.

### 3. Deploy the Edge Functions

```bash
supabase login
supabase link --project-ref <your-project-ref>

# Both functions are deployed with --no-verify-jwt (see Security notes below)
supabase functions deploy process-video-v2 --no-verify-jwt
supabase functions deploy chat-agent       --no-verify-jwt
```

### 4. Set the secrets

```bash
supabase secrets set \
  BRIGHTDATA_API_KEY=... \
  SPEECHMATICS_API_KEY=... \
  AIML_API_KEY=...
```

*(Alternatively, `OPENAI_API_KEY` or `VERCEL_AI_GATEWAY_KEY` can be used instead of `AIML_API_KEY`.)*

### 5. Point the frontend at your project

If you deploy your own backend, update:
- `src/lib/supabase.ts` — `supabaseUrl` and the fallback anon key
- `src/lib/api.ts` — `EDGE_FUNCTION_BASE`

The anon key can also come from the environment. Create a `.env.local`:

```bash
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 6. Run it

```bash
npm run dev        # http://localhost:5173
npm run build      # production build to dist/
npm run preview    # serve the build
```

---

## Using it

1. **Paste a YouTube URL** with captions, or switch to **Upload MP4** and drop a file (20 MB default cap — see `UPLOAD_MAX_BYTES`).
2. The sidebar shows live status: *Fetching → Transcribing → Indexing → Ready*. You can keep using the app while it works — open another video and chat with it.
3. Once a video is **Ready**, ask anything. Answers cite their sources; timestamps are clickable and open the video at that exact second.
4. Ask **"how many times do they say X?"** to get an exact count with jump links instead of an 8-chunk retrieval guess.

---

## Environment variables (Edge Functions)

**Required**

| Variable | Notes |
|---|---|
| `BRIGHTDATA_API_KEY` | Required for the YouTube path |
| `SPEECHMATICS_API_KEY` | Required for direct uploads |
| `AIML_API_KEY` | Required for embeddings and answers (or `OPENAI_API_KEY` / `VERCEL_AI_GATEWAY_KEY`) |

**Optional**

| Variable | Default | Notes |
|---|---|---|
| `TRANSCRIPT_SOURCE` | `dataset` | `dataset` (Bright Data) or `audio` (legacy path) |
| `BRIGHTDATA_DATASET_ID` | `gd_lk56epmy2i5g7lzu0k` | Bright Data YouTube transcript dataset |
| `BRIGHTDATA_ZONE` | `web_unlocker1` | Used for web unlocker operations |
| `DATASET_TIMEOUT_MS` | `110000` | Per-invocation budget; resumes afterwards if it runs over |
| `SPEECHMATICS_TIMEOUT_MS` | `100000` | Timeout budget for ASR jobs |
| `SPEECHMATICS_LANGUAGE` | `auto` | Force a language code to skip detection |
| `UPLOAD_MAX_BYTES` | `20971520` | 20 MB. Bounded by Edge Function memory, not by design |
| `MATCH_THRESHOLD` | `-1` | No cutoff. The query is already scoped to one video |
| `DEBUG_TOKEN` | *unset* | Enables debug endpoints when echoed back. Leave unset in production |

---

## Security notes

**The Edge Functions are deployed with `--no-verify-jwt`.** They are open endpoints: anyone who knows the URL can submit videos, which uses Bright Data, Speechmatics, and AI/ML API credits.
- **Why this was chosen:** For the hackathon and judge evaluations, this eliminates all authentication friction (no forced sign-up, email verification, or login wall), allowing immediate interactive testing.
- **Hardening for production:** Before making this publicly available, enable JWT verification (`supabase.auth.getUser()`), inject a custom pre-shared secret header (`x-askable-key`), or place rate-limiting / Cloudflare protection in front.

**Zero third-party keys in the browser:** Third-party keys (`BRIGHTDATA_API_KEY`, `SPEECHMATICS_API_KEY`, `AIML_API_KEY`) live exclusively in Supabase Edge Function environment variables. The browser only holds the Supabase anon key, protected by Row Level Security (RLS).

---

## Known limitations

- **Ingestion is a single long HTTP request.** The tab must stay open until it returns, though the app stays usable meanwhile and a slow job is resumed by polling.
- **The 20 MB upload cap** is an Edge Function memory constraint.
- **YouTube videos need captions.** YouTube blocks datacenter IPs from direct audio downloads (`LOGIN_REQUIRED`), so YouTube ingestion relies on Bright Data caption extraction.
- **Single-turn Q&A.** Each question is answered independently on its own retrieved context.

---

## Repo layout

```
src/
  App.tsx                     state for the video list, ingestion and selection
  components/
    Sidebar.tsx               video list, live status, delete
    VideoSubmission.tsx       URL / file submission form
    ChatPanel.tsx             per-video conversation & timestamp jump links
    ErrorBoundary.tsx         graceful error recovery boundary
  lib/
    api.ts                    Edge Function calls and the Video model
    conversations.ts          per-video chat store, survives navigation
    demoData.ts               pre-indexed judge demo sandbox
    supabase.ts               Supabase client
supabase/functions/
  process-video-v2/           ingestion: transcript, chunking, embeddings (AI/ML API)
  chat-agent/                 retrieval, exact mention counting, answering (AI/ML API)
scripts/                      shell integration tests
docs/
  coverimage.png              high-resolution application screenshot
  full-demo1080.mov           1080p video demo walkthrough
  pitch.html                  project pitch deck (16:9 interactive presentation)
  presentation.pdf            exported presentation PDF deck
  topologia.html              interactive architecture topology diagram
ARCHITECTURE.md               technical deep dive: how the five services fit together
```

---

## License

MIT.
