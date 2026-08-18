import type { KeyState, ProviderName } from '../types.ts';

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

export function maskApiKey(key: string): string {
  if (!key) return '***';
  if (key.length <= 8) return '****';
  const prefixLength = Math.min(12, Math.max(4, key.length > 12 ? 11 : Math.floor(key.length / 2)));
  const prefix = key.slice(0, prefixLength);
  const suffix = key.slice(-Math.min(4, Math.max(2, Math.floor(key.length / 4))));
  return `${prefix}...${suffix}`;
}

export class KeyPoolManager {
  private pools: Map<ProviderName, KeyState[]> = new Map();
  private baseRateLimitCooldownMs = 20000; // 20s initial cooldown for 429
  private maxCooldownMs = 300000; // 5 minutes max cooldown
  private serverErrorCooldownMs = 15000; // 15s initial for 5xx

  constructor() {
    this.reloadFromEnv();
  }

  public reloadFromEnv(): void {
    this.loadProviderKeys('openrouter', [
      'OPENROUTER_API_KEY',
      'OPENROUTER_API_KEYS',
      'OPENROUTER_KEY',
    ], 'OPENROUTER_API_KEY_');

    this.loadProviderKeys('nim', [
      'NVIDIA_NIM_API_KEY',
      'NVIDIA_NIM_API_KEYS',
      'NVIDIA_API_KEY',
      'NVIDIA_API_KEYS',
    ], 'NVIDIA_NIM_API_KEY_', 'NVIDIA_API_KEY_');

    this.loadProviderKeys('huggingface', [
      'HUGGINGFACE_API_KEY',
      'HUGGINGFACE_API_KEYS',
      'HF_TOKEN',
      'HF_API_KEY',
    ], 'HUGGINGFACE_API_KEY_');

    this.loadProviderKeys('cloudflare', [
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_API_TOKENS',
      'CLOUDFLARE_API_KEY',
      'CLOUDFLARE_TOKEN',
    ], 'CLOUDFLARE_API_KEY_', 'CLOUDFLARE_API_TOKEN_');
  }

  private loadProviderKeys(
    provider: ProviderName,
    bulkEnvVars: string[],
    ...indexedPrefixes: string[]
  ): void {
    const gatheredKeys: string[] = [];

    // 1. Check indexed environment variables: e.g. OPENROUTER_API_KEY_1..50
    for (const prefix of indexedPrefixes) {
      for (let i = 1; i <= 50; i++) {
        const val = process.env[`${prefix}${i}`];
        if (val && val.trim().length > 0) {
          gatheredKeys.push(val.trim());
        }
      }
    }

    // 2. Check bulk / comma-separated environment variables
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

    const newStates: KeyState[] = uniqueKeys.map(key => {
      const existing = stateMap.get(key);
      if (existing) return existing;
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
    });

    this.pools.set(provider, newStates);

    if (newStates.length > 0) {
      const maskedSample = newStates.map(s => maskApiKey(s.key)).join(', ');
      console.log(`[KeyPool] Loaded ${newStates.length} keys for provider [${provider}]: [${maskedSample}]`);
    }
  }

  /**
   * Intelligently selects the best available API key from the provider pool.
   * Selection priority:
   * 1. Not in cooldown (and not exhausted)
   * 2. Lowest recent failure count (consecutive failures)
   * 3. Best recent success rate
   * 4. Lowest recent usage (request count)
   * 5. Oldest last request time (LRU tie-breaker)
   */
  public getAvailableKey(provider: ProviderName, excludeKeys: string[] = []): string | null {
    const pool = this.pools.get(provider);
    if (!pool || pool.length === 0) return null;

    const now = Date.now();

    // Check for keys that completed their cooldown and restore them
    for (const state of pool) {
      if (state.backoffUntil > 0 && now >= state.backoffUntil) {
        state.backoffUntil = 0;
        state.backoffReason = undefined;
        // Half the consecutive rate limits counter on natural cooldown completion
        state.consecutiveRateLimits = Math.max(0, state.consecutiveRateLimits - 1);
        console.log(`[KeyPool] Key ${maskApiKey(state.key)} (${provider}) completed cooldown and is restored to active pool.`);
      }
    }

    // Filter eligible keys
    const eligible = pool.filter(k =>
      !k.isExhausted &&
      k.backoffUntil <= now &&
      !excludeKeys.includes(k.key)
    );

    if (eligible.length === 0) {
      return null;
    }

    // Intelligent Sorting
    eligible.sort((a, b) => {
      // 1. Lowest consecutive failures
      if (a.consecutiveFailures !== b.consecutiveFailures) {
        return a.consecutiveFailures - b.consecutiveFailures;
      }

      // 2. Best recent success rate
      const totalA = a.successCount + a.failureCount;
      const totalB = b.successCount + b.failureCount;
      const rateA = totalA > 0 ? a.successCount / totalA : 1.0;
      const rateB = totalB > 0 ? b.successCount / totalB : 1.0;
      if (rateA !== rateB) {
        return rateB - rateA;
      }

      // 3. Lowest recent request count
      if (a.requestCount !== b.requestCount) {
        return a.requestCount - b.requestCount;
      }

      // 4. Oldest last request time (LRU)
      return a.lastRequestTime - b.lastRequestTime;
    });

    const chosen = eligible[0];
    chosen.requestCount++;
    chosen.lastRequestTime = now;
    return chosen.key;
  }

  /**
   * Reports successful request execution for a key.
   */
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

  /**
   * Reports error or rate-limit on a specific key.
   * Applies exponential cooldown on 429 without permanently disabling it.
   */
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
      // Exponential backoff for rate-limits: 20s, 40s, 80s... max 5 mins
      const cooldownMs = Math.min(
        this.maxCooldownMs,
        this.baseRateLimitCooldownMs * Math.pow(2, state.consecutiveRateLimits - 1)
      );

      state.backoffUntil = now + cooldownMs;
      state.backoffReason = 'rate_limit_429';

      console.warn(`[KeyPool] Rate limit (429) on ${provider} key ${masked}. Temporary cooldown for ${Math.round(cooldownMs / 1000)}s (Level: ${state.consecutiveRateLimits}).`);
    } else if (statusCode === 401 || statusCode === 403) {
      const isQuotaExhausted = errorMessage && (
        errorMessage.toLowerCase().includes('quota') ||
        errorMessage.toLowerCase().includes('credit') ||
        errorMessage.toLowerCase().includes('balance') ||
        errorMessage.toLowerCase().includes('exhausted')
      );

      if (isQuotaExhausted && state.consecutiveFailures >= 3) {
        state.isExhausted = true;
        state.backoffReason = 'quota_exhausted';
        console.warn(`[KeyPool] Quota exhausted on ${provider} key ${masked}. Key marked exhausted.`);
      } else {
        // Cooldown for auth/permission
        const cooldownMs = Math.min(this.maxCooldownMs, 60000 * state.consecutiveFailures);
        state.backoffUntil = now + cooldownMs;
        state.backoffReason = 'auth_permission_error';
        console.warn(`[KeyPool] Auth/permission issue (${statusCode}) on ${provider} key ${masked}. Cooldown for ${Math.round(cooldownMs / 1000)}s.`);
      }
    } else {
      // General 5xx or network error with exponential backoff
      const cooldownMs = Math.min(
        this.maxCooldownMs,
        this.serverErrorCooldownMs * Math.pow(1.5, state.consecutiveFailures - 1)
      );
      state.backoffUntil = now + cooldownMs;
      state.backoffReason = `server_error_${statusCode || 'network'}`;
      console.warn(`[KeyPool] Error (${statusCode || 'network'}) on ${provider} key ${masked}. Cooldown for ${Math.round(cooldownMs / 1000)}s.`);
    }
  }

  public isProviderAvailable(provider: ProviderName): boolean {
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
    const pool = this.pools.get(provider) || [];
    const now = Date.now();

    const keys: KeyHealthStats[] = pool.map(k => {
      const inCooldown = !k.isExhausted && k.backoffUntil > now;
      const remainingSec = inCooldown ? Math.ceil((k.backoffUntil - now) / 1000) : 0;
      const status: 'active' | 'in_cooldown' | 'exhausted' = k.isExhausted
        ? 'exhausted'
        : inCooldown
        ? 'in_cooldown'
        : 'active';

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

    const active = keys.filter(k => k.status === 'active').length;
    const inCooldown = keys.filter(k => k.status === 'in_cooldown').length;
    const exhausted = keys.filter(k => k.status === 'exhausted').length;

    return {
      total: pool.length,
      active,
      inCooldown,
      exhausted,
      keys,
    };
  }

  /**
   * Securely sets keys for a provider at runtime (e.g. from Settings endpoint).
   * Overwrites or merges keys in memory.
   */
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
      if (existing) {
        // Reset exhaustion on explicit key update
        return { ...existing, isExhausted: false, backoffUntil: 0 };
      }
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
    });

    this.pools.set(provider, newStates);
    const masked = newStates.map(s => maskApiKey(s.key));
    console.log(`[KeyPool] Updated keys for provider [${provider}]: count=${newStates.length}`);

    return {
      active: newStates.filter(s => !s.isExhausted && s.backoffUntil <= Date.now()).length,
      total: newStates.length,
      maskedKeys: masked,
    };
  }

  public clearProviderKeys(provider: ProviderName): void {
    this.pools.set(provider, []);
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
    // Redact Bearer tokens
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]{8,}/gi, 'Bearer [REDACTED]')
    // Redact sk-... keys
    .replace(/sk-[a-zA-Z0-9_\-]{8,}/gi, 'sk-[REDACTED]')
    // Redact nvapi-... Nvidia keys
    .replace(/nvapi-[a-zA-Z0-9_\-]{16,}/gi, 'nvapi-[REDACTED]')
    // Redact hf_... HuggingFace keys
    .replace(/hf_[a-zA-Z0-9_\-]{16,}/gi, 'hf_[REDACTED]')
    // Redact cfut_... Cloudflare keys
    .replace(/cfut_[a-zA-Z0-9_\-]{16,}/gi, 'cfut_[REDACTED]')
    // Redact key=, token=, or with key ... patterns
    .replace(/((?:key|apikey|api_key|token|auth)\s*[:=]\s*)[a-zA-Z0-9_\-\.]{8,}/gi, '$1[REDACTED]')
    .replace(/(with\s+key\s+)[a-zA-Z0-9_\-\.]{8,}/gi, '$1[REDACTED]');
}

export const keyPoolManager = new KeyPoolManager();
