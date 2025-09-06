import { Kafka } from "kafkajs";
import { handleResult } from "./processor.js";

const kafka = new Kafka({ clientId: "scrapbackend", brokers: ["localhost:9092"] });
export const producer = kafka.producer();
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
        console.log("Received result from Puppeteer:", data);

        // Process asynchronously: chunk → vectorize → LLM → search
        handleResult(data);
      } catch (err) {
        console.error("Kafka consumer error:", err);
      }
    },
  });
}
