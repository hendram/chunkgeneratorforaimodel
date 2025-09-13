The Backend

This project is the backend for Auto Answering Q&A AI Agent service. This package as central along with kafka to deliver message between frontend, puppeteerservice,
puppeteerworkers, and vectorembedgen(tidb database connector). This backend will receive message first from frontend to scrap data either from external
site using search engine to find the links or scrap directly from private company knowledge base.

---

📦 About This Package

This package works together with another package as direct connection, like puppeteer, puppeteerworker1,
puppeteerworker2, puppeteerworker3, autoansweringform, vectorembedgen. some though fetch, and some through
kafka

---

⚙️ How It Works

This backend package will accept messages from frontend in two kind format like

```bash
topic: { searched: "tidb vector --filetype=html --filetype=xhtml --filetype=text,
  searchEngine: "search.brave.com",
  site: [https://docs.google.com/forms/d/e/1FAIpQLSfRj7VFEAZJIm8HgE3lk0K_b5i9w0mgX9G2_XntzbptuURYiw/viewform?usp=dialog}
}
```

or

```bash
topic: { corporate: "https://hendram.github.io/Knowledgebase/",
         topic: "mongodb rag"
}
```

at one time. And for all messages accepted all will be forward to puppeteer, but for topic with searched
keyword, will be change first so it will send to /insertsearchtodb endpoint directly to vectorembedgen, 
to check if keywords table exists or not there, if exists, then leave it and back again, if not exists 
will add first then back again. 

And still with topic with searched, topic object will be recreated, one consist only searched, and seachEngine only, and another one consist only site,
It needs to be send at different time to puppeteer, topic with searched will be send first, and after back, result links will be divided become three 
parts and each part is looping to send to each puppeteerworkers. After all links successfully scraped by puppeteerworkers, then messages will be back
again and joined become one message, clean it up from html tags, and chunking, and vectorized and send to /embed endpoint to create a database 
with format {keywordsonlysearch}_external, for example tidb_vector_external.

After this done, then another topic with only site key send it to puppeteer and scraped, then when back, result will be send to LLM, google gemini to be
sterilized from Tags and chunked. After that will be vectorized. then this vectorized will be send to endpoint /searchvectordb to compare it against
_internal or _internal or both if exists to get best results from q&a.

For topics with corporate key, this backend will send to puppeteer site scrapper directly upon receive
message from frontend, and process with cleanAndChunk, vectorizedcorporate function, and send to 
vectorembedgen through /embedcorporate endpoind to create table with {table_name}_internal which 
table_name will be inferred through user keywords search on topic user input. Then end result just
to create {table_name}_internal table on tidb test database.  

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


