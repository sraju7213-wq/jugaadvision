import { handleAIRequest } from './_lib/serverHandler';

export default async function handler(req: any, res: any) {
  try {
    const result = await handleAIRequest('/api/ai/health', 'GET', undefined, '127.0.0.1');
    res.status(200).json({
      success: true,
      resultStatus: result.status,
      resultData: result.data,
    });
  } catch (err: any) {
    res.status(200).json({
      success: false,
      diagnosticError: err?.message,
      diagnosticStack: err?.stack,
    });
  }
}
