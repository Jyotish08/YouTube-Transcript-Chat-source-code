---
doc: spec
status: approved
---

# Askable — Technical Spec

## How This Works, In Plain Language

Askable operates as a split system: a responsive single-page web application running in the user's browser, backed by serverless cloud functions and a database that understands the mathematical meaning of spoken words (vectors).

When a user provides a YouTube link or drops a video file:
1. The frontend immediately asks the backend to initiate transcription and gets back an acknowledgement, allowing the user interface to stay snappy and unblocked.
2. For YouTube links, the backend requests the timed captions through a specialized proxy service that avoids automated blocking. For uploaded files, the backend streams the audio directly to a high-accuracy speech recognition engine that transcribes every spoken word with millisecond-precision timestamps.
3. The backend slices the spoken text into digestible paragraphs (chunks), tags each chunk with an inline timestamp marker `[m:ss]`, calculates a mathematical vector representation (embedding) for each chunk, and saves it into the database.
4. When the user asks a question, the backend translates the question into an embedding and queries the database for the most relevant transcript chunks (or runs a full whole-word text scan if the user is asking how many times a word was said).
5. A lightweight language model synthesizes a factual answer using only those retrieved chunks, formatting every cited moment into an interactive timestamp chip.
6. When the user clicks that chip, the in-app video player automatically jumps to and plays that exact second.

---

## The Core Journey Through the System

Implements: `prd.md > The Core Journey`.

```
User Action                      Frontend Layer (React)                Backend (Supabase Edge & DB)             External Services
───────────                      ──────────────────────                ────────────────────────────             ─────────────────
1. Submits YouTube URL ─────────► VideoSubmission.tsx
                                  │ Calls submitVideo()
                                  ▼
                                  api.ts ────────────────────────────► process-video-v2 (Deno)
                                                                       │ 1. Creates 'pending' row in DB
                                                                       │ 2. Returns video_id to UI
                                  ◄────────────────────────────────────┘ (UI immediately updates sidebar)
                                                                       │
                                                                       │ 3. Fires Dataset Trigger ─────────────► Bright Data API
                                                                       │ 4. Polls snapshot status ◄───────────── (Returns timed captions)
                                                                       │ 5. Normalizes text & chunking
                                                                       │ 6. Requests 1536-d vectors ───────────► AI/ML API (Embedding)
                                                                       │ 7. Commits chunks to Postgres
                                                                       │ 8. Updates video status to 'done'
                                  Sidebar.tsx (polls / Realtime) ◄─────┘
                                  │ Status changes to 'Ready'
2. User asks question ──────────► ChatPanel.tsx
                                  │ Calls askQuestion()
                                  ▼
                                  conversations.ts ──────────────────► chat-agent (Deno)
                                                                       │ 1. Checks if question is mention count
                                                                       │    - Yes: Runs literal \bword\b regex over all chunks
                                                                       │    - No:  Computes question embedding & calls match_transcripts()
                                                                       │ 2. Builds grounded context prompt
                                                                       │ 3. Requests chat completion ──────────► AI/ML API (gpt-4o-mini)
                                  ◄────────────────────────────────────┘ (Returns answer + cited timestamps)
3. Clicks timestamp chip ───────► ChatPanel.tsx seeks embedded player
                                  (or opens external URL with &t=NNs)
```

---

## Stack

### Core Frontend Client
- **Language:** TypeScript 5.9.3 (strict typing across components and data layers)
- **Framework:** React 18.3.1 with `react-dom` 18.3.1
- **Build Tool & Dev Server:** Vite 7.2.4 with `@vitejs/plugin-react` 5.1.1
- **Styling:** Tailwind CSS 4.1.18 via `@tailwindcss/vite`
- **Iconography:** `react-icons` 5.7.0 (Feather icon set `fi`)
- **Backend Client:** `@supabase/supabase-js` 2.112.0
- **YouTube Parsing Utilities:** `youtubei.js` 17.2.0

### Backend Infrastructure
- **Serverless Edge Runtime:** Supabase Edge Functions (Deno runtime, TypeScript)
- **Database:** Supabase Managed PostgreSQL 15+ with `pgvector` extension enabled
- **Vector Index:** Cosine distance index (`ivfflat` operator class `vector_cosine_ops`)
- **Real-Time Push:** Supabase Realtime websocket subscriptions (`postgres_changes`)

### External AI & Media Processing Services
- **YouTube Caption Extraction:** Bright Data Dataset API v3 (`gd_lk56epmy2i5g7lzu0k`)
- **Audio Speech-to-Text (ASR):** Speechmatics ASR REST API v2
- **Vector Embeddings:** AI/ML API powering OpenAI `text-embedding-3-small` (1536 dimensions)
- **Answer Generation:** AI/ML API powering OpenAI `gpt-4o-mini` (temperature: 0.2)
- *Note:* Edge functions maintain zero-code fallback support for direct `OPENAI_API_KEY` or `VERCEL_AI_GATEWAY_KEY`.

---

## Where It Runs and How Someone Tries It

### Runtime Environment
- **Client:** Modern desktop web browser (Chrome, Edge, Firefox, Safari).
- **Local Dev Server:** Node.js 20+ runtime.
- **Backend Services:** Hosted Supabase project with Edge Functions deployed.

### Setup and Local Execution
```bash
# 1. Clone repository
git clone https://github.com/Jyotish08/YouTube-Transcript-Chat-source-code.git
cd YouTube-Transcript-Chat-source-code

# 2. Install dependencies
npm install

# 3. Configure local environment
cp .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local

# 4. Start Vite development server
npm run dev
```

### Zero-Friction Judge Sandbox Testing
To evaluate the application instantly without configuring third-party credentials or waiting for external transcription pipelines:
1. Open the running application at `http://localhost:5173`.
2. Click any of the three pre-indexed sessions in the **Judge Quick Access Sandbox** banner:
   - *"What Do Hackathon Judges Look For?"* (52-minute workshop by Joe Holmes, Devpost Learn)
   - *"State of GPT"* (42-minute talk by Andrej Karpathy, Microsoft Build)
   - *"Neural Networks"* (3Blue1Brown)
3. Immediately test conversational Q&A, click timestamp chips to seek the integrated player, or ask counting queries (e.g., "How many times do they say judges?").

---

## Look and Feel

Implements: `prd.md > Look and Feel`.

The application styling is declared in `src/index.css` using Tailwind CSS v4 design tokens:

- **Color Tokens:**
  - `bg-primary`: `oklch(0.14 0.004 285)` (deep charcoal canvas)
  - `bg-secondary`: `oklch(0.19 0.006 285)` (elevated sidebar and surfaces)
  - `bg-tertiary`: `oklch(0.23 0.008 285)` (card containers and chips)
  - `surface`: `oklch(0.21 0.007 285)` (floating interactive cards)
  - `brand`: `#e8934a` (warm cinematic amber for hero branding and sandbox markers)
  - `accent`: `oklch(0.65 0.15 250)` (soft blue for interactive buttons and links)
  - `accent-muted`: `oklch(0.65 0.15 250 / 0.15)` (pill background highlighting)
  - `text-primary`: `oklch(0.93 0.01 285)` (bright, high-legibility body text)
  - `text-secondary`: `oklch(0.68 0.02 285)` (secondary labels)
  - `text-muted`: `oklch(0.5 0.02 285)` (timestamps and captions)
- **Typography:**
  - Primary UI & Prose: `Inter`, system-ui, sans-serif
  - Chronometry & Timecodes: `ui-monospace`, `SF Mono`, `Menlo`, monospace
- **Interface Density:** Compact, studio-grade layout with persistent scroll controls and 1-pixel border framing (`var(--color-border)`).

---

## Components

### Frontend Components (`src/components/`)

#### `App.tsx`
- **Role:** Main application coordinator and top-level state container.
- **Responsibilities:** Owns the list of videos, selected video pointer, view routing between ingestion form and active chat, background polling timers (10-second ticker for in-flight jobs), and submission error handling.
- Implements: `prd.md > Multi-Session Management and Real-Time Status`.

#### `Sidebar.tsx`
- **Role:** Persistent left-hand navigation pane (width: 320px).
- **Responsibilities:** Renders brand logo, session search input, "+ New Video" button, Judge Quick-Access trigger, live status badges (`Queued`, `Retrieving`, `Transcribing`, `Indexing`, `Ready`, `Failed`), transient pending submission cards, and video deletion with two-step confirmation.
- Implements: `prd.md > Screens and Layout` (Sidebar) and `prd.md > Multi-Session Management and Real-Time Status`.

#### `VideoSubmission.tsx`
- **Role:** Main ingestion canvas displayed when no session is active or when "+ New Video" is clicked.
- **Responsibilities:** Displays the hero header, judge quick-access sandbox cards, segmented tabs for "YouTube Link" and "Upload Video", URL validation and normalization, file drag-and-drop zone (20 MB boundary), and dismissible error banners.
- Implements: `prd.md > Video Ingestion and Source Management` and `prd.md > Quick Access Sandbox for Evaluators`.

#### `ChatPanel.tsx`
- **Role:** Primary conversational interface for an active video session.
- **Responsibilities:** Displays session metadata header, collapsible in-app YouTube player drawer, scrollable chat history, prompt suggestion pills, grounded source citation drawer, timestamp seeking buttons, external YouTube links, conversation clearing, and message composition.
- Implements: `prd.md > Conversational Interrogation and Grounded Answers`, `prd.md > Exact Mention Counting and Literal Search`, and `prd.md > Interactive Playback and Video Synchronization`.

#### `Wordmark.tsx`
- **Role:** Dual-variant brand typography component.
- **Responsibilities:** Renders the full hero headline with value proposition statement for the landing view, or a compact horizontal brand bar for the chat panel header.
- Implements: `prd.md > Look and Feel`.

#### `ErrorBoundary.tsx`
- **Role:** React Class Error Boundary wrapping the application root.
- **Responsibilities:** Catches unhandled client-side runtime errors, preventing blank screen failures and providing safe reload or sandbox-recovery buttons.
- Implements: `prd.md > States and Boundaries`.

---

### Client Library Modules (`src/lib/`)

#### `api.ts`
- **Role:** HTTP and RPC communication layer connecting the client to Supabase Edge Functions and PostgreSQL.
- **Functions:**
  - `fetchVideos()`: Retrieves videos from PostgreSQL, automatically prepending `DEMO_VIDEOS`.
  - `submitVideo(url)`: Calls `process-video-v2` with a YouTube URL.
  - `uploadVideoFile(file)`: Sends a multipart `FormData` payload containing video bytes to `process-video-v2`.
  - `resumeVideo(id)`: Nudges in-flight Bright Data snapshots.
  - `deleteVideo(id)`: Deletes video and cascaded chunks.
  - `reprocessVideo(id)`: Re-indexes an existing video.
  - `askQuestion(id, q)`: Calls `chat-agent` or routes to `queryDemoTranscript()` for demo sessions.

#### `conversations.ts`
- **Role:** Decoupled in-memory conversation state store built with `useSyncExternalStore`.
- **Responsibilities:** Holds message arrays and unsubmitted text drafts keyed by `videoId`. Ensures that navigating between videos in the sidebar does not drop active chat history or unmount in-flight requests.

#### `demoData.ts`
- **Role:** Client-side sandbox dataset and local query engine.
- **Responsibilities:** Supplies static transcripts and metadata for the three judge demo sessions. Includes a local implementation of semantic scoring and whole-word regex counting, ensuring instant response times without network dependencies.

#### `supabase.ts`
- **Role:** Initializes the Supabase client using environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

---

### Supabase Edge Functions (`supabase/functions/`)

#### `process-video-v2/index.ts`
- **Role:** Serverless pipeline coordinator for video transcription, chunking, and vector embedding.
- **Workflow:**
  1. Handles CORS preflight and JSON / `FormData` parsing.
  2. For URLs: Dispatches Bright Data Dataset API trigger for dataset `gd_lk56epmy2i5g7lzu0k`, then polls snapshot endpoint.
  3. For files: Streams binary buffer to Speechmatics ASR API with auto-language detection and millisecond word timings.
  4. Parses returned transcript, normalizes text into 1,000-character segments, anchors `[m:ss]` inline timestamp markers.
  5. Computes 1536-dimensional embeddings for each chunk via AI/ML API (`text-embedding-3-small`).
  6. Inserts chunk records into the `transcripts` table and updates video status to `done`.

#### `chat-agent/index.ts`
- **Role:** Serverless RAG interrogation agent.
- **Workflow:**
  1. Receives `{ video_id, question }`.
  2. Inspects question phrasing using `isMentionCountQuestion()`.
  3. If counting query: Extracts target keyword and scans every chunk in `transcripts` using whole-word regex (`\bkeyword\b`, case-insensitive). Returns exact frequency and all matching timestamp chips.
  4. If semantic query: Computes embedding of the question via AI/ML API, executes RPC `match_transcripts`, retrieves top 8 chunks (threshold: 0.2).
  5. Prompts `gpt-4o-mini` with a strict grounding prompt requiring claims to cite inline timecodes.
  6. Returns structured JSON containing `{ answer, sources, video_title }`.

---

## Data Model

### PostgreSQL Relational Schema

```sql
create extension if not exists vector;

-- Video metadata and pipeline state
create table videos (
  id                  uuid primary key default gen_random_uuid(),
  youtube_url         text not null,          -- standard URL or upload://<filename>
  title               text,
  status              text not null default 'pending', -- pending | downloading | transcribing | processing | done | error
  error_message       text,
  speechmatics_job_id text,                   -- Bright Data snapshot ID or Speechmatics job ID
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Timed transcript chunks and vector embeddings
create table transcripts (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references videos(id) on delete cascade,
  chunk_index int not null,
  content     text not null,                  -- contains inline [m:ss] markers
  status      text not null default 'processing',
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);

-- Cosine vector similarity search index
create index on transcripts using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Scoped vector search RPC function
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
```

### TypeScript Data Interfaces (`src/lib/api.ts`)

```typescript
export interface Video {
  id: string;
  youtube_url: string;
  title: string | null;
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

export interface ChatSource {
  chunk_index: number;
  similarity: number;
  start_seconds?: number;
  timestamp?: string; // "m:ss"
  url?: string;       // Deep link with &t=NNs
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  video_title: string;
}
```

---

## File Structure

```
youtube-transcript-chat/
├── public/                       # Static web assets
├── docs/                         # Project documentation and demo assets
│   ├── coverimage.png            # Application preview screenshot
│   ├── presentation.pdf          # Presentation slide deck
│   ├── pitch.html                # Interactive HTML presentation companion
│   └── topologia.html            # Standalone visual topology diagram
├── src/                          # Application source code
│   ├── components/               # React UI components
│   │   ├── App.tsx               # Root component & state orchestrator
│   │   ├── ChatPanel.tsx         # Conversational Q&A & player drawer
│   │   ├── ErrorBoundary.tsx     # Crash fallback wrapper
│   │   ├── Sidebar.tsx           # Multi-session navigation & status
│   │   ├── VideoSubmission.tsx   # Ingestion forms & sandbox selector
│   │   └── Wordmark.tsx          # Dual-variant brand typography
│   ├── lib/                      # Core logic & utilities
│   │   ├── api.ts                # Client API methods & typings
│   │   ├── conversations.ts      # In-memory session message store
│   │   ├── demoData.ts           # Pre-indexed judge sandbox sessions
│   │   └── supabase.ts           # Supabase client instantiation
│   ├── index.css                 # Tailwind v4 theme & design tokens
│   └── main.tsx                  # Application entry point
├── supabase/                     # Supabase backend definitions
│   └── functions/                # Deno Edge Functions
│       ├── chat-agent/           # RAG retrieval & frequency counting
│       │   └── index.ts
│       ├── process-video/        # Legacy pipeline function
│       │   └── index.ts
│       └── process-video-v2/     # Active multi-provider ingestion function
│           └── index.ts
├── scope.md                      # Devpost Scope planning document
├── prd.md                        # Devpost Product Requirements Document
├── spec.md                       # Devpost Technical Specification
├── ARCHITECTURE.md               # Technical architecture deep dive
├── README.md                     # Project overview and runbook
├── package.json                  # NPM dependencies and scripts
├── tsconfig.json                 # TypeScript compiler configuration
└── vite.config.ts                # Vite bundler configuration
```

---

## External Services and Dependencies

| Service | Endpoint / SDK | Credentials Required | Purpose & Limits |
|---|---|---|---|
| **Supabase** | `https://<ref>.supabase.co` | `VITE_SUPABASE_URL`<br/>`VITE_SUPABASE_ANON_KEY`<br/>`SUPABASE_SERVICE_ROLE_KEY` | Hosts Postgres database, pgvector indexing, and Deno serverless edge runtime. Free tier accommodates proof-of-concept. |
| **Bright Data** | `https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_lk56epmy2i5g7lzu0k` | `BRIGHTDATA_API_KEY` | Fetches YouTube transcripts without datacenter IP blocks (`LOGIN_REQUIRED`). Asynchronous snapshot polling. |
| **Speechmatics** | `https://asr.api.speechmatics.com/v2/jobs/` | `SPEECHMATICS_API_KEY` | High-precision speech-to-text for uploaded MP4 files with millisecond word timestamps and entity recognition. |
| **AI/ML API** | `https://api.aimlapi.com/v1` | `AIML_API_KEY` | OpenAI-compatible gateway powering `text-embedding-3-small` (1536-d) and `gpt-4o-mini` chat completions. |

---

## Important Failure Modes

1. **YouTube Datacenter IP Blocking (`LOGIN_REQUIRED`)**
   - *Problem:* Direct scraping of YouTube caption tracks from AWS or Supabase cloud datacenters gets blocked by YouTube anti-bot mechanisms.
   - *Chosen Fallback:* Route caption extraction through Bright Data's managed Dataset API. If a snapshot takes longer than the initial HTTP request window, the video is marked `transcribing` and the client polls via `resumeVideo()` until complete.
2. **Hallucinated Counts on Frequency Questions**
   - *Problem:* Standard RAG only passes the top 8 semantic chunks to the LLM. Answering "How many times did they say X?" from 8 chunks yields severe undercounts.
   - *Chosen Fallback:* The `chat-agent` detects count inquiries using regex heuristics and pivots to an exact whole-word regular expression scan (`\bkeyword\b`, case-insensitive) across all chunks for that video. If literal hits equal zero, it falls back to standard semantic search.
3. **Third-Party API Rate Limit or Network Outage**
   - *Problem:* Edge Functions fail or external speech APIs throw temporary 5xx errors.
   - *Chosen Fallback:* Edge functions capture errors and write descriptive messages into `videos.error_message`, transitioning the video status to `error`. The UI surfaces a clear alert banner with the specific reason.
4. **Client-Side Rendering Exception**
   - *Problem:* An unexpected data shape or broken link could unmount the React component tree.
   - *Chosen Fallback:* Top-level `ErrorBoundary` catches the failure and renders a recovery screen with options to reload or return to the safe demo sandbox.

---

## What Was Simplified and Why

- **Decoupled In-Memory Conversation Store** instead of a persistent database table for chat history:
  - *Rationale:* Proof-of-concept users interrogate videos in focused, immediate research sessions. Storing chat state in-memory via `useSyncExternalStore` avoids database write churn, complex user row-level security policies, and session auth overhead while maintaining seamless multi-video tab switching.
- **Embedded Sandbox Dataset** instead of live API calls during hackathon evaluation:
  - *Rationale:* Hackathon judges frequently evaluate projects in constrained environments without providing their own paid API keys. Bundling three complete benchmark transcripts in `src/lib/demoData.ts` guarantees zero setup friction and instant sub-second verification.
- **Direct Edge Function Binary Uploads (up to 20 MB)** instead of multi-part cloud storage buckets (S3 / GCS):
  - *Rationale:* Avoiding dedicated cloud storage buckets eliminated significant configuration complexity while adequately supporting typical educational video and audio clips under 20 MB.

---

## Decisions and Open Issues

### Decisions Made
- **Zero Third-Party Keys on the Client:** The frontend only holds the Supabase anonymous public key. All third-party secrets (`BRIGHTDATA_API_KEY`, `SPEECHMATICS_API_KEY`, `AIML_API_KEY`) reside exclusively in encrypted Supabase Edge Function environment variables.
- **Whole-Word Matching for Counts:** Mention count scanning strictly enforces `\b` word boundaries. Querying "government" matches "Government" or "GOVERNMENT", but excludes plurals ("governments") or stems ("governing").
- **Integrated Video Player Drawer:** Implemented as an embedded drawer directly above the chat panel rather than an external window, keeping the conversation and video synchronized on a single screen.

### Open Issues & Next Steps
- **Large File Streaming:** Uploading files larger than 20 MB requires implementing direct-to-storage presigned URLs or client-side audio compression before transmission.
- **Embedding Cache Optimization:** Currently, re-indexing a video re-computes embeddings for all chunks; adding an embedding hash cache would reduce inference costs during repetitive re-runs.
