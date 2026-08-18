import type { AIRequest, AIResponse, DiscoveredModel, ProviderName } from '../types.ts';

export interface IProviderAdapter {
  readonly name: ProviderName;
  isConfigured(): boolean;
  discoverModels(apiKey: string): Promise<DiscoveredModel[]>;
  generate(request: AIRequest, apiKey: string, modelId: string): Promise<AIResponse>;
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
