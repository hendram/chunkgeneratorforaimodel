import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { handleResultToStream } from "./stream.js";

// Recreate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });


// --- Chunking ---
export function cleanAndChunk(results) {
  const chunksForVectorization = [];

  results.forEach((item) => {
    // Support both formats
    let rawText = item.text || item.htmlsite || "";
    let text = rawText.replace(/https?:\/\/\S+/g, ""); // remove URLs

    let lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.split(/\s+/).length > 3);
    if (!lines.length) return;

    const preparedLines = [];
    let buffer = [];

    lines.forEach((line) => {
      line.split(/\s+/).forEach((w) => buffer.push(w));
      while (buffer.length >= 7) {
        const len = Math.min(12, buffer.length);
        preparedLines.push(buffer.splice(0, len).join(" "));
      }
    });
    if (buffer.length) preparedLines.push(buffer.join(" "));

    for (let i = 0; i < preparedLines.length; i += 10) {
      let chunkLines = preparedLines.slice(i, i + 10);
      if (chunkLines.length) {
        chunksForVectorization.push({
          text: chunkLines.join(" "),
          metadata: item.metadata || {}, // keep metadata, includes `searched` if present
        });
      }
    }
  });

  return chunksForVectorization;
}

// --- Vectorize ---
export async function vectorize(chunks) {
  const resp = await fetch("http://127.0.0.1:8000/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chunks),
  });
  if (!resp.ok) throw new Error(`Vectorizer error ${resp.status}`);
  return resp.json();
}


// --- Vectorize ---
export async function vectorizecorporate(chunks) {
  const resp = await fetch("http://127.0.0.1:8000/embedcorporate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chunks),
  });
  if (!resp.ok) throw new Error(`Vectorizer error ${resp.status}`);
  return resp.json();
}

// --- LLM ---
export async function goingToLLM(htmlTextArray) {
  const apiKey = process.env.GOOGLE_API_KEY;

  const allQna = [];

  for (const site of htmlTextArray) {
    const promptText = `
Parse the text and return a clean JSON array like this:
[
  { "question": "What is the primary role of MongoDB in a RAG pipeline?", 
    "options": [
      "Training the language model", 
      "Storing and retrieving vector embeddings", 
      "Generating synthetic text responses", 
      "Optimizing the model hyperparameters"
    ] 
  }
]

Here is the input text from site: ${site.htmlsite}
`;

    const resp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 1000,
          },
        }),
      }
    );

    if (!resp.ok) {
      console.error("Error:", resp.status, await resp.text());
      continue; // skip this site if it fails
    }

    const data = await resp.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) continue;

    // clean possible ```json formatting
    if (text.startsWith("```")) {
      text = text.replace(/```json|```/g, "").trim();
    }

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        // Attach original site metadata to each QnA
        parsed.forEach(qna => allQna.push({ ...qna, metadata: site.metadata }));
      } else {
        allQna.push({ ...parsed, metadata: site.metadata });
      }
    } catch (e) {
      console.error(" ^}^l Failed to parse QnA JSON:", e, text);
    }
  }

  return allQna;
}

// --- Search ---
async function searchVectorDB(question, options, metadata) {
  const payload = { 
    query: JSON.stringify({ question, options, metadata }), 
    top_k: 3  // allow backend to retrieve top chunks
  };

  const resp = await fetch("http://127.0.0.1:8000/searchvectordb", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await resp.json();

  // Return full result: backend should already rerank and select best
  return {
    question: result.question,
    bestAnswer: result.bestAnswer,   // backend gives best option
    options: result.options,
    metadata: result.metadata
  };
}


export async function directToLLM(result){

let qna = await goingToLLM(result.resultssite || []);
if (typeof qna === "string") {
  qna = qna.trim();
  if (qna.startsWith("```")) {
    qna = qna.replace(/```json|```/g, "").trim();
  }
  try {
    qna = JSON.parse(qna);
  } catch (e) {
    console.error("Failed to parse QnA JSON:", e, qna);
    return [];
  }
}

if (!Array.isArray(qna)) {
  qna = [qna];
}

const allBest = [];

// Loop over each question object and send individually to vectorized container
for (const q of qna) {
  // Preserve metadata from original site
  const metadata = q.metadata || {};

  // Prepare payload exactly as vectorized container expects
  const qWithMeta = {
    question: q.question,
    options: q.options,
    metadata: metadata,
  };

  // Send to vectorized container
  const best = await searchVectorDB(qWithMeta);
  console.log("Best match for question:", best);

  allBest.push(best);
}

// Stream results
handleResultToStream(allBest);

// Return full array of processed Q&A with metadata preserved
return allBest;

}

// Handle all QnA objects
export async function handleResult(result) {
  try {
  if(result.results.corporate){  
 const chunks = cleanAndChunk(result.results.corporate || []);
    
      if (chunks && chunks.length > 0) {
        const vectorized = await vectorizecorporate(chunks);
        return vectorized;
      } else {
        console.warn("No chunks for corporate, skipping /embed call");
        return [];
      }
}

  else {
 const chunks = cleanAndChunk(result.results || []);


  if (chunks && chunks.length > 0) {
        const vectorized = await vectorize(chunks);
       return vectorized;
       } else {
        console.warn("No chunks for general result, skipping /embed call");
        return [];
      }
    }
 } catch (err) {
    console.error("Error processing result:", err);
    return [];
  }
 }


