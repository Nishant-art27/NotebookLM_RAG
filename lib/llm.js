import Groq from "groq-sdk";

// Lazy initialization — only created when first request comes in
let groq = null;

function getGroqClient() {
  if (!groq) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not set. Please add it to your .env file.");
    }
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

/**
 * System prompt that enforces grounding — the LLM must only answer
 * from the provided document context, never from its own knowledge.
 */
const SYSTEM_PROMPT = `You are an intelligent document assistant powered by RAG (Retrieval-Augmented Generation).
Your job is to answer user questions ONLY based on the provided document context.

Rules:
1. ONLY use information from the provided context to answer questions.
2. If the answer is NOT found in the context, clearly state: "I couldn't find this information in the uploaded document."
3. When referencing information, mention the page number or source if available.
4. Provide clear, well-structured answers using markdown formatting.
5. If the context is partial or unclear, acknowledge the limitation.
6. Do NOT make up information or use your general knowledge to fill gaps.`;

/**
 * Generate a grounded answer using Groq (Llama 3.3 70B).
 *
 * @param {string} query - The user's question
 * @param {Array} contextChunks - Retrieved document chunks from vector search
 * @returns {Promise<{answer: string, sources: Array}>} The grounded answer and source references
 */
export async function generateAnswer(query, contextChunks) {
  // Format context with page/source metadata for the LLM
  const formattedContext = contextChunks
    .map((chunk, i) => {
      const page = chunk.metadata?.page ?? chunk.metadata?.loc?.pageNumber ?? "N/A";
      const source = chunk.metadata?.source ?? "Unknown";
      return `--- Chunk ${i + 1} (Source: ${source}, Page: ${page}) ---\n${chunk.pageContent}`;
    })
    .join("\n\n");

  // Extract unique source references
  const sources = [
    ...new Set(
      contextChunks.map((chunk) => {
        const page = chunk.metadata?.page ?? chunk.metadata?.loc?.pageNumber ?? "N/A";
        const source = chunk.metadata?.source ?? "Unknown";
        return `${source} (Page ${page})`;
      })
    ),
  ];

  const response = await getGroqClient().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\n--- DOCUMENT CONTEXT ---\n${formattedContext}`,
      },
      {
        role: "user",
        content: query,
      },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  });

  const answer = response.choices[0].message.content;

  console.log(`💬 Generated answer for: "${query.substring(0, 50)}..."`);

  return { answer, sources };
}
