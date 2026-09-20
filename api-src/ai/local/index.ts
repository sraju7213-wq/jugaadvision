/**
 * GET /api/ai/local/models
 * POST /api/ai/local/models/search
 * POST /api/ai/local/models/download
 * DELETE /api/ai/local/models/:id
 * GET /api/ai/local/models/:id/status
 *
 * Vercel serverless endpoints for local GGUF model management.
 * All disk I/O uses the .local-models/ directory persisted via Vercel
 * filesystem (ephemeral — use R2 / external storage for production use).
 */

import { handleAIRequest } from '../../../server/ai/serverHandler';

export const config = {
  maxDuration: 300,           // 5 min — downloads can be large
  api: {
    bodyParser: {
      sizeLimit: '5mb',        // request bodies (search params, etc.)
    },
  },
};

export default async function handler(req: any, res: any) {
  // Route: /api/ai/local/...
  const url = req.url || '/api/ai/local/models';
  const method = req.method || 'GET';

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { /* keep as string */ }
  }

  const clientIp = (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress || '127.0.0.1';

  try {
    const result = await handleAIRequest(url, method, body, clientIp);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v);
      }
    }

    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error('[LocalModel API Error]:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      success: false,
      error: err?.message || 'Local model request failed',
    });
  }
}
