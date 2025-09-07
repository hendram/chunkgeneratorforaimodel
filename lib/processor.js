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
  console.log("GOOGLE_API_KEY", apiKey);

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

Here is the input text from site: ${site.urlsite}

${site.htmlsite}
`;

    console.log("Processing site:", site.urlsite);

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
        allQna.push(...parsed);
      } else {
        allQna.push(parsed);
      }
    } catch (e) {
      console.error(" ^}^l Failed to parse QnA JSON:", e, text);
    }
  }

  return allQna;
}

// --- Search ---
async function searchVectorDBSingle(question, option) {
  const payload = { query: JSON.stringify({ question, option }), top_k: 1 };

  const resp = await fetch("http://127.0.0.1:8000/searchvectordb", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return resp.json();
}

// Handle one QnA object → choose best option
export async function searchVectorDB(qna) {
  console.log("qnaonsearchvectordb", qna);

  const { question, options } = qna;
  const optionResults = [];

  // Loop over options
  for (const option of options) {
    const searchResult = await searchVectorDBSingle(question, option);
    optionResults.push({ option, score: searchResult.top_results?.[0]?.score ?? Infinity });
  }

  // Pick lowest score
  const best = optionResults.reduce((prev, curr) => 
    curr.score < prev.score ? curr : prev
  );

  // ✅ Return only question + best answer
  return { 
    question, 
    bestAnswer: best.option 
  };
}


export async function directToLLM(result){

    console.log(result);
   let qna = await goingToLLM(result.resultssite || []);
if (typeof qna === "string") {
  qna = qna.trim();

  // Remove ```json or ``` if present
  if (qna.startsWith("```")) {
    qna = qna.replace(/```json|```/g, "").trim();
  }

  try {
    qna = JSON.parse(qna);
  } catch (e) {
    console.error("❌ Failed to parse QnA JSON:", e, qna);
    return [];
  }
}

if (!Array.isArray(qna)) {
  qna = [qna];
}

console.log("qna parsed", qna);


    const allBest = [];

    // Loop over each question object
    for (const q of qna) {
      const best = await searchVectorDB(q);
      console.log("Best match for question:", best);
      allBest.push(best);
    }
   handleResultToStream(allBest);

    return allBest; // return full quiz answers
}

// Handle all QnA objects
export async function handleResult(result) {
  try {
  if(result.results.corporate){  
 const chunks = cleanAndChunk(result.results.corporate || []);
    console.log("chunk", chunks);
    const vectorized = await vectorizecorporate(chunks);
}

  else {
     console.log("resultnya", result.results);
 const chunks = cleanAndChunk(result.results || []);
   console.log("chunk", chunks);
    const vectorized = await vectorize(chunks);

return await directToLLM(result); 
   }
 } catch (err) {
    console.error("Error processing result:", err);
    return [];
  }
 }


