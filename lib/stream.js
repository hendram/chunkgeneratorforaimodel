// stream.js
const clients = [];

// Push result array to all connected clients
export function handleResultToStream(allBest) {
  const payload = JSON.stringify(allBest);
  clients.forEach((res) => {
    res.write(`data: ${payload}\n\n`);
  });
}

// Register a new SSE client
export function registerStream(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send initial message (optional, to confirm connection)
   clients.push(res);


  req.on("close", () => {
    console.log("❌ SSE client disconnected");
    const idx = clients.indexOf(res);
    if (idx !== -1) clients.splice(idx, 1);
  });
}
