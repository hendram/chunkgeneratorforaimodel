import express from "express";
import applyCors from "./lib/cors.js";
import { registerStream } from "./lib/stream.js";
import { sendMessage, startConsumer, startPuppeteerConsumer } from "./lib/kafka.js";
import eventBus from "./lib/events.js";

const app = express();
app.use(express.json());

// Apply CORS middleware for all requests
app.use((req, res, next) => {
  if (applyCors(req, res)) return; // handled preflight
  next();
});

app.get("/stream", (req, res) => {
  registerStream(req, res);
});

// Route: Submit job to Puppeteer via Kafka
app.post("/search", async (req, res) => {
  const { topic } = req.body;
  if (!topic) return res.status(400).json({ error: "Topic is required" });


  try {
    if (topic.corporate && topic.corporate !== "") {
      // Send message to Puppeteer via Kafka
      await sendMessage({query: topic});
      return res.status(200).json({
        success: true,
        message: "Corporate job dispatched",
      });
    } else if(topic.corporate === "") {
      return res.status(200).json({
        success: false,
        message: "No corporate topic",
      });
    }
  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ error: err.message });
  }

try {
  if (topic.searched && topic.searched !== "") {
    // 1️⃣ Call the FastAPI endpoint
    const response = await fetch("http://localhost:8000/insertsearchtodb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(topic)  // send full topic
    });

    if (!response.ok) {
      throw new Error(`Vectorized API returned ${response.status}`);
    }

    const data = await response.json();
  

    let topicToSend;
    let separatesiteToSend;
    let returnValue = false;

    if (data.answer === "yes") {
      // Only send the site field
       separatesiteToSend = { ignoresearched: topic.searched,
                site: topic.site
              }     

    await sendMessage({query: separatesiteToSend });

    } else {
      // Send full original topic
        
       topicToSend = { searched: topic.searched,
                        searchEngine: topic.searchEngine };


      separatesiteToSend = { onlyforsite: topic.site };

      await sendMessage({query: topicToSend });

      const returnValue = await new Promise(resolve => {
    eventBus.once("statusChanged", data => {
      resolve(data.returnValue);
    });
  });

  if (returnValue) {
    await sendMessage({ query: separatesiteToSend });
    return;
  }
    }

    return;
}
    else if(topic.searched === ""){
       return res.status(400).json({
        success: false,
        message: "No searched keyword",
      });
}
}  catch (err) {
  console.error(" ^}^l API Error:", err);
  return {
    success: false,
    error: err.message,
  };
}
});

// Start server + Kafka consumer
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  await startConsumer();
  await startPuppeteerConsumer() // <--- this was missing in your code
});

