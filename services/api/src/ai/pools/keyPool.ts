import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { KeyState, ProviderName } from '@jugaad/core/types';

export type { ProviderName };

/**
 * The app routes directly to a single primary provider with an optional
 * self-hosted custom endpoint. Free-model provider pools are gone, so the
 * credential store only manages these two providers.
 */
export const SUPPORTED_PROVIDERS: ProviderName[] = ['custom', 'openrouter'];

export interface KeyHealthStats {
  maskedKey: string;
  provider: ProviderName;
  status: 'active' | 'in_cooldown' | 'exhausted';
  requestCount: number;
  failureCount: number;
  consecutiveFailures: number;
  successRate: number;
  backoffRemainingSec: number;
  backoffReason?: string;
  lastUsedTime: number;
}

const PERSISTENCE_PATH = (() => {
  if (process.env.VERCEL) return path.join(os.tmpdir(), 'jugaad-api-keys.json');
  return path.resolve(process.cwd(), '.local-keys.json');
})();

export function maskApiKey(key: string): string {
  if (!key) return '***';
  if (key.length <= 8) return '****';
  const prefixLength = Math.min(12, Math.max(4, key.length > 12 ? 11 : Math.floor(key.length / 2)));
  const prefix = key.slice(0, prefixLength);
  const suffix = key.slice(-Math.min(4, Math.max(2, Math.floor(key.length / 4))));
  return `${prefix}...${suffix}`;
}

function emptyState(key: string, provider: ProviderName): KeyState {
  return {
    key,
    provider,
    consecutiveFailures: 0,
    failureCount: 0,
    successCount: 0,
    requestCount: 0,
    lastRequestTime: 0,
    lastErrorTime: 0,
    lastSuccessTime: 0,
    backoffUntil: 0,
    consecutiveRateLimits: 0,
    isExhausted: false,
  };
}

function serializePools(pools: Map<ProviderName, KeyState[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [provider, states] of pools) {
    if (states.length > 0) out[provider] = states.map(s => s.key);
  }
  return out;
}

function loadPersistedKeys(): Record<string, string[]> {
  try {
    if (!fs.existsSync(PERSISTENCE_PATH)) return {};
    const raw = fs.readFileSync(PERSISTENCE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    // corrupt or unreadable — start fresh
  }
  return {};
}

function savePersistedKeys(pools: Map<ProviderName, KeyState[]>): void {
  try {
    const dir = path.dirname(PERSISTENCE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PERSISTENCE_PATH, JSON.stringify(serializePools(pools)), 'utf-8');
  } catch {
    // best-effort persistence; failure is not fatal
  }
}

export class KeyPoolManager {
  private pools: Map<ProviderName, KeyState[]> = new Map();
  private baseRateLimitCooldownMs = 20000;
  private maxCooldownMs = 300000;
  private serverErrorCooldownMs = 15000;
  private initialized = false;

  constructor() {
    this.reloadFromEnv();
    this.loadPersisted();
  }

  private loadPersisted(): void {
    const persisted = loadPersistedKeys();
    for (const [provider, keys] of Object.entries(persisted)) {
      if (!SUPPORTED_PROVIDERS.includes(provider)) continue;
      const existing = this.pools.get(provider as ProviderName) || [];
      const existingKeys = new Set(existing.map(k => k.key));
      const newKeys = keys.filter(k => !existingKeys.has(k));
      if (newKeys.length > 0) {
        const newStates = newKeys.map(key => emptyState(key, provider as ProviderName));
        this.pools.set(provider as ProviderName, [...existing, ...newStates]);
      }
    }
  }

  public reloadFromEnv(): void {
    for (const p of SUPPORTED_PROVIDERS) {
      if (!this.pools.has(p)) this.pools.set(p, []);
    }

    this.loadProviderKeys('openrouter', [
      'OPENROUTER_API_KEY',
      'OPENROUTER_API_KEYS',
      'OPENROUTER_KEY',
    ], 'OPENROUTER_API_KEY_');

    this.loadProviderKeys('custom', [
      'CUSTOM_API_KEY',
      'CUSTOM_KEY',
    ]);
    if (process.env.CUSTOM_ENDPOINT_URL || process.env.CUSTOM_ENDPOINT || process.env.OLLAMA_BASE_URL) {
      this.setProviderKeys('custom', process.env.CUSTOM_API_KEY || '__custom_endpoint__');
    }
    this.initialized = true;
  }

  private loadProviderKeys(
    provider: ProviderName,
    bulkEnvVars: string[],
    ...indexedPrefixes: string[]
  ): void {
    const gatheredKeys: string[] = [];

    for (const prefix of indexedPrefixes) {
      for (let i = 1; i <= 50; i++) {
        const val = process.env[`${prefix}${i}`];
        if (val && val.trim().length > 0) gatheredKeys.push(val.trim());
      }
    }

    for (const envVar of bulkEnvVars) {
      const val = process.env[envVar];
      if (val && val.trim().length > 0) {
        const parts = val.split(/[,\n]/).map(k => k.trim()).filter(k => k.length > 0);
        gatheredKeys.push(...parts);
      }
    }

    const uniqueKeys = Array.from(new Set(gatheredKeys));
    const currentStates = this.pools.get(provider) || [];
    const stateMap = new Map(currentStates.map(s => [s.key, s]));

    const newStates: KeyState[] = uniqueKeys.map(key => stateMap.get(key) || emptyState(key, provider));
    this.pools.set(provider, newStates);

    if (newStates.length > 0) {
      const maskedSample = newStates.map(s => maskApiKey(s.key)).join(', ');
      console.log(`[KeyPool] Loaded ${newStates.length} keys for provider [${provider}]: [${maskedSample}]`);
    }
  }

  public getAvailableKey(provider: ProviderName, excludeKeys: string[] = []): string | null {
    let pool = this.pools.get(provider);
    if (!pool || pool.length === 0) {
      this.reloadFromEnv();
      pool = this.pools.get(provider);
    }
    if (!pool || pool.length === 0) return null;

    const now = Date.now();

    for (const state of pool) {
      if (state.backoffUntil > 0 && now >= state.backoffUntil) {
        state.backoffUntil = 0;
        state.backoffReason = undefined;
        state.consecutiveRateLimits = Math.max(0, state.consecutiveRateLimits - 1);
      }
    }

    const eligible = pool.filter(k => !k.isExhausted && k.backoffUntil <= now && !excludeKeys.includes(k.key));
    if (eligible.length === 0) return null;

    eligible.sort((a, b) => {
      if (a.consecutiveFailures !== b.consecutiveFailures) return a.consecutiveFailures - b.consecutiveFailures;
      const totalA = a.successCount + a.failureCount;
      const totalB = b.successCount + b.failureCount;
      const rateA = totalA > 0 ? a.successCount / totalA : 1.0;
      const rateB = totalB > 0 ? b.successCount / totalB : 1.0;
      if (rateA !== rateB) return rateB - rateA;
      if (a.requestCount !== b.requestCount) return a.requestCount - b.requestCount;
      return a.lastRequestTime - b.lastRequestTime;
    });

    const chosen = eligible[0];
    chosen.requestCount++;
    chosen.lastRequestTime = now;
    return chosen.key;
  }

  public reportSuccess(provider: ProviderName, key: string, _durationMs?: number): void {
    const pool = this.pools.get(provider);
    if (!pool) return;
    const state = pool.find(k => k.key === key);
    if (state) {
      state.successCount++;
      state.consecutiveFailures = 0;
      state.consecutiveRateLimits = 0;
      state.backoffUntil = 0;
      state.backoffReason = undefined;
      state.lastSuccessTime = Date.now();
    }
  }

  public reportError(provider: ProviderName, key: string, statusCode?: number, errorMessage?: string): void {
    const pool = this.pools.get(provider);
    if (!pool) return;
    const state = pool.find(k => k.key === key);
    if (!state) return;

    const now = Date.now();
    state.lastErrorTime = now;
    state.failureCount++;
    state.consecutiveFailures++;
    const masked = maskApiKey(key);

    if (statusCode === 429) {
      state.consecutiveRateLimits++;
      const cooldownMs = Math.min(this.maxCooldownMs, this.baseRateLimitCooldownMs * Math.pow(2, state.consecutiveRateLimits - 1));
      state.backoffUntil = now + cooldownMs;
      state.backoffReason = 'rate_limit_429';
      console.warn(`[KeyPool] Rate limit (429) on ${provider} key ${masked}. Cooldown ${Math.round(cooldownMs / 1000)}s.`);
    } else if (statusCode === 401 || statusCode === 403) {
      const isQuotaExhausted = errorMessage && /quota|credit|balance|exhausted/i.test(errorMessage);
      if (isQuotaExhausted && state.consecutiveFailures >= 3) {
        state.isExhausted = true;
        state.backoffReason = 'quota_exhausted';
        console.warn(`[KeyPool] Quota exhausted on ${provider} key ${masked}. Key marked exhausted.`);
      } else {
        const cooldownMs = Math.min(this.maxCooldownMs, 60000 * state.consecutiveFailures);
        state.backoffUntil = now + cooldownMs;
        state.backoffReason = 'auth_permission_error';
      }
    } else if (statusCode === 404 || statusCode === 410 || statusCode === 422 || (statusCode === 400 && !/api key|auth|credit|quota/i.test(errorMessage || ''))) {
      state.consecutiveFailures = 0;
    } else {
      const cooldownMs = Math.min(this.maxCooldownMs, this.serverErrorCooldownMs * Math.pow(1.5, state.consecutiveFailures - 1));
      state.backoffUntil = now + cooldownMs;
      state.backoffReason = `server_error_${statusCode || 'network'}`;
    }
  }

  public hasConfiguredKeys(provider: ProviderName): boolean {
    if (!this.initialized) this.reloadFromEnv();
    const pool = this.pools.get(provider);
    return !!(pool && pool.length > 0);
  }

  public isProviderAvailable(provider: ProviderName): boolean {
    if (!this.initialized) this.reloadFromEnv();
    const pool = this.pools.get(provider);
    if (!pool || pool.length === 0) return false;
    const now = Date.now();
    return pool.some(k => !k.isExhausted && k.backoffUntil <= now);
  }

  public getPoolStats(provider: ProviderName): {
    total: number;
    active: number;
    inCooldown: number;
    exhausted: number;
    keys: KeyHealthStats[];
  } {
    let pool = this.pools.get(provider);
    if (!pool || pool.length === 0) {
      this.reloadFromEnv();
      pool = this.pools.get(provider);
    }
    pool = pool || [];
    const now = Date.now();

    const keys: KeyHealthStats[] = pool.map(k => {
      const inCooldown = !k.isExhausted && k.backoffUntil > now;
      const remainingSec = inCooldown ? Math.ceil((k.backoffUntil - now) / 1000) : 0;
      const status: 'active' | 'in_cooldown' | 'exhausted' = k.isExhausted ? 'exhausted' : inCooldown ? 'in_cooldown' : 'active';
      const total = k.successCount + k.failureCount;
      const successRate = total > 0 ? Math.round((k.successCount / total) * 100) / 100 : 1.0;
      return {
        maskedKey: maskApiKey(k.key),
        provider,
        status,
        requestCount: k.requestCount,
        failureCount: k.failureCount,
        consecutiveFailures: k.consecutiveFailures,
        successRate,
        backoffRemainingSec: remainingSec,
        backoffReason: k.backoffReason,
        lastUsedTime: k.lastRequestTime,
      };
    });

    return {
      total: pool.length,
      active: keys.filter(k => k.status === 'active').length,
      inCooldown: keys.filter(k => k.status === 'in_cooldown').length,
      exhausted: keys.filter(k => k.status === 'exhausted').length,
      keys,
    };
  }

  public setProviderKeys(provider: ProviderName, keysInput: string[] | string): {
    active: number;
    total: number;
    maskedKeys: string[];
  } {
    let keyList: string[] = [];
    if (Array.isArray(keysInput)) {
      keyList = keysInput;
    } else if (typeof keysInput === 'string') {
      keyList = keysInput.split(/[,\n]/).map(k => k.trim()).filter(k => k.length > 0);
    }

    const uniqueKeys = Array.from(new Set(keyList.map(k => k.trim()).filter(k => k.length > 0)));
    const currentStates = this.pools.get(provider) || [];
    const stateMap = new Map(currentStates.map(s => [s.key, s]));

    const newStates: KeyState[] = uniqueKeys.map(key => {
      const existing = stateMap.get(key);
      if (existing) return { ...existing, isExhausted: false, backoffUntil: 0 };
      return emptyState(key, provider);
    });

    this.pools.set(provider, newStates);
    savePersistedKeys(this.pools);
    return {
      active: newStates.filter(s => !s.isExhausted && s.backoffUntil <= Date.now()).length,
      total: newStates.length,
      maskedKeys: newStates.map(s => maskApiKey(s.key)),
    };
  }

  public clearProviderKeys(provider: ProviderName): void {
    this.pools.set(provider, []);
    savePersistedKeys(this.pools);
  }

  public getAllProviders(): ProviderName[] {
    return Array.from(this.pools.keys()).filter(p => (this.pools.get(p)?.length || 0) > 0);
  }
}

/**
 * Sanitizes any text (such as error messages or traces) by redacting API keys,
 * authorization headers, and bearer tokens.
 */
export function redactSecrets(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/AIza[0-9A-Za-z\-_]{35}/g, 'AIza[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]{8,}/gi, 'Bearer [REDACTED]')
    .replace(/sk-[a-zA-Z0-9_\-]{8,}/gi, 'sk-[REDACTED]')
    .replace(/nvapi-[a-zA-Z0-9_\-]{16,}/gi, 'nvapi-[REDACTED]')
    .replace(/hf_[a-zA-Z0-9_\-]{16,}/gi, 'hf_[REDACTED]')
    .replace(/cfut_[a-zA-Z0-9_\-]{16,}/gi, 'cfut-[REDACTED]')
    .replace(/freellmapi-[a-zA-Z0-9_\-]{16,}/gi, 'freellmapi-[REDACTED]')
    .replace(/((?:key|apikey|api_key|token|auth)\s*[:=]\s*)[a-zA-Z0-9_\-\.]{8,}/gi, '$1[REDACTED]')
    .replace(/(with\s+key\s+)[a-zA-Z0-9_\-\.]{8,}/gi, '$1[REDACTED]');
}

export const keyPoolManager = new KeyPoolManager();
