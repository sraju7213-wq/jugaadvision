import fs from 'fs';
import path from 'path';
import { maskApiKey } from '../pools/keyPool';
import type { HealthReport, HealthState, KeyHealthData, ModelHealthData, ProviderHealthData, ProviderName } from '../types';

export class ModelHealthManager {
  private keyHealthMap: Map<string, KeyHealthData> = new Map();
  private modelHealthMap: Map<string, ModelHealthData> = new Map();
  private providerHealthMap: Map<ProviderName, ProviderHealthData> = new Map();

  private storageFile: string;
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private checkTimer: NodeJS.Timeout | null = null;
  private checkIntervalMs = 10000; // 10s periodic recheck

  constructor(storagePath?: string) {
    this.storageFile = storagePath || path.resolve('.cache', 'ai_health_state.json');
    this.loadFromStorage();
    this.startPeriodicRecheck();
  }

  // =========================================================================
  // KEY HEALTH TRACKING
  // =========================================================================

  public recordKeySuccess(provider: ProviderName, key: string, latencyMs: number): void {
    const keyId = this.getKeyId(provider, key);
    const data = this.getOrCreateKeyHealth(provider, key);
    const now = Date.now();

    const totalSuccess = data.successCount + 1;
    data.averageLatencyMs = Math.round(((data.averageLatencyMs * data.successCount) + latencyMs) / totalSuccess);
    data.successCount = totalSuccess;
    data.consecutiveFailures = 0;
    data.lastSuccess = new Date(now).toISOString();
    data.cooldownUntil = 0;
    data.lastErrorReason = undefined;
    data.state = 'healthy';

    this.updateProviderRollup(provider);
    this.scheduleSave();
  }

  public recordKeyFailure(provider: ProviderName, key: string, error: string, statusCode?: number): void {
    const data = this.getOrCreateKeyHealth(provider, key);
    const now = Date.now();

    data.failureCount++;
    data.consecutiveFailures++;
    data.lastFailure = new Date(now).toISOString();
    data.lastErrorReason = error;

    if (statusCode === 429) {
      const cooldownMs = Math.min(300000, 20000 * Math.pow(2, data.consecutiveFailures - 1));
      data.cooldownUntil = now + cooldownMs;
      data.state = 'rate_limited';
      console.warn(`[ModelHealthManager] Key ${data.maskedKey} (${provider}) state: rate_limited for ${Math.round(cooldownMs / 1000)}s.`);
    } else if (statusCode === 401 || statusCode === 403) {
      if (error.toLowerCase().includes('quota') || error.toLowerCase().includes('balance') || error.toLowerCase().includes('credit')) {
        data.state = 'quota_exhausted';
        data.cooldownUntil = now + 86400000; // 24 hours
        console.warn(`[ModelHealthManager] Key ${data.maskedKey} (${provider}) state: quota_exhausted.`);
      } else {
        const cooldownMs = Math.min(300000, 60000 * data.consecutiveFailures);
        data.cooldownUntil = now + cooldownMs;
        data.state = 'temporarily_unavailable';
      }
    } else {
      const cooldownMs = Math.min(300000, 15000 * Math.pow(1.5, data.consecutiveFailures - 1));
      data.cooldownUntil = now + cooldownMs;
      data.state = data.consecutiveFailures >= 3 ? 'degraded' : 'temporarily_unavailable';
    }

    this.updateProviderRollup(provider);
    this.scheduleSave();
  }

  public isKeyAvailable(provider: ProviderName, key: string): boolean {
    const keyId = this.getKeyId(provider, key);
    const data = this.keyHealthMap.get(keyId);
    if (!data) return true;
    if (data.state === 'disabled' || data.state === 'quota_exhausted') return false;
    return data.cooldownUntil <= Date.now();
  }

  // =========================================================================
  // MODEL HEALTH TRACKING (ISOLATED - MODEL FAILURE DOES NOT BRING DOWN PROVIDER)
  // =========================================================================

  public recordModelSuccess(provider: ProviderName, providerModelId: string, latencyMs: number): void {
    const data = this.getOrCreateModelHealth(provider, providerModelId);
    const now = Date.now();

    const totalSuccess = data.successCount + 1;
    data.averageLatencyMs = Math.round(((data.averageLatencyMs * data.successCount) + latencyMs) / totalSuccess);
    data.successCount = totalSuccess;
    data.consecutiveFailures = 0;
    data.lastSuccess = new Date(now).toISOString();
    data.cooldownUntil = 0;
    data.lastErrorReason = undefined;
    data.state = 'healthy';

    this.updateProviderRollup(provider);
    this.scheduleSave();
  }

  public recordModelFailure(provider: ProviderName, providerModelId: string, error: string, statusCode?: number): void {
    const data = this.getOrCreateModelHealth(provider, providerModelId);
    const now = Date.now();

    data.failureCount++;
    data.consecutiveFailures++;
    data.lastFailure = new Date(now).toISOString();
    data.lastErrorReason = error;

    if (statusCode === 429) {
      const cooldownMs = Math.min(300000, 30000 * Math.pow(1.5, data.consecutiveFailures - 1));
      data.cooldownUntil = now + cooldownMs;
      data.state = 'rate_limited';
      console.warn(`[ModelHealthManager] Model ${data.modelId} (${provider}) state: rate_limited for ${Math.round(cooldownMs / 1000)}s.`);
    } else if (statusCode === 404) {
      data.cooldownUntil = now + 300000; // 5 min cooldown for 404
      data.state = 'temporarily_unavailable';
    } else {
      const cooldownMs = Math.min(300000, 15000 * Math.pow(1.5, data.consecutiveFailures - 1));
      data.cooldownUntil = now + cooldownMs;
      data.state = data.consecutiveFailures >= 3 ? 'degraded' : 'temporarily_unavailable';
    }

    this.updateProviderRollup(provider);
    this.scheduleSave();
  }

  public isModelAvailable(provider: ProviderName, providerModelId: string): boolean {
    const modelId = `${provider}:${providerModelId}`;
    const data = this.modelHealthMap.get(modelId);
    if (!data) return true;
    if (data.state === 'disabled' || data.state === 'quota_exhausted') return false;
    return data.cooldownUntil <= Date.now();
  }

  public getModelHealth(provider: ProviderName, providerModelId: string): ModelHealthData {
    return this.getOrCreateModelHealth(provider, providerModelId);
  }

  // =========================================================================
  // PROVIDER HEALTH TRACKING & ROLLUP
  // =========================================================================

  public getProviderHealth(provider: ProviderName): ProviderHealthData {
    return this.getOrCreateProviderHealth(provider);
  }

  public isProviderAvailable(provider: ProviderName): boolean {
    const data = this.providerHealthMap.get(provider);
    if (!data) return true;
    if (data.state === 'disabled' || data.state === 'quota_exhausted') return false;
    return data.state !== 'temporarily_unavailable' && data.cooldownUntil <= Date.now();
  }

  private updateProviderRollup(provider: ProviderName): void {
    const data = this.getOrCreateProviderHealth(provider);
    const now = Date.now();

    // Aggregate key health for this provider
    const providerKeys = Array.from(this.keyHealthMap.values()).filter(k => k.provider === provider);
    const activeKeys = providerKeys.filter(k => k.state !== 'disabled' && k.state !== 'quota_exhausted' && k.cooldownUntil <= now).length;
    data.totalKeys = providerKeys.length;
    data.activeKeys = activeKeys;

    // Aggregate model health for this provider
    const providerModels = Array.from(this.modelHealthMap.values()).filter(m => m.provider === provider);
    const availableModels = providerModels.filter(m => m.state !== 'disabled' && m.cooldownUntil <= now).length;
    data.totalModels = providerModels.length;
    data.availableModels = availableModels;

    // Provider State Evaluation
    if (data.totalKeys > 0 && activeKeys === 0) {
      const allQuotaExhausted = providerKeys.every(k => k.state === 'quota_exhausted');
      if (allQuotaExhausted) {
        data.state = 'quota_exhausted';
      } else {
        data.state = 'temporarily_unavailable';
        const soonestKeyCooldown = providerKeys.map(k => k.cooldownUntil).sort((a, b) => a - b)[0] || (now + 20000);
        data.cooldownUntil = soonestKeyCooldown;
      }
    } else if (data.totalModels > 0 && availableModels === 0) {
      data.state = 'temporarily_unavailable';
      data.cooldownUntil = now + 30000;
    } else {
      const hasErrors = providerKeys.some(k => k.state === 'degraded' || k.consecutiveFailures > 2);
      data.state = hasErrors ? 'degraded' : 'healthy';
      data.cooldownUntil = 0;
    }
  }

  // =========================================================================
  // PERIODIC RECHECK & PERSISTENCE
  // =========================================================================

  private startPeriodicRecheck(): void {
    this.stopPeriodicRecheck();
    this.checkTimer = setInterval(() => {
      this.recheckHealthStates();
    }, this.checkIntervalMs);

    if (this.checkTimer && typeof this.checkTimer.unref === 'function') {
      this.checkTimer.unref();
    }
  }

  public stopPeriodicRecheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  public recheckHealthStates(): void {
    const now = Date.now();
    let stateChanged = false;

    // 1. Recheck Keys
    for (const [, kData] of this.keyHealthMap.entries()) {
      if (kData.cooldownUntil > 0 && now >= kData.cooldownUntil) {
        kData.cooldownUntil = 0;
        kData.state = kData.consecutiveFailures >= 3 ? 'degraded' : 'healthy';
        kData.lastErrorReason = undefined;
        console.log(`[ModelHealthManager] Key ${kData.maskedKey} (${kData.provider}) cooldown expired -> state: ${kData.state}`);
        stateChanged = true;
      }
    }

    // 2. Recheck Models
    for (const [modelId, mData] of this.modelHealthMap.entries()) {
      if (mData.cooldownUntil > 0 && now >= mData.cooldownUntil) {
        mData.cooldownUntil = 0;
        mData.state = mData.consecutiveFailures >= 3 ? 'degraded' : 'healthy';
        mData.lastErrorReason = undefined;
        console.log(`[ModelHealthManager] Model ${modelId} cooldown expired -> state: ${mData.state}`);
        stateChanged = true;
      }
    }

    // 3. Update Providers
    const providers: ProviderName[] = ['openrouter', 'nim', 'custom'];
    for (const p of providers) {
      this.updateProviderRollup(p);
    }

    if (stateChanged) {
      this.scheduleSave();
    }
  }

  public generateReport(
    keyCounts?: Record<string, { active: number; total: number }>,
    modelCounts?: Record<string, number>
  ): HealthReport {
    this.recheckHealthStates();

    const providersReport: Record<ProviderName, ProviderHealthData> = {} as any;
    const providers: ProviderName[] = ['openrouter', 'nim', 'custom'];

    for (const p of providers) {
      const pData = this.getOrCreateProviderHealth(p);
      if (keyCounts && keyCounts[p]) {
        pData.activeKeys = keyCounts[p].active;
        pData.totalKeys = keyCounts[p].total;
      }
      if (modelCounts && modelCounts[p]) {
        pData.totalModels = modelCounts[p];
      }
      providersReport[p] = { ...pData };
    }

    const keysReport: Record<string, KeyHealthData> = {};
    for (const [id, data] of this.keyHealthMap.entries()) {
      keysReport[id] = { ...data };
    }

    const modelsReport: Record<string, ModelHealthData> = {};
    for (const [id, data] of this.modelHealthMap.entries()) {
      modelsReport[id] = { ...data };
    }

    let discoveredTotal = 0;
    if (modelCounts) {
      discoveredTotal = Object.values(modelCounts).reduce((acc, c) => acc + c, 0);
    }

    return {
      timestamp: new Date().toISOString(),
      providers: providersReport,
      keys: keysReport,
      models: modelsReport,
      discoveredModelsTotal: discoveredTotal,
      freeModelsTotal: discoveredTotal,
    };
  }

  // =========================================================================
  // PERSISTENCE (DISK SNAPSHOT)
  // =========================================================================

  public flushSync(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
    this.saveToStorage();
  }

  private scheduleSave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.saveToStorage();
    }, 500);
  }

  private saveToStorage(): void {
    try {
      const dir = path.dirname(this.storageFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const snapshot = {
        timestamp: new Date().toISOString(),
        keys: Array.from(this.keyHealthMap.entries()),
        models: Array.from(this.modelHealthMap.entries()),
        providers: Array.from(this.providerHealthMap.entries()),
      };

      fs.writeFileSync(this.storageFile, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch (err: any) {
      console.warn('[ModelHealthManager] Failed to persist health state:', err.message);
    }
  }

  private loadFromStorage(): void {
    try {
      if (!fs.existsSync(this.storageFile)) return;
      const content = fs.readFileSync(this.storageFile, 'utf-8');
      const snapshot = JSON.parse(content);

      if (Array.isArray(snapshot.keys)) {
        for (const [id, data] of snapshot.keys) {
          this.keyHealthMap.set(id, data);
        }
      }
      if (Array.isArray(snapshot.models)) {
        for (const [id, data] of snapshot.models) {
          this.modelHealthMap.set(id, data);
        }
      }
      if (Array.isArray(snapshot.providers)) {
        for (const [id, data] of snapshot.providers) {
          this.providerHealthMap.set(id, data);
        }
      }
      console.log(`[ModelHealthManager] Loaded persistent health cache (${this.keyHealthMap.size} keys, ${this.modelHealthMap.size} models).`);
    } catch (err: any) {
      console.warn('[ModelHealthManager] Could not read health cache file, starting fresh:', err.message);
    }
  }

  private getKeyId(provider: ProviderName, key: string): string {
    return `${provider}:${maskApiKey(key)}`;
  }

  private getOrCreateKeyHealth(provider: ProviderName, key: string): KeyHealthData {
    const keyId = this.getKeyId(provider, key);
    let data = this.keyHealthMap.get(keyId);
    if (!data) {
      data = {
        maskedKey: maskApiKey(key),
        provider,
        state: 'unknown',
        successCount: 0,
        failureCount: 0,
        consecutiveFailures: 0,
        averageLatencyMs: 0,
        cooldownUntil: 0,
      };
      this.keyHealthMap.set(keyId, data);
    }
    return data;
  }

  private getOrCreateModelHealth(provider: ProviderName, providerModelId: string): ModelHealthData {
    const modelId = `${provider}:${providerModelId}`;
    let data = this.modelHealthMap.get(modelId);
    if (!data) {
      data = {
        modelId,
        provider,
        providerModelId,
        state: 'unknown',
        successCount: 0,
        failureCount: 0,
        consecutiveFailures: 0,
        averageLatencyMs: 0,
        cooldownUntil: 0,
      };
      this.modelHealthMap.set(modelId, data);
    }
    return data;
  }

  private getOrCreateProviderHealth(provider: ProviderName): ProviderHealthData {
    let data = this.providerHealthMap.get(provider);
    if (!data) {
      data = {
        provider,
        state: 'unknown',
        successCount: 0,
        failureCount: 0,
        consecutiveFailures: 0,
        averageLatencyMs: 0,
        cooldownUntil: 0,
        activeKeys: 0,
        totalKeys: 0,
        availableModels: 0,
        totalModels: 0,
      };
      this.providerHealthMap.set(provider, data);
    }
    return data;
  }
}

export const modelHealthManager = new ModelHealthManager();
