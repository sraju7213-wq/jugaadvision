import { handleAIRequest } from '../server/ai/serverHandler';

export async function forwardToHandler(defaultPath: string, req: any, res?: any) {
  try {
    const isWebRequest = typeof Request !== 'undefined' && req instanceof Request;
    let url = isWebRequest ? (req as Request).url : (req?.url || defaultPath);
    let method = isWebRequest ? (req as Request).method : (req?.method || 'GET');

    let clientIp = '127.0.0.1';
    let body: any = undefined;

    if (isWebRequest) {
      const webReq = req as Request;
      clientIp = webReq.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
      if (method !== 'GET' && method !== 'HEAD') {
        try {
          body = await webReq.json();
        } catch {
          body = undefined;
        }
      }
    } else {
      clientIp = (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req?.socket?.remoteAddress || '127.0.0.1';
      body = req?.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          // keep as string
        }
      }
    }

    if (!url.startsWith('/api/') && !url.startsWith('http')) {
      url = defaultPath + (url.startsWith('?') ? url : (url ? `/${url}` : ''));
    }

    const result = await handleAIRequest(url, method, body, clientIp);

    if (res && typeof res.status === 'function') {
      if (result.headers) {
        for (const [k, v] of Object.entries(result.headers)) {
          res.setHeader(k, v);
        }
      }
      return res.status(result.status).json(result.data);
    }

    return new Response(JSON.stringify(result.data), {
      status: result.status,
      headers: {
        'Content-Type': 'application/json',
        ...(result.headers || {}),
      },
    });
  } catch (err: any) {
    console.error('[API Error]:', err);
    if (res && typeof res.status === 'function') {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Serverless Execution Error',
        stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack,
      });
    }
    return new Response(JSON.stringify({
      success: false,
      error: err?.message || 'Serverless Execution Error',
      stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
