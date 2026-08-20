import { aiRouter } from './router/router';
import { SECURITY_HEADERS } from './security';
import type { AIRequest } from './types';

/**
 * Streaming Vision Handler — SSE progressive delivery
 * Executes normal aiRouter then streams result incrementally for perceived speed.
 * Provider-native streaming can replace the simulated chunking later without client changes.
 */

export async function handleVisionStreamRequest(body: any, clientIp = '127.0.0.1'): Promise<Response> {
  const encoder = new TextEncoder();

  // Build AIRequest same as serverHandler vision path
  const messages = body.messages || [
    {
      role: 'user',
      content: [
        { type: 'text', text: body.prompt || 'Describe this image in rich visual detail for an image generation prompt.' },
        {
          type: 'image_url',
          image_url: {
            url: body.imageBase64?.startsWith('data:')
              ? body.imageBase64
              : `data:${body.mimeType || 'image/jpeg'};base64,${body.imageBase64}`,
          },
        },
      ],
    },
  ];

  const aiRequest: AIRequest = {
    taskType: 'advanced_image_analysis',
    messages,
    temperature: body.temperature ?? 0.6,
    maxTokens: body.maxTokens ?? 2048,
    preferredProvider: body.preferredProvider,
    preferredModel: body.preferredModel,
    preferFree: body.preferFree !== false,
  };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send('status', { stage: 'routing', progress: 10 });

        const startTime = Date.now();
        // Kick off routing — this is the latency bottleneck; status emitted first gives instant feedback
        const result = await aiRouter.execute(aiRequest);
        const durationMs = Date.now() - startTime;

        send('meta', {
          model: result.model,
          provider: result.provider,
          durationMs,
          fallbackCount: result.fallbackCount,
        });

        // Simulate token streaming: chunk by words with small delay for progressive UI
        // When provider streaming is implemented, replace this with real token events
        const content: string = result.content || '';
        // Try to preserve JSON structure: if content looks like JSON, stream as structured
        let isJson = false;
        let parsed: any = null;
        try {
          const maybe = content.trim();
          if (maybe.startsWith('{') || maybe.startsWith('[')) {
            parsed = JSON.parse(maybe);
            isJson = true;
          } else {
            const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
            if (match) {
              parsed = JSON.parse(match[1].trim());
              isJson = true;
            }
          }
        } catch { /* not json */ }

        if (isJson && parsed) {
          // Stream structured object: emit assembledPrompt tokens + fields progressively
          const assembled: string = parsed.assembledPrompt || parsed.prompt || content;
          const tokens = assembled.split(/(\s+)/);
          let acc = '';
          for (let i = 0; i < tokens.length; i++) {
            acc += tokens[i];
            // emit every 3 tokens to reduce event spam
            if (i % 3 === 0 || i === tokens.length - 1) {
              send('token', { text: tokens[i], accumulated: acc });
            }
          }
          send('structured', { ...parsed, _streamed: true });
        } else {
          const tokens = content.split(/(\s+)/);
          let acc = '';
          for (let i = 0; i < tokens.length; i++) {
            acc += tokens[i];
            if (i % 3 === 0 || i === tokens.length - 1) {
              send('token', { text: tokens[i], accumulated: acc });
            }
          }
        }

        send('done', {
          result: result.content,
          parsedJson: result.parsedJson || parsed || null,
          model: result.model,
          provider: result.provider,
          durationMs,
        });
      } catch (err: any) {
        send('error', { error: err?.message || 'Vision streaming failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...SECURITY_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
