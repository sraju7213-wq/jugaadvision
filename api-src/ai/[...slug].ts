import { forwardToHandler } from '../_helper';
import { handleVisionStreamRequest } from '@jugaad/api/ai/visionStreamHandler';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if ((req.method || 'GET').toUpperCase() === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, X-Custom-Auth, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }

  let path = '/api/ai';
  const querySlug = req.query?.slug
    ? (Array.isArray(req.query.slug) ? req.query.slug.join('/') : req.query.slug)
    : '';
  const urlSlug = typeof req.url === 'string'
    ? (req.url.split('?')[0].match(/^\/api\/ai\/(.+)$/)?.[1] || '')
    : '';
  const slug = querySlug || urlSlug;
  if (slug) {
    if (slug === 'vision/stream') {
      if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method Not Allowed' });
        return;
      }

      let body: any = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || (req.headers['x-real-ip'] as string)
        || (req as any).ip
        || '127.0.0.1';

      try {
        const streamResponse = await handleVisionStreamRequest(body || {}, clientIp);
        res.writeHead(streamResponse.status, Object.fromEntries(streamResponse.headers.entries()));
        if (!streamResponse.body) {
          res.end();
          return;
        }
        const reader = streamResponse.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } catch (err: any) {
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: err?.message || 'Vision stream failed' });
        } else {
          try { res.end(); } catch {}
        }
      }
      return;
    }
    path = `/api/ai/${slug}`;
  }
  return forwardToHandler(path, req, res);
}
