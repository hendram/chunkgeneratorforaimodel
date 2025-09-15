# 🛰️ The Backend

This project is the **backend for the Auto Answering Q&A AI Agent Service**.  
It acts as the central hub, orchestrating message delivery between:

- 📡 **Kafka** (messaging backbone)
- 🤖 **Puppeteer Service**
- 🕷️ **Puppeteer Workers (1, 2, 3)**
- 🧩 **VectorEmbedGen (TiDB connector)**
- 🌐 **AutoAnsweringForm** (frontend)

Some Communication is powered by **Kafka**, ensuring reliable and scalable messaging between all components.  

---

## 📦 About This Package

The backend works as the **control center** of the entire pipeline:  
- Direct connections to services like vectorembedgen.  
- Kafka-based messaging for workers and puppeteer service.  
- Handles message transformation, routing, and enrichment.  

Packages that interact with it:
- 🔎 `puppeteerservice`  
- 🕷️ `puppeteerworker1`, `puppeteerworker2`, `puppeteerworker3`  
- 📋 `autoansweringform`  
- 🧩 `vectorembedgen`  


---

## ⚙️ How It Works

The backend accepts messages from the **frontend** in two formats:

### 🔍 Search Job

## ⚙️ How It Works

The backend accepts messages from the **frontend** in two formats:

### 🔍 Search Job

For Example:

```bash
{
  "topic": {
    "searched": "tidb vector --filetype=html --filetype=xhtml --filetype=text",
    "searchEngine": "search.brave.com",
    "site": [
      "https://docs.google.com/forms/d/e/1FAIpQLSfRj7VFEAZJIm8HgE3lk0K_b5i9w0mgX9G2_XntzbptuURYiw/viewform?usp=dialog"
    ]
  }
}
```

or

###🏢 Corporate Knowledge Base Database Population Job

For Example:

```bash
topic: { corporate: "https://hendram.github.io/Knowledgebase/",
         topic: "mongodb rag"
}
```

## 🔄 Processing Logic

### 1️⃣ For **Search Jobs**

#### 📝 Step 1: Initial Keyword Check
- 📤 Message received from autoansweringform(frontend) is forwarded to **Puppeteer**.  
- 🔍 Keywords are sent to **VectorEmbedGen** at `/insertsearchtodb` to check if a table already exists in **TiDB**.  
  - ✅ If exists → continue.  
  - ➕ If not → create the table, then continue.  

---

#### ✂️ Step 2: Message Splitting
The original message is **split into two smaller jobs**:
- 🟣 `{ searched, searchEngine }`  
- 🔵 `{ site }`  

👉 These are sent to **Puppeteer** at **different times**.  

---

#### 🌐 Step 3: Scraping Search Results
1. The 🟣 `{ searched, searchEngine }` job is processed first.  

2. 🔗 Resulting links are **divided into 3 parts** → sent to:  
   - 🕷️ `puppeteerworker1`  
   - 🕷️ `puppeteerworker2`  
   - 🕷️ `puppeteerworker3`  

3. After scraping:  
   - 🧹 **Merged** into one message  
   - 🪄 **Cleaned** (HTML tags removed)  
   - ✂️ **Chunked**  
   - 📐 **Vectorized**  
   - 💾 Stored in **TiDB** via `/embed`  

#### 🏢 Step 4: Scraping Target Site

1. 🔵 The `{ site }` message is processed **after** the external links are finished.  
2. 🖥️ Content is scraped by **Puppeteer**.  
3. 📦 Results are then processed through several stages:  
   - 🧹 **Google Gemini LLM** → sterilize and remove tags  
   - ✂️ **Chunked** into smaller pieces  
   - 📐 **Vectorized** for embedding  

4. ⚖️ Final embeddings are **compared** via `/searchvectordb` against:  
   - 🟢 `_internal`  
   - 🔵 `_external`  
   - 🔀 Or both  

✅ This ensures the **best possible Q&A results** are returned.  


#### 2️⃣For Corporate Database Populate Jobs 

1. 🔑 A message with the **corporate key** just received from autoansweringform(frontend) is sent **directly** to Puppeteer.  
2. 🖥️ Puppeteer scrapes the **content**.  
3. 🔄 The content flows through these stages:  
   - 🧹 **cleanAndChunk** → prepare the data  
   - 📐 **vectorizedCorporate** → generate corporate embeddings  
4. 📡 Vector embeddings are sent to **VectorEmbedGen** via `/embedcorporate`.  
5. 🗄️ A **TiDB table** is created in the test database using the format: {table_name}_internal 
👉 where **`table_name`** is automatically inferred from the user’s topic inputted by user on Topic input form.  

✅ This pipeline ensures corporate data is properly scraped, cleaned, embedded, and stored for **efficient retrieval**.  


---


### 🔄 Message Exchange Details  


#### 🖥️ Backend ⇄ 🧠 VectorEmbedGen  
- 📡 Communication: **Direct fetch requests**  
- ⚡ Fast and lightweight for embedding operations  

---

#### 🖥️ Backend ⇄ 🤖 Puppeteer Service & Workers  
- 🔌 Communication: **Kafka**  
- ⏳ Why Kafka?  
  - Scraping takes a long time  
  - ❌ Fetch calls may **timeout**  
  - ✅ Kafka ensures **reliability & buffering**  

---

#### 🖥️ Backend ⇄ 📝 AutoAnsweringForm (Frontend)  
- 📥 Accepts messages from frontend via **fetch**  
- 📤 Sends responses back via **SSE (Server-Sent Events)**  
  - ⚡ Keeps the connection alive  
  - ⏳ Supports long-running processes  
  - ✅ Users get **real-time answers** without refreshing  

---


🌐 **In summary:**  
- **Lightweight ops** → fetch (Backend ⇄ VectorEmbedGen)  
- **Heavy ops** → Kafka (Backend ⇄ Puppeteer Workers)  
- **User-facing ops** → fetch + SSE (Backend ⇄ AutoAnsweringForm)  


---

## ⚡ Platform Requirements

💾 At least 12 GB RAM

🖥️ At least 4 CPU cores (Intel i5 or higher recommended)

🐳 Docker installed


---

## 🚀 How to Run It


#### 📥 Download

```bash
docker pull ghcr.io/hendram/chunkgeneratorforaimodel
```

#### ▶️ Start

```bash
docker run -it -d --network=host ghcr.io/hendram/chunkgeneratorforaimodel bash
```

#### 🔍 Check Running Container

```bash
docker ps
```

```bash
CONTAINER ID   IMAGE                                         NAME                    STATUS
123abc456def   ghcr.io/hendram/chunkgeneratorforaimodel      practical_chatterjee    Up 5 minutes
```

#### 📦 Enter Container

```bash
docker exec -it practical_chatterjee /bin/bash
```

#### 🏃 Run the Service

```bash
cd /home/chunkgeneratorforaimodel
node server.js
```

# 🖥️  Code Overview

####  server.js

This Node.js server handles real-time streaming, Kafka messaging, and Puppeteer job dispatching. It also integrates with a FastAPI endpoint for database insertion.

---

## ⚡ Technologies Used

- **Node.js** + **Express**: Server framework
- **Kafka**: Message queue for async processing
- **Puppeteer**: Headless browser automation
- **EventBus**: Internal event management
- **CORS**: Cross-origin request handling
- **Fetch API**: Calling external FastAPI endpoint

---

## 🚀 Key Features

###  1️⃣ CORS Middleware

```bash
app.use((req, res, next) => {
  if (applyCors(req, res)) return; // handles preflight requests
  next();
});
```

###  2️⃣ Streaming Endpoint

```bash
app.get("/stream", (req, res) => {
  registerStream(req, res);
});
```

  Registers a streaming connection for clients.

###  3️⃣ Job Submission (/search)

```bash
app.post("/search", async (req, res) => { ... });
```

  Handles topic submissions and routes jobs:


###  ✅ Corporate Job Dispatch:

If topic.corporate exists, send to Puppeteer via Kafka.

####  ⚠️ Empty Corporate Topic:

Responds with No corporate topic.

####  🔍 Searched Keyword:

Calls FastAPI insertsearchtodb, handles response, and sends relevant messages to Kafka.

####  ❌ Missing Keyword:

Responds with No searched keyword.

####  Internal Flow:

Log topic variables with timestamp.

Call FastAPI for vectorized search insertion.

Depending on FastAPI response:

Send only site info if answer === "yes".

Otherwise, send full topic, then optionally send site info after statusChanged event.

###  4️⃣ Kafka Consumers

```bash
await startConsumer();
await startPuppeteerConsumer();
```

Starts Kafka consumers on server boot:

startConsumer: General processing

startPuppeteerConsumer: Puppeteer job processing

###  5️⃣ Server Start

```bash
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => { ... });
```

Server listens on port 3000 (default)

Initializes Kafka consumers at startup.

####  📝 Utility Functions

Logging

```bash
function logTopicVariable(topic) {
  const now = new Date();
  const ts = now.toISOString().replace("T", " ").replace("Z", "");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  console.log(`[${ts},${ms}] INFO Sending request to insertsearchtodb ${JSON.stringify(topic)}`);
}
```

Logs each topic with timestamp + milliseconds.

Helps track database insertion requests.

#### 🔗 Flow Diagram

```bash
Client -> /search POST -> Validate topic
         ├─ corporate exists -> Kafka -> Puppeteer
         └─ searched keyword -> FastAPI -> Kafka -> EventBus
```

---

# 🌊 Stream Module (`/lib/stream.js`)

This module handles **Server-Sent Events (SSE)**, allowing the server to push real-time updates to connected clients.

---

## ⚡ Key Features

###  1️⃣ Connected Clients

```bash
const clients = [];
```
Maintains an array of all currently connected SSE clients.

###  2️⃣ Structured Logger
```bash
function logSSE(event, details = {}) {
  console.log(JSON.stringify({
    level: "INFO",
    timestamp: new Date().toISOString(),
    logger: "sse",
    event,
    ...details
  }));
}
```

Logs all SSE activity in JSON format.

Includes event type, timestamp, and additional details.

Useful for debugging and monitoring live streams.

###  3️⃣ Broadcast Results

```bash
export function handleResultToStream(allBest) { ... }
```

Sends a JSON payload (allBest) to all connected clients.

####  Logs:

```bash
clients_count: Number of connected clients

payload_size: Size of payload in bytes
```

Sends a heartbeat comment (:heartbeat) to clients every 5 seconds to keep connections alive.


###  4️⃣ Register New Client

```bash
export function registerStream(req, res) { ... }
```

####  Sets SSE headers:

Content-Type: text/event-stream

Cache-Control: no-cache

Connection: keep-alive

Adds the client res to the clients array.

####  Logs:

client_connected with current client count

Handles client disconnects:

Removes disconnected clients

Logs client_disconnected event

###  5️⃣ Global Heartbeat

```bash
setInterval(() => {
  clients.forEach((res) => res.write(":heartbeat\n\n"));
  if (clients.length > 0) {
    logSSE("heartbeat", { clients_count: clients.length });
  }
}, 10000);
```

Sends a global heartbeat every 10 seconds to all clients.

Keeps SSE connections alive.

Logs heartbeat events only if clients are connected.

#### 📝 Usage

Register a new client:

```bash
app.get("/stream", (req, res) => {
  registerStream(req, res);
});
```
Push results to clients:

```bash
handleResultToStream(allBestArray);
```

allBestArray is any array of results you want to broadcast.

---

# ☕ Kafka Module (`/lib/kafka.js`)

This module manages **Kafka producers and consumers** for handling job dispatching, Puppeteer processing, and search results. It integrates **event-based logic** to retry failed jobs and ensures robust processing of messages.

---

## ⚡ Key Features

### 1️⃣ Kafka Setup

```bash
const kafka = new Kafka({ 
  clientId: "scrapbackend", 
  brokers: ["localhost:9092"] 
});
```

####  Creates Kafka clients and producers:

producer: For general job dispatch

topProducer: For Puppeteer worker jobs

Consumers:

consumer: Handles /search and corporate results

puppeteerConsumer: Handles results from Puppeteer worker

Heartbeat interval and session timeout configured for stability.

###  2️⃣ Send Messages

```bash
export async function sendMessage(data) { ... }
```

Sends a message to the "fromscrap" topic (Puppeteer jobs).

Logs message delivery status in JSON style:

✅ Success

❌ Error

Includes payload size and preview.

```bash
export async function sendToPuppeteerWorker(data) { ... }
```

Sends job to "topuppeteerworker" topic.

Uses EventBus to retry messages if a timeout occurs.

Logs every action in structured JSON.

###  3️⃣ Consumer: General Job Processing

```bash
export async function startConsumer() { ... }
```

Subscribes to "toscrap-results" topic.

####  Handles incoming messages:

Corporate results → handleResult

Site results → directToLLM

Links array → split into 3 parts and sent to Puppeteer worker

Includes helper function splitIntoThreeParts to divide large payloads.

###  4️⃣ Consumer: Puppeteer Worker

```bash
export async function startPuppeteerConsumer() { ... }
```

Subscribes to "frompuppeteerworker" topic.

####  Buffers job results using puppeteerBuffer:

Tracks jobIds to avoid duplicates

Collects results until all expected jobs are received

####  Uses timeout logic (3 minutes) to resend incomplete jobs via EventBus:

Ensures no job is lost

Logs events with ✅, ⚠️, 🎯 for clarity

Calls handleResult when all expected jobs are collected.

###  5️⃣ EventBus Integration

```bash
eventBus.on("sending again", async (signal) => { ... });
```

Listens for resending signals from Puppeteer consumer timeout.

Ensures reliability in asynchronous job processing.

###  6️⃣ Utility Functions

```bash
function splitIntoThreeParts(array) { ... }
```

Splits an array into 3 non-overlapping chunks for efficient Puppeteer job distribution.

#### 🔗 Flow Diagram

```bash
/search POST → Kafka Producer → Puppeteer Worker
             ↘ Kafka Consumer → handleResult / directToLLM
fromPuppeteerWorker → PuppeteerConsumer → buffer → handleResult
EventBus → retry messages on timeout
```

### 📝 Logging

All actions are logged in JSON format for structured monitoring.

####  Includes:

Timestamp

Logger name

Event type

Payload size & preview

Errors (if any)


---


# 🛠️ Processor Module (`/lib/processor.js`)

This module handles **htmltext processing, chunking, vectorization, and LLM integration** for search results and corporate data.

---

## ⚡ Key Features

### 1️⃣ Chunking

```js
export function cleanAndChunk(results) { ... }
```

####  Cleans raw HTML/text:

Removes URLs

Splits into lines and trims whitespace

Filters lines with at least 3 words

Splits content into smaller chunks of 7–12 words

Groups chunks into sets of 10 for vectorization

Preserves metadata for downstream processing


###  2️⃣ Vectorization

```bash
export async function vectorize(chunks) { ... }
export async function vectorizecorporate(chunks) { ... }
```

Sends text chunks to FastAPI embedding endpoints:

/embed → general results

/embedcorporate → corporate data

Logs request, response, and errors in JSON format

Emits statusChanged events for workflow synchronization


###  3️⃣ LLM Integration

```bash
export async function goingToLLM(htmlTextArray) { ... }
```

Uses Google Generative Language API (gemini-2.0-flash) to generate Q&A from site text

####  Returns clean JSON with:

question

options array

Attaches original site metadata

Handles malformed JSON gracefully


###  4️⃣ Vectorized Search

```bash
async function searchVectorDB(question, options, metadata) { ... }
```

Sends Q&A to vectorized database

Returns best answer and full ranking from vectorembedgen

Logs structured information:

Question

Best answer

URL of source


```bash
export async function directToLLM(result) { ... }
```

Converts result.resultssite to Q&A using LLM

Sends each question to vectorized search

Streams best answers to SSE clients via handleResultToStream

Structured logging of every processed Q&A


###  5️⃣ Corporate Vectorization

```bash
export async function handleResult(result) { ... }
```

Handles both internal corporate tables and external search results

Cleans and chunks data

Calls appropriate vectorization endpoint

Logs success or warnings for missing chunks

###  6️⃣ Utility Logging

logResultVariable(result) → logs search result received from backend

logBestVariable(best) → logs best vectorized search result

logVectorizedCorporate(vectorized) → logs corporate vectorization

All logs are structured in JSON for monitoring and observability.


#### 🔗 Workflow

```bash
Raw results → cleanAndChunk → vectorize / vectorizecorporate → handleResult
LLM processing → goingToLLM → searchVectorDB → directToLLM → SSE stream
```
