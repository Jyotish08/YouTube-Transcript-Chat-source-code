---
doc: prd
status: approved
---

# Askable — Product Requirements

A focused desktop web application that allows users to interrogate video content in plain language and receive fact-grounded answers citing the exact second spoken.

Source: `scope.md > Who It's For` and `scope.md > The Unique Kernel`.

---

## The Core Journey

Source: `scope.md > The Core Loop` and `scope.md > What "Working" Looks Like`.

1. **Arrival & Overview:** The user lands on the application and sees a dual-pane workspace: a left navigation sidebar containing previously processed sessions alongside pre-loaded sample sessions, and a main central panel displaying a clean hero header with an ingestion interface.
2. **Video Ingestion or Instant Demo Selection:** The user has two paths:
   - *Instant Path:* Select one of the pre-indexed demo video cards (e.g., "What Do Hackathon Judges Look For?") in the top sandbox banner to immediately open a ready session with zero waiting.
   - *Custom Ingestion Path:* Choose between the "YouTube Link" tab to paste a URL or the "Upload Video" tab to drag-and-drop an MP4/video file (up to 20 MB), then click the submit button.
3. **Non-Blocking Background Processing:** When a custom video is submitted, a new row appears in the sidebar displaying a live status badge (Queued → Retrieving → Transcribing → Indexing). The user is free to click into other sessions or explore demo content while transcription runs in the background.
4. **Conversational Interrogation:** Once indexing completes, the main panel transitions into a dedicated conversation view displaying the video title, duration, author metadata, and three quick-start suggestion pills (e.g., "What is this video about?", "Summarize the key takeaways.").
5. **Prompt Submission:** The user selects a suggestion pill or types a question into the prompt composer (e.g., "What does Joe say about UI polish?" or "How many times do they mention criteria?").
6. **Inspecting Grounded Answers:** The assistant generates a concise, direct answer. Beneath the text, it renders interactive timecode chips indicating every specific moment in the video where the spoken words occurred, alongside match confidence badges and a collapsible source drawer.
7. **One-Click Evidence Verification:** The user clicks a timestamp chip (e.g., `04:15`). An integrated video player drawer expands and immediately synchronizes playback to that exact second, allowing instant verification of the speaker's claim without leaving the screen.

---

## Screens and Layout

The application utilizes a persistent two-panel responsive workspace designed for split-screen efficiency:

### 1. Left Navigation Sidebar (Width: 320px)
- **Top Brand & Action Area:** Displays the brand mark ("Askable"), a live count of ready sessions, a search filter input, and a high-contrast "+ New Video" button.
- **Judge Quick-Access Shortcut:** A dedicated quick-access action button allowing hackathon judges to jump straight into pre-indexed evaluation material in one click.
- **Active / Pending Submission Row:** If a transcription job is currently in progress, a dedicated card appears at the top of the list showing the target filename/URL and a spinning activity indicator.
- **Pre-loaded Sandbox Sessions Group:** A distinct grouped list of curated benchmark videos marked with visual "PRELOADED" badges.
- **User Sessions Group:** Chronologically sorted list of submitted videos showing video titles, upload file names, creation timestamps, and live status badges.
- **Session Controls:** Inline hover affordances for individual video deletion protected by a two-step confirmation toggle.

### 2. Main Content Stage
The main stage toggles between two primary views depending on user selection:
- **View A: Ingestion & Hero Canvas (When "+ New Video" or no active video is selected):**
  - Hero header with bold typography communicating the core value proposition ("Make any video askable. You can Control-F a document. You cannot Control-F a video.").
  - Prominent "Judge Quick Access Sandbox" card highlighting zero-wait, pre-indexed sessions with clickable quick-launch cards.
  - Dual-mode submission card with segmented tabs: "YouTube Link" and "Upload Video".
  - Dedicated URL input field with clear button, or a drag-and-drop dashed dropzone accepting video files up to 20 MB.
  - Dismissible alert banner for reporting submission validation or processing errors.
- **View B: Interactive Conversational Panel (When a video session is active):**
  - **Top Navigation Banner:** Shows the compact brand wordmark, video title, total runtime duration, and contextual metadata.
  - **Header Action Bar:** Houses the "Watch Video" / "Close Player" drawer toggle, a "Clear chat" button with two-step confirmation, and an "Open on YouTube" external link button.
  - **Collapsible In-App Video Player Drawer:** When activated, smoothly expands an embedded player above the chat, automatically seeking to any timecode clicked in the conversation.
  - **Scrollable Message Log:** Alternating chat messages with distinct avatars for user queries and assistant responses. Assistant messages render markdown formatting, auto-linkified external URLs, and interactive timestamp chips.
  - **Transcript Source Inspector:** Collapsible accordion button ("X transcript excerpts used") that expands to show all retrieved speech segments with match percentages.
  - **Suggested Inquiry Bar:** Horizontal row of prompt chips above the input box offering relevant questions to jumpstart inquiry.
  - **Bottom Message Composer:** Auto-expanding multi-line text input with submit button, handling Enter-to-send and Shift+Enter for line breaks.

---

## Look and Feel

Source: `scope.md > Inspiration & Identity`.

- **Visual Theme:** Focused dark "screening room" aesthetic. The interface uses deep obsidian slate backgrounds paired with subtle border outlines to minimize eye fatigue during extended research sessions.
- **Color Hierarchy:**
  - Background Canvas: Dark charcoal/obsidian slate.
  - Surface Cards & Sidebars: Elevated deep gray slate with subtle borders.
  - Brand Accent: Warm amber (`#e8934a`) used for hero highlights, sandbox badges, and brand identity.
  - Interactive Accents: Crisp cyan and soft indigo for active buttons, hover states, and timestamp jump chips.
  - Status Indicators: Subtle color-coded badges for Queued (purple/slate), Transcribing/Indexing (blue/indigo with spinner), Ready (emerald green), and Failed (coral red).
- **Typography:** Modern, clean sans-serif for comfortable reading across long syntheses, paired with a dedicated monospace font for timecodes (`[m:ss]`), runtime durations, and exact metrics.
- **Tone of Copy:** Concise, objective, and authoritative. Empty states explain exactly what the tool does; error banners provide constructive remedies rather than cryptic technical messages.

---

## Features and Behavior

### Video Ingestion and Source Management

Source: `scope.md > The POC Boundary`.

The application accepts both public YouTube video URLs and uploaded recording files.

- As a researcher, I want to paste a YouTube video link so that I can interrogate its spoken content without downloading it.
  - [ ] Supports standard watch URLs, shortened links, embed links, and mobile links.
  - [ ] Automatically strips extra tracking query parameters to ensure clean URL normalization.
  - [ ] Validates the URL structure and displays an immediate inline warning if the link format is invalid.
- As a student, I want to upload a local recording file so that I can interrogate lectures that are not hosted on YouTube.
  - [ ] Supports drag-and-drop and manual file selection of video/audio files (MP4, M4V, MOV, WebM).
  - [ ] Enforces a maximum file size boundary of 20 MB with immediate visual feedback if exceeded.
  - [ ] Displays the selected file's name and size with a clear "Remove" button before submission.

### Judge Quick Access & Pre-indexed Demo Sandbox

Source: `scope.md > What "Working" Looks Like`.

To allow instant evaluation without requiring external transcription latency or third-party API credentials, the system provides curated, pre-indexed demo sessions.

- As a hackathon judge, I want to test video interrogation immediately so that I do not have to wait 2 minutes for speech recognition to complete.
  - [ ] The submission screen displays three prominent quick-access cards representing diverse videos (including a 52-minute Devpost judging workshop).
  - [ ] Clicking any demo card immediately switches the view into an active chat panel populated with custom suggested questions.
  - [ ] Querying a demo video returns sub-second, verified answers with functional timestamp chips.
  - [ ] Pre-indexed demo sessions are permanently protected from accidental deletion.

### Conversational Question & Answering with Deep Jump Links

Source: `scope.md > The Unique Kernel` and `scope.md > The Core Loop`.

The chat panel allows open-ended natural language questions answered strictly from the video's spoken transcript.

- As a user, I want to ask questions about the video and receive answers that cite the exact second spoken.
  - [ ] Assistant responses synthesize information strictly from the spoken transcript.
  - [ ] Every factual claim includes clickable timecode chips formatted as `[m:ss]`.
  - [ ] Hovering over a timecode chip displays the similarity match percentage.
  - [ ] Clicking the timecode button synchronizes the embedded player to that exact second.
  - [ ] Clicking the external icon next to a timecode opens the video in a new browser tab at the exact time offset (`&t=NNs`).
  - [ ] Raw URLs mentioned within assistant responses are automatically converted into clickable hyperlinks.

### Literal Mention Counting and Search

Source: `scope.md > The POC Boundary`.

Standard conversational search frequently fails when asked to count word occurrences because semantic search only evaluates small excerpt windows. Askable introduces an exact frequency verification capability.

- As a user, I want to ask "How many times do they say [word]?" and receive an exact, truthful count.
  - [ ] Detects inquiry phrasing indicating frequency or counting questions (e.g., "how many times", "how often").
  - [ ] Performs an exact, case-insensitive scan across every spoken word boundary in the entire recording.
  - [ ] Matches whole words only, avoiding false positive substring hits.
  - [ ] Returns the exact frequency count accompanied by individual timestamp jump chips for every occurrence.
  - [ ] If no literal matches exist, gracefully falls back to semantic search rather than returning an unhelpful error.

### Interactive Playback and Video Synchronization

Source: `scope.md > What "Working" Looks Like`.

- As a viewer, I want to watch the video alongside the conversation without opening external tabs.
  - [ ] The header includes a "Watch Video" toggle button that expands an embedded video drawer directly above the chat.
  - [ ] Clicking any timestamp chip in any assistant message automatically seeks the video player to that exact second and begins playback.
  - [ ] The drawer includes a "Hide Player" button to collapse the player and expand the reading area when desired.

### Multi-Session Management and Real-Time Status

Source: `scope.md > The POC Boundary`.

- As a multi-tasking user, I want to process multiple videos simultaneously while continuing my current conversation.
  - [ ] Submitting a new video does not interrupt or block the active conversation.
  - [ ] The sidebar displays a live indicator that updates as videos move through queued, transcribing, indexing, and completed states.
  - [ ] Switching between video tabs in the sidebar preserves conversation history and unsent input drafts.
  - [ ] Users can clear the chat history for a session using a two-step confirmation dialog.
  - [ ] Users can delete uploaded sessions from the sidebar, which removes them from the session list.

---

## States and Boundaries

- **First Use / Empty State:**
  - Sidebar shows the three preloaded sandbox sessions.
  - Main panel displays the Hero headline, value proposition banner, judge sandbox cards, and the dual-mode ingestion form.
- **Submission in Progress:**
  - The submit button displays a spinning indicator with label "Submitting...".
  - A transient pending card appears at the top of the sidebar showing the file name or URL with a live "Queued" badge.
- **Background Processing States:**
  - *Queued:* Video received and waiting in line for transcription.
  - *Retrieving / Transcribing:* Audio speech recognition or caption extraction in progress.
  - *Indexing:* Text chunks are being cataloged with timestamps and semantic vectors.
  - *Ready:* Video is fully transcribed and ready for interrogation.
  - *Failed:* Video encountered an extraction error; displays a descriptive error banner explaining the cause.
- **Active Interrogation State:**
  - Chat panel displays header with video title, metadata pills, embedded player toggle, and conversation log.
  - An empty chat displays three contextual suggested question chips.
  - An active query displays a spinning activity indicator while synthesizing answers.
- **Session Persistence:**
  - Active chat logs, in-flight drafts, and selected sessions remain preserved while switching back and forth between different videos in the sidebar.
  - Hard browser refresh reloads stored video sessions and re-seeds the sandbox demo data.

---

## Product Decisions

- **Pre-Indexed Judge Sandbox:**
  - *Decision:* Provide three fully indexed, high-profile demo videos directly in the interface.
  - *Tradeoff:* Requires shipping static transcript excerpts with the client application, but guarantees zero-latency, 100% dependable evaluations for judges without requiring personal API keys.
- **Dual Ingestion Strategy (Captions + Audio ASR):**
  - *Decision:* Ingest YouTube URLs via managed caption pipelines while allowing direct file uploads via high-precision speech-to-text.
  - *Tradeoff:* File uploads require handling binary uploads up to 20 MB, but ensure videos without captions or unreleased private recordings can still be interrogated.
- **Hybrid Retrieval (Vector Search + Literal Regex Scanning):**
  - *Decision:* Intercept frequency-based questions to run a complete whole-word literal scan over all transcript blocks.
  - *Tradeoff:* Adds query pattern detection logic, but solves the chronic AI hallucination problem where language models guess word counts based on incomplete excerpt windows.
- **Non-Modal Synchronized Video Drawer:**
  - *Decision:* Embed the video player inside an expandable top drawer in the chat panel rather than in a pop-up modal or forcing external tab switches.
  - *Tradeoff:* Temporarily reduces vertical chat space while open, but keeps chat context and video playback visible simultaneously.

---

## What We're Building

The proof of concept includes:
1. Dual-pane responsive desktop interface with dark screening-room design.
2. Ingestion pipeline supporting YouTube URLs and video file uploads up to 20 MB.
3. Live status tracking across multi-video sidebar sessions.
4. Three pre-indexed judge sandbox video sessions.
5. Grounded question answering with second-accurate `[m:ss]` timestamp jump chips.
6. Synchronized in-app YouTube player drawer that seeks on timestamp chip clicks.
7. Exact mention counting engine with whole-word regex filtering.
8. Robust validation, inline error alerts, and application-level error boundaries.

---

## Deferred From the POC

Source: `scope.md > Later`.

- **User Accounts and Personal Workspaces:** Omitted to allow frictionless, anonymous exploration.
- **Cross-Video Comparative Search:** Interrogating multiple videos in a single unified conversation.
- **Full Transcript Exporting:** One-click download of timestamped transcripts to Markdown, CSV, or PDF.
- **Cloud Storage for Large Files (> 20 MB):** Supporting multi-hour 4K raw video file uploads via chunked cloud bucket storage.

---

## Possible Later Enhancements

- Automatic chapter generation that segments long videos into topical milestones.
- Speaker diarization labeling so users can query what a specific speaker said during panel debates.
- Browser extension to interrogate YouTube videos directly on youtube.com without leaving the page.

---

## Non-Goals

Source: `scope.md > Explicitly Cut`.

- Askable will NOT provide video editing, trimming, or audio re-encoding capabilities.
- Askable will NOT support real-time live-stream broadcast transcription during the POC.
- Askable will NOT bypass paywalled or private video content requiring user credentials.

---

## Open Questions

- *Resolved:* How to handle YouTube datacenter IP blocking during automated caption retrieval? Resolved by routing through a managed dataset proxy pipeline.
- *Resolved:* How to ensure judges can evaluate the app immediately without waiting 2 minutes for speech recognition? Resolved by pre-indexing three rich benchmark sessions.
- *Deferred:* What is the optimal chunk duration for very long videos (over 2 hours)? The current 1,000-character chunking with inline timecodes works reliably up to 2-hour videos; further token optimizations can wait for future releases.
