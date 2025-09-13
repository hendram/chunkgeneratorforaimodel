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

⚡ Platform Requirements

💾 At least 12 GB RAM

🖥️ At least 4 CPU cores (Intel i5 or higher recommended)

🐳 Docker installed


---

🚀 How to Run It


📥 Download

```bash
docker pull ghcr.io/hendram/chunkgeneratorforaimodel
```

▶️ Start

```bash
docker run -it -d --network=host ghcr.io/hendram/chunkgeneratorforaimodel bash
```

🔍 Check Running Container

```bash
docker ps
```

```bash
CONTAINER ID   IMAGE                                         NAME                    STATUS
123abc456def   ghcr.io/hendram/chunkgeneratorforaimodel      practical_chatterjee    Up 5 minutes
```

📦 Enter Container

```bash
docker exec -it practical_chatterjee /bin/bash
```

🏃 Run the Service

```bash
cd /home/chunkgeneratorforaimodel
node server.js
```


