import { handleVisionStreamRequest } from '../../../server/ai/visionStreamHandler';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method Not Allowed' });
    return;
  }

  // Aggregate body (Vercel may pre-parse)
  let body: any = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || (req.headers['x-real-ip'] as string)
    || (req as any).ip
    || '127.0.0.1';

  try {
    const streamResponse = await handleVisionStreamRequest(body, clientIp);

    // Forward SSE response to Vercel's Node response
    res.writeHead(streamResponse.status, Object.fromEntries(streamResponse.headers.entries()));

    if (!streamResponse.body) {
      res.end();
      return;
    }

    const reader = streamResponse.body.getReader();
    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } catch (e) {
        try { res.end(); } catch {}
      }
    };
    await pump();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err?.message || 'Vision stream failed' });
    } else {
      try { res.end(); } catch {}
    }
  }
}
