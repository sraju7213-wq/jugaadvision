export default function handler(req: any, res: any) {
  try {
    res.status(200).json({
      success: true,
      nodeVersion: process.version,
      platform: process.platform,
      envVercel: process.env.VERCEL,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
