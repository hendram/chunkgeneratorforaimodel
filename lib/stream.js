// stream.js
const clients = [];

// Structured logger
function logSSE(event, details = {}) {
  console.log(JSON.stringify({
    level: "INFO",
    timestamp: new Date().toISOString(),
    logger: "sse",
    event,
    ...details
  }));
}
// Push result array to all connected clients
export function handleResultToStream(allBest) {
  const payload = JSON.stringify(allBest);

 setInterval(() => { clients.forEach(res => res.write(":heartbeat\n\n")); }, 5000);

  clients.forEach((res) => {
    res.write(`data: ${payload}\n\n`);
  });

  logSSE("result_broadcast", {
    clients_count: clients.length,
    payload_size: Buffer.byteLength(payload)
  });

}

// Register a new SSE client
export function registerStream(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  logSSE("client_connected", { clients_count: clients.length });

  clients.push(res);

  req.on("close", () => {
    const idx = clients.indexOf(res);
    if (idx !== -1) clients.splice(idx, 1);
    logSSE("client_disconnected", { clients_count: clients.length });
  });
}

// ✅ Global heartbeat (runs once per process, not per client)
setInterval(() => {
  clients.forEach((res) => res.write(":heartbeat\n\n"));
  if (clients.length > 0) {
    logSSE("heartbeat", { clients_count: clients.length });
  }
},10000);
