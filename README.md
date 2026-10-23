# 💡 Lumen Notebook

> A fast, privacy-conscious AI research assistant inspired by Google NotebookLM. Grounded source citations, audio podcast scripts, study guides, YouTube transcripts, and OCR document parsing — powered by Groq LPUs, Gemini embeddings, FastAPI, and React.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF.svg?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Groq](https://img.shields.io/badge/LLM-Groq%20Cloud-f55036.svg?style=flat-square)](https://groq.com)
[![Gemini](https://img.shields.io/badge/Embeddings-Gemini%20text--embedding--004-4285F4.svg?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)
[![ChromaDB](https://img.shields.io/badge/Vector%20Store-ChromaDB-FF6600.svg?style=flat-square)](https://www.trychroma.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

---

## 📖 Why Lumen Notebook?

General-purpose chatbots (like vanilla ChatGPT or Claude) are great for open-ended brainstorming, but they struggle when you need **verifiable, hallucination-free research across your own private documents**. Either they lose context, invent facts, or cost a fortune in token context windows.

**Lumen Notebook** is an open-source, self-hostable research companion. You create dedicated notebooks for projects, upload messy PDFs, lecture slides, YouTube videos, and research papers, and interact with an AI that answers questions **strictly referencing your sources with clickable citations**.

### Key Design Goals:
- **Zero Server Starvation**: Running heavy vector models locally on a cheap 1-vCPU cloud instance often freezes the event loop. Lumen uses high-speed cloud embeddings and offloads indexing to background workers so uploads return in under 300ms.
- **Cost-Effective & Fast**: By pairing **Google's `text-embedding-004`** with **Groq's LPU inference** (delivering 300+ tokens/sec on open models like Qwen 27B and LLaMA 3.3 70B), queries feel instant without burning expensive GPUs.
- **Fail-Safe Reliability**: Built with graceful fallbacks across the board — if AWS RDS PostgreSQL drops or times out, it silently falls back to SQLite; if Gemini embedding API is unreachable, it falls back to local MiniLM; if digital PDF text is empty, it runs RapidOCR.

---

## ✨ Features

### 1. Multi-Modal Source Ingestion
Feed diverse materials into any notebook:
- **PDF Documents**: Dual-pass text extraction. It first extracts selectable text via `pypdf`. If the PDF is scanned or image-based, it automatically triggers a headless OCR pipeline (`RapidOCR` + `pypdfium2`) to pull text from scanned pages.
- **YouTube Videos**: Paste any standard or shortened YouTube URL. Lumen pulls the complete, timestamped transcript using `youtube-transcript-api` without downloading video files.
- **Web Articles & Blogs**: Scrapes web pages with `BeautifulSoup`, stripping away navigation menus, cookie banners, and ads to extract pure article copy.
- **Live Google Search Discovery**: Researching a topic from scratch? Search Google directly from the modal to discover top authoritative articles and ingest them in one click.
- **Pasted Text & Notes**: Quickly paste raw notes, transcripts, or snippets.
- **Batch Upload Queue**: Drag and drop multiple files simultaneously with an interactive staging queue.

### 2. Grounded Chat with Interactive Citations
- **Source-Restricted Grounding**: Answers are strictly synthesized from retrieved context chunks. If the answer isn't in your sources, the model states so rather than making up facts.
- **Clickable Inline Citations (`[1]`, `[2]`)**: Every claim references its source. Clicking a citation highlights the exact excerpt and document it was drawn from.
- **Source Filtering / Checkboxes**: Focus your conversation on a subset of documents by simply toggling sources on or off in the sidebar.

### 3. Studio Artifact Generation
Inspired by NotebookLM, the Studio transforms your raw sources into structured learning artifacts:
- 🎙️ **Audio Overview**: Generates a natural, engaging podcast dialogue between two AI co-hosts (Alex and Taylor) debating and summarizing your materials.
- 📚 **Study Guide**: Creates an organized study cheat-sheet with core themes, detailed section breakdowns, a glossary of key terms, and practice quiz questions with answers.
- 📋 **Briefing Doc**: Synthesizes an executive overview, background context, key findings, and actionable next steps.
- ❓ **FAQ Generator**: Produces a comprehensive list of frequently asked questions and clear answers derived from your sources.
- ✍️ **Custom Prompts**: Ask the studio to generate timelines, comparison tables, or essays tailored to your exact prompt.

### 4. Integrated Notebook Scratchpad
- A built-in Markdown note editor alongside your chat.
- One-click **"Save to Note"** button on any chat answer to persist important insights immediately without leaving your workspace.

---

## 🛠️ Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────┐
│             Frontend (React 19 + Vite 8)               │
│   • Dark Mode Glassmorphism UI (Pure CSS)              │
│   • Multi-pane Layout (Sources | Chat | Studio/Notes)  │
│   • Firebase Authentication (Google Auth / Email)      │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON REST APIs
┌──────────────────────────▼─────────────────────────────┐
│                 FastAPI Backend (Python)               │
│   • Async Uvicorn Server & FastAPI BackgroundTasks     │
│   • S3 Storage Service + Local Disk Fallback           │
│   • SQLAlchemy ORM (PostgreSQL RDS + SQLite fallback)   │
└──────┬──────────────────┬──────────────────┬───────────┘
       │                  │                  │
┌──────▼────────┐  ┌──────▼────────┐  ┌──────▼────────┐
│  RAG Pipeline │  │  Scrapers/OCR │  │  LLM Engine   │
│ • Gemini 004  │  │ • RapidOCR    │  │ • Groq LPU    │
│   (768-dim)   │  │ • PyPDFium2   │  │   (Qwen 27B / │
│ • MiniLM fallback│ • YouTube API │  │   LLaMA 3.3)  │
│ • ChromaDB    │  │ • BS4 Scraper │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
```

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) with asynchronous endpoint routing and background task execution.
- **LLM Inference**: [Groq Cloud](https://groq.com/) using fast LPU hardware (`qwen/qwen3.8-27b` or `llama-3.3-70b-versatile`).
- **Embedding Models**:
  - **Primary**: Google Gemini `text-embedding-004` (768 dimensions) via `langchain-google-genai`.
  - **Fallback**: Hugging Face `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions) via `langchain-huggingface`.
- **Vector Database**: [ChromaDB](https://www.trychroma.com/) for chunk storage, metadata tagging, and cosine similarity retrieval.
- **Relational Storage**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) with PostgreSQL (`psycopg2`) on AWS RDS, with auto-fallback to SQLite (`notebooks.db`).
- **Object Storage**: [boto3](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html) integrating with Amazon S3 (with local `./storage/uploads` fallback).
- **OCR Engine**: `rapidocr-onnxruntime`, `pypdfium2`, and `opencv-python-headless`.

### Frontend
- **Core**: [React 19](https://react.dev/) bundled with [Vite](https://vitejs.dev/).
- **Design System**: Tailored pure CSS (`index.css`) featuring a custom dark theme, sleek glassmorphism, responsive split-pane layout, and micro-interactions. No heavyweight utility CSS frameworks.
- **Icons**: [Lucide React](https://lucide.dev/).
- **Markdown Rendering**: [Marked](https://marked.js.org/) for fast rendering of math, tables, code blocks, and studio notes.
- **Auth**: [Firebase](https://firebase.google.com/) Client SDK.

---

## 📁 Repository Structure

```
lumen-notebook/
├── backend/
│   ├── app/
│   │   ├── aws_service.py       # S3 uploads, file validation, and RapidOCR fallback
│   │   ├── config.py            # Pydantic Settings & environment variables
│   │   ├── database.py          # SQLAlchemy session & fallback SQLite handler
│   │   ├── llm.py               # Groq LLM client, prompts, and studio generators
│   │   ├── main.py              # FastAPI endpoints & background tasks
│   │   ├── models.py            # Database tables (Notebook, Source, Message, Note)
│   │   ├── rag.py               # Chunking, Gemini/MiniLM embeddings, ChromaDB RAG
│   │   ├── schemas.py           # Pydantic request & response schemas
│   │   └── scrapers.py          # YouTube transcripts, web articles & Google search
│   ├── Dockerfile               # Multi-stage production container with OCR libraries
│   ├── requirements.txt         # Pinned Python dependencies
│   └── .env.example             # Example configuration file
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AddSourceModal.jsx     # Source ingestion dialog (Dropzone, URL, YouTube, Search)
│   │   │   ├── ChatArea.jsx           # Grounded conversation thread & citation pills
│   │   │   ├── ChatPanel.jsx          # Chat layout wrapper
│   │   │   ├── Icons.jsx              # Centralized Lucide icon exports
│   │   │   ├── NoteViewerModal.jsx    # Studio artifact reader & editor
│   │   │   ├── NotebooksDashboard.jsx # Notebook grid & creation screen
│   │   │   ├── NotesPanel.jsx         # Scratchpad notebook editor
│   │   │   ├── Sidebar.jsx            # Navigation & notebook switcher
│   │   │   ├── SourceCard.jsx         # Individual source display card
│   │   │   ├── SourceSelector.jsx     # Source toggle checklist
│   │   │   ├── SourceViewerModal.jsx  # Original source viewer & text excerpt preview
│   │   │   ├── SourcesPanel.jsx       # Left sidebar list of sources
│   │   │   └── StudioPanel.jsx        # Podcast, study guide, and briefing doc actions
│   │   ├── App.jsx                    # Root app state & routing
│   │   ├── firebase.js                # Firebase auth initialization
│   │   └── index.css                  # Complete CSS design system
│   ├── package.json
│   └── vite.config.js
├── README.md
├── start.bat                    # Windows quick-launch script
└── run.ps1                      # PowerShell quick-launch script
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.10+** (Python 3.11 or 3.12 recommended)
- **Node.js 18+** and **npm**
- **Groq API Key** (Free tier available at [console.groq.com](https://console.groq.com))
- *(Optional)* **Google Gemini API Key** for fast cloud embeddings ([aistudio.google.com](https://aistudio.google.com))
- *(Optional)* **SerpApi Key** if using live Google search discovery ([serpapi.com](https://serpapi.com))

---

### 1. Backend Setup

1. **Navigate to the backend directory and set up a virtual environment**:
   ```bash
   cd backend
   python -m venv venv
   
   # On Windows:
   venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` (or create a `.env` in `backend/`):
   ```ini
   PROJECT_NAME="Lumen Notebook"

   # LLM Engine (Groq Cloud)
   GROQ_API_KEY="gsk_your_groq_api_key_here"
   GROQ_MODEL="qwen/qwen3.8-27b"   # or "llama-3.3-70b-versatile"

   # Vector Embeddings (Gemini text-embedding-004)
   GOOGLE_API_KEY="AIzaSy_your_google_gemini_key"
   GEMINI_EMBEDDING_MODEL="models/text-embedding-004"

   # Database (Leaves default to SQLite if empty)
   # DATABASE_URL="postgresql://user:password@localhost:5432/lumen"

   # AWS S3 (Optional - uses local ./storage/uploads if blank)
   # AWS_ACCESS_KEY_ID=""
   # AWS_SECRET_ACCESS_KEY=""
   # AWS_REGION="us-east-1"
   # AWS_S3_BUCKET=""

   # Search API (Optional - for web research discovery)
   # SERPAPI_API_KEY=""
   ```

4. **Start the backend server**:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   The backend API will be live at `http://localhost:8000`. You can inspect the interactive Swagger docs at `http://localhost:8000/docs`.

---

### 2. Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   npm install
   ```

2. **Run Vite development server**:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

> **Windows Quick Start**: You can also double-click `start.bat` or run `.\run.ps1` from the project root to start both backend and frontend concurrently.

---

## 🐳 Docker Deployment

The included `backend/Dockerfile` comes pre-configured with the required OS libraries for headless OCR (`libgl1`, `libxcb1`, `libx11-xcb1`, etc.) and pre-downloads the backup MiniLM model during build time so the container can boot instantly without internet delays:

```bash
cd backend
docker build -t lumen-backend .
docker run -d \
  --name lumen \
  --restart always \
  -p 8000:8000 \
  --env-file .env \
  lumen-backend
```

---

## ☁️ Production Deployment Notes

Lumen Notebook is designed to deploy seamlessly across modern cloud infrastructure:

| Component | Recommended Service | Notes |
| :--- | :--- | :--- |
| **Frontend** | [Vercel](https://vercel.com) | Host the built React SPA. Use `vercel.json` rewrites to proxy `/api/*` directly to your backend host. |
| **Backend API** | [AWS EC2](https://aws.amazon.com/ec2) | A lightweight `t3.small` or `t3.medium` instance running Docker is more than sufficient since embedding and inference are handled via APIs. |
| **Document Storage** | [AWS S3](https://aws.amazon.com/s3) | Set `AWS_S3_BUCKET` in `.env` to store uploaded PDFs and files securely in an S3 bucket with private ACLs. |
| **Database** | [AWS RDS PostgreSQL](https://aws.amazon.com/rds) | Managed PostgreSQL instance. Ensure the EC2 security group is authorized on port 5432 in the RDS security group. |

---

## 🔒 Security & Privacy

- **No Public S3 Buckets Needed**: Document uploads are managed by backend presigned credentials or streamed server-side.
- **Scoped CORS**: CORS origins are locked down to your production frontend domain and localhost development ports in `backend/app/config.py`.
- **Private Data Partitioning**: Sources and vector embeddings are partitioned strictly per notebook ID, preventing cross-notebook data leakage during RAG queries.

---

## 🤝 Contributing

Contributions are welcome! If you run into a bug or have ideas for new studio artifacts:
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m "Add amazing feature"`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. Feel free to use, modify, and build upon this project.
