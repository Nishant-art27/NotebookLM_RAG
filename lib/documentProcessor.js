import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import fs from "fs/promises";
import path from "path";

/**
 * Chunking Strategy: Recursive Character Text Splitting
 *
 * Why this strategy?
 * - Uses hierarchical separators ["\n\n", "\n", " ", ""] to split text
 * - Tries paragraph breaks first, then line breaks, then spaces
 * - Preserves semantic coherence by respecting natural text boundaries
 * - Overlap ensures no information is lost at chunk boundaries
 *
 * Parameters:
 * - chunkSize: 1000 — large enough for meaningful context, small enough for precise retrieval
 * - chunkOverlap: 200 — 20% overlap captures cross-boundary information
 */
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", " ", ""],
});

/**
 * Process an uploaded document: load → chunk → return enriched chunks.
 * Supports PDF and plain text files.
 *
 * @param {string} filePath - Absolute path to the uploaded file
 * @param {string} originalName - Original file name from the upload
 * @returns {Promise<Array>} Array of LangChain Document objects with metadata
 */
export async function processDocument(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  let rawDocs;

  if (ext === ".pdf") {
    // Use LangChain PDFLoader — splits by page automatically
    const loader = new PDFLoader(filePath);
    rawDocs = await loader.load();
  } else if (ext === ".txt") {
    // Plain text — read the full file as a single document
    const content = await fs.readFile(filePath, "utf-8");
    rawDocs = [
      {
        pageContent: content,
        metadata: { source: originalName, page: 1 },
      },
    ];
  } else {
    throw new Error(`Unsupported file type: ${ext}. Only PDF and TXT are supported.`);
  }

  // Apply recursive character text splitting to all loaded documents
  const chunks = await splitter.splitDocuments(rawDocs);

  // Enrich each chunk with additional metadata
  const enrichedChunks = chunks.map((chunk, index) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      source: originalName,
      chunkIndex: index,
      totalChunks: chunks.length,
    },
  }));

  console.log(
    `✅ Processed "${originalName}": ${rawDocs.length} page(s) → ${enrichedChunks.length} chunks`
  );

  return enrichedChunks;
}
