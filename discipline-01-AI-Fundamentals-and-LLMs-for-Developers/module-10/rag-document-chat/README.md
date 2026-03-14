# RAG Chat UI

A full-stack learning chat app powered by **Retrieval-Augmented Generation (RAG)**. Upload any document, train the model, and study its content through a conversational chat interface.

Built on top of the RAG pipeline, wrapped in a React frontend and Express backend.

---

## How It Works

```
Upload file → Train (generate embeddings) → Chat (RAG answers)
```

1. **Upload** a document (PDF, DOCX, XLSX, or image)
2. **Train** — the backend splits the document into chunks, generates vector embeddings locally using `Xenova/all-MiniLM-L6-v2`, and stores them in Neo4j
3. **Chat** — ask questions; the backend retrieves the most relevant chunks via similarity search and sends them to an LLM (via OpenRouter) to generate a grounded answer, streamed back in real time

---

## Architecture

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│  React + Vite   │  HTTP   │   Express + Node 22   │  Bolt   │  Neo4j          │
│  :5173          │◄───────►│   :3001               │◄───────►│  :7687          │
│                 │         │                        │         │  (Docker)       │
│  • Upload UI    │         │  POST /api/upload      │         │                 │
│  • Train button │         │  POST /api/train       │         │  Chunk nodes    │
│  • Chat (SSE)   │         │  POST /api/chat (SSE)  │         │  + embeddings   │
│                 │         │  GET  /api/status      │         │                 │
└─────────────────┘         └──────────┬───────────┘         └─────────────────┘
                                        │
                            ┌───────────▼───────────┐
                            │  OpenRouter API        │
                            │  (google/gemma-3-27b)  │
                            └───────────────────────┘
```

**Embedding model:** `Xenova/all-MiniLM-L6-v2` — runs locally via `@xenova/transformers` (no API key needed for embeddings)

---

## Supported File Types

| Format | Extension | Processing |
|--------|-----------|------------|
| PDF | `.pdf` | LangChain `PDFLoader` |
| Word | `.docx` | `mammoth` (text extraction) |
| Excel | `.xlsx` | `SheetJS` (sheets → CSV text) |
| Image | `.jpg` `.png` `.webp` | `Tesseract.js` OCR |

---

## Prerequisites

- **Node.js** v22+
- **Docker** (for Neo4j)
- An **OpenRouter API key** — get one free at [openrouter.ai](https://openrouter.ai)

---

## Setup

### 1. Configure environment

Copy `.env.example` to `.env` and fill in your OpenRouter key:

```bash
cp .env.example .env
```

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
NLP_MODEL=google/gemma-3-27b-it:free
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2

NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

PORT=3001
UPLOAD_DIR=./uploads
```

### 2. Install dependencies

```bash
npm run install:all
```

### 3. Start Neo4j

```bash
npm run infra:up
```

Neo4j browser available at http://localhost:7474 (`neo4j` / `password`)

### 4. Start the backend

```bash
npm run dev:backend
```

### 5. Start the frontend

```bash
npm run dev:frontend
```

Open **http://localhost:5173**

---

## Usage

1. Click **Choose file** and pick a document (PDF, DOCX, XLSX, or image)
2. Click **Train** — wait for the status badge to turn **Ready**
   - On first run, the embedding model (~23 MB) is downloaded and cached automatically
3. Type a question in the chat input and press **Enter**
4. The answer streams in real time, grounded in the document content

To study a different document, click **Change file**, upload the new one, and click **Retrain**.

---

## Project Structure

```
exemplo-14-rag-chat-ui/
├── docker-compose.yml          # Neo4j container
├── .env                        # Environment variables
├── package.json                # Root scripts
│
├── backend/
│   └── src/
│       ├── index.ts            # Express server
│       ├── config.ts           # Configuration
│       ├── state.ts            # In-memory app state
│       ├── ai.ts               # RAG chain + streaming
│       ├── documentProcessor.ts # Multi-format document loader
│       ├── prompts/
│       │   ├── answerPrompt.json
│       │   └── template.txt
│       └── routes/
│           ├── upload.ts       # POST /api/upload
│           ├── train.ts        # POST /api/train
│           ├── chat.ts         # POST /api/chat (SSE)
│           └── status.ts       # GET  /api/status
│
└── frontend/
    └── src/
        ├── App.tsx             # Root component + state
        ├── api.ts              # Typed API client
        ├── types.ts
        └── components/
            ├── FileUploadPanel.tsx
            ├── StatusBadge.tsx
            ├── ChatWindow.tsx
            ├── MessageBubble.tsx
            └── ChatInput.tsx
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload a file (`multipart/form-data`, field: `file`, max 50 MB) |
| `POST` | `/api/train` | Process uploaded file into Neo4j vector store |
| `POST` | `/api/chat` | Ask a question — returns SSE stream (`data: {"chunk":"..."}`) |
| `GET` | `/api/status` | Get current system status |

**Status values:** `idle` → `uploading` → `training` → `ready` / `error`

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run infra:up` | Start Neo4j via Docker |
| `npm run infra:down` | Stop Neo4j and remove volumes |
| `npm run install:all` | Install backend and frontend dependencies |
| `npm run dev:backend` | Start backend in watch mode |
| `npm run dev:frontend` | Start Vite dev server |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Backend | Express, TypeScript, Node.js 22 |
| Vector DB | Neo4j 5.14 (community) |
| Embeddings | `Xenova/all-MiniLM-L6-v2` (local, 384 dims) |
| LLM | OpenRouter (`google/gemma-3-27b-it:free`) |
| AI orchestration | LangChain (`@langchain/community`, `@langchain/openai`) |
| PDF | LangChain PDFLoader + `pdf-parse` |
| DOCX | `mammoth` |
| XLSX | `SheetJS` |
| Images | `Tesseract.js` OCR |
