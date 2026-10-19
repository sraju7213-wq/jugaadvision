import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { aiRouter } from '@jugaad/api/ai/router/router';
import { setCustomEndpoint } from '@jugaad/api/ai/customEndpoint';

// The credential store persists to a shared tmpdir path; clear it so a key
// saved by an earlier run cannot make a "no provider configured" test pass.
const PERSISTED_KEYS = path.join(os.tmpdir(), 'jugaad-api-keys.json');

const REQUEST = {
  taskType: 'structured_json',
  messages: [{ role: 'user', content: 'describe this image' }],
  maxTokens: 128,
};

function okResponse(content: string) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }),
    text: async () => content,
  } as unknown as Response;
}

function errorResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    statusText: 'Error',
    json: async () => ({}),
    text: async () => body,
  } as unknown as Response;
}

describe('AIRouter', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fs.rmSync(PERSISTED_KEYS, { force: true });
    setCustomEndpoint(null);
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEYS;
    delete process.env.OPENROUTER_API_KEY_1;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws a clear error when no provider is configured', async () => {
    await expect(aiRouter.execute({ ...REQUEST, requestId: 'no-provider' })).rejects.toThrow(
      /No AI provider is configured/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dedupes concurrent identical requests into a single upstream call', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key-0000000000';
    fetchMock.mockResolvedValue(okResponse('{"subject":"a lighthouse"}'));

    const [a, b] = await Promise.all([
      aiRouter.execute({ ...REQUEST, requestId: 'shared' }),
      aiRouter.execute({ ...REQUEST, requestId: 'shared' }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.content).toBe(b.content);
  });

  it('returns the first provider response and records the model', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key-0000000000';
    fetchMock.mockResolvedValue(okResponse('{"subject":"a lighthouse"}'));

    const response = await aiRouter.execute({ ...REQUEST, requestId: 'single' });

    expect(response.provider).toBe('openrouter');
    expect(response.fallbackCount).toBe(0);
    expect(response.usage?.totalTokens).toBe(15);
  });

  it('serves a repeated vision request from cache without calling upstream', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key-0000000000';
    fetchMock.mockResolvedValue(okResponse('{"subject":"a lighthouse"}'));

    const visionRequest = {
      taskType: 'vision',
      messages: [{ role: 'user', content: 'what is in this image' }],
      requestId: 'vision-cache',
    };

    const first = await aiRouter.execute(visionRequest);
    const second = await aiRouter.execute(visionRequest);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.durationMs).toBe(0);
    expect(second.content).toBe(first.content);
  });

  it('aggregates and redacts a failure when every provider errors', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key-0000000000';
    fetchMock.mockResolvedValue(errorResponse(401, 'invalid api key sk-or-test-key-0000000000'));

    await expect(aiRouter.execute({ ...REQUEST, requestId: 'redact' })).rejects.toThrow(
      /AI request failed\. \[openrouter\]/,
    );

    // The raw key must never reach the caller.
    await expect(aiRouter.execute({ ...REQUEST, requestId: 'redact-2' })).rejects.not.toThrow(
      /sk-or-test-key-0000000000/,
    );
  });

  it('does not leak the raw key into the thrown message', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-test-key-0000000000';
    fetchMock.mockResolvedValue(errorResponse(500, 'upstream exploded'));

    const error = await aiRouter
      .execute({ ...REQUEST, requestId: 'no-leak' })
      .catch((err: Error) => err);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('sk-or-test-key-0000000000');
  });
});
