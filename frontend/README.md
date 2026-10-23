# 🖥️ Lumen Notebook — Frontend Client

The frontend client for **Lumen Notebook**, an AI-powered personalized research workspace. Built with **React 19**, **Vite 8**, **Lucide Icons**, and a bespoke vanilla CSS design system.

---

## 🎨 UI Architecture & Design Principles

Unlike traditional dashboard templates built on bloated CSS frameworks, Lumen Notebook's UI is crafted with **pure vanilla CSS** (`src/index.css`) emphasizing:
- **Dark Mode Glassmorphism**: Translucent panels (`backdrop-filter: blur`), dark slate palettes, and subtle border highlights.
- **Three-Column Research Layout**:
  - **Left Pane (Sources)**: Source selector, quota indicators, document badges, and "Add Sources" modal.
  - **Center Pane (Chat & Scratchpad)**: Multi-turn grounded RAG conversational thread with interactive citation badges (`[1]`, `[2]`) that highlight excerpts. Includes a direct "Save to Note" action.
  - **Right Pane (Studio)**: One-click generators for Audio Overviews (podcast script), Study Guides, Executive Briefings, and FAQs.
- **Zero Heavy UI Libraries**: Fast bundle times and clean CSS hierarchy without Tailwind or component UI kit overhead.

---

## 🧩 Key Components

| Component | Path | Description |
| :--- | :--- | :--- |
| **App.jsx** | `src/App.jsx` | Main workspace coordinator: handles active notebook state, selected sources, and responsive views. |
| **NotebooksDashboard** | `src/components/NotebooksDashboard.jsx` | Grid view of all user notebooks with creation dialog and metadata counts. |
| **AddSourceModal** | `src/components/AddSourceModal.jsx` | Multi-source ingestion hub featuring a drag-and-drop file dropzone, staging queue, URL extractor, YouTube parser, and live Google search research tool. |
| **ChatArea** | `src/components/ChatArea.jsx` | RAG chat conversation thread with inline citation pills, message streaming states, and "Save to Note" integration. |
| **StudioPanel** | `src/components/StudioPanel.jsx` | Artifact generation deck (Audio Overview podcast, Study Guide, Briefing Doc, FAQ, and Custom prompt synthesis). |
| **NotesPanel** | `src/components/NotesPanel.jsx` | Real-time markdown scratchpad and persistent notebook notes. |
| **SourceViewerModal** | `src/components/SourceViewerModal.jsx` | Modal preview for inspecting parsed text chunks and original source excerpts. |

---

## 🚀 Development Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (Optional)
If connecting to an external or cloud backend rather than the default `http://localhost:8000`, configure your Vite proxy or API URL in `vite.config.js`:
```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
```

### 3. Run Dev Server
```bash
npm run dev
```
The interface will be available at `http://localhost:5173`.

### 4. Build for Production
```bash
npm run build
```
Generates optimized static assets in `dist/`, ready to deploy to [Vercel](https://vercel.com), Cloudflare Pages, or AWS S3/CloudFront.
