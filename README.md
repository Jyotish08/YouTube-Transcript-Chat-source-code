# Askable

**Make any video askable.**

You can Control-F a document. You can't Control-F a video. Askable turns any video
into a source you can interrogate in plain language — and every answer cites the
exact second it came from, as a link that jumps you straight there.

Paste a YouTube URL or upload a video file. Askable fetches or generates the
transcript, indexes it with timestamps, and gives you a chat panel per video.

---

## What it does

- **Two ingestion paths.** YouTube links go through Bright Data (captions);
  uploaded files go to Speechmatics ASR, so a video works with or without captions.
- **Answers with proof.** Every answer carries the transcript chunks it used, with
  timestamps rendered as `youtube.com/watch?v=…&t=NNs` deep links.
- **Exact mention counting.** "How many times do they say *government*?" cannot be
  answered from the eight closest chunks, because the model never saw the rest of
  the transcript. Askable detects those questions and scans every segment literally,
  returning an exact count plus a jump link per hit. If the literal search misses,
  it falls back to semantic search rather than wrongly answering "never mentioned".
- **Non-blocking ingestion.** Transcribe one video while chatting with another.
  Conversations and in-flight answers survive navigating away.

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

The browser only ever talks to Supabase. All third-party keys live as Edge Function
environment variables and are never shipped to the client.

| Service | Role |
|---|---|
| **Supabase** | Edge Functions (Deno), Postgres + pgvector, Realtime. The only backend the browser touches. |
| **Bright Data** | YouTube transcript retrieval (Dataset API). |
| **Speechmatics** | ASR for uploaded files — audio to text with word timings. |
| **AI/ML API** | Embeddings (`text-embedding-3-small`, 1536 dims) and the chat model (`gpt-4o-mini`). |

---

## Requirements

- **Node.js 20+** (Vite 7 requires it)
- A **Supabase** project (free tier is enough)
- The **Supabase CLI** — `npm i -g supabase`
- Accounts and API keys for **Bright Data**, **Speechmatics** and **AI/ML API**

---

## API keys you need

All three are set as **Supabase Edge Function secrets**, never in the frontend.

| Key | Where to get it | Used for |
|---|---|---|
| `BRIGHTDATA_API_KEY` | [brightdata.com](https://brightdata.com) → Account settings → API tokens | Fetching YouTube transcripts |
| `SPEECHMATICS_API_KEY` | [portal.speechmatics.com](https://portal.speechmatics.com) → API keys | Transcribing uploaded files |
| `AIMLAPI_KEY` | [aimlapi.com](https://aimlapi.com) → Dashboard → API keys | Embeddings + the answering model |

`SUPABASE_URL` and `SUPABASE_SECRET_KEYS` are injected by the Supabase platform —
you do not set those yourself.

---

## Setup

### 1. Clone and install

```bash
git clone <your-fork-url>
cd YouTube-Transcript-Chat-source-code
npm install
```

### 2. Create the database schema

> **This repo does not ship migrations.** The SQL below is reconstructed from the
> code that reads and writes these tables, and is enough to run the app. Check it
> against your own project before relying on it in production.

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

No Storage bucket is required. Uploaded files stream straight through the Edge
Function to Speechmatics; the `audio` bucket referenced by the legacy audio path is
not used.

### 3. Deploy the Edge Functions

```bash
supabase login
supabase link --project-ref <your-project-ref>

# Both functions are called without a JWT — see the security note below.
supabase functions deploy process-video-v2 --no-verify-jwt
supabase functions deploy chat-agent       --no-verify-jwt
```

### 4. Set the secrets

```bash
supabase secrets set \
  BRIGHTDATA_API_KEY=... \
  SPEECHMATICS_API_KEY=... \
  AIMLAPI_KEY=...
```

### 5. Point the frontend at your project

Two places still carry a hard-coded project reference — change both:

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

There is also `./run.sh` (`dev` · `build` · `preview` · `clean`), which checks your
Node version first and accepts `PORT` and `HOST`.

---

## Using it

1. **Paste a YouTube URL** with captions, or switch to **Upload MP4** and drop a file
   (20 MB default cap — see `UPLOAD_MAX_BYTES`).
2. The sidebar shows live status: *Fetching → Transcribing → Indexing → Ready*.
   You can keep using the app while it works — open another video and chat with it.
3. Once a video is **Ready**, ask anything. Answers cite their sources; timestamps
   are clickable and open the video at that second.
4. Ask **"how many times do they say X?"** to get an exact count instead of a guess.

---

## Environment variables (Edge Functions)

**Required**

| Variable | Notes |
|---|---|
| `BRIGHTDATA_API_KEY` | Required for the YouTube path |
| `SPEECHMATICS_API_KEY` | Required for uploads |
| `AIMLAPI_KEY` | Required for embeddings and answers |

**Optional**

| Variable | Default | Notes |
|---|---|---|
| `TRANSCRIPT_SOURCE` | `dataset` | `dataset` (Bright Data) or `audio` (legacy path, blocked in production) |
| `BRIGHTDATA_DATASET_ID` | `gd_lk56epmy2i5g7lzu0k` | Bright Data YouTube transcript dataset |
| `BRIGHTDATA_ZONE` | `web_unlocker1` | Only used by the legacy audio path |
| `DATASET_TIMEOUT_MS` | `110000` | Per-invocation budget; the row resumes afterwards if it runs over |
| `SPEECHMATICS_TIMEOUT_MS` | `100000` | Same idea for ASR jobs |
| `SPEECHMATICS_LANGUAGE` | `auto` | Force a language code to skip detection |
| `UPLOAD_MAX_BYTES` | `20971520` | 20 MB. Bounded by Edge Function memory, not by design |
| `MATCH_THRESHOLD` | `-1` | No cutoff. The query is already scoped to one video |
| `YOUTUBE_FETCH_MODE` | `auto` | Legacy audio path only |
| `DEBUG_TOKEN` | *unset* | Enables debug endpoints when echoed back in the request. Leave unset |

---

## Security notes

**The Edge Functions are deployed with `--no-verify-jwt`.** They are open endpoints:
anyone who knows the URL can submit videos, which costs *you* Bright Data,
Speechmatics and AI/ML API credits. Before putting this anywhere public, either
require a JWT, add your own shared-secret check, or put a rate limit in front.

**This repo ships a working Supabase URL and anon key** in `src/lib/supabase.ts`.
An anon key is designed to be public and is constrained by RLS, but a fork that
does not change it will silently read and write the original project. Step 5 above
is not optional if you are running your own instance.

**`DEBUG_TOKEN` should stay unset in production.** It unlocks endpoints that submit
billable transcription jobs for arbitrary URLs.

---

## Known limitations

- **Ingestion is a single long HTTP request.** The tab must stay open until it
  returns, though the app stays usable meanwhile and a slow job is resumed by
  polling. Moving the upload to Storage would remove this.
- **The 20 MB upload cap** is an Edge Function memory constraint, not a design one.
- **YouTube videos need captions.** The audio fallback path is blocked in
  production: Supabase datacenter IPs get `LOGIN_REQUIRED` from YouTube, and the
  Bright Data zone rejects `youtube.com` pending KYC.
- **Follow-up questions carry no context.** Each question is answered on its own.

---

## Repo layout

```
src/
  App.tsx                     state for the video list, ingestion and selection
  components/
    Sidebar.tsx               video list, live status, delete
    VideoSubmission.tsx       URL / file submission form
    ChatPanel.tsx             per-video conversation
  lib/
    api.ts                    Edge Function calls and the Video model
    conversations.ts          per-video chat store, survives navigation
    supabase.ts               Supabase client
supabase/functions/
  process-video-v2/           ingestion: transcript, chunking, embeddings
  chat-agent/                 retrieval, mention counting, answering
scripts/                      shell integration tests
docs/
  pitch.html                  project pitch deck (print to PDF at 16:9)
  presentation.pdf            the deck, exported
  topologia.html              architecture diagram
ARCHITECTURE.md               how the five services fit together
```

---

## License

MIT.
