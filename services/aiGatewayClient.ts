/**
 * Client-Side AI Gateway
 * Dispatches requests to the secure server-side AI router (/api/ai/*).
 * Zero API keys are present in frontend client code.
 */

import type {
  UnifiedGenerateRequest,
  UnifiedGenerateResponse,
  BatchGenerateRequest,
  BatchGenerateResponse,
  QualityGateDiagnostic,
} from '../server/ai/types';

export interface AIGenerateOptions {
  prompt?: string;
  systemPrompt?: string;
  userInput?: string;
  taskType?: 'text_generation' | 'prompt_enhancement' | 'structured_json' | 'vision';
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
  preferredProvider?: 'openrouter' | 'nim' | 'custom' | string;
  preferredModel?: string;
  preferFree?: boolean;
  signal?: AbortSignal;
}

export interface AIStructuredOptions extends AIGenerateOptions {
  schema?: Record<string, any>;
  jsonSchema?: Record<string, any>;
}

export interface AIVisionOptions {
  prompt?: string;
  imageBase64: string;
  mimeType?: string;
  temperature?: number;
  maxTokens?: number;
  preferredProvider?: string;
  preferredModel?: string;
  preferFree?: boolean;
  signal?: AbortSignal;
}

async function postJsonWithRetry<T>(
  url: string,
  data: any,
  timeoutMs = 45000,
  maxRetries = 2,
  externalSignal?: AbortSignal
): Promise<T> {
  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    if (externalSignal?.aborted) {
      throw new Error('Request was cancelled by user.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      externalSignal.addEventListener('abort', onExternalAbort);
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') || '';
      const json = contentType.includes('application/json')
        ? await res.json()
        : { error: await res.text() };
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      return json;
    } catch (err: any) {
      lastError = err;
      if (externalSignal?.aborted) {
        throw new Error('Request was cancelled by user.');
      }
      if (attempt < maxRetries && (err.name === 'AbortError' || err.message?.includes('fetch') || err.message?.includes('500'))) {
        attempt++;
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
        continue;
      }
      break;
    } finally {
      clearTimeout(timer);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  if (lastError?.name === 'AbortError') {
    throw new Error(`AI request timed out after ${timeoutMs / 1000}s`);
  }
  throw lastError;
}

/**
 * Unified generation endpoint caller
 */
export async function aiGenerateUnified(
  options: UnifiedGenerateRequest & { signal?: AbortSignal }
): Promise<UnifiedGenerateResponse> {
  return postJsonWithRetry<UnifiedGenerateResponse>(
    '/api/ai/generate',
    options,
    60000,
    1,
    options.signal
  );
}

/**
 * Bounded concurrency batch generation caller
 */
export async function aiGenerateBatch(
  options: BatchGenerateRequest & { signal?: AbortSignal }
): Promise<BatchGenerateResponse> {
  return postJsonWithRetry<BatchGenerateResponse>(
    '/api/ai/batch',
    options,
    90000,
    1,
    options.signal
  );
}

/**
 * Structured schema validation & repair caller
 */
export async function aiValidateStructured(
  raw: string,
  schema?: Record<string, any>
): Promise<{ success: boolean; parsed?: any; diagnostics: QualityGateDiagnostic[] }> {
  return postJsonWithRetry(
    '/api/ai/validate',
    { raw, schema },
    15000,
    0
  );
}

export async function aiGenerateText(
  options: AIGenerateOptions
): Promise<{ result: string; model: string; provider: string; durationMs: number }> {
  return postJsonWithRetry('/api/ai/chat', options, 45000, 1, options.signal);
}

export async function aiGenerateStructured<T = any>(
  options: AIStructuredOptions
): Promise<{ result: T; raw: string; model: string; provider: string; durationMs: number }> {
  return postJsonWithRetry('/api/ai/structured', options, 60000, 1, options.signal);
}

export async function aiAnalyzeVision(
  options: AIVisionOptions
): Promise<{ result: string; model: string; provider: string; durationMs: number }> {
  return postJsonWithRetry('/api/ai/vision', options, 65000, 1, options.signal);
}

export interface ModelCatalogResponse {
  success: boolean;
  freeOnly: boolean;
  taskType: string | null;
  count: number;
  lastRefreshed: string;
  stats: any;
  models: any[];
  categories: Record<string, { fast: any[]; balanced: any[]; quality: any[] }>;
}

export interface HealthResponse {
  success: boolean;
  report: any;
  providerStatuses: Record<string, {
    status: 'configured' | 'healthy' | 'degraded' | 'invalid_key' | 'no_models';
    activeKeys: number;
    totalKeys: number;
    modelCount: number;
    maskedKeys: string[];
  }>;
  registryStats: any;
  recentFailures: Array<{
    id: string;
    timestamp: string;
    provider: string;
    modelId: string;
    error: string;
    statusCode?: number;
  }>;
}

export async function aiFetchModelCatalog(options: { freeOnly?: boolean; taskType?: string } = {}): Promise<ModelCatalogResponse> {
  try {
    const params = new URLSearchParams();
    if (options.freeOnly !== undefined) params.set('freeOnly', String(options.freeOnly));
    if (options.taskType) params.set('taskType', options.taskType);
    const query = params.toString();
    const res = await fetch(`/api/ai/models${query ? `?${query}` : ''}`);
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.warn('Failed to fetch AI model catalog:', err);
    return {
      success: false,
      freeOnly: true,
      taskType: null,
      count: 0,
      lastRefreshed: new Date().toISOString(),
      stats: null,
      models: [],
      categories: {} as any,
    };
  }
}

export async function aiFetchModels(options: { freeOnly?: boolean; taskType?: string } = {}): Promise<any[]> {
  const catalog = await aiFetchModelCatalog(options);
  return catalog.models || [];
}

export async function aiRefreshModels(options: { freeOnly?: boolean; intervalMs?: number } = {}): Promise<ModelCatalogResponse> {
  return postJsonWithRetry<ModelCatalogResponse>('/api/ai/models/refresh', options, 30000, 0);
}

export async function aiFetchHealth(): Promise<HealthResponse | null> {
  try {
    const res = await fetch('/api/ai/health');
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Failed to fetch AI health report:', err);
    return null;
  }
}

export async function aiTestProvider(provider: string, key?: string): Promise<{
  success: boolean;
  provider: string;
  status: 'healthy' | 'degraded' | 'invalid_key' | 'no_models';
  latencyMs: number;
  message: string;
  testedModel?: string;
  error?: string;
}> {
  return postJsonWithRetry('/api/ai/provider/test', { provider, key }, 20000, 0);
}

export async function aiSaveProviderKeys(provider: string, keys: string[] | string): Promise<{
  success: boolean;
  provider: string;
  activeKeys: number;
  totalKeys: number;
  maskedKeys: string[];
  message: string;
}> {
  return postJsonWithRetry('/api/settings/providers', { provider, keys }, 15000, 0);
}

export async function aiSaveCustomEndpoint(options: { endpoint: string; model: string; key?: string }): Promise<{ success: boolean; endpoint: string; model: string; message: string }> {
  return postJsonWithRetry('/api/settings/custom-endpoint', options, 15000, 0);
}

export async function aiFetchCustomEndpoint(): Promise<{ endpoint: string; model: string }> {
  const res = await fetch('/api/settings/custom-endpoint');
  const data = await res.json();
  return { endpoint: data.endpoint || '', model: data.model || '' };
}

export async function aiFetchAppearanceSettings(): Promise<any> {
  try {
    const res = await fetch('/api/settings/appearance');
    const data = await res.json();
    return data.settings || null;
  } catch (err) {
    console.warn('Failed to fetch appearance settings from server:', err);
    return null;
  }
}

export async function aiSaveAppearanceSettings(settings: any): Promise<any> {
  return postJsonWithRetry('/api/settings/appearance', settings, 10000, 0);
}

export async function aiClearTelemetry(): Promise<{ success: boolean; message: string }> {
  return postJsonWithRetry('/api/ai/telemetry/clear', {}, 10000, 0);
}
