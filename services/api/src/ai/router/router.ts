import { AdapterError, type IProviderAdapter } from '../adapters/baseAdapter';
import { CustomEndpointAdapter } from '../adapters/customEndpointAdapter';
import { OpenRouterAdapter } from '../adapters/openrouterAdapter';
import { getCustomEndpoint } from '../customEndpoint';
import { keyPoolManager, redactSecrets } from '../pools/keyPool';
import { isZdrViolationError, resolveZdrFallbackModel } from '../openrouterZdr';
import type { AIRequest, AIResponse, ProviderName } from '@jugaad/core/types';

/**
 * Direct AI router.
 *
 * The free-model discovery/registry/scoring engine has been removed. Requests
 * are routed straight to a single primary provider — a self-hosted
 * OpenAI-compatible custom endpoint when configured, otherwise OpenRouter —
 * with automatic key rotation and at most one provider fallback.
 */
const DEFAULT_OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/auto';

export class AIRouter {
  private inFlightRequests: Map<string, Promise<AIResponse>> = new Map();
  private visionCache: Map<string, { response: AIResponse; timestamp: number }> = new Map();
  private maxAttemptsPerProvider = 3;

  private readonly adapters: Record<string, IProviderAdapter> = {
    custom: new CustomEndpointAdapter(),
    openrouter: new OpenRouterAdapter(),
  };

  public async execute(request: AIRequest): Promise<AIResponse> {
    const requestKey = this.generateRequestFingerprint(request);
    const isVision = request.taskType === 'vision' || request.taskType === 'advanced_image_analysis';

    if (isVision) {
      const cached = this.visionCache.get(requestKey);
      if (cached && Date.now() - cached.timestamp < 60_000) {
        return { ...cached.response, durationMs: 0, fallbackCount: 0 };
      }
      if (this.visionCache.size > 50) {
        const now = Date.now();
        for (const [k, v] of this.visionCache.entries()) {
          if (now - v.timestamp > 60_000) this.visionCache.delete(k);
        }
      }
    }

    const existing = this.inFlightRequests.get(requestKey);
    if (existing) return existing;

    const executionPromise = this.performRouting(request).then(res => {
      if (isVision) this.visionCache.set(requestKey, { response: res, timestamp: Date.now() });
      return res;
    });
    this.inFlightRequests.set(requestKey, executionPromise);

    try {
      return await executionPromise;
    } finally {
      this.inFlightRequests.delete(requestKey);
    }
  }

  private getProviderOrder(request: AIRequest): ProviderName[] {
    const order: ProviderName[] = [];
    if (request.preferredProvider && this.adapters[request.preferredProvider]) {
      order.push(request.preferredProvider);
    }
    if (getCustomEndpoint()?.endpoint) order.push('custom');
    order.push('openrouter');

    const seen = new Set<string>();
    return order.filter(p => {
      if (seen.has(p)) return false;
      seen.add(p);
      const adapter = this.adapters[p];
      return !!(adapter && adapter.isConfigured());
    });
  }

  private resolveModel(provider: ProviderName, request: AIRequest): string {
    if (request.preferredModel) return request.preferredModel;
    if (provider === 'custom') return getCustomEndpoint()?.model || 'custom';
    return DEFAULT_OPENROUTER_MODEL;
  }

  private async performRouting(request: AIRequest): Promise<AIResponse> {
    const providers = this.getProviderOrder(request);
    const errors: Array<{ provider: ProviderName; error: string }> = [];
    const isVisionTask = request.taskType === 'vision' || request.taskType === 'advanced_image_analysis';

    if (providers.length === 0) {
      throw new Error(
        'No AI provider is configured. Set a custom endpoint or an OpenRouter API key in Settings.',
      );
    }

    for (const provider of providers) {
      const adapter = this.adapters[provider];
      let modelId = this.resolveModel(provider, request);
      const attemptedKeys: string[] = [];
      let zdrFallbackTried = false;

      for (let attempt = 0; attempt < this.maxAttemptsPerProvider; attempt++) {
        const apiKey = keyPoolManager.getAvailableKey(provider, attemptedKeys);
        if (!apiKey) break;
        attemptedKeys.push(apiKey);
        const startTime = Date.now();

        try {
          const response = await adapter.generate(request, apiKey, modelId);
          keyPoolManager.reportSuccess(provider, apiKey, response.durationMs || Date.now() - startTime);
          return {
            content: response.content,
            parsedJson: response.parsedJson,
            model: response.model,
            provider: response.provider,
            taskType: request.taskType,
            usage: response.usage,
            durationMs: response.durationMs,
            fallbackCount: errors.length,
          };
        } catch (err: any) {
          const statusCode = err instanceof AdapterError ? err.statusCode : undefined;
          const errMsg = err.message || 'Unknown provider error';
          keyPoolManager.reportError(provider, apiKey, statusCode, errMsg);
          errors.push({ provider, error: errMsg });

          // Zero Data Retention accounts reject every non-ZDR endpoint. Free
          // models usually have none, so retry once with the closest
          // ZDR-compatible model (paid twin first, then cheapest capable one).
          if (provider === 'openrouter' && !zdrFallbackTried && isZdrViolationError(errMsg)) {
            zdrFallbackTried = true;
            const fallbackModel = await resolveZdrFallbackModel({
              apiKey,
              preferredModel: request.preferredModel || modelId,
              vision: isVisionTask,
            });

            if (fallbackModel && fallbackModel !== modelId) {
              const fallbackStart = Date.now();
              try {
                const fallbackResponse = await adapter.generate(request, apiKey, fallbackModel);
                keyPoolManager.reportSuccess(
                  provider,
                  apiKey,
                  fallbackResponse.durationMs || Date.now() - fallbackStart,
                );
                return {
                  content: fallbackResponse.content,
                  parsedJson: fallbackResponse.parsedJson,
                  model: fallbackResponse.model,
                  provider: fallbackResponse.provider,
                  taskType: request.taskType,
                  usage: fallbackResponse.usage,
                  durationMs: fallbackResponse.durationMs,
                  fallbackCount: errors.length,
                };
              } catch (fallbackErr: any) {
                const fallbackMsg = fallbackErr.message || 'ZDR fallback failed';
                keyPoolManager.reportError(
                  provider,
                  apiKey,
                  fallbackErr instanceof AdapterError ? fallbackErr.statusCode : undefined,
                  fallbackMsg,
                );
                errors.push({ provider, error: `ZDR fallback (${fallbackModel}): ${fallbackMsg}` });
              }
            }
          }

          // Auth / quota / invalid-key failures must not burn the remaining
          // keys on the same provider.
          if (statusCode === 401 || statusCode === 402 || statusCode === 403) break;
        }
      }
    }

    if (errors.some(entry => isZdrViolationError(entry.error))) {
      throw new Error(
        "OpenRouter is blocking this request under your account's Zero Data Retention (ZDR) privacy setting. " +
          'Free vision models have no ZDR-compatible endpoints, and the automatic fallback could not complete the analysis. ' +
          'Disable ZDR at https://openrouter.ai/settings/privacy (or configure a custom endpoint) and retry.',
      );
    }

    const summary = redactSecrets(errors.map(e => `[${e.provider}] ${e.error}`).join('; '));
    throw new Error(`AI request failed. ${summary || 'No provider responded successfully.'}`);
  }

  private generateRequestFingerprint(request: AIRequest): string {
    if (request.requestId) return request.requestId;
    const bodyStr = JSON.stringify({
      taskType: request.taskType,
      messages: request.messages,
      temp: request.temperature,
      model: request.preferredModel,
      provider: request.preferredProvider,
    });
    return `${request.taskType}_${this.simpleHash(bodyStr)}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }
}

export const aiRouter = new AIRouter();
