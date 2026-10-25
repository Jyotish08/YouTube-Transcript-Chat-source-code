---
doc: scope
status: approved
---

# Askable

Make any video askable: interrogate YouTube videos and uploaded recordings in plain language with second-accurate timestamp citations.

## The Unique Kernel

You can Control-F a document; you cannot Control-F a video. Askable eliminates the friction of scrubbing through long-form video content by pairing an AI conversational agent with second-level transcript timecodes, ensuring every generated claim cites verifiable, clickable moments that jump directly to the exact spoken second.

## Who It's For

A researcher, hackathon judge, technical student, or developer who regularly watches 30-to-90-minute lectures, technical presentations, and recorded discussions. Today, they either sit through entire recordings at 2x speed, click blindly across progress bars hoping to catch keywords, or paste raw un-timestamped transcripts into general-purpose LLM windows that hallucinate content without giving any way to verify where or when something was actually said.

## The Core Loop

1. The user opens Askable and enters a video (pasting a YouTube URL, uploading an MP4/video file, or clicking a pre-indexed demo video from the Judge Sandbox).
2. The user submits a plain-language question or selects a suggested exploration prompt (e.g., "What are the most important conclusions?" or "How many times do they mention transformers?").
3. Askable analyzes the spoken transcript and returns a synthesis accompanied by interactive timecode badges.
4. The user clicks a timecode badge to immediately verify the claim—either playing the exact moment in an integrated video drawer or jumping directly to that second on YouTube.

## Inspiration & Identity

- **Mood & Atmosphere:** Dark, focused "screening room" aesthetic. Inspired by high-precision developer tools, chronometry dashboards, and focused media studios.
- **Palette:** Rich obsidian slate surfaces (`oklch(0.14 0.004 285)`) paired with warm amber accenting (`#e8934a`) for brand identity and clean indigo/cyan interactive badges for navigation affordances.
- **Typography:** Crisp sans-serif (`Inter`) for natural conversational reading, accented with technical monospace styling for timestamps, metrics, and video timecodes.
- **Tone:** Fast, objective, and auditable. Every statement must prove itself against primary source video evidence.

## Why This Matters to the Learner

Video has become the dominant medium for deep technical talks, university lectures, and hackathon project demos, yet it remains an opaque black box for information retrieval. Building Askable solves personal study friction by creating a tool that respects the viewer's time—delivering instant answers while maintaining absolute fidelity to the source audio.

## What "Working" Looks Like

A complete, working single-page application where a user can paste a 45-minute YouTube video link (or upload an MP4 lecture), observe background status changes as it processes, and ask complex questions. The "oh, that's cool" moment happens when the assistant responds with an accurate synthesis and the user clicks a `[14:32]` chip, watching an embedded player instantly jump and speak the exact sentence quoted in the chat.

## The POC Boundary

### In Scope for Proof of Concept:
- **Dual Ingestion Paths:** Direct ingestion of public YouTube URLs via managed caption scraping, plus direct file upload (up to 20 MB) for local video/audio files.
- **Automated Transcription & Alignment:** Background extraction of text with second-level timestamps.
- **Vector Retrieval & Exact Mention Counting:** Semantic search over transcript chunks, plus an exact whole-word regular expression scanner for frequency questions (e.g., "How many times did they say X?").
- **Grounded Conversational Interface:** Dedicated multi-turn chat panel per video with suggested inquiry chips, collapsible transcript citation inspectors, and external YouTube timestamp deep links.
- **Embedded Player Synchronization:** Synchronized in-app YouTube player drawer that seeks to the exact second when an answer timestamp chip is clicked.
- **Judge Quick-Access Sandbox:** Three pre-indexed benchmark video sessions accessible with zero configuration and zero API latency.
- **Persistent Multi-Video Sidebar:** Multi-session video list with live status badges (Queued, Retrieving, Transcribing, Indexing, Ready, Failed) and search filtering.

## Later

- Persistent user authentication and multi-user database isolation.
- Support for uploading multi-gigabyte video files via presigned cloud storage uploads.
- Cross-video comparative synthesis (interrogating an entire playlist or lecture series simultaneously).
- Exportable transcript summaries with timestamped markdown and PDF reports.
- Multi-speaker diarization labeling (identifying distinct speakers by name).

## Explicitly Cut

- **Full User Accounts and Authentication:** Cut to ensure zero friction for hackathon evaluators and guests; all sessions run without requiring login screens.
- **Direct Headless Browser Scraping:** Cut because cloud edge runtimes get immediately flagged and IP-blocked with `LOGIN_REQUIRED` challenges by YouTube; delegated to managed caption dataset pipelines.
- **Live WebSocket Streaming Audio:** Cut to keep audio ingestion simple and resilient over HTTP edge boundaries.
- **In-App Video Editing / Clipping:** Cut because Askable is an interrogation and navigation tool, not a video editing suite.
