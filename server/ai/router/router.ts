import { AdapterError } from '../adapters/baseAdapter';
import { modelDiscoveryService } from '../discovery/discoveryService';
import { modelHealthManager } from '../health/modelHealthManager';
import { keyPoolManager, redactSecrets } from '../pools/keyPool';
import { freeModelRegistry } from '../registry/freeModelRegistry';
import { modelScoringEngine } from '../scoring/modelScoringEngine';
import type {
  AIModel,
  AIRequest,
  AIResponse,
  ModelCapabilityType,
  ProviderName,
} from '../types';

export class AIRouter {
  private inFlightRequests: Map<string, Promise<AIResponse>> = new Map();
  private defaultMaxFallbackAttempts = 6;

  /**
   * Main AI Router execution engine.
   * Performs 10-step routing pipeline:
   * 1. Get models from FreeModelRegistry
   * 2. Keep only verified free models
   * 3. Remove unhealthy models
   * 4. Remove models currently in cooldown
   * 5. Filter by required capability
   * 6. Score the remaining models with task-specific weights (lightweight for simple tasks, strong for complex)
   * 7. Select best available provider + model + API key
   * 8. Execute the request
   * 9. Record success / failure
   * 10. If failed, automatically try next compatible candidate
   */
  public async execute(request: AIRequest): Promise<AIResponse> {
    const requestKey = this.generateRequestFingerprint(request);
    const existing = this.inFlightRequests.get(requestKey);
    if (existing) {
      return existing;
    }

    const executionPromise = this.performRouting(request);
    this.inFlightRequests.set(requestKey, executionPromise);

    try {
      return await executionPromise;
    } finally {
      this.inFlightRequests.delete(requestKey);
    }
  }

  private async performRouting(request: AIRequest): Promise<AIResponse> {
    // Keep model discovery current in long-lived servers and serverless
    // instances alike. Give live discovery a short head start so first-use
    // routing can select a current model, then continue in the background if
    // a provider is slow.
    if (freeModelRegistry.isRefreshDue()) {
      await freeModelRegistry.waitForFreshCatalog();
    }

    // 1. Get all models from FreeModelRegistry
    let allModels = freeModelRegistry.getAllModels();
    if (allModels.length === 0) {
      allModels = await freeModelRegistry.refreshRegistry();
    }

    const now = Date.now();
    const preferFree = request.preferFree !== false;
    const requiredCaps = this.getRequiredCapabilities(request);
    const errors: Array<{ provider: ProviderName; model: string; error: string; status?: number }> = [];

    // 2. Keep eligible models (verified free and provider models, excluding paid when preferFree is true)
    let candidates = allModels.filter(m => {
      if (preferFree && m.provider !== 'custom' && !(m.verifiedFree === true && m.eligibilityStatus === 'free')) {
        return false;
      }
      return true;
    });

    // 3. Remove unhealthy models
    candidates = candidates.filter(m => {
      if (m.status === 'disabled') return false;
      return modelHealthManager.isModelAvailable(m.provider, m.providerModelId || m.id);
    });

    // 4. Remove models currently in cooldown
    candidates = candidates.filter(m => {
      if ((m.cooldownUntil || 0) > now || m.status === 'cooldown') {
        return false;
      }
      return true;
    });

    // 5. Filter by required capability
    candidates = candidates.filter(m => {
      for (const cap of requiredCaps) {
        if (!m.capabilityMap || m.capabilityMap[cap] !== 'supported') {
          return false;
        }
      }
      if (request.taskType === 'structured_json' && m.capabilityMap?.structured_output !== 'supported') {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      // Relaxed fallback: allow degraded models whose cooldown expired for this specific capability,
      // and allow eligible_unknown models when verified free models are unavailable
      candidates = allModels.filter(m => {
        if (preferFree && m.provider !== 'custom' && !(m.verifiedFree === true && m.eligibilityStatus === 'free') && m.eligibilityStatus !== 'eligible_unknown') return false;
        for (const cap of requiredCaps) {
          if (!m.capabilityMap || m.capabilityMap[cap] !== 'supported') return false;
        }
        // Allow degraded but not disabled/cooldown-active models
        if (m.status === 'disabled') return false;
        if ((m.cooldownUntil || 0) > now) return false;
        return true;
      });
    }

    if (candidates.length === 0) {
      const emergencyRes = await this.emergencyFallback(request, errors);
      if (emergencyRes) {
        return emergencyRes;
      }
      if (preferFree) {
        throw new Error(
          `No verified free AI models are available for task "${request.taskType}" with required capabilities: [${requiredCaps.join(', ')}]. Please configure API keys in Settings or allow paid models.`
        );
      }
      throw new Error(`No available AI models found matching task type: ${request.taskType} with required capabilities: [${requiredCaps.join(', ')}]`);
    }

    // A selected provider/model is an instruction, not merely a scoring hint.
    // Keep normal candidates as fallbacks so a temporary provider failure never
    // turns into a hard failure for the user.
    if (request.preferredModel) {
      const preferredModelCandidates = candidates.filter(model =>
        model.providerModelId === request.preferredModel ||
        model.id === request.preferredModel ||
        `${model.provider}:${model.providerModelId}` === request.preferredModel
      );
      if (preferredModelCandidates.length > 0) {
        const preferredSet = new Set(preferredModelCandidates);
        candidates = [...preferredModelCandidates, ...candidates.filter(model => !preferredSet.has(model))];
      }
    } else if (request.preferredProvider) {
      const providerCandidates = candidates.filter(model => model.provider === request.preferredProvider);
      if (providerCandidates.length > 0) {
        const providerSet = new Set(providerCandidates);
        candidates = [...providerCandidates, ...candidates.filter(model => !providerSet.has(model))];
      }
    }

    // 6. Score remaining models using dynamic task-specific scoring engine
    const scoredCandidates = [...candidates].sort((a, b) => {
      if (request.preferredModel) {
        const isPreferred = (model: typeof a) =>
          model.providerModelId === request.preferredModel ||
          model.id === request.preferredModel ||
          `${model.provider}:${model.providerModelId}` === request.preferredModel;
        if (isPreferred(a) !== isPreferred(b)) return isPreferred(a) ? -1 : 1;
      } else if (request.preferredProvider && (a.provider === request.preferredProvider) !== (b.provider === request.preferredProvider)) {
        return a.provider === request.preferredProvider ? -1 : 1;
      }
      const scoreA = modelScoringEngine.scoreModel(a, request);
      const scoreB = modelScoringEngine.scoreModel(b, request);
      return scoreB - scoreA;
    });

    // 7. Select best candidate + fallback loop
    const maxAttempts = request.maxFallbackAttempts || this.defaultMaxFallbackAttempts;
    let attemptsCount = 0;
    const unavailableProviders = new Set<ProviderName>();

    for (const candidate of scoredCandidates) {
      if (attemptsCount >= maxAttempts) {
        break;
      }

      if (unavailableProviders.has(candidate.provider)) {
        continue;
      }

      const adapter = modelDiscoveryService.getAdapter(candidate.provider);
      if (!adapter) continue;

      if (!keyPoolManager.isProviderAvailable(candidate.provider)) {
        unavailableProviders.add(candidate.provider);
        continue;
      }

      const attemptedKeys: string[] = [];
      let modelSucceeded = false;

      while (!modelSucceeded && attemptsCount < maxAttempts) {
        const apiKey = keyPoolManager.getAvailableKey(candidate.provider, attemptedKeys);
        if (!apiKey) {
          if (attemptedKeys.length > 0) {
            unavailableProviders.add(candidate.provider);
          }
          break;
        }

        attemptedKeys.push(apiKey);
        attemptsCount++;
        const startTime = Date.now();

        try {
          // 8. Execute request
          const modelIdToUse = candidate.providerModelId || candidate.id;
          const response = await adapter.generate(request, apiKey, modelIdToUse);
          const duration = Date.now() - startTime;

          // 9. Record success
          keyPoolManager.reportSuccess(candidate.provider, apiKey, duration);
          modelHealthManager.recordModelSuccess(candidate.provider, modelIdToUse, duration);
          modelHealthManager.recordKeySuccess(candidate.provider, apiKey, duration);
          freeModelRegistry.recordModelSuccess(candidate.provider, modelIdToUse, duration);

          return {
            content: response.content,
            parsedJson: response.parsedJson,
            model: response.model,
            provider: response.provider,
            taskType: request.taskType,
            usage: response.usage,
            durationMs: response.durationMs,
            fallbackCount: attemptsCount - 1,
          };
        } catch (err: any) {
          // 9. Record failure
          const statusCode = err instanceof AdapterError ? err.statusCode : undefined;
          const errMsg = err.message || 'Unknown provider error';
          const modelIdToUse = candidate.providerModelId || candidate.id;

          keyPoolManager.reportError(candidate.provider, apiKey, statusCode, errMsg);
          modelHealthManager.recordModelFailure(candidate.provider, modelIdToUse, errMsg, statusCode);
          modelHealthManager.recordKeyFailure(candidate.provider, apiKey, errMsg, statusCode);
          freeModelRegistry.recordModelFailure(candidate.provider, modelIdToUse, errMsg, statusCode);

          errors.push({
            provider: candidate.provider,
            model: modelIdToUse,
            error: errMsg,
            status: statusCode,
          });

          // Detect auth/key failures — skip entire provider immediately
          const isAuthFailure = statusCode === 401 || statusCode === 403 ||
            (statusCode === 400 && (errMsg.includes('API key') || errMsg.includes('API_KEY_INVALID') || errMsg.includes('INVALID_ARGUMENT')));
          const isModelGone = statusCode === 404;
          const isTimeout = errMsg.toLowerCase().includes('timeout') || errMsg.toLowerCase().includes('timed out');

          if (isAuthFailure) {
            // All keys for this provider are likely invalid — skip to next provider
            unavailableProviders.add(candidate.provider);
            console.warn(`[AIRouter] Auth failure for ${candidate.provider} — skipping provider entirely.`);
            break;
          }

          if (isModelGone) {
            // Model doesn't exist — don't retry with different keys, move to next model
            console.warn(`[AIRouter] Model ${candidate.providerModelId} not found (404) — skipping model.`);
            break;
          }

          if (isTimeout) {
            // Model is unresponsive — don't burn other keys on it, move to next model
            console.warn(`[AIRouter] Model ${candidate.providerModelId} timed out — skipping model.`);
            break;
          }

          console.warn(`[AIRouter] Candidate ${candidate.providerModelId} on ${candidate.provider} failed: ${errMsg}. Trying next candidate (Attempt ${attemptsCount}/${maxAttempts})...`);
        }
      }
    }

    // 10. Emergency Fallback
    const emergencyRes = await this.emergencyFallback(request, errors);
    if (emergencyRes) {
      return emergencyRes;
    }

    const summary = redactSecrets(errors.map(e => `[${e.provider}:${e.model}] ${e.error}`).join('; '));
    throw new Error(`All AI fallback candidates failed (${attemptsCount} attempts). Details: ${summary || 'No healthy providers available'}`);
  }

  private getRequiredCapabilities(request: AIRequest): ModelCapabilityType[] {
    if (request.requiredCapabilities && request.requiredCapabilities.length > 0) {
      return request.requiredCapabilities;
    }

    return [modelScoringEngine.getPrimaryCapabilityForTask(request.taskType)];
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

  private async emergencyFallback(
    request: AIRequest,
    previousErrors: Array<{ provider: ProviderName; model: string; error: string; status?: number }>
  ): Promise<AIResponse | null> {
    const requiredCaps = this.getRequiredCapabilities(request);
    const isVision = request.taskType === 'vision' ||
                     request.taskType === 'advanced_image_analysis' ||
                     request.taskType === 'image_analysis' ||
                     requiredCaps.includes('vision') ||
                     request.requiredCapabilities?.includes('vision');
    // Prioritize providers that have known working keys (NIM first for vision and general tasks)
    const providers: ProviderName[] = ['custom', 'nim', 'openrouter'];

    for (const p of providers) {
      const adapter = modelDiscoveryService.getAdapter(p);
      if (!adapter) continue;

      const apiKey = keyPoolManager.getAvailableKey(p);
      if (!apiKey) continue;

      let bootstrapModels = modelDiscoveryService.getBootstrapModels(p);
      if (isVision) {
        bootstrapModels = bootstrapModels.filter(m => m.capabilities.includes('vision') || m.modalities.includes('vision'));
      }

      for (const model of bootstrapModels) {
        try {
          const startTime = Date.now();
          const res = await adapter.generate(request, apiKey, model.id);
          const duration = Date.now() - startTime;

          keyPoolManager.reportSuccess(p, apiKey, duration);
          modelHealthManager.recordModelSuccess(p, model.id, duration);
          freeModelRegistry.recordModelSuccess(p, model.id, duration);

          return {
            content: res.content,
            parsedJson: res.parsedJson,
            model: res.model,
            provider: res.provider,
            taskType: request.taskType,
            usage: res.usage,
            durationMs: res.durationMs,
            fallbackCount: previousErrors.length,
          };
        } catch (err: any) {
          previousErrors.push({
            provider: p,
            model: model.id,
            error: err.message,
          });
        }
      }
    }

    return null;
  }
}

export const aiRouter = new AIRouter();
