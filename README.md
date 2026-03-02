# Video Intelligence Pipeline

A full-stack application that processes long-form videos using AI to generate intelligent insights, structured reports, executive summaries, and interactive chat. Supports **YouTube**, **Google Drive**, and **direct file uploads** as video sources. Built with **FastAPI** (Python) on the backend and **React + Vite** on the frontend, powered by **Google Gemini** for AI analysis and **MongoDB** for persistence.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Backend](#backend)
  - [Entry Point (`main.py`)](#entry-point-mainpy)
  - [Configuration (`config.py`)](#configuration-configpy)
  - [Models](#models)
  - [Routes (API Endpoints)](#routes-api-endpoints)
  - [Services](#services)
  - [Utilities](#utilities)
  - [Helper Scripts](#helper-scripts)
- [Frontend](#frontend)
  - [App Shell & Authentication](#app-shell--authentication)
  - [Pages](#pages)
  - [Components](#components)
- [Processing Pipeline — Step by Step](#processing-pipeline--step-by-step)
- [Credit System](#credit-system)
- [Playlist / Topic Processing](#playlist--topic-processing)
- [Video Chat (AI Q&A)](#video-chat-ai-qa)
- [Environment Variables](#environment-variables)
- [Setup & Installation](#setup--installation)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [API Reference](#api-reference)
- [Deployment Notes](#deployment-notes)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│   Landing Page │ Reports Library │ Topics │ VideoChatBot         │
│         Clerk Authentication  •  Tailwind CSS  •  Vite          │
└─────────────────────────┬────────────────────────────────────────┘
                          │ REST API (HTTP)
┌─────────────────────────▼────────────────────────────────────────┐
│                    Backend (FastAPI + Uvicorn)                   │
│                                                                  │
│  Routes ──► Pipeline ──► Services (Gemini, Drive, YouTube,       │
│                            Credit, Playlist)                     │
│        ▼                                                         │
│  MongoDB (Motor async driver)    Google Drive (frame storage)    │
└──────────────────────────────────────────────────────────────────┘
```

A user submits a video (via URL or upload). The backend creates a **VideoJob** document in MongoDB, then runs the multi-phase processing pipeline as a **BackgroundTask**. The frontend polls the job status endpoint until completion, then renders the full report.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, React Router 7, Vite 7, Tailwind CSS 4, Clerk (auth), Axios |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, Pydantic v2 |
| **AI / ML** | Google Gemini (text model: `gemini-2.0-flash-exp`, vision model: `gemini-2.5-flash`) |
| **Database** | MongoDB (async via Motor 3.3) |
| **Video Processing** | FFmpeg (via `imageio-ffmpeg`), yt-dlp, Playwright (fallback) |
| **Image Processing** | Pillow (PIL), perceptual hashing (dHash), edge-based sharpness scoring |
| **Cloud Storage** | Google Drive API v3 (frame uploads, video downloads) |
| **Authentication** | Clerk (frontend SDK + user ID passed to backend) |

---

## Project Structure

```
├── Backend/
│   ├── main.py                 # FastAPI app entry point
│   ├── config.py               # Central configuration & env vars
│   ├── check_setup.py          # Setup verification script
│   ├── generate_token.py       # Google Drive OAuth token generator
│   ├── requirements.txt        # Python dependencies
│   │
│   ├── models/                 # Pydantic data models & MongoDB schemas
│   │   ├── database.py         # Motor async MongoDB connection
│   │   ├── video_job.py        # VideoJob, Frame, Topic, Transcript models
│   │   ├── topic.py            # Playlist/Topic models
│   │   └── user.py             # User & CreditTransaction models
│   │
│   ├── routes/                 # FastAPI API routers
│   │   ├── video_routes.py     # /api/videos/* endpoints
│   │   ├── topic_routes.py     # /api/topics/* endpoints
│   │   └── user_routes.py      # /api/users/* endpoints
│   │
│   ├── services/               # Core business logic
│   │   ├── pipeline.py         # Main processing pipeline orchestrator
│   │   ├── gemini_service.py   # All Gemini AI interactions
│   │   ├── drive_service.py    # Google Drive API operations
│   │   ├── youtube_service.py  # yt-dlp based YouTube operations
│   │   ├── playwright_youtube_service.py  # Playwright-based fallback downloader
│   │   ├── credit_service.py   # Credit system (deductions, refunds, balances)
│   │   └── playlist_service.py # Playlist orchestration (multi-video topics)
│   │
│   ├── utils/                  # Utility modules
│   │   ├── ffmpeg_utils.py     # FFmpeg wrapper (audio extraction, frame capture)
│   │   ├── image_processing.py # Perceptual hashing, clustering, sharpness
│   │   ├── roi_utils.py        # Region-of-Interest time window merging
│   │   └── cookies.txt         # YouTube authentication cookies (optional)
│   │
│   └── temp/                   # Temporary files (auto-created)
│
├── Frontend/
│   ├── index.html              # HTML shell
│   ├── package.json            # Node dependencies
│   ├── vite.config.js          # Vite + Tailwind plugin config
│   │
│   └── src/
│       ├── main.jsx            # React + Clerk provider mount
│       ├── App.jsx             # Router, auth gate, credit badge
│       ├── App.css             # Global styles
│       ├── index.css           # Base CSS / Tailwind imports
│       │
│       ├── pages/
│       │   ├── Landing.jsx     # Video submission & report viewer
│       │   ├── Reports.jsx     # Personal + public report library
│       │   ├── Topics.jsx      # Playlist topics listing
│       │   └── TopicDetail.jsx # Single topic detail with all videos
│       │
│       └── components/
│           └── VideoChatBot.jsx # AI chatbot for Q&A on processed videos
│
└── README.md
```

---

## Backend

### Entry Point (`main.py`)

The application is bootstrapped with FastAPI and Uvicorn.

**Lifespan management:**
- **Startup:** Connects to MongoDB via the `Database` class, logs the configured Gemini model name, and validates YouTube cookies configuration (file path or browser extraction).
- **Shutdown:** Closes the MongoDB connection gracefully.

**Middleware:**
- CORS is configured with a whitelist of allowed origins defined in `config.py` (includes `localhost:5173`, `localhost:3000`, and production Vercel/Render domains).

**Routers included:**
1. `video_router` — `/api/videos/*`
2. `topic_router` — `/api/topics/*`
3. `user_router` — `/api/users/*`

**Built-in endpoints:**
- `GET /` — Returns API name, version, status, and docs URL.
- `GET /health` — Pings MongoDB and returns health status with the configured model name.

**Server start:** Uvicorn runs on `0.0.0.0` using the `PORT` environment variable (defaults to `8000`).

---

### Configuration (`config.py`)

All configuration is loaded from environment variables via `python-dotenv`. Key settings:

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | — | Google Gemini API key |
| `MODEL` | `gemini-2.0-flash-exp` | Gemini text model for transcription & analysis |
| `MONGODB_URI` | — | MongoDB connection string |
| `MONGODB_NAME` | `VideoProcessor` | Database name |
| `CLIENT_ID` | — | Google OAuth Client ID (Drive) |
| `CLIENT_SECRET` | — | Google OAuth Client Secret (Drive) |
| `DRIVE_FOLDER_ID` | — | Google Drive folder for frame uploads |
| `REFRESH_TOKEN` | — | Google Drive OAuth refresh token |
| `YOUTUBE_COOKIES_PATH` | `None` | Path to `cookies.txt` for authenticated YouTube downloads |
| `YOUTUBE_COOKIES_FROM_BROWSER` | `None` | Browser name to extract cookies from (e.g., `chrome`) |

**Processing constants (hardcoded):**

| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_AUDIO_CHUNK_DURATION` | 300s (5 min) | Maximum audio chunk size for transcription |
| `AUDIO_OVERLAP_DURATION` | 30s | Overlap between audio chunks to avoid cut-off words |
| `KEYFRAME_INTERVAL` | 60s | Coarse frame extraction interval |
| `MAX_FRAMES_PER_VIDEO` | 120 | Maximum frames to extract |
| `MAX_ANALYSIS_FRAMES` | 150 | Maximum frames sent to Gemini for deep analysis |
| `MAX_CONCURRENT_TRANSCRIBES` | 2 | Parallel audio transcription tasks |
| `MAX_CONCURRENT_VISION_TASKS` | 2 | Parallel Gemini Vision API calls |
| `MAX_CONCURRENT_UPLOADS` | 3 | Parallel Drive uploads |
| `AUDIO_SAMPLE_RATE` | 16000 Hz | Audio sample rate for transcription |
| `SIGNUP_BONUS_CREDITS` | 100 | Credits awarded on first sign-up |
| `CREDITS_PER_MINUTE` | 1 | Base cost per minute (public videos) |
| `PRIVATE_CREDIT_MULTIPLIER` | 3 | Private videos cost 3× more |

---

### Models

#### `database.py` — MongoDB Connection

The `Database` class is an async singleton using **Motor** (`AsyncIOMotorClient`). Provides:
- `connect_db()` — Establishes async connection.
- `close_db()` — Closes connection.
- `get_db()` — Returns the database instance for the configured `MONGODB_NAME`.

#### `video_job.py` — VideoJob & Related Models

The central data model for video processing.

**`VideoJob`** — The primary document stored in the `video_jobs` MongoDB collection:

| Field | Type | Description |
|-------|------|-------------|
| `drive_video_url` | `str` | Google Drive video URL |
| `youtube_url` | `str` | YouTube video URL |
| `video_source` | `str` | `"drive"`, `"youtube"`, or `"upload"` |
| `drive_file_id` | `str` | Extracted Google Drive file ID |
| `youtube_video_id` | `str` | Extracted YouTube video ID |
| `uploaded_video_path` | `str` | Local path for uploaded videos |
| `video_name` | `str` | Human-readable video name |
| `user_id` | `str` | Clerk user ID |
| `topic_id` | `str` | Parent topic ID (if part of a playlist) |
| `visibility` | `str` | `"public"` or `"private"` |
| `status` | `str` | `pending`, `downloading`, `extracting`, `transcribing`, `analyzing`, `synthesizing`, `completed`, `failed` |
| `progress` | `float` | 0.0 – 1.0 |
| `transcript` | `List[TranscriptSegment]` | Full transcript with timestamps and speaker labels |
| `topics` | `List[Topic]` | Extracted topic segments with summaries, key points, frames, sub-topics, quotes |
| `frames` | `List[Frame]` | Hero frames with Drive URLs, descriptions, OCR text |
| `executive_summary` | `str` | AI-generated executive summary |
| `key_takeaways` | `List[str]` | Actionable insights |
| `entities` | `Dict` | Named entities (people, companies, concepts, tools) |
| `slide_summary` | `List[Slide]` | 5-slide executive presentation |
| `video_genre` | `str` | Classified genre (e.g., `podcast_panel`, `educational_lecture`) |
| `genre_confidence` | `float` | Genre classification confidence |
| `report` | `Dict` | Full synthesis result object |
| `credits_charged` | `float` | Credits deducted for this job |
| `duration` | `float` | Video duration in seconds |
| `current_action` | `str` | Latest human-readable status message |
| `processing_logs` | `List[Dict]` | History of status messages with timestamps |

**`TranscriptSegment`** — Individual transcript entry with `text`, `start_time`, `end_time`, `speaker`, `confidence`.

**`Topic`** — A logical chapter/section of the video with:
- `title`, `timestamp_range` (start/end in HH:MM:SS), `start_seconds`, `end_seconds`
- `summary`, `key_points`, `quotes`, `visual_cues`
- `frames` (list of `Frame` objects mapped to this topic's time range)
- `sub_topics` (list of `SubTopic` — visual sub-topics with images)

**`Frame`** — A keyframe with `timestamp`, `frame_number`, `drive_url`, `description`, `ocr_text`, `type` (slide, demo, diagram, etc.).

**`SubTopic`** — A visual sub-topic with `title`, `visual_summary`, `timestamp`, `image_url`.

**`Slide`** — An executive slide with `title` and `bullets` (list of strings).

**Request models:** `VideoJobCreate` (Drive URL), `YouTubeJobCreate` (YouTube URL), `UploadJobCreate` (file upload).

**Response models:** `VideoJobResponse` (status polling), `VideoJobResult` (full results), `ReportSummary` (listing).

#### `topic.py` — Playlist/Topic Models

**`Topic`** — Represents a YouTube playlist as a "learning topic":
- `playlist_url`, `title`, `description`, `channel`, `user_id`
- `videos` — List of `TopicVideo` entries (each with `video_url`, `video_title`, `duration`, `job_id`, `status`, `order`)
- `status` — `pending`, `processing`, `completed`, `partial`, `failed`
- `progress` — fraction of completed videos
- `current_video_index` — which video is currently processing

**Generated after all videos complete (curriculum summary):**
- `topic_summary` — AI-generated overview of the entire series
- `learning_objectives` — Specific, measurable learning goals
- `prerequisites` — Required prior knowledge
- `difficulty_level` — beginner / intermediate / advanced / mixed
- `estimated_total_time` — Human-readable total study time
- `chapter_outline` — Per-chapter one-liner with dependency graph

#### `user.py` — User & Credit Models

**`User`** — Stored in the `users` MongoDB collection:
- `clerk_user_id` — Clerk authentication ID
- `credits` — Current credit balance
- `total_credits_earned`, `total_credits_spent` — Lifetime totals

**`CreditTransaction`** — Audit log in `credit_transactions` collection:
- `clerk_user_id`, `amount` (positive = credit, negative = deduction)
- `type` — `"signup_bonus"`, `"video_processing"`, `"refund"`
- `description`, `job_id`, `balance_after`, `created_at`

---

### Routes (API Endpoints)

#### Video Routes (`/api/videos`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/process` | Start processing a Google Drive video. Accepts `VideoJobCreate` body. Checks credits, creates a `VideoJob`, launches background processing. |
| `POST` | `/process-youtube` | Start processing a YouTube video. Accepts `YouTubeJobCreate` body. Same flow as above. |
| `POST` | `/process-upload` | Start processing an uploaded file. Accepts `multipart/form-data` with `file`, `video_name`, `user_id`, `visibility`. Validates file type, saves to `temp/`, launches processing. |
| `GET` | `/status/{job_id}` | Poll job status. Returns `status`, `progress`, `current_action`, `processing_logs`, and video source metadata. |
| `GET` | `/results/{job_id}` | Get full results of a completed job — topics, frames, executive summary, key takeaways, entities, slide summary, genre info. Returns 400 if still processing. |
| `GET` | `/list` | List all jobs with pagination (`limit`, `skip`). Returns `job_id`, `video_name`, `status`, `progress`, `created_at`. |
| `DELETE` | `/{job_id}` | Delete a job and its database record. |
| `GET` | `/reports` | Paginated report listing with filtering. Supports `mode=personal` (user's own) or `mode=public` (other users' public reports). Extracts thumbnail URLs from frames. Query params: `page`, `limit`, `status`, `user_id`, `mode`. |
| `PATCH` | `/{job_id}/visibility` | Toggle report visibility between `public` and `private`. Owner-only (verified by `user_id`). |
| `GET` | `/{job_id}/download/transcript` | Download transcript as JSON or plain text (with timestamps). Format selected via `?format=json\|txt`. |
| `GET` | `/{job_id}/download/audio` | Download the extracted audio file (WAV). |
| `POST` | `/chat/{job_id}` | Chat with a completed video. Sends user question + conversation history (last 5 messages) to Gemini along with the video's full transcript, executive summary, topics, and key takeaways as context. Returns AI response with timestamps and quotes. |

#### Topic Routes (`/api/topics`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/process` | Accept a YouTube playlist URL, extract all videos via yt-dlp, create a `Topic` document, and start sequential processing in background. Returns `topic_id`, `title`, `video_count`, `status`. |
| `GET` | `` | List all topics for a user (filtered by `user_id` query param). Returns `topic_id`, `title`, `channel`, `video_count`, `completed_count`, `status`, `progress`, `topic_summary`, `difficulty_level`, timestamps. |
| `GET` | `/{topic_id}` | Full topic detail including all `TopicVideo` entries, curriculum summary fields (`topic_summary`, `learning_objectives`, `prerequisites`, `difficulty_level`, `estimated_total_time`, `chapter_outline`). |
| `GET` | `/{topic_id}/progress` | Lightweight progress polling — returns `status`, `progress`, `completed_count`, `current_video_index`, `current_video_title`. |

#### User Routes (`/api/users`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/me` | Get current user's credit balance. Auto-creates user with signup bonus (100 credits) on first call. Query param: `user_id`. |
| `GET` | `/me/transactions` | Get credit transaction history. Query params: `user_id`, `limit` (default 50). |
| `GET` | `/estimate-cost` | Estimate credit cost before submission. Query params: `duration_minutes`, `visibility`. Returns `estimated_cost`, rate description. |

---

### Services

#### `pipeline.py` — Processing Pipeline

The `ProcessingPipeline` class orchestrates the entire video-to-report workflow. It is invoked as a **FastAPI BackgroundTask** and runs asynchronously.

**Pipeline Phases:**

1. **Download** (progress 0.05 – 0.10)
   - Determines video source (`drive`, `youtube`, or `upload`).
   - **YouTube:** Downloads via `yt-dlp` with cookie support, proxy support, and multiple format fallback strategies (progressive MP4 preferred, HLS as last resort). Falls back to Playwright-based download if yt-dlp fails.
   - **Google Drive:** Extracts file ID from URL, fetches metadata, downloads via Drive API.
   - **Upload:** Uses the file already saved to `temp/` during the upload route.

2. **Credit Deduction** (after download, once duration is known)
   - Calculates cost based on actual video duration and visibility.
   - Atomically deducts credits. If insufficient, the pipeline stops with a failure status.
   - On pipeline failure after deduction, credits are automatically **refunded**.

3. **Audio Extraction** (progress 0.15 – 0.25)
   - Extracts mono 16kHz WAV audio via FFmpeg.
   - Stores audio path for later download.

4. **Transcription** (progress 0.30 – 0.50)
   - Splits audio into 5-minute chunks with 30-second overlap.
   - Transcribes all chunks **in parallel** (limited by `MAX_CONCURRENT_TRANSCRIBES` semaphore) using Gemini.
   - Each chunk returns segments with `text`, `start_time`, `end_time`, `speaker` labels.
   - **Deduplication:** Overlapping segments from chunk boundaries are merged using a 70% overlap threshold and 2-second gap merging.

5. **Audio Cue Scout** (progress ~0.50)
   - Scans the transcript for phrases that reference visuals (e.g., "as you can see on this chart", "looking at this slide").
   - Returns a list of `visual_cues` with timestamps, cue phrases, confidence, and expected visual type.

6. **Genre Classification** (progress ~0.55)
   - Classifies the video into one of 7 genres using a sample of the transcript:
     - `podcast_panel`, `educational_lecture`, `interview_qna`, `vlog`, `meeting_presentation`, `single_speaker_general`, `unknown`
   - Uses fuzzy matching to normalize genre strings.
   - Genre influences downstream prompts for transcript analysis and synthesis.

7. **Transcript Analysis** (progress 0.55 – 0.60)
   - Analyzes transcript to extract:
     - **Topics** — Logical chapters with timestamp ranges, summaries, key points.
     - **Visual cues** — Phrases referencing on-screen content.
     - **Named entities** — People, companies, concepts, tools.
     - **Key takeaways** — Main insights.
   - Large transcripts (>50,000 chars) are split into ~3 chunks, each analyzed independently, then results are merged and deduplicated.
   - **Ad filtering:** Topics classified as `"ad"` or containing "sponsor" in the title are removed.
   - Genre-specific prompt snippets are appended for tailored analysis.
   - Playlist context (from previously completed videos) is included when processing videos within a topic.

8. **Coarse Visual Sampling** (progress 0.65)
   - Extracts frames every 30 seconds using FFmpeg.

9. **Visual Gatekeeper** (progress 0.65 – 0.70) — Parallel
   - Each coarse frame is evaluated by Gemini Vision **in parallel** (semaphore-limited).
   - Classified into: `slide_presentation`, `software_demo`, `technical_diagram`, `talking_head`, `other`.
   - Frames with `is_useful: false` (e.g., talking heads, transitions, blurry frames) are dropped.
   - Frames with `is_useful: true` are kept for further processing.

10. **ROI Fusion & Dense Sampling** (progress 0.70)
    - Merges audio cue timestamps and visual ROI timestamps into continuous **processing windows**.
    - Each timestamp gets a ±5 second buffer; windows within 5 seconds of each other are merged.
    - Extracts frames at 1 FPS **only within these windows** (dense sampling).
    - Combined with useful coarse frames, deduplicated by timestamp (rounded to nearest second).

11. **Visual Deduplication & Clustering** (progress 0.75)
    - Computes **dHash** (difference hash) for all frames.
    - Clusters similar frames by Hamming distance (threshold: 12 on 64-bit hash).
    - Within each cluster, frames are ranked by **sharpness** (edge variance via Laplacian).
    - Top 5 sharpest candidates per cluster are selected for hero frame analysis.

12. **Hero Frame Selection & Visual Intelligence** (progress 0.75 – 0.85) — Parallel
    - For each visual cluster, Gemini Vision selects the **hero frame** (sharpest, most complete).
    - Extracts: sub-topic title, visual summary (what's visible, not audio), OCR keywords.
    - Results are collected as `visual_subtopics`.

13. **Hero Frame Upload** (progress 0.85) — Parallel
    - Creates a Google Drive folder for the job.
    - Uploads hero frames **in parallel** (semaphore-limited) to Drive.
    - Generates thumbnail URLs (`https://drive.google.com/thumbnail?id=...&sz=w800`).
    - Maps uploads to `frame_analyses` (description, OCR text, insights, Drive URL).

14. **Synthesis** (progress 0.90)
    - Combines transcript analysis and frame analyses into final structured output:
      - Executive summary (3-5 sentences covering the entire video).
      - All topics preserved from transcript analysis (with >80% topic retention check).
      - Key takeaways, entities.
    - Genre-specific synthesis prompts are applied.
    - Post-synthesis ad topic cleanup.

15. **Visual-to-Topic Mapping** (progress 0.90 – 0.95)
    - Uses Gemini to intelligently map visual sub-topics to main transcript topics based on timestamps.
    - Each main topic gets up to 3 most distinct visual sub-topics.
    - Ad/promotional visuals are discarded.
    - Falls back to simple timestamp-based mapping if LLM mapping fails.

16. **5-Slide Executive Summary** (progress 0.95)
    - Generates a 5-slide executive presentation:
      1. **Core Thesis & Context** — Central idea, relevance.
      2. **Key Concepts / Framework** — Building blocks, terminology.
      3. **Deep Insights** — Non-obvious insights, trade-offs.
      4. **Practical Applications** — Real-world usage, implementation.
      5. **Strategic Takeaways & Next Moves** — Implications, action items.
    - Each slide has a title and 4-6 bullet points.

17. **Topic Building** (progress 0.95 – 1.0)
    - Constructs final `Topic` Pydantic objects with:
      - Timestamp-matched frames from `frame_analyses`.
      - Visual sub-topics (with hero frame Drive URLs).
      - Validated timestamp ranges.

18. **Completion**
    - Stores all results in MongoDB.
    - Cleans up temporary files (keeps audio for downloads, keeps uploaded videos).
    - On failure: refunds any charged credits automatically.

**Job Status Logging:**
Every pipeline step pushes a human-readable `message` to `processing_logs` (with timestamp) and sets `current_action` for real-time frontend display.

---

#### `gemini_service.py` — AI Service

Handles all Google Gemini API interactions. Uses two model instances:
- **Text model** (`gemini-2.0-flash-exp`) — Transcription, analysis, synthesis, genre classification, chat.
- **Vision model** (`gemini-2.5-flash`) — Frame evaluation, cluster analysis, hero frame selection.

**Key methods:**

| Method | Purpose |
|--------|---------|
| `classify_video_genre()` | Classifies video genre from a transcript sample (~8000 chars). Returns genre, confidence, reason. |
| `detect_transcript_visual_cues()` | Scans transcript for speaker references to on-screen visuals. Returns timestamps with cue phrases. |
| `evaluate_frame_content()` | Classifies a single frame as useful (slide/demo/diagram) or junk (talking head/transition). |
| `transcribe_audio()` | Transcribes an audio chunk with speaker diarization. Returns segments with timestamps, speaker labels. Falls back to simple transcription on failure. |
| `analyze_transcript()` | Extracts topics, entities, key takeaways, visual cues from transcript text. Handles chunked analysis for large transcripts (>50k chars). |
| `analyze_frames()` | Batch-analyzes frames with Gemini Vision (batches of 2). Extracts description, OCR text, type, insights. |
| `analyze_frame_clusters()` | Selects hero frames from visual clusters. Extracts sub-topic titles and visual summaries. |
| `map_visuals_to_topics()` | Maps visual sub-topics to main transcript topics using LLM reasoning. |
| `synthesize_results()` | Combines transcript and frame analyses into final report with executive summary. |
| `generate_slide_summary()` | Generates 5-slide executive presentation from the full report context. |
| `generate_topic_summary()` | Generates curriculum-level summary for playlist topics (learning objectives, prerequisites, chapter outline). |

**Genre-aware prompting:** The service maintains a `genre_prompt_snippets` dictionary with analysis and synthesis prompt fragments for each genre. These are appended to base prompts to produce genre-appropriate output.

**Error handling:** All Gemini calls use `retry_with_backoff` (3 retries, exponential delay starting at 2 seconds). JSON parsing uses aggressive error recovery (`_parse_json_response`) including comment removal, trailing comma cleanup, and newline-in-string fixes.

---

#### `drive_service.py` — Google Drive Service

Manages all Google Drive API interactions using OAuth2 credentials.

**Thread safety:** Uses `threading.local()` for per-thread Drive service instances (since `httplib2` is not thread-safe).

**Key methods:**

| Method | Description |
|--------|-------------|
| `extract_file_id()` | Parses Google Drive URLs to extract file IDs. Handles `/file/d/` and `?id=` formats. |
| `download_file()` | Downloads a file from Drive with progress reporting. |
| `get_file_metadata()` | Retrieves file metadata (name, size, MIME type). Supports shared drives. |
| `create_folder()` | Creates a folder in Drive (optionally under a parent). |
| `upload_file()` | Uploads a file with 5-retry exponential backoff, rate limiting (0.5s delay), and automatic re-authentication on token expiry. |
| `_set_file_permission()` | Sets `anyone:reader` permission on uploaded files for public access. |
| `delete_file()` | Deletes a file from Drive. |

---

#### `youtube_service.py` — YouTube Service

Handles YouTube video downloading and metadata extraction via **yt-dlp**.

**Key methods:**

| Method | Description |
|--------|-------------|
| `extract_video_id()` | Parses YouTube URLs (youtube.com/watch, youtu.be, embed) to extract 11-character video IDs. |
| `get_video_info()` | Fetches video metadata (title, duration, description, uploader) without downloading. Supports proxy and cookies. |
| `extract_playlist_info()` | Extracts all video metadata from a playlist without downloading. Returns playlist title, channel, and video list with URLs, titles, durations, and order. |
| `download_video()` | Downloads a video with multiple format fallback strategies: 1) Progressive MP4, 2) Non-HLS format, 3) Best available. Supports cookies (file-based for servers, browser-based for local), proxy, and progress reporting. |

**Cookie resolution:** The `_resolve_cookies_path()` method searches for the cookies file across multiple locations: absolute path, relative to CWD, relative to Backend directory, relative to utils directory.

---

#### `playwright_youtube_service.py` — Playwright Fallback

A fallback YouTube downloader using **Playwright** (headless Chromium) that downloads via a third-party site (`vidssave.com`). Used when yt-dlp fails (e.g., due to bot detection without cookies).

**Flow:**
1. Launches headless Chromium with a desktop user agent.
2. Navigates to `vidssave.com/yt`.
3. Enters the YouTube URL and submits.
4. Looks for quality-specific download links (720p, 1080p, MP4).
5. Initiates the download and saves to the target path.
6. Takes error screenshots on failure for debugging.

---

#### `credit_service.py` — Credit System

Manages the credit-based usage system with atomic MongoDB operations.

**Methods:**

| Method | Description |
|--------|-------------|
| `calculate_cost()` | Calculates credit cost: `ceil(minutes × CREDITS_PER_MINUTE)`. Private videos multiply by `PRIVATE_CREDIT_MULTIPLIER` (3×). Minimum charge: 1 credit. |
| `get_or_create_user()` | Atomic upsert — creates user with signup bonus (100 credits) on first call, or returns existing user. Logs signup bonus transaction. |
| `get_balance()` | Returns current credit balance. |
| `check_credits()` | Pre-submission check — returns `true` if balance > 0. |
| `deduct_credits()` | Atomically deducts credits using `$gte` guard (only succeeds if balance ≥ amount). Logs transaction. Returns `{success, balance, charged}`. |
| `refund_credits()` | Refunds credits after pipeline failure. Increments balance, decrements `total_credits_spent`. Logs refund transaction. |
| `get_transactions()` | Returns recent transactions sorted by date (newest first). |

---

#### `playlist_service.py` — Playlist Orchestration

Manages YouTube playlist processing as multi-video "topics".

**`create_topic_from_playlist()`:**
1. Extracts playlist metadata via `youtube_service.extract_playlist_info()`.
2. Builds `TopicVideo` list with URLs, titles, durations, and order.
3. Creates a `Topic` document in MongoDB.

**`process_topic()`:**
1. Processes videos **sequentially** (one at a time).
2. For each video:
   - Creates a `VideoJob` linked to the topic.
   - Builds **playlist context** from previously completed videos (summaries and key takeaways) to avoid redundancy and highlight new content.
   - Runs `pipeline.process_video()` with the playlist context.
   - Updates topic progress after each video.
3. Handles per-video failures gracefully (continues to next video).
4. After all videos: sets final status (`completed` or `partial`).
5. Generates **curriculum-level summary** via Gemini:
   - Topic summary, learning objectives, prerequisites.
   - Difficulty level, estimated total time.
   - Chapter outline with dependency graph (`depends_on` array).

---

### Utilities

#### `ffmpeg_utils.py` — FFmpeg Wrapper

Uses `imageio-ffmpeg`'s bundled FFmpeg binary (falls back to system FFmpeg).

| Method | Description |
|--------|-------------|
| `check_ffmpeg()` | Verifies FFmpeg availability. |
| `get_video_duration()` | Parses video duration from FFmpeg stderr output. |
| `extract_audio()` | Extracts mono 16kHz PCM WAV audio from video. |
| `split_audio()` | Splits audio into overlapping chunks (default 5 min with 30s overlap). |
| `extract_keyframes()` | Extracts frames at regular intervals (default 60s). |
| `extract_dense_frames()` | Extracts frames at 1 FPS only within specified time windows. Renames output files with semantic timestamps. |
| `format_timestamp()` | Converts seconds to `HH:MM:SS` format. |

#### `image_processing.py` — Image Processing

Pure PIL-based (no OpenCV/NumPy dependency).

| Method | Description |
|--------|-------------|
| `calculate_phash()` | Computes **dHash** (difference hash) — resizes to 9×8 grayscale, compares adjacent pixels, produces 64-bit hash as hex string. |
| `calculate_blur()` | Estimates sharpness using edge variance (PIL `FIND_EDGES` filter + `ImageStat.Stat.var`). Higher = sharper. |
| `cluster_frames()` | Groups frames by perceptual similarity using Hamming distance on dHash. Returns clusters sorted by sharpness with top-5 candidates per cluster. |

#### `roi_utils.py` — Region of Interest Merging

| Function | Description |
|----------|-------------|
| `merge_time_windows()` | Collects timestamps from audio cues and visual ROIs, creates ±buffer windows (default ±5s), sorts, and merges overlapping/adjacent windows (gap < 5s). Returns list of `(start, end)` tuples. |

---

### Helper Scripts

#### `check_setup.py`

Verifies the development environment:
1. Python version ≥ 3.10.
2. FFmpeg installation.
3. `.env` file existence.
4. Key Python packages (fastapi, google.generativeai, pymongo, cv2).

#### `generate_token.py`

Interactive script to generate a Google Drive OAuth refresh token:
1. Reads `CLIENT_ID` and `CLIENT_SECRET` from `.env`.
2. Runs local OAuth flow (opens browser at port 8080).
3. Requests Drive scopes: `drive.readonly`, `drive.file`, `drive.metadata.readonly`.
4. Outputs the refresh token for copying into `.env`.

---

## Frontend

### App Shell & Authentication

The frontend uses **Clerk** for authentication. All routes are protected behind a `<SignedIn>` gate.

**`main.jsx`:**
- Wraps the app in `<ClerkProvider>` with the publishable key from `VITE_CLERK_PUBLISHABLE_KEY`.

**`App.jsx`:**
- Auth header with Sign In / Sign Up buttons (when signed out) or user avatar + credits badge (when signed in).
- **CreditsBadge** component: Fetches and displays the user's credit balance, refreshing every 30 seconds.
- When signed out: shows a landing gate with "Sign in to get started".
- When signed in: renders the router with 4 routes.

**Routes:**

| Path | Page | Description |
|------|------|-------------|
| `/` | `Landing` | Video submission form & report viewer |
| `/reports` | `Reports` | Personal and public report library |
| `/topics` | `Topics` | Playlist topics listing |
| `/topics/:topicId` | `TopicDetail` | Single topic detail page |

---

### Pages

#### `Landing.jsx` — Video Submission & Report Viewer

The primary user interface. Handles the entire video processing workflow.

**Submission Form:**
- **URL input** — Accepts Google Drive or YouTube URLs. Auto-detects source type (YouTube, Drive, or Playlist) from URL patterns.
- **File upload** — Allows direct video file upload (MP4, MOV, AVI, MKV, WEBM, M4V).
- **Source toggle** — Manual source type override (Auto / YouTube / Google Drive / Upload).
- **Visibility selector** — Public (1 credit/min) or Private (3 credits/min).
- **Video name** — Optional custom name.
- Pre-submission credit check (disallow submit if balance is 0).

**Processing Status:**
- Polls `/api/videos/status/{job_id}` every 8 seconds.
- Displays:
  - Status text (e.g., "Transcribing", "Analyzing").
  - Progress bar (0–100%).
  - Current action message from `current_action`.
  - Scrollable processing log with timestamped messages.

**Report Viewer (when completed):**
- **Navigation tabs:** Summary | Topics Covered | Key Frames | Transcript | 5-Slide Summary
- Can load reports from URL query param (`?jobId=...`).

**Summary Tab:**
- Video metadata badge (duration, genre with confidence %, topic count, frame count).
- Video embed (YouTube iframe or Drive preview based on source).
- Executive summary.
- Key takeaways list.
- Entities grid (People, Companies, Concepts, Tools).

**Topics Covered Tab:**
- Expandable topic cards with:
  - Topic title and timestamp range.
  - Summary and key points.
  - Quotes (if any).
  - Visual sub-topics — each with hero frame image, title, and visual summary.
  - Frames carousel — clickable thumbnails that open in new tab.

**Key Frames Tab:**
- Grid of all hero frames with description, OCR text, type badge, and timestamp.

**Transcript Tab:**
- Full transcript with timestamps and speaker labels.
- Download buttons for JSON and TXT formats.
- Download button for audio file (WAV).

**5-Slide Summary Tab:**
- Renders the executive presentation as styled slide cards.
- Each slide shows title and bullet points.

**Video Chatbot:**
- The `VideoChatBot` component is rendered alongside the report when a job is completed. Allows interactive AI Q&A about the video content.

#### `Reports.jsx` — Report Library

Two-tab view:
1. **My Reports** — User's own completed reports (fetched with `mode=personal`).
2. **Public Library** — Other users' public reports (fetched with `mode=public`).

**Features:**
- Paginated grid of report cards.
- Each card shows: thumbnail, video name, genre badge, duration, topic count, visibility badge, credits charged, executive summary preview.
- Click to view: navigates to `/?jobId={id}`.
- Visibility toggle (public ↔ private) on personal reports via `PATCH /api/videos/{id}/visibility`.

#### `Topics.jsx` — Playlist Topics

- Fetches all topics for the current user.
- Displays topic cards with: title, channel, video count, completion progress, status badge, difficulty level, creation date.
- Click to navigate to `/topics/{topicId}`.

#### `TopicDetail.jsx` — Topic Detail

- Shows full topic information: title, channel, playlist URL link, status, progress bar, curriculum summary.
- **Curriculum Summary section:** Topic summary, learning objectives, prerequisites, difficulty level, estimated time.
- **Chapter Outline:** Ordered list with dependency indicators.
- **Video List:** Each video shows title, status badge, duration. Completed videos link to their report (`/?jobId={id}`).

---

### Components

#### `VideoChatBot.jsx` — AI Chatbot

A floating chat widget for interactive Q&A about processed videos.

**Features:**
- Toggleable chat window (floating button in bottom-right).
- Maintains conversation history (sent to backend as context, last 5 messages).
- Sends questions to `POST /api/videos/chat/{job_id}`.
- Renders AI responses with basic Markdown support (bold, headers, bullets, code blocks, timestamps).
- Auto-scrolls to latest message.
- Loading indicator while waiting for response.

---

## Processing Pipeline — Step by Step

Below is the complete data flow for a single video:

```
User submits URL/file
        │
        ▼
[Route] Creates VideoJob in MongoDB (status: pending)
        │
        ▼
[BackgroundTask] pipeline.process_video(job_id)
        │
        ├── 1. Download video (Drive API / yt-dlp / local file)
        ├── 2. Deduct credits (atomic, with refund on failure)
        ├── 3. Extract audio (FFmpeg → 16kHz mono WAV)
        ├── 4. Split audio into 5-min overlapping chunks
        ├── 5. Transcribe chunks in parallel (Gemini text model)
        ├── 6. Deduplicate overlapping transcript segments
        ├── 7. Audio Cue Scout (detect visual references in transcript)
        ├── 8. Classify video genre (podcast, lecture, vlog, etc.)
        ├── 9. Analyze transcript (topics, entities, takeaways)
        ├── 10. Filter ad/sponsorship topics
        ├── 11. Coarse frame extraction (every 30s)
        ├── 12. Visual Gatekeeper (classify frames in parallel)
        ├── 13. ROI Fusion (merge audio + visual cues into windows)
        ├── 14. Dense frame extraction (1 FPS in ROI windows only)
        ├── 15. Combine & deduplicate all frames
        ├── 16. Perceptual hash clustering (dHash)
        ├── 17. Hero frame selection per cluster (Gemini Vision)
        ├── 18. Upload hero frames to Drive (parallel)
        ├── 19. Synthesize full report (executive summary, topics, takeaways)
        ├── 20. Map visual sub-topics to transcript topics
        ├── 21. Generate 5-slide executive summary
        ├── 22. Build final Topic objects with frames
        ├── 23. Store results in MongoDB
        └── 24. Cleanup temp files (keep audio + uploaded video)
```

---

## Credit System

| Event | Amount |
|-------|--------|
| **Sign-up bonus** | +100 credits |
| **Public video processing** | -1 credit per minute (rounded up) |
| **Private video processing** | -3 credits per minute (rounded up) |
| **Minimum charge** | 1 credit per video |
| **Failed job refund** | Full refund of charged amount |

- Credits are deducted **after download** (when actual duration is known).
- Deduction is **atomic** (MongoDB `$gte` guard prevents negative balance).
- All transactions are logged in the `credit_transactions` collection with full audit trail.
- Pre-submission check prevents jobs from starting if balance is 0.

---

## Playlist / Topic Processing

1. User submits a YouTube playlist URL.
2. Backend extracts all video metadata via yt-dlp (`extract_flat` mode — no downloads).
3. A `Topic` document is created with all videos listed as `pending`.
4. Videos are processed **sequentially** — each goes through the full pipeline.
5. **Playlist context** is passed to each subsequent video:
   - Summaries and key takeaways from previously completed videos.
   - Gemini is instructed to avoid re-explaining covered concepts and highlight new material.
6. After all videos complete, a **curriculum summary** is generated:
   - Overall topic summary, learning objectives, prerequisites.
   - Difficulty level classification.
   - Estimated total study time.
   - Chapter outline with inter-chapter dependencies.

---

## Video Chat (AI Q&A)

After a video is processed, users can ask questions about it via the chat interface.

**How it works:**
1. Frontend sends the user's question + last 5 conversation entries to `POST /api/videos/chat/{job_id}`.
2. Backend retrieves the job's full transcript, executive summary, topics, and key takeaways.
3. Constructs a context prompt positioning Gemini as a "Video Insights Assistant" with access to all video data.
4. Gemini generates a response referencing specific timestamps and quotes.
5. Response is returned and rendered with Markdown formatting.

---

## Environment Variables

Create a `.env` file in the `Backend/` directory:

```env
# Gemini AI
GEMINI_API_KEY=your_gemini_api_key
MODEL=gemini-2.0-flash-exp

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
MONGODB_NAME=VideoProcessor

# Google Drive OAuth
CLIENT_ID=your_google_client_id
CLIENT_SECRET=your_google_client_secret
DRIVE_FOLDER_ID=your_drive_folder_id
REFRESH_TOKEN=your_refresh_token

# YouTube (optional)
YOUTUBE_COOKIES_PATH=utils/cookies.txt
# YOUTUBE_COOKIES_FROM_BROWSER=chrome

# Proxy (optional)
# PROXY_URL=http://your-proxy:port

# Server
PORT=8000
```

Create a `.env` file in the `Frontend/` directory (or set in your deployment platform):

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
```

---

## Setup & Installation

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**
- **FFmpeg** (auto-bundled via `imageio-ffmpeg`, or install system-wide)
- **MongoDB** instance (local or Atlas)
- **Google Cloud Project** with Drive API enabled
- **Gemini API Key** (Google AI Studio)
- **Clerk account** for authentication

### Backend Setup

```bash
cd Backend

# Create virtual environment
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers (for fallback YouTube download)
playwright install chromium

# Create .env file with your credentials (see Environment Variables section)

# Verify setup
python check_setup.py

# Generate Google Drive refresh token (first time only)
python generate_token.py

# Start the server
python main.py
# Or with auto-reload for development:
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd Frontend

# Install dependencies
npm install

# Create .env file
# VITE_API_BASE_URL=http://localhost:8000
# VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Start dev server
npm run dev

# Build for production
npm run build
```

---

## API Reference

### Videos

```
POST   /api/videos/process          — Process Google Drive video
POST   /api/videos/process-youtube   — Process YouTube video
POST   /api/videos/process-upload    — Process uploaded video file
GET    /api/videos/status/{job_id}   — Poll job status
GET    /api/videos/results/{job_id}  — Get completed job results
GET    /api/videos/list              — List all jobs (paginated)
DELETE /api/videos/{job_id}          — Delete a job
GET    /api/videos/reports           — List reports (personal/public)
PATCH  /api/videos/{job_id}/visibility — Toggle visibility
GET    /api/videos/{job_id}/download/transcript?format=json|txt
GET    /api/videos/{job_id}/download/audio
POST   /api/videos/chat/{job_id}     — Chat with video AI
```

### Topics

```
POST   /api/topics/process           — Process YouTube playlist
GET    /api/topics                    — List user's topics
GET    /api/topics/{topic_id}         — Get topic detail
GET    /api/topics/{topic_id}/progress — Poll topic progress
```

### Users

```
GET    /api/users/me?user_id=...              — Get credit balance
GET    /api/users/me/transactions?user_id=...  — Transaction history
GET    /api/users/estimate-cost?duration_minutes=...&visibility=... — Cost estimate
```

### Health

```
GET    /         — API info
GET    /health   — Health check (DB ping + model info)
```

Interactive API documentation is available at `/docs` (Swagger UI) when the server is running.

---

## Deployment Notes

- **Backend** is designed for deployment on platforms like **Render**. Concurrency settings (`MAX_CONCURRENT_*`) should be tuned based on available RAM:
  - Free tier (512 MB): Use 2 concurrent tasks.
  - Starter (2 GB): Use 5 concurrent tasks.
  - Pro (4 GB+): Use 10+ concurrent tasks.
- **Frontend** is designed for deployment on **Vercel** (or any static hosting). Set `VITE_API_BASE_URL` to the backend URL.
- CORS origins in `config.py` must include the production frontend domain.
- YouTube cookies file (`cookies.txt`) should be deployed alongside the backend for authenticated downloads.
- The `temp/` directory is auto-created and used for intermediate files. Ensure sufficient disk space.
- Audio files are retained after processing (for transcript/audio download endpoints). Implement a cleanup policy for production.
- The `PORT` environment variable is respected for the server port (Render sets this automatically).
