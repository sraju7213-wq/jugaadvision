import { capabilityClassifier } from '../classification/capabilityClassifier';
import { modelDiscoveryService } from '../discovery/discoveryService';
import { redactSecrets } from '../pools/keyPool';
import type {
  AIModel,
  CategorizedModelCatalog,
  ModelCapabilityType,
  ModelStatus,
  ProviderName,
  SanitizedRecentFailure,
  TaskCategory,
  TaskType,
} from '../types';

export interface RegistryStats {
  totalModels: number;
  verifiedFreeModels: number;
  eligibleUnknownModels: number;
  paidModels: number;
  visionModels: number;
  capabilitiesCount: Record<ModelCapabilityType, number>;
  byProvider: Record<ProviderName, {
    total: number;
    verifiedFree: number;
    available: number;
    inCooldown: number;
  }>;
  lastRefreshed: string;
}

export class FreeModelRegistry {
  private models: Map<string, AIModel> = new Map();
  private refreshPromise: Promise<AIModel[]> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshIntervalMs = parseInt(process.env.REGISTRY_REFRESH_INTERVAL_MS || '3600000', 10); // 1 hour default
  private lastRefreshed: string = new Date().toISOString();
  private hasCompletedRefresh = false;
  private recentFailures: SanitizedRecentFailure[] = [];

  // Model health history
  private modelTelemetry: Map<string, {
    successCount: number;
    failureCount: number;
    totalLatencyMs: number;
    cooldownUntil: number;
    lastChecked: string;
  }> = new Map();

  constructor() {
    // A serverless instance must be able to serve its first request immediately.
    // Live model discovery is useful for keeping the catalog current, but waiting
    // for three provider discovery calls here made cold requests unnecessarily slow.
    for (const adapter of modelDiscoveryService.getAllAdapters()) {
      for (const model of modelDiscoveryService.getBootstrapModels(adapter.name)) {
        const normalized = this.normalizeModel(model, adapter.name);
        this.models.set(normalized.id, normalized);
      }
    }
    this.startPeriodicRefresh(this.refreshIntervalMs);
  }

  /**
   * Refreshes model catalog across all registered adapters.
   * If any provider API fails, that provider's previous valid models are preserved.
   */
  public async refreshRegistry(force = false): Promise<AIModel[]> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh(force);
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async performRefresh(force: boolean): Promise<AIModel[]> {
    const startTime = Date.now();
    const adapters = modelDiscoveryService.getAllAdapters();

    for (const adapter of adapters) {
      const provider = adapter.name;
      try {
        const discovered = await modelDiscoveryService.getDiscoveredModels(provider, force);

        if (discovered && discovered.length > 0) {
          // Remove previous models for this provider only
          for (const key of Array.from(this.models.keys())) {
            if (key.startsWith(`${provider}:`)) {
              this.models.delete(key);
            }
          }

          for (const rawModel of discovered) {
            const globalId = `${provider}:${rawModel.id || rawModel.providerModelId}`;
            const normalized = this.normalizeModel(rawModel, provider);
            this.models.set(globalId, normalized);
          }

          console.log(`[FreeModelRegistry] Synced ${discovered.length} models for provider [${provider}]`);
        }
      } catch (err: any) {
        console.warn(`[FreeModelRegistry] Failed to refresh [${provider}]: ${err.message}. Retaining previous provider models.`);
        const existingCount = Array.from(this.models.keys()).filter(k => k.startsWith(`${provider}:`)).length;
        if (existingCount === 0) {
          const bootstrap = modelDiscoveryService.getBootstrapModels(provider);
          for (const b of bootstrap) {
            const globalId = `${provider}:${b.id}`;
            this.models.set(globalId, this.normalizeModel(b, provider));
          }
        }
      }
    }

    this.lastRefreshed = new Date().toISOString();
    this.hasCompletedRefresh = true;
    console.log(`[FreeModelRegistry] Registry refresh complete in ${Date.now() - startTime}ms. Total models: ${this.models.size}`);
    return this.getAllModels();
  }

  public getAllModels(): AIModel[] {
    const now = Date.now();
    return Array.from(this.models.values()).map(m => this.applyLiveTelemetry(m, now));
  }

  /**
   * Indicates whether the catalog should be refreshed before selecting a
   * model. This is intentionally cheap so the router can check it per
   * request without doing network work on the hot path.
   */
  public isRefreshDue(): boolean {
    return !this.hasCompletedRefresh || Date.now() - Date.parse(this.lastRefreshed) >= this.refreshIntervalMs;
  }

  /**
   * Starts a refresh without making the current request wait for provider
   * discovery. The shared refresh promise prevents duplicate refresh storms.
   */
  public refreshInBackground(force = true): void {
    if (!this.refreshPromise) {
      void this.refreshRegistry(force).catch(err => {
        console.warn(`[FreeModelRegistry] Background refresh error: ${err.message}`);
      });
    }
  }

  /**
   * Gives live discovery a small opportunity to finish before routing. If a
   * provider is slow or unavailable, routing continues with the current
   * telemetry-aware catalog while the same refresh continues in the background.
   */
  public async waitForFreshCatalog(maxWaitMs = 2500): Promise<void> {
    if (!this.isRefreshDue()) return;

    const refresh = this.refreshRegistry(true).catch(err => {
      console.warn(`[FreeModelRegistry] Request refresh error: ${err.message}`);
    });
    await Promise.race([
      refresh,
      new Promise<void>(resolve => setTimeout(resolve, maxWaitMs)),
    ]);
  }

  public getModel(idOrProviderModelId: string): AIModel | undefined {
    const direct = this.models.get(idOrProviderModelId);
    if (direct) return this.applyLiveTelemetry(direct, Date.now());

    for (const m of this.models.values()) {
      if (m.providerModelId === idOrProviderModelId || m.id === idOrProviderModelId) {
        return this.applyLiveTelemetry(m, Date.now());
      }
    }
    return undefined;
  }

  public getModelsByProvider(provider: ProviderName): AIModel[] {
    const now = Date.now();
    return Array.from(this.models.values())
      .filter(m => m.provider === provider)
      .map(m => this.applyLiveTelemetry(m, now));
  }

  /**
   * Returns models that are strictly verified free and have the required verified capability.
   */
  public getVerifiedFreeModels(taskType?: TaskType, requiredCapability?: ModelCapabilityType): AIModel[] {
    const all = this.getAllModels();
    const targetCap = requiredCapability || (taskType ? this.mapTaskToCapability(taskType) : undefined);

    return all.filter(m => {
      if (!m.verifiedFree || m.eligibilityStatus !== 'free') return false;

      if (targetCap && (!m.capabilityMap || m.capabilityMap[targetCap] !== 'supported')) {
        return false;
      }

      return m.status === 'available' || m.status === 'degraded';
    });
  }

  /**
   * Live recording of model execution success
   */
  public recordModelSuccess(provider: ProviderName, providerModelId: string, latencyMs: number): void {
    const globalId = `${provider}:${providerModelId}`;
    const entry = this.getOrCreateTelemetry(globalId);

    entry.successCount++;
    entry.totalLatencyMs += latencyMs;
    entry.cooldownUntil = 0;
    entry.lastChecked = new Date().toISOString();
  }

  /**
   * Live recording of model execution error & rate limit cooldown
   */
  public recordModelFailure(provider: ProviderName, providerModelId: string, error: string, statusCode?: number): void {
    const globalId = `${provider}:${providerModelId}`;
    const entry = this.getOrCreateTelemetry(globalId);

    entry.failureCount++;
    entry.lastChecked = new Date().toISOString();

    const now = Date.now();
    if (statusCode === 429) {
      entry.cooldownUntil = now + 30000;
      console.warn(`[FreeModelRegistry] Model ${globalId} hit rate limit (429). In cooldown for 30s.`);
    } else if (statusCode === 404 || statusCode === 401) {
      entry.cooldownUntil = now + 300000;
    } else {
      entry.cooldownUntil = now + 15000;
    }

    // Add to sanitized recent failures ring buffer (max 30 items)
    const sanitizedError = redactSecrets(error || 'Unknown error');
    this.recentFailures.unshift({
      id: `fail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      provider,
      modelId: providerModelId,
      error: sanitizedError,
      statusCode,
    });
    if (this.recentFailures.length > 30) {
      this.recentFailures.pop();
    }
  }

  public getRecentFailures(): SanitizedRecentFailure[] {
    return [...this.recentFailures];
  }

  public clearRecentFailures(): void {
    this.recentFailures = [];
  }

  public clearTelemetry(): void {
    this.modelTelemetry.clear();
    this.recentFailures = [];
  }

  /**
   * Returns models organized into task categories and grouped by tier (fast / balanced / quality).
   */
  public getCategorizedCatalog(preferFree = true): CategorizedModelCatalog {
    const allModels = this.getAllModels();
    const filtered = preferFree
      ? allModels.filter(m => m.verifiedFree === true && m.eligibilityStatus === 'free')
      : allModels;

    const buildTierGroup = (models: AIModel[]): { fast: AIModel[]; balanced: AIModel[]; quality: AIModel[] } => {
      const fast = models.filter(m => m.tier === 'fast');
      const balanced = models.filter(m => m.tier === 'balanced' || (!m.tier));
      const quality = models.filter(m => m.tier === 'quality');
      return { fast, balanced, quality };
    };

    // 1. Vision / Image Analysis
    const visionModels = filtered.filter(m =>
      m.capabilityMap?.vision === 'supported' ||
      m.capabilities.includes('vision') ||
      m.modalities.includes('vision')
    );

    // 2. Structured JSON
    const structuredJsonModels = filtered.filter(m =>
      m.capabilityMap?.structured_output === 'supported' ||
      m.supportsStructuredJson ||
      m.capabilities.includes('structured_output')
    );

    // 3. Prompt Enhancement
    const promptEnhanceModels = filtered.filter(m =>
      m.capabilityMap?.chat === 'supported' ||
      m.capabilities.includes('chat') ||
      m.capabilities.includes('text')
    );

    // 4. Text Generation
    const textGenModels = filtered.filter(m =>
      m.capabilityMap?.chat === 'supported' ||
      m.capabilities.includes('chat') ||
      m.capabilities.includes('text')
    );

    // 5. Reasoning
    const reasoningModels = filtered.filter(m =>
      m.capabilityMap?.reasoning === 'supported' ||
      m.capabilities.includes('reasoning')
    );

    // 6. Coding
    const codingModels = filtered.filter(m =>
      m.capabilityMap?.coding === 'supported' ||
      m.capabilities.includes('coding')
    );

    // 7. Image Generation
    const imageGenModels = filtered.filter(m =>
      // Removed image_generation check
      m.capabilities.includes('image')
    );

    return {
      vision: buildTierGroup(visionModels),
      structured_json: buildTierGroup(structuredJsonModels),
      prompt_enhancement: buildTierGroup(promptEnhanceModels),
      text_generation: buildTierGroup(textGenModels),
      reasoning: buildTierGroup(reasoningModels.length > 0 ? reasoningModels : filtered.filter(m => m.tier === 'quality')),
      coding: buildTierGroup(codingModels.length > 0 ? codingModels : filtered),
      // Removed image generation tier group
    };
  }

  public getRegistryStats(): RegistryStats {
    const models = this.getAllModels();
    const capsCount: Record<ModelCapabilityType, number> = {
      chat: 0,
      reasoning: 0,
      coding: 0,
      vision: 0,
      tool_calling: 0,
      structured_output: 0,
    };

    let visionModelsCount = 0;

    const stats: RegistryStats = {
      totalModels: models.length,
      verifiedFreeModels: 0,
      eligibleUnknownModels: 0,
      paidModels: 0,
      visionModels: 0,
      capabilitiesCount: capsCount,
      byProvider: {} as any,
      lastRefreshed: this.lastRefreshed,
    };

    for (const m of models) {
      if (m.verifiedFree) stats.verifiedFreeModels++;
      if (m.eligibilityStatus === 'eligible_unknown') stats.eligibleUnknownModels++;
      if (m.eligibilityStatus === 'paid') stats.paidModels++;

      if ((m.capabilityMap && m.capabilityMap.vision === 'supported') || m.capabilities.includes('vision') || m.modalities.includes('vision')) {
        visionModelsCount++;
      }

      for (const cap of m.capabilities) {
        const capKey = cap as ModelCapabilityType;
        if (stats.capabilitiesCount[capKey] !== undefined) {
          stats.capabilitiesCount[capKey]++;
        }
      }

      if (!stats.byProvider[m.provider]) {
        stats.byProvider[m.provider] = {
          total: 0,
          verifiedFree: 0,
          available: 0,
          inCooldown: 0,
        };
      }

      const pStat = stats.byProvider[m.provider];
      pStat.total++;
      if (m.verifiedFree) pStat.verifiedFree++;
      if (m.status === 'available') pStat.available++;
      if (m.status === 'cooldown') pStat.inCooldown++;
    }

    stats.visionModels = visionModelsCount;
    return stats;
  }

  public setRefreshInterval(intervalMs: number): void {
    this.refreshIntervalMs = intervalMs;
    this.startPeriodicRefresh(intervalMs);
  }

  public startPeriodicRefresh(intervalMs: number): void {
    if (process.env.VERCEL === '1') return;
    this.stopPeriodicRefresh();
    this.refreshIntervalMs = intervalMs;
    this.refreshTimer = setInterval(() => {
      this.refreshRegistry(true).catch(err => {
        console.warn('[FreeModelRegistry] Periodic refresh error:', err?.message || err);
      });
    }, this.refreshIntervalMs);

    if (this.refreshTimer && typeof this.refreshTimer.unref === 'function') {
      this.refreshTimer.unref();
    }
  }

  public stopPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private normalizeModel(rawModel: any, provider: ProviderName): AIModel {
    const providerModelId = rawModel.providerModelId || rawModel.id;
    const globalId = `${provider}:${providerModelId}`;

    const inputCost = typeof rawModel.inputCost === 'number' ? rawModel.inputCost : (rawModel.pricing?.prompt ?? -1);
    const outputCost = typeof rawModel.outputCost === 'number' ? rawModel.outputCost : (rawModel.pricing?.completion ?? -1);

    const verifiedFree = rawModel.verifiedFree ?? (inputCost === 0 && outputCost === 0 && rawModel.freeEligibility !== 'eligible_unknown' && rawModel.freeEligibility !== 'paid');
    const eligibilityStatus = rawModel.eligibilityStatus || rawModel.freeEligibility || (verifiedFree ? 'free' : (inputCost < 0 || outputCost < 0 ? 'eligible_unknown' : 'paid'));

    const contextWindow = rawModel.contextWindow || rawModel.contextLength || 8192;
    const tier = rawModel.tier || 'balanced';

    // Automatic Capability Classification
    const capabilityMap = capabilityClassifier.classify({
      id: providerModelId,
      name: rawModel.name,
      description: rawModel.description,
      provider,
      architecture: rawModel.architecture,
      supported_parameters: rawModel.supported_parameters,
      supportedGenerationMethods: rawModel.supportedGenerationMethods,
    });

    const capabilities = capabilityClassifier.getVerifiedSupportedList(capabilityMap);

    return {
      id: globalId,
      provider,
      providerModelId,
      name: rawModel.name || providerModelId,
      verifiedFree,
      eligibilityStatus,
      capabilities,
      capabilityMap,
      contextWindow,
      status: 'available',
      successRate: 1,
      averageLatency: 0,
      failureCount: 0,
      lastChecked: rawModel.discoveredTimestamp || new Date().toISOString(),
      cooldownUntil: 0,

      // Compatibility aliases
      isFree: verifiedFree,
      contextLength: contextWindow,
      freeEligibility: eligibilityStatus,
      tier,
      pricing: {
        prompt: Math.max(0, inputCost),
        completion: Math.max(0, outputCost),
        isZeroCost: verifiedFree,
      },
      modalities: rawModel.modalities || ['text'],
      supportsStructuredJson: capabilityMap.structured_output === 'supported',
      description: rawModel.description,
      inputCost,
      outputCost,
      discoveredTimestamp: rawModel.discoveredTimestamp || new Date().toISOString(),
    };
  }

  private mapTaskToCapability(taskType: TaskType): ModelCapabilityType {
    switch (taskType) {
      case 'vision':
      case 'image_analysis':
      case 'advanced_image_analysis':
        return 'vision';
      case 'structured_json':
        return 'structured_output';
      // image_generation case removed
      case 'coding':
        return 'coding';
      case 'reasoning':
        return 'reasoning';
      case 'prompt_enhancement':
      case 'text_generation':
      default:
        return 'chat';
    }
  }

  private applyLiveTelemetry(model: AIModel, now: number): AIModel {
    const globalId = model.id;
    const telemetry = this.modelTelemetry.get(globalId);

    if (!telemetry) {
      return { ...model };
    }

    const totalReqs = telemetry.successCount + telemetry.failureCount;
    const successRate = totalReqs > 0 ? telemetry.successCount / totalReqs : 1;
    const averageLatency = telemetry.successCount > 0 ? Math.round(telemetry.totalLatencyMs / telemetry.successCount) : 0;

    let status: ModelStatus = 'available';
    if (telemetry.cooldownUntil > now) {
      status = 'cooldown';
    } else if (telemetry.failureCount >= 3 && successRate < 0.5) {
      status = 'degraded';
    }

    return {
      ...model,
      status,
      successRate,
      averageLatency,
      failureCount: telemetry.failureCount,
      cooldownUntil: telemetry.cooldownUntil,
      lastChecked: telemetry.lastChecked || model.lastChecked,
    };
  }

  private getOrCreateTelemetry(globalId: string) {
    let entry = this.modelTelemetry.get(globalId);
    if (!entry) {
      entry = {
        successCount: 0,
        failureCount: 0,
        totalLatencyMs: 0,
        cooldownUntil: 0,
        lastChecked: new Date().toISOString(),
      };
      this.modelTelemetry.set(globalId, entry);
    }
    return entry;
  }
}

export const freeModelRegistry = new FreeModelRegistry();
