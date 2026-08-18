// Auto-generated bundled serverless function for JugaadVision


// api/test.ts
async function handler(req, res) {
  const data = {
    success: true,
    nodeVersion: typeof process !== "undefined" ? process.version : "edge",
    platform: typeof process !== "undefined" ? process.platform : "edge",
    hasRes: !!res,
    isReqInstanceOfRequest: typeof Request !== "undefined" && req instanceof Request,
    url: req?.url || "unknown"
  };
  if (res && typeof res.status === "function") {
    return res.status(200).json(data);
  }
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
export {
  handler as default
};
