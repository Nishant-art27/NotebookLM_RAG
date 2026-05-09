# 📓 NotebookLM RAG — Chat with Your Documents

A full-stack **RAG (Retrieval-Augmented Generation)** application inspired by Google NotebookLM. Upload any document and have an AI-powered conversation grounded entirely in its content.

![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-FF6B35?style=flat&logo=data:image/svg+xml;base64,&logoColor=white)
![Qdrant](https://img.shields.io/badge/Qdrant-FF4F64?style=flat&logo=data:image/svg+xml;base64,&logoColor=white)

## ✨ Features

- **Document Upload** — Upload PDF or plain text files via drag-and-drop or file picker
- **Intelligent Chunking** — Documents are split using Recursive Character Text Splitting for optimal retrieval
- **Semantic Search** — Chunks are embedded and stored in Qdrant vector database for similarity search
- **Grounded Answers** — AI answers come exclusively from your document — no hallucination
- **Source References** — Every answer shows which pages/sections the information came from
- **Premium Dark UI** — Beautiful glassmorphism design with smooth animations
- **Responsive** — Works on desktop and mobile

## 🏗️ Architecture

```
User Browser ──► Express.js Server
                    │
                    ├── Document Processor (PDFLoader + RecursiveCharacterTextSplitter)
                    │
                    ├── Google Gemini Embeddings (text-embedding-004) ──► Qdrant Cloud (Vector DB)
                    │
                    └── Groq LLM (llama-3.3-70b-versatile) ──► Grounded Answer
```

### RAG Pipeline

1. **Ingestion** — Upload a PDF or TXT file
2. **Chunking** — `RecursiveCharacterTextSplitter` splits the document (1000 chars, 200 overlap)
3. **Embedding** — Google Gemini `text-embedding-004` generates 768-dim vectors
4. **Storage** — Vectors are stored in Qdrant Cloud (free tier)
5. **Retrieval** — User question is embedded and top-4 similar chunks are retrieved
6. **Generation** — Groq `llama-3.3-70b-versatile` generates an answer grounded in the retrieved context

## 📐 Chunking Strategy

**Recursive Character Text Splitting** was chosen for its balance of simplicity and effectiveness:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `chunkSize` | 1000 | Large enough for meaningful context, small enough for precise retrieval |
| `chunkOverlap` | 200 | 20% overlap prevents information loss at chunk boundaries |
| Separators | `["\n\n", "\n", " ", ""]` | Hierarchical — tries paragraph breaks first, then lines, then words |

This strategy preserves natural text structure (paragraphs, sentences) while ensuring consistent chunk sizes for embedding quality.

## 🛠️ Tech Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| Backend | Node.js + Express.js | Free |
| LLM | Groq (llama-3.3-70b-versatile) | Free |
| Embeddings | Google Gemini (text-embedding-004) | Free |
| Vector DB | Qdrant Cloud | Free |
| Frontend | Vanilla HTML/CSS/JS | Free |
| Deployment | Render | Free |

## 🚀 Setup

### Prerequisites

- Node.js 18+
- Free API keys (no credit card needed):
  - [Groq Console](https://console.groq.com) — LLM
  - [Google AI Studio](https://aistudio.google.com) — Embeddings
  - [Qdrant Cloud](https://cloud.qdrant.io) — Vector Database

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/notebooklm-rag.git
   cd notebooklm-rag
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```

5. **Open** `http://localhost:3000` in your browser

### Environment Variables

| Variable | Description | Where to Get |
|----------|-------------|-------------|
| `GROQ_API_KEY` | Groq API key for LLM | [console.groq.com](https://console.groq.com) |
| `GOOGLE_API_KEY` | Google AI Studio key for embeddings | [aistudio.google.com](https://aistudio.google.com) |
| `QDRANT_URL` | Qdrant Cloud cluster URL | [cloud.qdrant.io](https://cloud.qdrant.io) |
| `QDRANT_API_KEY` | Qdrant Cloud API key | Qdrant Cloud dashboard |

## 📁 Project Structure

```
notebooklm-rag/
├── server.js              # Express server + API routes
├── lib/
│   ├── documentProcessor.js   # PDF/TXT loading + chunking
│   ├── vectorStore.js         # Gemini embeddings + Qdrant operations
│   └── llm.js                 # Groq LLM for answer generation
├── public/
│   ├── index.html             # Frontend UI
│   ├── styles.css             # Premium dark theme
│   └── app.js                 # Client-side logic
├── .env.example               # Environment variable template
├── render.yaml                # Render deployment config
└── README.md
```

## 🌐 Deployment (Render)

1. Push code to GitHub
2. Go to [Render.com](https://render.com) → New Web Service
3. Connect your GitHub repo
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Add environment variables in the Render dashboard
6. Deploy!

## 📄 License

MIT
