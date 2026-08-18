import { handleAIRequest } from '@/server/ai/serverHandler';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const url = new URL(req.url).pathname;
    const body = await req.json().catch(() => ({}));
    const result = await handleAIRequest(url, 'POST', body);

    return new Response(JSON.stringify(result.data), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url).pathname;
    const result = await handleAIRequest(url, 'GET');

    return new Response(JSON.stringify(result.data), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
}
