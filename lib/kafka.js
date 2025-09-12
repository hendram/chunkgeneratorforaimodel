import { Kafka } from "kafkajs";
import { handleResult, directToLLM } from "./processor.js";
import eventBus from "./events.js";

const kafka = new Kafka({ clientId: "scrapbackend", brokers: ["localhost:9092"] });
export const producer = kafka.producer();
export const topProducer = kafka.producer();
const consumer = kafka.consumer({ groupId: "scrapbackend-group",   
  heartbeatInterval: 30000, // send heartbeat every 20s
  sessionTimeout: 480000 });


// Send job to Puppeteer worker
export async function sendMessage(data) {
  await producer.connect();
  await producer.send({
    topic: "fromscrap",
    messages: [{ value: JSON.stringify(data) }],
  });
  await producer.disconnect();
}

// Start background consumer to process Puppeteer results
export async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: "toscrap-results", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const raw = message.value.toString();
        const data = JSON.parse(raw);

        // Process asynchronously: chunk → vectorize → LLM → search
        if(data && data.results && data.results.corporate.length > 0){
           handleResult(data);
        }
        else if(data  && data.resultssite && data.resultssite.length > 0) {
           directToLLM(data);
        }
       else {
         if (Array.isArray(data.links) && data.links.length > 0) {
          // Split data.items into 3 non-overlapping parts
          const parts = splitIntoThreeParts(data.links);

          // Send each part separately
          for (const part of parts) {
            if (part.length > 0) {
              console.log("part", part);

              await sendToPuppeteerWorker({query: part, topicsArray: data.topicsArray, searched: data.searched });
              
            }
          }
   await topProducer.disconnect();
      } 
    }
}
       catch (err) {
        console.error("Kafka consumer error:", err);
      }
    },
  });
}

function splitIntoThreeParts(array) {
  const len = array.length;
  const part1End = Math.ceil(len / 3);
  const part2End = Math.ceil((2 * len) / 3);

  const part1 = array.slice(0, part1End);
  const part2 = array.slice(part1End, part2End);
  const part3 = array.slice(part2End);

  return [part1, part2, part3];
}

export async function sendToPuppeteerWorker(data) {
  await topProducer.connect();
  await topProducer.send({
    topic: "topuppeteerworker",
    messages: [{ value: JSON.stringify(data) }],
  });
}

const puppeteerConsumer = kafka.consumer({ groupId: "puppeteerworker-group",   
  heartbeatInterval: 30000, // send heartbeat every 20s
  sessionTimeout: 480000 });

const puppeteerBuffer = {
  jobIds: new Set(),     // to track which jobIds we’ve received
  results: []            // to collect results
};
const expectedJobIds = [1, 2, 3]; 

export async function startPuppeteerConsumer() {
  await puppeteerConsumer.connect();
  await puppeteerConsumer.subscribe({ topic: "frompuppeteerworker", fromBeginning: false });


  await puppeteerConsumer.run({
    eachMessage: async ({ message }) => {
      try {
        const raw = message.value.toString();
        const data = JSON.parse(raw);
  const { jobId, results } = data;

        // only push if this jobId wasn’t seen before
        if (!puppeteerBuffer.jobIds.has(jobId)) {
          puppeteerBuffer.jobIds.add(jobId);
          puppeteerBuffer.results.push(...results);

          console.log(`✅ Stored results for jobId=${jobId}`);
        } else {
          console.log(`⚠️ Duplicate jobId=${jobId}, ignoring`);
        }

        // check if we have all expected jobIds
        const allReceived = expectedJobIds.every(id => puppeteerBuffer.jobIds.has(id));

        if (allReceived) {
          console.log("🎯 All jobsId received, executing handleResult", allReceived);

          await handleResult({ results: puppeteerBuffer.results });

          // cleanup for next round
          puppeteerBuffer.jobIds.clear();
          puppeteerBuffer.results = [];
        }
eventBus.emit("statusChanged", { returnValue: true });



      } catch (err) {
        console.error("Kafka puppeteer consumer error:", err);
      }
    },
  });
}
