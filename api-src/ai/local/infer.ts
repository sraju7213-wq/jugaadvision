/**
 * Vercel serverless endpoint for local GGUF model inference.
 *
 * POST /api/ai/local/infer
 *   Body: { modelId: string, prompt: string, maxTokens?: number, temperature?: number }
 *   Response: { success: true, content: string, model: string, durationMs: number }
 *
 * This separate file exists so it can have an extended timeout (maxDuration: 300)
 * for large model loading without affecting the main /api/ai/local endpoint.
 */

import { handleAIRequest } from '../../../server/ai/serverHandler';

export const config = {
  maxDuration: 300,           // 5 min for model load + inference
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  const url = req.url || '/api/ai/local/infer';
  const method = req.method || 'POST';

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { /* keep as string */ }
  }

  const clientIp = (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress || '127.0.0.1';

  try {
    const result = await handleAIRequest(url, method, body, clientIp);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v);
      }
    }

    res.status(result.status).json(result.data);
  } catch (err: any) {
    console.error('[LocalInfer API Error]:', err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      success: false,
      error: err?.message || 'Local inference failed',
    });
  }
}
