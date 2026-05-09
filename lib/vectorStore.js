import { QdrantVectorStore } from "@langchain/qdrant";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

/**
 * Creates a Google Gemini embedding instance.
 * Uses text-embedding-004 — free tier, no credit card needed.
 * Produces 768-dimensional vectors.
 */
function getEmbeddings() {
  return new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    model: "gemini-embedding-001",
  });
}

/**
 * Index document chunks into Qdrant Cloud.
 * Creates a new collection (named after the document) and stores embeddings.
 *
 * @param {Array} chunks - LangChain Document objects from the document processor
 * @param {string} collectionName - Unique collection name (derived from filename)
 * @returns {Promise<void>}
 */
export async function indexDocument(chunks, collectionName) {
  const embeddings = getEmbeddings();

  await QdrantVectorStore.fromDocuments(chunks, embeddings, {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName,
  });

  console.log(`✅ Indexed ${chunks.length} chunks into collection "${collectionName}"`);
}

/**
 * Retrieve the most relevant chunks for a user query via similarity search.
 *
 * @param {string} query - The user's natural language question
 * @param {string} collectionName - The Qdrant collection to search
 * @param {number} k - Number of top results to return (default: 4)
 * @returns {Promise<Array>} Array of relevant Document objects
 */
export async function retrieveContext(query, collectionName, k = 4) {
  const embeddings = getEmbeddings();

  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName,
  });

  const retriever = vectorStore.asRetriever({ k });
  const results = await retriever.invoke(query);

  console.log(`🔍 Retrieved ${results.length} chunks for query: "${query.substring(0, 50)}..."`);
  return results;
}

/**
 * Delete a Qdrant collection (when user removes a document).
 *
 * @param {string} collectionName - The collection to delete
 * @returns {Promise<void>}
 */
export async function deleteCollection(collectionName) {
  // Use the Qdrant REST API directly to delete a collection
  const response = await fetch(`${process.env.QDRANT_URL}/collections/${collectionName}`, {
    method: "DELETE",
    headers: {
      "api-key": process.env.QDRANT_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete collection "${collectionName}": ${response.statusText}`);
  }

  console.log(`🗑️ Deleted collection "${collectionName}"`);
}
