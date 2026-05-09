import "dotenv/config";
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

import { processDocument } from "./lib/documentProcessor.js";
import { indexDocument, retrieveContext, deleteCollection } from "./lib/vectorStore.js";
import { generateAnswer } from "./lib/llm.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- File Upload Config (Multer) ---
const uploadsDir = path.join(__dirname, "uploads");
await fs.mkdir(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["application/pdf", "text/plain"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and TXT files are supported."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
});

// --- Document Registry (simple JSON file persistence) ---
const registryPath = path.join(__dirname, "documents.json");

async function loadRegistry() {
  try {
    const data = await fs.readFile(registryPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveRegistry(docs) {
  await fs.writeFile(registryPath, JSON.stringify(docs, null, 2));
}

// --- API Routes ---

/**
 * POST /api/upload
 * Upload a document, process it (chunk + embed), and index into Qdrant.
 */
app.post("/api/upload", upload.single("document"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const { originalname, filename, path: filePath } = req.file;

    // Generate a safe collection name from the filename
    const collectionName = filename
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 50)
      .toLowerCase();

    // Step 1: Process document (load + chunk)
    const chunks = await processDocument(filePath, originalname);

    // Step 2: Index into Qdrant (embed + store)
    await indexDocument(chunks, collectionName);

    // Step 3: Save to registry
    const docEntry = {
      id: collectionName,
      name: originalname,
      collectionName,
      uploadedAt: new Date().toISOString(),
      chunkCount: chunks.length,
      filePath: filename,
    };

    const registry = await loadRegistry();
    registry.push(docEntry);
    await saveRegistry(registry);

    // Clean up uploaded file (already indexed)
    await fs.unlink(filePath).catch(() => {});

    res.json({
      success: true,
      document: docEntry,
      message: `"${originalname}" processed successfully: ${chunks.length} chunks indexed.`,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message || "Failed to process document." });
  }
});

/**
 * POST /api/chat
 * Ask a question about a specific document.
 * Body: { query: string, collectionName: string }
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { query, collectionName } = req.body;

    if (!query || !collectionName) {
      return res.status(400).json({ error: "Both 'query' and 'collectionName' are required." });
    }

    // Step 1: Retrieve relevant chunks from Qdrant
    const contextChunks = await retrieveContext(query, collectionName);

    if (!contextChunks || contextChunks.length === 0) {
      return res.json({
        answer: "I couldn't find any relevant information in the document for your question.",
        sources: [],
      });
    }

    // Step 2: Generate grounded answer via Groq
    const { answer, sources } = await generateAnswer(query, contextChunks);

    res.json({ answer, sources });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message || "Failed to generate answer." });
  }
});

/**
 * GET /api/documents
 * List all uploaded/indexed documents.
 */
app.get("/api/documents", async (req, res) => {
  try {
    const registry = await loadRegistry();
    res.json(registry);
  } catch (error) {
    console.error("List error:", error);
    res.status(500).json({ error: "Failed to load documents." });
  }
});

/**
 * DELETE /api/documents/:id
 * Remove a document and its Qdrant collection.
 */
app.delete("/api/documents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const registry = await loadRegistry();
    const docIndex = registry.findIndex((d) => d.id === id);

    if (docIndex === -1) {
      return res.status(404).json({ error: "Document not found." });
    }

    // Delete from Qdrant
    await deleteCollection(registry[docIndex].collectionName);

    // Remove from registry
    registry.splice(docIndex, 1);
    await saveRegistry(registry);

    res.json({ success: true, message: "Document deleted." });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ error: error.message || "Failed to delete document." });
  }
});

// --- Error handling middleware ---
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err.message === "Only PDF and TXT files are supported.") {
    return res.status(400).json({ error: err.message });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error." });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`\n🚀 NotebookLM RAG Server running at http://localhost:${PORT}\n`);
});
