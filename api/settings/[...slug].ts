import { handleAIRequest } from '../../server/ai/serverHandler';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: any, res: any) {
  const url = req.url || '';
  const method = req.method || 'GET';

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // keep as string
    }
  }

  const result = await handleAIRequest(url, method, body);
  res.status(result.status).json(result.data);
}
