// Auto-generated bundled serverless function for JugaadVision


// api/test.ts
function handler(req, res) {
  try {
    res.status(200).json({
      success: true,
      nodeVersion: process.version,
      platform: process.platform,
      envVercel: process.env.VERCEL
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
export {
  handler as default
};
