import type { AIRequest, AIResponse, DiscoveredModel, ProviderName } from '@jugaad/core/types';

export interface IProviderAdapter {
  readonly name: ProviderName;
  isConfigured(): boolean;
  discoverModels(apiKey: string): Promise<DiscoveredModel[]>;
  generate(request: AIRequest, apiKey: string, modelId: string): Promise<AIResponse>;
}

/**
 * Normalises a self-hosted OpenAI-compatible base URL.
 *
 * Operators export these gateways as a bare origin (e.g.
 * `http://127.0.0.1:3001`), but the OpenAI surface lives under `/v1`. Appends
 * `/v1` when missing and strips any trailing slashes, so a caller-supplied
 * origin and a fully-qualified `/v1` URL behave identically.
 */
export function normaliseOpenAiBase(raw: string): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return trimmed;
  // A base that already points at a concrete OpenAI route is left alone.
  if (/\/v\d+$/i.test(trimmed)) return trimmed;
  if (/\/(chat\/completions|models|responses)$/i.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
}

export class AdapterError extends Error {
  public statusCode?: number;
  public provider: ProviderName;
  public isRateLimit: boolean;

  constructor(message: string, provider: ProviderName, statusCode?: number) {
    super(message);
    this.name = 'AdapterError';
    this.provider = provider;
    this.statusCode = statusCode;
    this.isRateLimit = statusCode === 429;
  }
}

export async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 25000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}
