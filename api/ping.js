// Auto-generated bundled serverless function for JugaadVision


// api-src/ping.ts
function handler(req, res) {
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify({ pong: true, timestamp: Date.now() }));
    return;
  }
  return new Response(JSON.stringify({ pong: true, timestamp: Date.now() }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
export {
  handler as default
};
