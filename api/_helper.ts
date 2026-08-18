import { handleAIRequest } from './_lib/serverHandler';

export async function forwardToHandler(defaultPath: string, req: any, res: any) {
  try {
    let url = req.url || defaultPath;
    if (!url.startsWith('/api/') && !url.startsWith('http')) {
      url = defaultPath + (url.startsWith('?') ? url : (url ? `/${url}` : ''));
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

    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v);
      }
    }

    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error('[API Error]:', err);
    res.status(500).json({
      success: false,
      error: err?.message || 'Serverless Execution Error',
    });
  }
}
