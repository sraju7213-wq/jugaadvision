import { handleAIRequest } from '@jugaad/api/ai/serverHandler';

export async function forwardToHandler(defaultPath: string, req: any, res: any) {
  try {
    if ((req.method || 'GET').toUpperCase() === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,HEAD');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, X-Custom-Auth, Range');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.status(204).end();
      return;
    }

    let url = defaultPath || req.url || '/api/ai';
    if (!url.startsWith('/api/') && !url.startsWith('http')) {
      url = `/api/${url.replace(/^\/+/, '')}`;
    }
    // Append query string if present
    if (req.url && req.url.includes('?') && !url.includes('?')) {
      url += req.url.slice(req.url.indexOf('?'));
    }
    const method = req.method || 'GET';
    const clientIp = (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // keep as string
      }
    }

    const result = await handleAIRequest(url, method, body, clientIp);

    // Always set CORS so preview hosts and self-hosted frontends can call the API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin, X-Custom-Auth, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining');

    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v);
      }
    }

    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error('[API Error]:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      success: false,
      error: err?.message || 'Serverless Execution Error',
    });
  }
}
