// Auto-generated bundled serverless function for JugaadVision

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/ai/pools/keyPool.ts
function maskApiKey(key) {
  if (!key) return "***";
  if (key.length <= 8) return "****";
  const prefixLength = Math.min(12, Math.max(4, key.length > 12 ? 11 : Math.floor(key.length / 2)));
  const prefix = key.slice(0, prefixLength);
  const suffix = key.slice(-Math.min(4, Math.max(2, Math.floor(key.length / 4))));
  return `${prefix}...${suffix}`;
}
function redactSecrets(text) {
  if (!text || typeof text !== "string") return "";
  return text.replace(/Bearer\s+[a-zA-Z0-9_\-\.]{8,}/gi, "Bearer [REDACTED]").replace(/sk-[a-zA-Z0-9_\-]{8,}/gi, "sk-[REDACTED]").replace(/nvapi-[a-zA-Z0-9_\-]{16,}/gi, "nvapi-[REDACTED]").replace(/hf_[a-zA-Z0-9_\-]{16,}/gi, "hf_[REDACTED]").replace(/cfut_[a-zA-Z0-9_\-]{16,}/gi, "cfut_[REDACTED]").replace(/((?:key|apikey|api_key|token|auth)\s*[:=]\s*)[a-zA-Z0-9_\-\.]{8,}/gi, "$1[REDACTED]").replace(/(with\s+key\s+)[a-zA-Z0-9_\-\.]{8,}/gi, "$1[REDACTED]");
}
var KeyPoolManager, keyPoolManager;
var init_keyPool = __esm({
  "server/ai/pools/keyPool.ts"() {
    KeyPoolManager = class {
      // 15s initial for 5xx
      constructor() {
        this.pools = /* @__PURE__ */ new Map();
        this.baseRateLimitCooldownMs = 2e4;
        // 20s initial cooldown for 429
        this.maxCooldownMs = 3e5;
        // 5 minutes max cooldown
        this.serverErrorCooldownMs = 15e3;
        this.reloadFromEnv();
      }
      reloadFromEnv() {
        this.loadProviderKeys("openrouter", [
          "OPENROUTER_API_KEY",
          "OPENROUTER_API_KEYS",
          "OPENROUTER_KEY"
        ], "OPENROUTER_API_KEY_");
        this.loadProviderKeys("nim", [
          "NVIDIA_NIM_API_KEY",
          "NVIDIA_NIM_API_KEYS",
          "NVIDIA_API_KEY",
          "NVIDIA_API_KEYS"
        ], "NVIDIA_NIM_API_KEY_", "NVIDIA_API_KEY_");
        this.loadProviderKeys("huggingface", [
          "HUGGINGFACE_API_KEY",
          "HUGGINGFACE_API_KEYS",
          "HF_TOKEN",
          "HF_API_KEY"
        ], "HUGGINGFACE_API_KEY_");
        this.loadProviderKeys("cloudflare", [
          "CLOUDFLARE_API_TOKEN",
          "CLOUDFLARE_API_TOKENS",
          "CLOUDFLARE_API_KEY",
          "CLOUDFLARE_TOKEN"
        ], "CLOUDFLARE_API_KEY_", "CLOUDFLARE_API_TOKEN_");
      }
      loadProviderKeys(provider, bulkEnvVars, ...indexedPrefixes) {
        const gatheredKeys = [];
        for (const prefix of indexedPrefixes) {
          for (let i = 1; i <= 50; i++) {
            const val = process.env[`${prefix}${i}`];
            if (val && val.trim().length > 0) {
              gatheredKeys.push(val.trim());
            }
          }
        }
        for (const envVar of bulkEnvVars) {
          const val = process.env[envVar];
          if (val && val.trim().length > 0) {
            const parts = val.split(/[,\n]/).map((k) => k.trim()).filter((k) => k.length > 0);
            gatheredKeys.push(...parts);
          }
        }
        const uniqueKeys = Array.from(new Set(gatheredKeys));
        const currentStates = this.pools.get(provider) || [];
        const stateMap = new Map(currentStates.map((s) => [s.key, s]));
        const newStates = uniqueKeys.map((key) => {
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
            isExhausted: false
          };
        });
        this.pools.set(provider, newStates);
        if (newStates.length > 0) {
          const maskedSample = newStates.map((s) => maskApiKey(s.key)).join(", ");
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
      getAvailableKey(provider, excludeKeys = []) {
        const pool = this.pools.get(provider);
        if (!pool || pool.length === 0) return null;
        const now = Date.now();
        for (const state of pool) {
          if (state.backoffUntil > 0 && now >= state.backoffUntil) {
            state.backoffUntil = 0;
            state.backoffReason = void 0;
            state.consecutiveRateLimits = Math.max(0, state.consecutiveRateLimits - 1);
            console.log(`[KeyPool] Key ${maskApiKey(state.key)} (${provider}) completed cooldown and is restored to active pool.`);
          }
        }
        const eligible = pool.filter(
          (k) => !k.isExhausted && k.backoffUntil <= now && !excludeKeys.includes(k.key)
        );
        if (eligible.length === 0) {
          return null;
        }
        eligible.sort((a, b) => {
          if (a.consecutiveFailures !== b.consecutiveFailures) {
            return a.consecutiveFailures - b.consecutiveFailures;
          }
          const totalA = a.successCount + a.failureCount;
          const totalB = b.successCount + b.failureCount;
          const rateA = totalA > 0 ? a.successCount / totalA : 1;
          const rateB = totalB > 0 ? b.successCount / totalB : 1;
          if (rateA !== rateB) {
            return rateB - rateA;
          }
          if (a.requestCount !== b.requestCount) {
            return a.requestCount - b.requestCount;
          }
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
      reportSuccess(provider, key, _durationMs) {
        const pool = this.pools.get(provider);
        if (!pool) return;
        const state = pool.find((k) => k.key === key);
        if (state) {
          state.successCount++;
          state.consecutiveFailures = 0;
          state.consecutiveRateLimits = 0;
          state.backoffUntil = 0;
          state.backoffReason = void 0;
          state.lastSuccessTime = Date.now();
        }
      }
      /**
       * Reports error or rate-limit on a specific key.
       * Applies exponential cooldown on 429 without permanently disabling it.
       */
      reportError(provider, key, statusCode, errorMessage) {
        const pool = this.pools.get(provider);
        if (!pool) return;
        const state = pool.find((k) => k.key === key);
        if (!state) return;
        const now = Date.now();
        state.lastErrorTime = now;
        state.failureCount++;
        state.consecutiveFailures++;
        const masked = maskApiKey(key);
        if (statusCode === 429) {
          state.consecutiveRateLimits++;
          const cooldownMs = Math.min(
            this.maxCooldownMs,
            this.baseRateLimitCooldownMs * Math.pow(2, state.consecutiveRateLimits - 1)
          );
          state.backoffUntil = now + cooldownMs;
          state.backoffReason = "rate_limit_429";
          console.warn(`[KeyPool] Rate limit (429) on ${provider} key ${masked}. Temporary cooldown for ${Math.round(cooldownMs / 1e3)}s (Level: ${state.consecutiveRateLimits}).`);
        } else if (statusCode === 401 || statusCode === 403) {
          const isQuotaExhausted = errorMessage && (errorMessage.toLowerCase().includes("quota") || errorMessage.toLowerCase().includes("credit") || errorMessage.toLowerCase().includes("balance") || errorMessage.toLowerCase().includes("exhausted"));
          if (isQuotaExhausted && state.consecutiveFailures >= 3) {
            state.isExhausted = true;
            state.backoffReason = "quota_exhausted";
            console.warn(`[KeyPool] Quota exhausted on ${provider} key ${masked}. Key marked exhausted.`);
          } else {
            const cooldownMs = Math.min(this.maxCooldownMs, 6e4 * state.consecutiveFailures);
            state.backoffUntil = now + cooldownMs;
            state.backoffReason = "auth_permission_error";
            console.warn(`[KeyPool] Auth/permission issue (${statusCode}) on ${provider} key ${masked}. Cooldown for ${Math.round(cooldownMs / 1e3)}s.`);
          }
        } else {
          const cooldownMs = Math.min(
            this.maxCooldownMs,
            this.serverErrorCooldownMs * Math.pow(1.5, state.consecutiveFailures - 1)
          );
          state.backoffUntil = now + cooldownMs;
          state.backoffReason = `server_error_${statusCode || "network"}`;
          console.warn(`[KeyPool] Error (${statusCode || "network"}) on ${provider} key ${masked}. Cooldown for ${Math.round(cooldownMs / 1e3)}s.`);
        }
      }
      isProviderAvailable(provider) {
        const pool = this.pools.get(provider);
        if (!pool || pool.length === 0) return false;
        const now = Date.now();
        return pool.some((k) => !k.isExhausted && k.backoffUntil <= now);
      }
      getPoolStats(provider) {
        const pool = this.pools.get(provider) || [];
        const now = Date.now();
        const keys = pool.map((k) => {
          const inCooldown2 = !k.isExhausted && k.backoffUntil > now;
          const remainingSec = inCooldown2 ? Math.ceil((k.backoffUntil - now) / 1e3) : 0;
          const status = k.isExhausted ? "exhausted" : inCooldown2 ? "in_cooldown" : "active";
          const total = k.successCount + k.failureCount;
          const successRate = total > 0 ? Math.round(k.successCount / total * 100) / 100 : 1;
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
            lastUsedTime: k.lastRequestTime
          };
        });
        const active = keys.filter((k) => k.status === "active").length;
        const inCooldown = keys.filter((k) => k.status === "in_cooldown").length;
        const exhausted = keys.filter((k) => k.status === "exhausted").length;
        return {
          total: pool.length,
          active,
          inCooldown,
          exhausted,
          keys
        };
      }
      /**
       * Securely sets keys for a provider at runtime (e.g. from Settings endpoint).
       * Overwrites or merges keys in memory.
       */
      setProviderKeys(provider, keysInput) {
        let keyList = [];
        if (Array.isArray(keysInput)) {
          keyList = keysInput;
        } else if (typeof keysInput === "string") {
          keyList = keysInput.split(/[,\n]/).map((k) => k.trim()).filter((k) => k.length > 0);
        }
        const uniqueKeys = Array.from(new Set(keyList.map((k) => k.trim()).filter((k) => k.length > 0)));
        const currentStates = this.pools.get(provider) || [];
        const stateMap = new Map(currentStates.map((s) => [s.key, s]));
        const newStates = uniqueKeys.map((key) => {
          const existing = stateMap.get(key);
          if (existing) {
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
            isExhausted: false
          };
        });
        this.pools.set(provider, newStates);
        const masked = newStates.map((s) => maskApiKey(s.key));
        console.log(`[KeyPool] Updated keys for provider [${provider}]: count=${newStates.length}`);
        return {
          active: newStates.filter((s) => !s.isExhausted && s.backoffUntil <= Date.now()).length,
          total: newStates.length,
          maskedKeys: masked
        };
      }
      clearProviderKeys(provider) {
        this.pools.set(provider, []);
      }
      getAllProviders() {
        return Array.from(this.pools.keys()).filter((p) => (this.pools.get(p)?.length || 0) > 0);
      }
    };
    keyPoolManager = new KeyPoolManager();
  }
});

// server/ai/health/modelHealthManager.ts
import fs from "fs";
import path from "path";
var ModelHealthManager, modelHealthManager;
var init_modelHealthManager = __esm({
  "server/ai/health/modelHealthManager.ts"() {
    init_keyPool();
    ModelHealthManager = class {
      // 10s periodic recheck
      constructor(storagePath) {
        this.keyHealthMap = /* @__PURE__ */ new Map();
        this.modelHealthMap = /* @__PURE__ */ new Map();
        this.providerHealthMap = /* @__PURE__ */ new Map();
        this.saveDebounceTimer = null;
        this.checkTimer = null;
        this.checkIntervalMs = 1e4;
        this.storageFile = storagePath || path.resolve(".cache", "ai_health_state.json");
        this.loadFromStorage();
        this.startPeriodicRecheck();
      }
      // =========================================================================
      // KEY HEALTH TRACKING
      // =========================================================================
      recordKeySuccess(provider, key, latencyMs) {
        const keyId = this.getKeyId(provider, key);
        const data = this.getOrCreateKeyHealth(provider, key);
        const now = Date.now();
        const totalSuccess = data.successCount + 1;
        data.averageLatencyMs = Math.round((data.averageLatencyMs * data.successCount + latencyMs) / totalSuccess);
        data.successCount = totalSuccess;
        data.consecutiveFailures = 0;
        data.lastSuccess = new Date(now).toISOString();
        data.cooldownUntil = 0;
        data.lastErrorReason = void 0;
        data.state = "healthy";
        this.updateProviderRollup(provider);
        this.scheduleSave();
      }
      recordKeyFailure(provider, key, error, statusCode) {
        const data = this.getOrCreateKeyHealth(provider, key);
        const now = Date.now();
        data.failureCount++;
        data.consecutiveFailures++;
        data.lastFailure = new Date(now).toISOString();
        data.lastErrorReason = error;
        if (statusCode === 429) {
          const cooldownMs = Math.min(3e5, 2e4 * Math.pow(2, data.consecutiveFailures - 1));
          data.cooldownUntil = now + cooldownMs;
          data.state = "rate_limited";
          console.warn(`[ModelHealthManager] Key ${data.maskedKey} (${provider}) state: rate_limited for ${Math.round(cooldownMs / 1e3)}s.`);
        } else if (statusCode === 401 || statusCode === 403) {
          if (error.toLowerCase().includes("quota") || error.toLowerCase().includes("balance") || error.toLowerCase().includes("credit")) {
            data.state = "quota_exhausted";
            data.cooldownUntil = now + 864e5;
            console.warn(`[ModelHealthManager] Key ${data.maskedKey} (${provider}) state: quota_exhausted.`);
          } else {
            const cooldownMs = Math.min(3e5, 6e4 * data.consecutiveFailures);
            data.cooldownUntil = now + cooldownMs;
            data.state = "temporarily_unavailable";
          }
        } else {
          const cooldownMs = Math.min(3e5, 15e3 * Math.pow(1.5, data.consecutiveFailures - 1));
          data.cooldownUntil = now + cooldownMs;
          data.state = data.consecutiveFailures >= 3 ? "degraded" : "temporarily_unavailable";
        }
        this.updateProviderRollup(provider);
        this.scheduleSave();
      }
      isKeyAvailable(provider, key) {
        const keyId = this.getKeyId(provider, key);
        const data = this.keyHealthMap.get(keyId);
        if (!data) return true;
        if (data.state === "disabled" || data.state === "quota_exhausted") return false;
        return data.cooldownUntil <= Date.now();
      }
      // =========================================================================
      // MODEL HEALTH TRACKING (ISOLATED - MODEL FAILURE DOES NOT BRING DOWN PROVIDER)
      // =========================================================================
      recordModelSuccess(provider, providerModelId, latencyMs) {
        const data = this.getOrCreateModelHealth(provider, providerModelId);
        const now = Date.now();
        const totalSuccess = data.successCount + 1;
        data.averageLatencyMs = Math.round((data.averageLatencyMs * data.successCount + latencyMs) / totalSuccess);
        data.successCount = totalSuccess;
        data.consecutiveFailures = 0;
        data.lastSuccess = new Date(now).toISOString();
        data.cooldownUntil = 0;
        data.lastErrorReason = void 0;
        data.state = "healthy";
        this.updateProviderRollup(provider);
        this.scheduleSave();
      }
      recordModelFailure(provider, providerModelId, error, statusCode) {
        const data = this.getOrCreateModelHealth(provider, providerModelId);
        const now = Date.now();
        data.failureCount++;
        data.consecutiveFailures++;
        data.lastFailure = new Date(now).toISOString();
        data.lastErrorReason = error;
        if (statusCode === 429) {
          const cooldownMs = Math.min(3e5, 3e4 * Math.pow(1.5, data.consecutiveFailures - 1));
          data.cooldownUntil = now + cooldownMs;
          data.state = "rate_limited";
          console.warn(`[ModelHealthManager] Model ${data.modelId} (${provider}) state: rate_limited for ${Math.round(cooldownMs / 1e3)}s.`);
        } else if (statusCode === 404) {
          data.cooldownUntil = now + 3e5;
          data.state = "temporarily_unavailable";
        } else {
          const cooldownMs = Math.min(3e5, 15e3 * Math.pow(1.5, data.consecutiveFailures - 1));
          data.cooldownUntil = now + cooldownMs;
          data.state = data.consecutiveFailures >= 3 ? "degraded" : "temporarily_unavailable";
        }
        this.updateProviderRollup(provider);
        this.scheduleSave();
      }
      isModelAvailable(provider, providerModelId) {
        const modelId = `${provider}:${providerModelId}`;
        const data = this.modelHealthMap.get(modelId);
        if (!data) return true;
        if (data.state === "disabled" || data.state === "quota_exhausted") return false;
        return data.cooldownUntil <= Date.now();
      }
      getModelHealth(provider, providerModelId) {
        return this.getOrCreateModelHealth(provider, providerModelId);
      }
      // =========================================================================
      // PROVIDER HEALTH TRACKING & ROLLUP
      // =========================================================================
      getProviderHealth(provider) {
        return this.getOrCreateProviderHealth(provider);
      }
      isProviderAvailable(provider) {
        const data = this.providerHealthMap.get(provider);
        if (!data) return true;
        if (data.state === "disabled" || data.state === "quota_exhausted") return false;
        return data.state !== "temporarily_unavailable" && data.cooldownUntil <= Date.now();
      }
      updateProviderRollup(provider) {
        const data = this.getOrCreateProviderHealth(provider);
        const now = Date.now();
        const providerKeys = Array.from(this.keyHealthMap.values()).filter((k) => k.provider === provider);
        const activeKeys = providerKeys.filter((k) => k.state !== "disabled" && k.state !== "quota_exhausted" && k.cooldownUntil <= now).length;
        data.totalKeys = providerKeys.length;
        data.activeKeys = activeKeys;
        const providerModels = Array.from(this.modelHealthMap.values()).filter((m) => m.provider === provider);
        const availableModels = providerModels.filter((m) => m.state !== "disabled" && m.cooldownUntil <= now).length;
        data.totalModels = providerModels.length;
        data.availableModels = availableModels;
        if (data.totalKeys > 0 && activeKeys === 0) {
          const allQuotaExhausted = providerKeys.every((k) => k.state === "quota_exhausted");
          if (allQuotaExhausted) {
            data.state = "quota_exhausted";
          } else {
            data.state = "temporarily_unavailable";
            const soonestKeyCooldown = providerKeys.map((k) => k.cooldownUntil).sort((a, b) => a - b)[0] || now + 2e4;
            data.cooldownUntil = soonestKeyCooldown;
          }
        } else if (data.totalModels > 0 && availableModels === 0) {
          data.state = "temporarily_unavailable";
          data.cooldownUntil = now + 3e4;
        } else {
          const hasErrors = providerKeys.some((k) => k.state === "degraded" || k.consecutiveFailures > 2);
          data.state = hasErrors ? "degraded" : "healthy";
          data.cooldownUntil = 0;
        }
      }
      // =========================================================================
      // PERIODIC RECHECK & PERSISTENCE
      // =========================================================================
      startPeriodicRecheck() {
        if (process.env.VERCEL === "1") return;
        this.stopPeriodicRecheck();
        this.checkTimer = setInterval(() => {
          this.recheckHealthStates();
        }, this.checkIntervalMs);
        if (this.checkTimer && typeof this.checkTimer.unref === "function") {
          this.checkTimer.unref();
        }
      }
      stopPeriodicRecheck() {
        if (this.checkTimer) {
          clearInterval(this.checkTimer);
          this.checkTimer = null;
        }
      }
      recheckHealthStates() {
        const now = Date.now();
        let stateChanged = false;
        for (const [, kData] of this.keyHealthMap.entries()) {
          if (kData.cooldownUntil > 0 && now >= kData.cooldownUntil) {
            kData.cooldownUntil = 0;
            kData.state = kData.consecutiveFailures >= 3 ? "degraded" : "healthy";
            kData.lastErrorReason = void 0;
            console.log(`[ModelHealthManager] Key ${kData.maskedKey} (${kData.provider}) cooldown expired -> state: ${kData.state}`);
            stateChanged = true;
          }
        }
        for (const [modelId, mData] of this.modelHealthMap.entries()) {
          if (mData.cooldownUntil > 0 && now >= mData.cooldownUntil) {
            mData.cooldownUntil = 0;
            mData.state = mData.consecutiveFailures >= 3 ? "degraded" : "healthy";
            mData.lastErrorReason = void 0;
            console.log(`[ModelHealthManager] Model ${modelId} cooldown expired -> state: ${mData.state}`);
            stateChanged = true;
          }
        }
        const providers = ["openrouter", "nim", "custom"];
        for (const p of providers) {
          this.updateProviderRollup(p);
        }
        if (stateChanged) {
          this.scheduleSave();
        }
      }
      generateReport(keyCounts, modelCounts) {
        this.recheckHealthStates();
        const providersReport = {};
        const providers = ["openrouter", "nim", "custom"];
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
        const keysReport = {};
        for (const [id, data] of this.keyHealthMap.entries()) {
          keysReport[id] = { ...data };
        }
        const modelsReport = {};
        for (const [id, data] of this.modelHealthMap.entries()) {
          modelsReport[id] = { ...data };
        }
        let discoveredTotal = 0;
        if (modelCounts) {
          discoveredTotal = Object.values(modelCounts).reduce((acc, c) => acc + c, 0);
        }
        return {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          providers: providersReport,
          keys: keysReport,
          models: modelsReport,
          discoveredModelsTotal: discoveredTotal,
          freeModelsTotal: discoveredTotal
        };
      }
      // =========================================================================
      // PERSISTENCE (DISK SNAPSHOT)
      // =========================================================================
      flushSync() {
        if (this.saveDebounceTimer) {
          clearTimeout(this.saveDebounceTimer);
          this.saveDebounceTimer = null;
        }
        this.saveToStorage();
      }
      scheduleSave() {
        if (this.saveDebounceTimer) {
          clearTimeout(this.saveDebounceTimer);
        }
        this.saveDebounceTimer = setTimeout(() => {
          this.saveToStorage();
        }, 500);
      }
      saveToStorage() {
        if (process.env.VERCEL === "1") return;
        try {
          const dir = path.dirname(this.storageFile);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          const snapshot = {
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            keys: Array.from(this.keyHealthMap.entries()),
            models: Array.from(this.modelHealthMap.entries()),
            providers: Array.from(this.providerHealthMap.entries())
          };
          fs.writeFileSync(this.storageFile, JSON.stringify(snapshot, null, 2), "utf-8");
        } catch (err) {
          console.warn("[ModelHealthManager] Failed to persist health state:", err?.message || err);
        }
      }
      loadFromStorage() {
        if (process.env.VERCEL === "1") return;
        try {
          if (!fs.existsSync(this.storageFile)) return;
          const content = fs.readFileSync(this.storageFile, "utf-8");
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
        } catch (err) {
          console.warn("[ModelHealthManager] Could not read health cache file, starting fresh:", err?.message || err);
        }
      }
      getKeyId(provider, key) {
        return `${provider}:${maskApiKey(key)}`;
      }
      getOrCreateKeyHealth(provider, key) {
        const keyId = this.getKeyId(provider, key);
        let data = this.keyHealthMap.get(keyId);
        if (!data) {
          data = {
            maskedKey: maskApiKey(key),
            provider,
            state: "unknown",
            successCount: 0,
            failureCount: 0,
            consecutiveFailures: 0,
            averageLatencyMs: 0,
            cooldownUntil: 0
          };
          this.keyHealthMap.set(keyId, data);
        }
        return data;
      }
      getOrCreateModelHealth(provider, providerModelId) {
        const modelId = `${provider}:${providerModelId}`;
        let data = this.modelHealthMap.get(modelId);
        if (!data) {
          data = {
            modelId,
            provider,
            providerModelId,
            state: "unknown",
            successCount: 0,
            failureCount: 0,
            consecutiveFailures: 0,
            averageLatencyMs: 0,
            cooldownUntil: 0
          };
          this.modelHealthMap.set(modelId, data);
        }
        return data;
      }
      getOrCreateProviderHealth(provider) {
        let data = this.providerHealthMap.get(provider);
        if (!data) {
          data = {
            provider,
            state: "unknown",
            successCount: 0,
            failureCount: 0,
            consecutiveFailures: 0,
            averageLatencyMs: 0,
            cooldownUntil: 0,
            activeKeys: 0,
            totalKeys: 0,
            availableModels: 0,
            totalModels: 0
          };
          this.providerHealthMap.set(provider, data);
        }
        return data;
      }
    };
    modelHealthManager = new ModelHealthManager();
  }
});

// server/ai/health/healthTracker.ts
var HealthTracker, healthTracker;
var init_healthTracker = __esm({
  "server/ai/health/healthTracker.ts"() {
    init_modelHealthManager();
    HealthTracker = class {
      recordSuccess(provider, modelId, durationMs) {
        modelHealthManager.recordModelSuccess(provider, modelId, durationMs);
      }
      recordError(provider, modelId, statusCode, errorMessage) {
        modelHealthManager.recordModelFailure(provider, modelId, errorMessage || "Model error", statusCode);
      }
      isHealthy(provider, modelId) {
        return modelHealthManager.isModelAvailable(provider, modelId);
      }
      getHealthScore(provider, modelId) {
        const health = modelHealthManager.getModelHealth(provider, modelId);
        if (health.state === "disabled" || health.state === "quota_exhausted") return 0;
        if (health.state === "rate_limited" || health.state === "temporarily_unavailable") return 10;
        if (health.state === "degraded") return 50;
        const total = health.successCount + health.failureCount;
        const rate = total > 0 ? health.successCount / total : 1;
        return Math.round(rate * 100);
      }
      getModelHealthState(provider, modelId) {
        return modelHealthManager.getModelHealth(provider, modelId).state;
      }
      generateReport(keyStats, modelCounts) {
        return modelHealthManager.generateReport(keyStats, modelCounts);
      }
    };
    healthTracker = new HealthTracker();
  }
});

// server/ai/classification/capabilityClassifier.ts
var CapabilityClassifier, capabilityClassifier;
var init_capabilityClassifier = __esm({
  "server/ai/classification/capabilityClassifier.ts"() {
    CapabilityClassifier = class {
      /**
       * Automatically classifies model capabilities from official provider metadata.
       * If capability is not verifiable from metadata, it is marked 'unknown' or 'unsupported' - never guessed.
       */
      classify(raw) {
        switch (raw.provider) {
          case "openrouter":
            return this.classifyOpenRouter(raw);
          case "nim":
            return this.classifyNim(raw);
          case "gemini":
            return this.classifyGemini(raw);
          case "huggingface":
            return this.classifyHuggingFace(raw);
          case "cloudflare":
            return this.classifyCloudflare(raw);
          default:
            return this.classifyGeneric(raw);
        }
      }
      /**
       * Extracts an array of strictly verified supported capabilities.
       */
      getVerifiedSupportedList(caps) {
        const list = [];
        if (caps.chat === "supported") list.push("chat");
        if (caps.reasoning === "supported") list.push("reasoning");
        if (caps.coding === "supported") list.push("coding");
        if (caps.vision === "supported") list.push("vision");
        if (caps.tool_calling === "supported") list.push("tool_calling");
        if (caps.structured_output === "supported") list.push("structured_output");
        return list;
      }
      classifyOpenRouter(raw) {
        const modality = (raw.architecture?.modality || "").toLowerCase();
        const desc = (raw.description || "").toLowerCase();
        const id = raw.id.toLowerCase();
        const supportedParams = Array.isArray(raw.supported_parameters) ? raw.supported_parameters : [];
        const isChat = modality.includes("text->text") || modality.includes("text+image->text") || raw.architecture?.instruct_type !== null || id.includes("instruct") || id.includes("chat");
        const chat = isChat ? "supported" : modality ? "unsupported" : "unknown";
        const isExplicitNonVision = modality === "text->text" || modality === "text->image";
        const hasVisionModality = !isExplicitNonVision && (modality.includes("multimodal") || modality.includes("image->") || modality.includes("text+image") || id.includes("-vl") || id.includes("vision") || id.includes("multimodal") || desc.includes("vision model") || desc.includes("visual reasoning"));
        const vision = hasVisionModality ? "supported" : modality || isChat ? "unsupported" : "unknown";
        let tool_calling = "unknown";
        if (supportedParams.length > 0) {
          const hasTools = supportedParams.includes("tools") || supportedParams.includes("function_calling");
          tool_calling = hasTools ? "supported" : "unsupported";
        } else if (desc.includes("tool calling") || desc.includes("function calling")) {
          tool_calling = "supported";
        }
        let structured_output = "unknown";
        if (supportedParams.length > 0) {
          const hasFormat = supportedParams.includes("response_format") || supportedParams.includes("structured_outputs");
          structured_output = hasFormat ? "supported" : "unsupported";
        } else if (isChat) {
          structured_output = "supported";
        }
        const isReasoning = id.includes("r1") || id.includes("reason") || id.includes("qwq") || id.includes("o1") || id.includes("o3") || desc.includes("chain-of-thought") || desc.includes("reasoning model");
        const reasoning = isReasoning ? "supported" : "unknown";
        const isCoding = id.includes("coder") || id.includes("code") || id.includes("deepseek-coder") || id.includes("starcoder") || id.includes("codeqwen") || desc.includes("coding model") || desc.includes("code generation");
        const coding = isCoding ? "supported" : "unknown";
        return {
          chat,
          reasoning,
          coding,
          vision,
          tool_calling,
          structured_output
        };
      }
      classifyNim(raw) {
        const id = raw.id.toLowerCase();
        const desc = (raw.description || "").toLowerCase();
        const isChat = id.includes("instruct") || id.includes("chat") || id.includes("llama") || id.includes("nemotron") || id.includes("mistral") || id.includes("qwen");
        const chat = isChat ? "supported" : "unknown";
        const isVision = id.includes("vision") || id.includes("vlm") || id.includes("multimodal") || id.includes("neva") || id.includes("florence") || id.includes("kosmos");
        const vision = isVision ? "supported" : isChat ? "unsupported" : "unknown";
        const isReasoning = id.includes("r1") || id.includes("reason") || id.includes("qwq") || desc.includes("reasoning");
        const reasoning = isReasoning ? "supported" : "unknown";
        const isCoding = id.includes("coder") || id.includes("code");
        const coding = isCoding ? "supported" : "unknown";
        const tool_calling = "unknown";
        const structured_output = isChat ? "supported" : "unknown";
        return {
          chat,
          reasoning,
          coding,
          vision,
          tool_calling,
          structured_output
        };
      }
      classifyGemini(raw) {
        const id = raw.id.toLowerCase();
        if (id.includes("imagen")) {
          return {
            chat: "unsupported",
            reasoning: "unsupported",
            coding: "unsupported",
            vision: "unsupported",
            tool_calling: "unsupported",
            structured_output: "unsupported"
          };
        }
        const isFlashOrPro = id.includes("flash") || id.includes("pro");
        return {
          chat: "supported",
          reasoning: id.includes("2.0-flash-thinking") || id.includes("pro") ? "supported" : "unknown",
          coding: "supported",
          vision: "supported",
          tool_calling: isFlashOrPro ? "supported" : "unknown",
          structured_output: "supported"
        };
      }
      classifyHuggingFace(raw) {
        const id = raw.id.toLowerCase();
        const isVision = id.includes("-vl") || id.includes("vision") || id.includes("glm-4.5v") || id.includes("glm-4.6v") || id.includes("aya-vision") || id.includes("command-a-vision") || id.includes("multimodal") || id.includes("internvl") || id.includes("idefics") || id.includes("llava");
        const isCoding = id.includes("code") || id.includes("coder");
        const isReasoning = id.includes("r1") || id.includes("reason") || id.includes("thinking") || id.includes("qwq");
        return {
          chat: "supported",
          reasoning: isReasoning ? "supported" : "unknown",
          coding: isCoding ? "supported" : "unknown",
          vision: isVision ? "supported" : "unsupported",
          tool_calling: "unknown",
          structured_output: "supported"
        };
      }
      classifyCloudflare(raw) {
        const id = raw.id.toLowerCase();
        const isVision = id.includes("vision") || id.includes("llava");
        const isCoding = id.includes("code") || id.includes("coder");
        const isReasoning = id.includes("r1") || id.includes("reason");
        return {
          chat: "supported",
          reasoning: isReasoning ? "supported" : "unknown",
          coding: isCoding ? "supported" : "unknown",
          vision: isVision ? "supported" : "unsupported",
          tool_calling: "unknown",
          structured_output: "supported"
        };
      }
      classifyGeneric(raw) {
        const id = raw.id.toLowerCase();
        const isChat = id.includes("chat") || id.includes("instruct");
        const isVision = id.includes("vision") || id.includes("vlm");
        const isCoding = id.includes("code") || id.includes("coder");
        const isReasoning = id.includes("r1") || id.includes("reason");
        return {
          chat: isChat ? "supported" : "unknown",
          reasoning: isReasoning ? "supported" : "unknown",
          coding: isCoding ? "supported" : "unknown",
          vision: isVision ? "supported" : "unknown",
          tool_calling: "unknown",
          structured_output: isChat ? "supported" : "unknown"
        };
      }
    };
    capabilityClassifier = new CapabilityClassifier();
  }
});

// server/ai/adapters/baseAdapter.ts
async function fetchWithTimeout(url, options, timeoutMs = 25e3) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}
var AdapterError;
var init_baseAdapter = __esm({
  "server/ai/adapters/baseAdapter.ts"() {
    AdapterError = class extends Error {
      constructor(message, provider, statusCode) {
        super(message);
        this.name = "AdapterError";
        this.provider = provider;
        this.statusCode = statusCode;
        this.isRateLimit = statusCode === 429;
      }
    };
  }
});

// server/ai/adapters/cloudflareAdapter.ts
var CLOUDFLARE_BOOTSTRAP_MODELS, CloudflareAdapter;
var init_cloudflareAdapter = __esm({
  "server/ai/adapters/cloudflareAdapter.ts"() {
    init_baseAdapter();
    CLOUDFLARE_BOOTSTRAP_MODELS = [
      {
        id: "@cf/meta/llama-3.2-11b-vision-instruct",
        name: "Cloudflare Llama 3.2 11B Vision Instruct",
        contextLength: 131072,
        capabilities: ["text", "vision", "json"],
        modalities: ["text", "vision", "json"],
        tier: "balanced"
      },
      {
        id: "@cf/meta/llama-3.1-8b-instruct",
        name: "Cloudflare Llama 3.1 8B Instruct",
        contextLength: 131072,
        capabilities: ["text", "json"],
        modalities: ["text", "json"],
        tier: "fast"
      },
      {
        id: "@cf/meta/llama-3.1-70b-instruct",
        name: "Cloudflare Llama 3.1 70B Instruct",
        contextLength: 131072,
        capabilities: ["text", "json", "reasoning"],
        modalities: ["text", "json"],
        tier: "quality"
      },
      {
        id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
        name: "Cloudflare DeepSeek R1 Distill Qwen 32B",
        contextLength: 32768,
        capabilities: ["text", "json", "reasoning"],
        modalities: ["text", "json"],
        tier: "quality"
      }
    ];
    CloudflareAdapter = class {
      constructor() {
        this.name = "cloudflare";
        this.verifyUrl = "https://api.cloudflare.com/client/v4/user/tokens/verify";
      }
      isConfigured() {
        return !!(process.env.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_KEY || process.env.CLOUDFLARE_TOKEN);
      }
      async discoverModels(apiKey) {
        try {
          const res = await fetchWithTimeout(this.verifyUrl, {
            headers: {
              Authorization: `Bearer ${apiKey}`
            }
          }, 1e4);
          if (!res.ok) {
            throw new AdapterError(`Cloudflare token verification failed: ${res.statusText}`, this.name, res.status);
          }
          const json = await res.json();
          if (!json.success) {
            const msg = json.errors?.[0]?.message || "Invalid Cloudflare token";
            throw new AdapterError(msg, this.name, 401);
          }
          const timestamp = (/* @__PURE__ */ new Date()).toISOString();
          return CLOUDFLARE_BOOTSTRAP_MODELS.map((m) => ({
            id: m.id,
            name: m.name,
            provider: this.name,
            inputCost: 0,
            outputCost: 0,
            contextLength: m.contextLength,
            capabilities: m.capabilities,
            isFree: true,
            freeEligibility: "free",
            discoveredTimestamp: timestamp,
            description: `Cloudflare Workers AI: ${m.name}`,
            tier: m.tier,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            modalities: m.modalities,
            supportsStructuredJson: true
          }));
        } catch (err) {
          if (err instanceof AdapterError) throw err;
          throw new AdapterError(err.message || "Cloudflare discovery failed", this.name);
        }
      }
      async generate(request, apiKey, modelId) {
        const startTime = Date.now();
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        if (!accountId) {
          const res = await fetchWithTimeout(this.verifyUrl, {
            headers: { Authorization: `Bearer ${apiKey}` }
          }, 5e3).catch(() => null);
          if (!res || !res.ok) {
            throw new AdapterError("Invalid Cloudflare API token", this.name, 401);
          }
          throw new AdapterError(
            "Cloudflare Workers AI requires CLOUDFLARE_ACCOUNT_ID in environment variables.",
            this.name,
            400
          );
        }
        const runUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`;
        const formattedMessages = this.formatMessages(request.messages);
        const body = {
          messages: formattedMessages,
          max_tokens: request.maxTokens ?? 2048
        };
        try {
          const res = await fetchWithTimeout(runUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          }, 6e4);
          if (!res.ok) {
            const errorText = await res.text().catch(() => "");
            throw new AdapterError(
              `Cloudflare Workers AI error (${res.status}): ${errorText || res.statusText}`,
              this.name,
              res.status
            );
          }
          const json = await res.json();
          const rawContent = json.result?.response || json.result?.description || JSON.stringify(json.result || "");
          const durationMs = Date.now() - startTime;
          let parsedJson = void 0;
          if (request.responseFormat === "json_object" || request.taskType === "structured_json") {
            try {
              parsedJson = JSON.parse(rawContent);
            } catch {
            }
          }
          return {
            content: rawContent,
            parsedJson,
            model: modelId,
            provider: this.name,
            durationMs
          };
        } catch (err) {
          if (err instanceof AdapterError) throw err;
          throw new AdapterError(err.message || "Cloudflare generation failed", this.name);
        }
      }
      formatMessages(messages) {
        return messages.map((m) => {
          if (typeof m.content === "string") {
            return { role: m.role, content: m.content };
          }
          const textParts = m.content.filter((p) => p.type === "text").map((p) => p.text || "").join("\n");
          return { role: m.role, content: textParts };
        });
      }
    };
  }
});

// server/ai/customEndpoint.ts
function getCustomEndpoint() {
  return config;
}
function setCustomEndpoint(next) {
  config = next;
  return config;
}
var config;
var init_customEndpoint = __esm({
  "server/ai/customEndpoint.ts"() {
    config = null;
  }
});

// server/ai/adapters/customEndpointAdapter.ts
var CustomEndpointAdapter;
var init_customEndpointAdapter = __esm({
  "server/ai/adapters/customEndpointAdapter.ts"() {
    init_customEndpoint();
    init_baseAdapter();
    CustomEndpointAdapter = class {
      constructor() {
        this.name = "custom";
      }
      isConfigured() {
        return !!getCustomEndpoint()?.endpoint;
      }
      async discoverModels(apiKey) {
        const current = getCustomEndpoint();
        if (!current) return [];
        const modelsUrl = current.endpoint.replace(/\/chat\/completions\/?$/, "/models");
        try {
          const res = await fetchWithTimeout(modelsUrl, { headers: this.headers(apiKey) }, 15e3);
          if (res.ok) {
            const json = await res.json();
            const models = (json.data || []).map((model) => this.model(model.id, model.name || model.id));
            if (models.length) return models;
          }
        } catch {
        }
        return current.model ? [this.model(current.model, current.model)] : [];
      }
      async generate(request, apiKey, modelId) {
        const current = getCustomEndpoint();
        if (!current) throw new AdapterError("Custom endpoint is not configured", this.name, 400);
        const startTime = Date.now();
        const body = { model: modelId || current.model, messages: request.messages, temperature: request.temperature ?? 0.7, max_tokens: request.maxTokens ?? 2048 };
        if (request.responseFormat === "json_object" || request.taskType === "structured_json") body.response_format = { type: "json_object" };
        try {
          const res = await fetchWithTimeout(current.endpoint, { method: "POST", headers: { ...this.headers(apiKey), "Content-Type": "application/json" }, body: JSON.stringify(body) }, 45e3);
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new AdapterError(`Custom endpoint error (${res.status}): ${json.error?.message || res.statusText}`, this.name, res.status);
          const content = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || json.output_text || "";
          let parsedJson;
          if (request.responseFormat === "json_object" || request.taskType === "structured_json") {
            try {
              parsedJson = JSON.parse(content);
            } catch {
            }
          }
          return { content, parsedJson, model: body.model, provider: this.name, durationMs: Date.now() - startTime };
        } catch (err) {
          if (err instanceof AdapterError) throw err;
          throw new AdapterError(err.message || "Custom endpoint request failed", this.name);
        }
      }
      headers(apiKey) {
        return apiKey && apiKey !== "__custom_endpoint__" ? { Authorization: `Bearer ${apiKey}` } : {};
      }
      model(id, name) {
        const modalities = ["text", "json"];
        return { id, name, provider: this.name, inputCost: 0, outputCost: 0, contextLength: 32768, capabilities: ["text", "json"], modalities, isFree: false, freeEligibility: "eligible_unknown", discoveredTimestamp: (/* @__PURE__ */ new Date()).toISOString(), tier: "balanced", pricing: { prompt: 0, completion: 0, isZeroCost: false }, supportsStructuredJson: true };
      }
    };
  }
});

// server/ai/adapters/huggingfaceAdapter.ts
var KNOWN_VISION_MODEL_PATTERNS, HuggingFaceAdapter;
var init_huggingfaceAdapter = __esm({
  "server/ai/adapters/huggingfaceAdapter.ts"() {
    init_baseAdapter();
    KNOWN_VISION_MODEL_PATTERNS = [
      "vl",
      "vision",
      "glm-4.5v",
      "glm-4.6v",
      "aya-vision",
      "command-a-vision",
      "florence",
      "paligemma",
      "multimodal",
      "internvl",
      "idefics",
      "llava",
      "cogvlm"
    ];
    HuggingFaceAdapter = class {
      constructor() {
        this.name = "huggingface";
        this.baseUrl = "https://router.huggingface.co/v1";
      }
      isConfigured() {
        return !!(process.env.HUGGINGFACE_API_KEY_1 || process.env.HUGGINGFACE_API_KEYS || process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN || process.env.HF_API_KEY);
      }
      /**
       * Discovers models available on the Hugging Face Inference Router.
       * Hugging Face Serverless Inference is free for authenticated users.
       */
      async discoverModels(apiKey) {
        try {
          const res = await fetchWithTimeout(`${this.baseUrl}/models`, {
            headers: {
              Authorization: `Bearer ${apiKey}`
            }
          }, 15e3);
          if (!res.ok) {
            throw new AdapterError(`Failed to fetch Hugging Face models: ${res.statusText}`, this.name, res.status);
          }
          const json = await res.json();
          const rawModels = json.data || [];
          const timestamp = (/* @__PURE__ */ new Date()).toISOString();
          return rawModels.map((m) => {
            const id = m.id;
            const lowerId = id.toLowerCase();
            const capabilities = ["text", "json"];
            const modalities = ["text", "json"];
            const hasVision = KNOWN_VISION_MODEL_PATTERNS.some((pat) => lowerId.includes(pat));
            if (hasVision) {
              capabilities.push("vision");
              modalities.push("vision");
            }
            if (lowerId.includes("r1") || lowerId.includes("reason") || lowerId.includes("thinking") || lowerId.includes("qwq")) {
              capabilities.push("reasoning");
            }
            if (lowerId.includes("code") || lowerId.includes("coder")) {
              capabilities.push("coding");
            }
            let tier = "balanced";
            if (lowerId.includes("flash") || lowerId.includes("tiny") || lowerId.includes("small") || lowerId.includes("3b") || lowerId.includes("4b") || lowerId.includes("7b") || lowerId.includes("8b") || lowerId.includes("9b") || lowerId.includes("11b") || lowerId.includes("12b")) {
              tier = "fast";
            } else if (lowerId.includes("70b") || lowerId.includes("72b") || lowerId.includes("120b") || lowerId.includes("235b") || lowerId.includes("405b") || lowerId.includes("pro") || lowerId.includes("r1") || lowerId.includes("ultra")) {
              tier = "quality";
            }
            return {
              id,
              name: id.split("/").pop() || id,
              provider: this.name,
              inputCost: 0,
              outputCost: 0,
              contextLength: 32768,
              capabilities,
              isFree: true,
              freeEligibility: "free",
              discoveredTimestamp: timestamp,
              description: `Hugging Face Serverless: ${id}`,
              tier,
              pricing: {
                prompt: 0,
                completion: 0,
                isZeroCost: true
              },
              modalities,
              supportsStructuredJson: true
            };
          });
        } catch (err) {
          if (err instanceof AdapterError) throw err;
          throw new AdapterError(err.message || "Hugging Face model discovery failed", this.name);
        }
      }
      async generate(request, apiKey, modelId) {
        const startTime = Date.now();
        const formattedMessages = this.formatMessages(request.messages, request);
        const body = {
          model: modelId,
          messages: formattedMessages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2048
        };
        if (request.responseFormat === "json_object" || request.taskType === "structured_json") {
          body.response_format = { type: "json_object" };
        }
        try {
          const res = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          }, 6e4);
          if (!res.ok) {
            const errorText = await res.text().catch(() => "");
            throw new AdapterError(
              `Hugging Face API error (${res.status}): ${errorText || res.statusText}`,
              this.name,
              res.status
            );
          }
          const json = await res.json();
          const choice = json.choices?.[0];
          const rawContent = choice?.message?.content || "";
          const durationMs = Date.now() - startTime;
          let parsedJson = void 0;
          if (request.responseFormat === "json_object" || request.taskType === "structured_json") {
            try {
              parsedJson = JSON.parse(this.cleanJsonString(rawContent));
            } catch {
              const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
              if (jsonMatch) {
                try {
                  parsedJson = JSON.parse(jsonMatch[1]);
                } catch {
                }
              }
            }
          }
          return {
            content: rawContent,
            parsedJson,
            model: modelId,
            provider: this.name,
            usage: {
              promptTokens: json.usage?.prompt_tokens,
              completionTokens: json.usage?.completion_tokens,
              totalTokens: json.usage?.total_tokens
            },
            durationMs
          };
        } catch (err) {
          if (err instanceof AdapterError) throw err;
          throw new AdapterError(err.message || "Hugging Face generation failed", this.name);
        }
      }
      formatMessages(messages, request) {
        const formatted = messages.map((m) => {
          if (typeof m.content === "string") {
            return { role: m.role, content: m.content };
          }
          const contentParts = m.content.map((part) => {
            if (part.type === "text") {
              return { type: "text", text: part.text || "" };
            }
            if (part.type === "image_url") {
              return {
                type: "image_url",
                image_url: { url: part.image_url?.url || "" }
              };
            }
            return part;
          });
          return { role: m.role, content: contentParts };
        });
        if (request.taskType === "structured_json" && request.jsonSchema) {
          const schemaInstruction = `
You MUST output your response strictly as valid JSON adhering to this schema:
${JSON.stringify(request.jsonSchema, null, 2)}`;
          const sysIndex = formatted.findIndex((m) => m.role === "system");
          if (sysIndex >= 0) {
            formatted[sysIndex].content = `${formatted[sysIndex].content}
${schemaInstruction}`;
          } else {
            formatted.unshift({ role: "system", content: schemaInstruction });
          }
        }
        return formatted;
      }
      cleanJsonString(str) {
        return str.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      }
    };
  }
});

// server/ai/adapters/nimAdapter.ts
var KNOWN_FREE_NIM_MODEL_IDS, NvidiaNimAdapter;
var init_nimAdapter = __esm({
  "server/ai/adapters/nimAdapter.ts"() {
    init_baseAdapter();
    KNOWN_FREE_NIM_MODEL_IDS = /* @__PURE__ */ new Set([
      "meta/llama-3.2-11b-vision-instruct",
      "meta/llama-3.2-90b-vision-instruct",
      "meta/llama-3.1-8b-instruct",
      "meta/llama-3.1-70b-instruct",
      "meta/llama-3.1-405b-instruct",
      "mistralai/mistral-7b-instruct-v0.3",
      "mistralai/mixtral-8x7b-instruct-v0.1",
      "mistralai/mixtral-8x22b-instruct-v0.1",
      "nvidia/nemotron-4-340b-instruct",
      "nvidia/llama-3.1-nemotron-70b-instruct",
      "google/gemma-2-9b-it",
      "google/gemma-2-27b-it",
      "microsoft/phi-3-mini-128k-instruct",
      "microsoft/phi-3-medium-128k-instruct"
    ]);
    NvidiaNimAdapter = class {
      constructor() {
        this.name = "nim";
        this.baseUrl = "https://integrate.api.nvidia.com/v1";
      }
      isConfigured() {
        return !!(process.env.NVIDIA_NIM_API_KEY_1 || process.env.NVIDIA_NIM_API_KEYS || process.env.NVIDIA_API_KEY);
      }
      /**
       * Automatic model discovery for NVIDIA NIM.
       * If pricing metadata cannot be determined programmatically from the API,
       * models are marked as 'eligible_unknown' (isFree: false) to prevent assuming all NIM models are free.
       */
      async discoverModels(apiKey) {
        try {
          const res = await fetchWithTimeout(`${this.baseUrl}/models`, {
            headers: {
              Authorization: `Bearer ${apiKey}`
            }
          }, 15e3);
          if (!res.ok) {
            throw new AdapterError(`Failed to fetch NVIDIA NIM models: ${res.statusText}`, this.name, res.status);
          }
          const json = await res.json();
          const rawModels = json.data || [];
          const timestamp = (/* @__PURE__ */ new Date()).toISOString();
          return rawModels.map((m) => {
            const id = m.id;
            const lowerId = id.toLowerCase();
            let inputCost = -1;
            let outputCost = -1;
            let isFree = false;
            let freeEligibility = "eligible_unknown";
            if (m.pricing) {
              inputCost = parseFloat(m.pricing.prompt ?? "-1");
              outputCost = parseFloat(m.pricing.completion ?? "-1");
              if (inputCost === 0 && outputCost === 0) {
                isFree = true;
                freeEligibility = "free";
              } else if (inputCost > 0 || outputCost > 0) {
                isFree = false;
                freeEligibility = "paid";
              }
            } else if (KNOWN_FREE_NIM_MODEL_IDS.has(id)) {
              inputCost = 0;
              outputCost = 0;
              isFree = true;
              freeEligibility = "free";
            } else {
              inputCost = -1;
              outputCost = -1;
              isFree = false;
              freeEligibility = "eligible_unknown";
            }
            const capabilities = ["text", "json"];
            const modalities = ["text", "json"];
            if (lowerId.includes("vision") || lowerId.includes("vlm") || lowerId.includes("multimodal") || lowerId.includes("neva") || lowerId.includes("florence") || lowerId.includes("kosmos")) {
              capabilities.push("vision");
              modalities.push("vision");
            }
            if (lowerId.includes("r1") || lowerId.includes("reason") || lowerId.includes("instruct")) {
              capabilities.push("reasoning");
            }
            let tier = "balanced";
            if (lowerId.includes("8b") || lowerId.includes("7b") || lowerId.includes("mini") || lowerId.includes("flash") || lowerId.includes("small") || lowerId.includes("lite") || lowerId.includes("11b") || lowerId.includes("12b")) {
              tier = "fast";
            } else if (lowerId.includes("70b") || lowerId.includes("90b") || lowerId.includes("405b") || lowerId.includes("large") || lowerId.includes("deepseek-r1") || lowerId.includes("llama-3.3-70b")) {
              tier = "quality";
            }
            return {
              id,
              name: id.split("/").pop() || id,
              provider: this.name,
              inputCost,
              outputCost,
              contextLength: 16384,
              capabilities,
              isFree,
              freeEligibility,
              discoveredTimestamp: timestamp,
              description: `NVIDIA NIM Hosted Model: ${id}`,
              tier,
              pricing: {
                prompt: Math.max(0, inputCost),
                completion: Math.max(0, outputCost),
                isZeroCost: isFree
              },
              modalities,
              supportsStructuredJson: true
            };
          });
        } catch (err) {
          if (err instanceof AdapterError) throw err;
          throw new AdapterError(err.message || "NVIDIA NIM model discovery failed", this.name);
        }
      }
      async generate(request, apiKey, modelId) {
        const startTime = Date.now();
        const formattedMessages = this.formatMessages(request.messages, request);
        const body = {
          model: modelId,
          messages: formattedMessages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2048
        };
        if (request.responseFormat === "json_object" || request.taskType === "structured_json") {
          body.response_format = { type: "json_object" };
        }
        try {
          const res = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          }, 6e4);
          if (!res.ok) {
            const errorText = await res.text().catch(() => "");
            throw new AdapterError(
              `NVIDIA NIM API error (${res.status}): ${errorText || res.statusText}`,
              this.name,
              res.status
            );
          }
          const json = await res.json();
          const choice = json.choices?.[0];
          const rawContent = choice?.message?.content || "";
          const durationMs = Date.now() - startTime;
          let parsedJson = void 0;
          if (request.responseFormat === "json_object" || request.taskType === "structured_json") {
            try {
              parsedJson = JSON.parse(this.cleanJsonString(rawContent));
            } catch {
              const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
              if (jsonMatch) {
                try {
                  parsedJson = JSON.parse(jsonMatch[1]);
                } catch {
                }
              }
            }
          }
          return {
            content: rawContent,
            parsedJson,
            model: modelId,
            provider: this.name,
            usage: {
              promptTokens: json.usage?.prompt_tokens,
              completionTokens: json.usage?.completion_tokens,
              totalTokens: json.usage?.total_tokens
            },
            durationMs
          };
        } catch (err) {
          if (err instanceof AdapterError) throw err;
          throw new AdapterError(err.message || "NVIDIA NIM generation failed", this.name);
        }
      }
      formatMessages(messages, request) {
        const formatted = messages.map((m) => {
          if (typeof m.content === "string") {
            return { role: m.role, content: m.content };
          }
          const contentParts = m.content.map((part) => {
            if (part.type === "text") {
              return { type: "text", text: part.text || "" };
            }
            if (part.type === "image_url") {
              return {
                type: "image_url",
                image_url: { url: part.image_url?.url || "" }
              };
            }
            return part;
          });
          return { role: m.role, content: contentParts };
        });
        if (request.taskType === "structured_json" && request.jsonSchema) {
          const schemaInstruction = `
You MUST output your response strictly as valid JSON adhering to this schema:
${JSON.stringify(request.jsonSchema, null, 2)}`;
          const sysIndex = formatted.findIndex((m) => m.role === "system");
          if (sysIndex >= 0) {
            formatted[sysIndex].content = `${formatted[sysIndex].content}
${schemaInstruction}`;
          } else {
            formatted.unshift({ role: "system", content: schemaInstruction });
          }
        }
        return formatted;
      }
      cleanJsonString(str) {
        return str.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      }
    };
  }
});

// server/ai/adapters/openrouterAdapter.ts
var OpenRouterAdapter;
var init_openrouterAdapter = __esm({
  "server/ai/adapters/openrouterAdapter.ts"() {
    init_baseAdapter();
    OpenRouterAdapter = class {
      constructor() {
        this.name = "openrouter";
        this.baseUrl = "https://openrouter.ai/api/v1";
      }
      isConfigured() {
        return !!(process.env.OPENROUTER_API_KEY_1 || process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY);
      }
      /**
       * Fetch live models dynamically from official OpenRouter models API.
       * Free models are determined purely by checking if both input and output pricing are 0.
       */
      async discoverModels(apiKey) {
        try {
          const res = await fetchWithTimeout(`${this.baseUrl}/models`, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "HTTP-Referer": "https://jugaadvisuals.app",
              "X-Title": "JugaadVision AI Toolkit"
            }
          }, 15e3);
          if (!res.ok) {
            throw new AdapterError(`Failed to fetch OpenRouter models: ${res.statusText}`, this.name, res.status);
          }
          const json = await res.json();
          const rawModels = json.data || [];
          const timestamp = (/* @__PURE__ */ new Date()).toISOString();
          return rawModels.map((m) => {
            const inputCost = parseFloat(m.pricing?.prompt ?? "0") || 0;
            const outputCost = parseFloat(m.pricing?.completion ?? "0") || 0;
            const isFree = inputCost === 0 && outputCost === 0;
            const freeEligibility = isFree ? "free" : "paid";
            const capabilities = ["text"];
            const modalities = ["text"];
            const modStr = (m.architecture?.modality || "").toLowerCase();
            const desc = (m.description || "").toLowerCase();
            const lowerId = m.id.toLowerCase();
            const isExplicitNonVision = modStr === "text->text" || modStr === "text->image";
            if (!isExplicitNonVision && (modStr.includes("multimodal") || modStr.includes("image->") || modStr.includes("text+image") || modStr.includes("vision") || lowerId.includes("-vl") || lowerId.includes("vision") || desc.includes("vision model") || desc.includes("visual reasoning"))) {
              capabilities.push("vision");
              modalities.push("vision");
            }
            capabilities.push("json");
            modalities.push("json");
            if (m.supported_parameters?.includes("tools") || m.supported_parameters?.includes("function_calling") || desc.includes("function call")) {
              capabilities.push("tools");
            }
            if (desc.includes("reasoning") || desc.includes("chain-of-thought") || m.id.includes("r1") || m.id.includes("reason")) {
              capabilities.push("reasoning");
            }
            let tier = "balanced";
            if (lowerId.includes("flash") || lowerId.includes("mini") || lowerId.includes("haiku") || lowerId.includes("lite") || lowerId.includes("7b") || lowerId.includes("8b") || lowerId.includes("tiny")) {
              tier = "fast";
            } else if (lowerId.includes("pro") || lowerId.includes("opus") || lowerId.includes("70b") || lowerId.includes("large") || lowerId.includes("r1") || lowerId.includes("405b")) {
              tier = "quality";
            }
            return {
              id: m.id,
              name: m.name || m.id,
              provider: this.name,
              inputCost,
              outputCost,
              contextLength: m.context_length || 8192,
              capabilities,
              isFree,
              freeEligibility,
              discoveredTimestamp: timestamp,
              description: m.description || "",
              tier,
              pricing: {
                prompt: inputCost,
                completion: outputCost,
                isZeroCost: isFree
              },
              modalities,
              supportsStructuredJson: true
            };
          });
        } catch (err) {
          if (err instanceof AdapterError) throw err;
          throw new AdapterError(err.message || "OpenRouter model discovery failed", this.name);
        }
      }
      async generate(request, apiKey, modelId) {
        const startTime = Date.now();
        const formattedMessages = this.formatMessages(request.messages, request);
        const body = {
          model: modelId,
          messages: formattedMessages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2048,
          provider: {
            data_collection: "allow",
            allow_fallbacks: true
          }
        };
        if (request.responseFormat === "json_object" || request.taskType === "structured_json") {
          body.response_format = { type: "json_object" };
        }
        try {
          const res = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "HTTP-Referer": "https://jugaadvisuals.app",
              "X-Title": "JugaadVision AI Toolkit",
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          }, 6e4);
          if (!res.ok) {
            const errorText = await res.text().catch(() => "");
            throw new AdapterError(
              `OpenRouter API error (${res.status}): ${errorText || res.statusText}`,
              this.name,
              res.status
            );
          }
          const json = await res.json();
          const choice = json.choices?.[0];
          const rawContent = choice?.message?.content || "";
          const durationMs = Date.now() - startTime;
          let parsedJson = void 0;
          if (request.responseFormat === "json_object" || request.taskType === "structured_json") {
            try {
              parsedJson = JSON.parse(this.cleanJsonString(rawContent));
            } catch {
              const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
              if (jsonMatch) {
                try {
                  parsedJson = JSON.parse(jsonMatch[1]);
                } catch {
                }
              }
            }
          }
          return {
            content: rawContent,
            parsedJson,
            model: modelId,
            provider: this.name,
            usage: {
              promptTokens: json.usage?.prompt_tokens,
              completionTokens: json.usage?.completion_tokens,
              totalTokens: json.usage?.total_tokens
            },
            durationMs
          };
        } catch (err) {
          if (err instanceof AdapterError) throw err;
          throw new AdapterError(err.message || "OpenRouter generation failed", this.name);
        }
      }
      formatMessages(messages, request) {
        const formatted = messages.map((m) => {
          if (typeof m.content === "string") {
            return { role: m.role, content: m.content };
          }
          const contentParts = m.content.map((part) => {
            if (part.type === "text") {
              return { type: "text", text: part.text || "" };
            }
            if (part.type === "image_url") {
              return {
                type: "image_url",
                image_url: { url: part.image_url?.url || "" }
              };
            }
            return part;
          });
          return { role: m.role, content: contentParts };
        });
        if (request.taskType === "structured_json" && request.jsonSchema) {
          const schemaInstruction = `
You MUST output your response strictly as valid JSON adhering to this schema:
${JSON.stringify(request.jsonSchema, null, 2)}`;
          const sysIndex = formatted.findIndex((m) => m.role === "system");
          if (sysIndex >= 0) {
            formatted[sysIndex].content = `${formatted[sysIndex].content}
${schemaInstruction}`;
          } else {
            formatted.unshift({ role: "system", content: schemaInstruction });
          }
        }
        return formatted;
      }
      cleanJsonString(str) {
        return str.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      }
    };
  }
});

// server/ai/discovery/discoveryService.ts
var ModelDiscoveryService, modelDiscoveryService;
var init_discoveryService = __esm({
  "server/ai/discovery/discoveryService.ts"() {
    init_cloudflareAdapter();
    init_customEndpointAdapter();
    init_huggingfaceAdapter();
    init_nimAdapter();
    init_openrouterAdapter();
    init_keyPool();
    ModelDiscoveryService = class {
      // 1 hour
      constructor() {
        this.adapters = /* @__PURE__ */ new Map();
        this.modelCache = /* @__PURE__ */ new Map();
        this.cacheTtlMs = parseInt(process.env.AI_CACHE_TTL_MS || "3600000", 10);
        this.registerAdapter(new OpenRouterAdapter());
        this.registerAdapter(new NvidiaNimAdapter());
        this.registerAdapter(new HuggingFaceAdapter());
        this.registerAdapter(new CloudflareAdapter());
        this.registerAdapter(new CustomEndpointAdapter());
      }
      registerAdapter(adapter) {
        this.adapters.set(adapter.name, adapter);
      }
      getAdapter(provider) {
        return this.adapters.get(provider);
      }
      getAllAdapters() {
        return Array.from(this.adapters.values());
      }
      /**
       * Get models for a provider or all providers.
       * Leverages in-memory caching.
       * If a refresh fails, gracefully falls back to the last valid cached model list.
       */
      async getDiscoveredModels(provider, forceRefresh = false) {
        const providersToQuery = provider ? [provider] : Array.from(this.adapters.keys());
        const allModels = [];
        for (const p of providersToQuery) {
          const adapter = this.adapters.get(p);
          if (!adapter) continue;
          const cached = this.modelCache.get(p);
          const now = Date.now();
          if (!forceRefresh && cached && now - cached.lastUpdated < this.cacheTtlMs && cached.models.length > 0) {
            allModels.push(...cached.models);
            continue;
          }
          const apiKey = keyPoolManager.getAvailableKey(p);
          if (!apiKey) {
            if (cached && cached.models.length > 0) {
              allModels.push(...cached.models);
            } else {
              const bootstrap = this.getBootstrapModels(p);
              allModels.push(...bootstrap);
            }
            continue;
          }
          try {
            const discovered = await adapter.discoverModels(apiKey);
            if (discovered && discovered.length > 0) {
              this.modelCache.set(p, { models: discovered, lastUpdated: now });
              allModels.push(...discovered);
              console.log(`[ModelDiscovery] Refreshed ${discovered.length} models for ${p}.`);
            } else if (cached && cached.models.length > 0) {
              allModels.push(...cached.models);
            } else {
              const bootstrap = this.getBootstrapModels(p);
              allModels.push(...bootstrap);
            }
          } catch (err) {
            console.warn(`[ModelDiscovery] Refresh failed for ${p}: ${err.message}. Retaining existing cache.`);
            if (cached && cached.models.length > 0) {
              allModels.push(...cached.models);
            } else {
              const bootstrap = this.getBootstrapModels(p);
              this.modelCache.set(p, { models: bootstrap, lastUpdated: now });
              allModels.push(...bootstrap);
            }
          }
        }
        return allModels;
      }
      getBootstrapModels(provider) {
        const timestamp = (/* @__PURE__ */ new Date()).toISOString();
        switch (provider) {
          case "openrouter":
            return [
              {
                id: "meta-llama/llama-3.2-11b-vision-instruct:free",
                name: "Meta Llama 3.2 11B Vision (Free)",
                provider: "openrouter",
                inputCost: 0,
                outputCost: 0,
                contextLength: 131072,
                capabilities: ["text", "vision", "json"],
                modalities: ["text", "vision", "json"],
                isFree: true,
                freeEligibility: "free",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: true },
                supportsStructuredJson: true,
                tier: "balanced"
              },
              {
                id: "qwen/qwen-2.5-vl-72b-instruct:free",
                name: "Qwen 2.5 VL 72B Instruct (Free)",
                provider: "openrouter",
                inputCost: 0,
                outputCost: 0,
                contextLength: 32768,
                capabilities: ["text", "vision", "json"],
                modalities: ["text", "vision", "json"],
                isFree: true,
                freeEligibility: "free",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: true },
                supportsStructuredJson: true,
                tier: "quality"
              },
              {
                id: "google/gemma-2-9b-it:free",
                name: "Google Gemma 2 9B (Free)",
                provider: "openrouter",
                inputCost: 0,
                outputCost: 0,
                contextLength: 8192,
                capabilities: ["text", "json"],
                modalities: ["text", "json"],
                isFree: true,
                freeEligibility: "free",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: true },
                supportsStructuredJson: true,
                tier: "fast"
              }
            ];
          case "nim":
            return [
              {
                id: "meta/llama-3.2-11b-vision-instruct",
                name: "Meta Llama 3.2 11B Vision Instruct",
                provider: "nim",
                inputCost: 0,
                outputCost: 0,
                contextLength: 131072,
                capabilities: ["text", "vision", "json"],
                modalities: ["text", "vision", "json"],
                isFree: true,
                freeEligibility: "free",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: true },
                supportsStructuredJson: true,
                tier: "balanced"
              },
              {
                id: "meta/llama-3.2-90b-vision-instruct",
                name: "Meta Llama 3.2 90B Vision Instruct",
                provider: "nim",
                inputCost: 0,
                outputCost: 0,
                contextLength: 131072,
                capabilities: ["text", "vision", "json"],
                modalities: ["text", "vision", "json"],
                isFree: true,
                freeEligibility: "free",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: true },
                supportsStructuredJson: true,
                tier: "quality"
              },
              {
                id: "meta/llama-3.1-8b-instruct",
                name: "Llama 3.1 8B Instruct",
                provider: "nim",
                inputCost: -1,
                outputCost: -1,
                contextLength: 131072,
                capabilities: ["text", "json"],
                modalities: ["text", "json"],
                isFree: false,
                freeEligibility: "eligible_unknown",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: false },
                supportsStructuredJson: true,
                tier: "fast"
              },
              {
                id: "meta/llama-3.1-70b-instruct",
                name: "Llama 3.1 70B Instruct",
                provider: "nim",
                inputCost: -1,
                outputCost: -1,
                contextLength: 131072,
                capabilities: ["text", "json"],
                modalities: ["text", "json"],
                isFree: false,
                freeEligibility: "eligible_unknown",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: false },
                supportsStructuredJson: true,
                tier: "quality"
              }
            ];
          case "huggingface":
            return [
              {
                id: "Qwen/Qwen2.5-VL-72B-Instruct",
                name: "Qwen 2.5 VL 72B Instruct (Hugging Face)",
                provider: "huggingface",
                inputCost: 0,
                outputCost: 0,
                contextLength: 32768,
                capabilities: ["text", "vision", "json"],
                modalities: ["text", "vision", "json"],
                isFree: true,
                freeEligibility: "free",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: true },
                supportsStructuredJson: true,
                tier: "quality"
              },
              {
                id: "zai-org/GLM-4.6V-Flash",
                name: "GLM 4.6V Flash (Hugging Face)",
                provider: "huggingface",
                inputCost: 0,
                outputCost: 0,
                contextLength: 32768,
                capabilities: ["text", "vision", "json"],
                modalities: ["text", "vision", "json"],
                isFree: true,
                freeEligibility: "free",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: true },
                supportsStructuredJson: true,
                tier: "fast"
              },
              {
                id: "CohereLabs/aya-vision-32b",
                name: "Aya Vision 32B (Hugging Face)",
                provider: "huggingface",
                inputCost: 0,
                outputCost: 0,
                contextLength: 32768,
                capabilities: ["text", "vision", "json"],
                modalities: ["text", "vision", "json"],
                isFree: true,
                freeEligibility: "free",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: true },
                supportsStructuredJson: true,
                tier: "balanced"
              },
              {
                id: "meta-llama/Llama-3.3-70B-Instruct",
                name: "Meta Llama 3.3 70B Instruct (Hugging Face)",
                provider: "huggingface",
                inputCost: 0,
                outputCost: 0,
                contextLength: 131072,
                capabilities: ["text", "json", "reasoning"],
                modalities: ["text", "json"],
                isFree: true,
                freeEligibility: "free",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: true },
                supportsStructuredJson: true,
                tier: "quality"
              }
            ];
          case "cloudflare":
            return [
              {
                id: "@cf/meta/llama-3.2-11b-vision-instruct",
                name: "Meta Llama 3.2 11B Vision (Cloudflare)",
                provider: "cloudflare",
                inputCost: 0,
                outputCost: 0,
                contextLength: 131072,
                capabilities: ["text", "vision", "json"],
                modalities: ["text", "vision", "json"],
                isFree: true,
                freeEligibility: "free",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: true },
                supportsStructuredJson: true,
                tier: "balanced"
              },
              {
                id: "@cf/meta/llama-3.1-8b-instruct",
                name: "Llama 3.1 8B Instruct (Cloudflare)",
                provider: "cloudflare",
                inputCost: 0,
                outputCost: 0,
                contextLength: 131072,
                capabilities: ["text", "json"],
                modalities: ["text", "json"],
                isFree: true,
                freeEligibility: "free",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: true },
                supportsStructuredJson: true,
                tier: "fast"
              }
            ];
          case "custom":
            return [
              {
                id: "custom",
                name: "Custom Endpoint Model",
                provider: "custom",
                inputCost: 0,
                outputCost: 0,
                contextLength: 1048576,
                capabilities: ["text", "vision", "json"],
                modalities: ["text", "vision", "json"],
                isFree: true,
                freeEligibility: "free",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: true },
                supportsStructuredJson: true,
                tier: "fast"
              },
              {
                id: "custom",
                name: "Custom Endpoint Model",
                provider: "custom",
                inputCost: 0,
                outputCost: 0,
                contextLength: 1048576,
                capabilities: ["text", "vision", "json"],
                modalities: ["text", "vision", "json"],
                isFree: true,
                freeEligibility: "free",
                discoveredTimestamp: timestamp,
                pricing: { prompt: 0, completion: 0, isZeroCost: true },
                supportsStructuredJson: true,
                tier: "balanced"
              }
            ];
          default:
            return [];
        }
      }
    };
    modelDiscoveryService = new ModelDiscoveryService();
  }
});

// server/ai/registry/freeModelRegistry.ts
var FreeModelRegistry, freeModelRegistry;
var init_freeModelRegistry = __esm({
  "server/ai/registry/freeModelRegistry.ts"() {
    init_capabilityClassifier();
    init_discoveryService();
    init_keyPool();
    FreeModelRegistry = class {
      constructor() {
        this.models = /* @__PURE__ */ new Map();
        this.refreshPromise = null;
        this.refreshTimer = null;
        this.refreshIntervalMs = parseInt(process.env.REGISTRY_REFRESH_INTERVAL_MS || "3600000", 10);
        // 1 hour default
        this.lastRefreshed = (/* @__PURE__ */ new Date()).toISOString();
        this.hasCompletedRefresh = false;
        this.recentFailures = [];
        // Model health history
        this.modelTelemetry = /* @__PURE__ */ new Map();
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
      async refreshRegistry(force = false) {
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
      async performRefresh(force) {
        const startTime = Date.now();
        const adapters = modelDiscoveryService.getAllAdapters();
        for (const adapter of adapters) {
          const provider = adapter.name;
          try {
            const discovered = await modelDiscoveryService.getDiscoveredModels(provider, force);
            if (discovered && discovered.length > 0) {
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
          } catch (err) {
            console.warn(`[FreeModelRegistry] Failed to refresh [${provider}]: ${err.message}. Retaining previous provider models.`);
            const existingCount = Array.from(this.models.keys()).filter((k) => k.startsWith(`${provider}:`)).length;
            if (existingCount === 0) {
              const bootstrap = modelDiscoveryService.getBootstrapModels(provider);
              for (const b of bootstrap) {
                const globalId = `${provider}:${b.id}`;
                this.models.set(globalId, this.normalizeModel(b, provider));
              }
            }
          }
        }
        this.lastRefreshed = (/* @__PURE__ */ new Date()).toISOString();
        this.hasCompletedRefresh = true;
        console.log(`[FreeModelRegistry] Registry refresh complete in ${Date.now() - startTime}ms. Total models: ${this.models.size}`);
        return this.getAllModels();
      }
      getAllModels() {
        const now = Date.now();
        return Array.from(this.models.values()).map((m) => this.applyLiveTelemetry(m, now));
      }
      /**
       * Indicates whether the catalog should be refreshed before selecting a
       * model. This is intentionally cheap so the router can check it per
       * request without doing network work on the hot path.
       */
      isRefreshDue() {
        return !this.hasCompletedRefresh || Date.now() - Date.parse(this.lastRefreshed) >= this.refreshIntervalMs;
      }
      /**
       * Starts a refresh without making the current request wait for provider
       * discovery. The shared refresh promise prevents duplicate refresh storms.
       */
      refreshInBackground(force = true) {
        if (!this.refreshPromise) {
          void this.refreshRegistry(force).catch((err) => {
            console.warn(`[FreeModelRegistry] Background refresh error: ${err.message}`);
          });
        }
      }
      /**
       * Gives live discovery a small opportunity to finish before routing. If a
       * provider is slow or unavailable, routing continues with the current
       * telemetry-aware catalog while the same refresh continues in the background.
       */
      async waitForFreshCatalog(maxWaitMs = 2500) {
        if (!this.isRefreshDue()) return;
        const refresh = this.refreshRegistry(true).catch((err) => {
          console.warn(`[FreeModelRegistry] Request refresh error: ${err.message}`);
        });
        await Promise.race([
          refresh,
          new Promise((resolve) => setTimeout(resolve, maxWaitMs))
        ]);
      }
      getModel(idOrProviderModelId) {
        const direct = this.models.get(idOrProviderModelId);
        if (direct) return this.applyLiveTelemetry(direct, Date.now());
        for (const m of this.models.values()) {
          if (m.providerModelId === idOrProviderModelId || m.id === idOrProviderModelId) {
            return this.applyLiveTelemetry(m, Date.now());
          }
        }
        return void 0;
      }
      getModelsByProvider(provider) {
        const now = Date.now();
        return Array.from(this.models.values()).filter((m) => m.provider === provider).map((m) => this.applyLiveTelemetry(m, now));
      }
      /**
       * Returns models that are strictly verified free and have the required verified capability.
       */
      getVerifiedFreeModels(taskType, requiredCapability) {
        const all = this.getAllModels();
        const targetCap = requiredCapability || (taskType ? this.mapTaskToCapability(taskType) : void 0);
        return all.filter((m) => {
          if (!m.verifiedFree || m.eligibilityStatus !== "free") return false;
          if (targetCap && m.capabilityMap[targetCap] !== "supported") {
            return false;
          }
          return m.status === "available" || m.status === "degraded";
        });
      }
      /**
       * Live recording of model execution success
       */
      recordModelSuccess(provider, providerModelId, latencyMs) {
        const globalId = `${provider}:${providerModelId}`;
        const entry = this.getOrCreateTelemetry(globalId);
        entry.successCount++;
        entry.totalLatencyMs += latencyMs;
        entry.cooldownUntil = 0;
        entry.lastChecked = (/* @__PURE__ */ new Date()).toISOString();
      }
      /**
       * Live recording of model execution error & rate limit cooldown
       */
      recordModelFailure(provider, providerModelId, error, statusCode) {
        const globalId = `${provider}:${providerModelId}`;
        const entry = this.getOrCreateTelemetry(globalId);
        entry.failureCount++;
        entry.lastChecked = (/* @__PURE__ */ new Date()).toISOString();
        const now = Date.now();
        if (statusCode === 429) {
          entry.cooldownUntil = now + 3e4;
          console.warn(`[FreeModelRegistry] Model ${globalId} hit rate limit (429). In cooldown for 30s.`);
        } else if (statusCode === 404 || statusCode === 401) {
          entry.cooldownUntil = now + 3e5;
        } else {
          entry.cooldownUntil = now + 15e3;
        }
        const sanitizedError = redactSecrets(error || "Unknown error");
        this.recentFailures.unshift({
          id: `fail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          provider,
          modelId: providerModelId,
          error: sanitizedError,
          statusCode
        });
        if (this.recentFailures.length > 30) {
          this.recentFailures.pop();
        }
      }
      getRecentFailures() {
        return [...this.recentFailures];
      }
      clearRecentFailures() {
        this.recentFailures = [];
      }
      clearTelemetry() {
        this.modelTelemetry.clear();
        this.recentFailures = [];
      }
      /**
       * Returns models organized into task categories and grouped by tier (fast / balanced / quality).
       */
      getCategorizedCatalog(preferFree = true) {
        const allModels = this.getAllModels();
        const filtered = preferFree ? allModels.filter((m) => m.verifiedFree === true && m.eligibilityStatus === "free") : allModels;
        const buildTierGroup = (models) => {
          const fast = models.filter((m) => m.tier === "fast");
          const balanced = models.filter((m) => m.tier === "balanced" || !m.tier);
          const quality = models.filter((m) => m.tier === "quality");
          return { fast, balanced, quality };
        };
        const visionModels = filtered.filter(
          (m) => m.capabilityMap.vision === "supported" || m.capabilities.includes("vision") || m.modalities.includes("vision")
        );
        const structuredJsonModels = filtered.filter(
          (m) => m.capabilityMap.structured_output === "supported" || m.supportsStructuredJson || m.capabilities.includes("structured_output")
        );
        const promptEnhanceModels = filtered.filter(
          (m) => m.capabilityMap.chat === "supported" || m.capabilities.includes("chat") || m.capabilities.includes("text")
        );
        const textGenModels = filtered.filter(
          (m) => m.capabilityMap.chat === "supported" || m.capabilities.includes("chat") || m.capabilities.includes("text")
        );
        const reasoningModels = filtered.filter(
          (m) => m.capabilityMap.reasoning === "supported" || m.capabilities.includes("reasoning")
        );
        const codingModels = filtered.filter(
          (m) => m.capabilityMap.coding === "supported" || m.capabilities.includes("coding")
        );
        const imageGenModels = filtered.filter(
          (m) => (
            // Removed image_generation check
            m.capabilities.includes("image")
          )
        );
        return {
          vision: buildTierGroup(visionModels),
          structured_json: buildTierGroup(structuredJsonModels),
          prompt_enhancement: buildTierGroup(promptEnhanceModels),
          text_generation: buildTierGroup(textGenModels),
          reasoning: buildTierGroup(reasoningModels.length > 0 ? reasoningModels : filtered.filter((m) => m.tier === "quality")),
          coding: buildTierGroup(codingModels.length > 0 ? codingModels : filtered)
          // Removed image generation tier group
        };
      }
      getRegistryStats() {
        const models = this.getAllModels();
        const capsCount = {
          chat: 0,
          reasoning: 0,
          coding: 0,
          vision: 0,
          tool_calling: 0,
          structured_output: 0
        };
        let visionModelsCount = 0;
        const stats = {
          totalModels: models.length,
          verifiedFreeModels: 0,
          eligibleUnknownModels: 0,
          paidModels: 0,
          visionModels: 0,
          capabilitiesCount: capsCount,
          byProvider: {},
          lastRefreshed: this.lastRefreshed
        };
        for (const m of models) {
          if (m.verifiedFree) stats.verifiedFreeModels++;
          if (m.eligibilityStatus === "eligible_unknown") stats.eligibleUnknownModels++;
          if (m.eligibilityStatus === "paid") stats.paidModels++;
          if (m.capabilityMap.vision === "supported" || m.capabilities.includes("vision") || m.modalities.includes("vision")) {
            visionModelsCount++;
          }
          for (const cap of m.capabilities) {
            if (stats.capabilitiesCount[cap] !== void 0) {
              stats.capabilitiesCount[cap]++;
            }
          }
          if (!stats.byProvider[m.provider]) {
            stats.byProvider[m.provider] = {
              total: 0,
              verifiedFree: 0,
              available: 0,
              inCooldown: 0
            };
          }
          const pStat = stats.byProvider[m.provider];
          pStat.total++;
          if (m.verifiedFree) pStat.verifiedFree++;
          if (m.status === "available") pStat.available++;
          if (m.status === "cooldown") pStat.inCooldown++;
        }
        stats.visionModels = visionModelsCount;
        return stats;
      }
      setRefreshInterval(intervalMs) {
        this.refreshIntervalMs = intervalMs;
        this.startPeriodicRefresh(intervalMs);
      }
      startPeriodicRefresh(intervalMs) {
        if (process.env.VERCEL === "1") return;
        this.stopPeriodicRefresh();
        this.refreshIntervalMs = intervalMs;
        this.refreshTimer = setInterval(() => {
          this.refreshRegistry(true).catch((err) => {
            console.warn("[FreeModelRegistry] Periodic refresh error:", err?.message || err);
          });
        }, this.refreshIntervalMs);
        if (this.refreshTimer && typeof this.refreshTimer.unref === "function") {
          this.refreshTimer.unref();
        }
      }
      stopPeriodicRefresh() {
        if (this.refreshTimer) {
          clearInterval(this.refreshTimer);
          this.refreshTimer = null;
        }
      }
      normalizeModel(rawModel, provider) {
        const providerModelId = rawModel.providerModelId || rawModel.id;
        const globalId = `${provider}:${providerModelId}`;
        const inputCost = typeof rawModel.inputCost === "number" ? rawModel.inputCost : rawModel.pricing?.prompt ?? -1;
        const outputCost = typeof rawModel.outputCost === "number" ? rawModel.outputCost : rawModel.pricing?.completion ?? -1;
        const verifiedFree = rawModel.verifiedFree ?? (inputCost === 0 && outputCost === 0 && rawModel.freeEligibility !== "eligible_unknown" && rawModel.freeEligibility !== "paid");
        const eligibilityStatus = rawModel.eligibilityStatus || rawModel.freeEligibility || (verifiedFree ? "free" : inputCost < 0 || outputCost < 0 ? "eligible_unknown" : "paid");
        const contextWindow = rawModel.contextWindow || rawModel.contextLength || 8192;
        const tier = rawModel.tier || "balanced";
        const capabilityMap = capabilityClassifier.classify({
          id: providerModelId,
          name: rawModel.name,
          description: rawModel.description,
          provider,
          architecture: rawModel.architecture,
          supported_parameters: rawModel.supported_parameters,
          supportedGenerationMethods: rawModel.supportedGenerationMethods
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
          status: "available",
          successRate: 1,
          averageLatency: 0,
          failureCount: 0,
          lastChecked: rawModel.discoveredTimestamp || (/* @__PURE__ */ new Date()).toISOString(),
          cooldownUntil: 0,
          // Compatibility aliases
          isFree: verifiedFree,
          contextLength: contextWindow,
          freeEligibility: eligibilityStatus,
          tier,
          pricing: {
            prompt: Math.max(0, inputCost),
            completion: Math.max(0, outputCost),
            isZeroCost: verifiedFree
          },
          modalities: rawModel.modalities || ["text"],
          supportsStructuredJson: capabilityMap.structured_output === "supported",
          description: rawModel.description,
          inputCost,
          outputCost,
          discoveredTimestamp: rawModel.discoveredTimestamp || (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      mapTaskToCapability(taskType) {
        switch (taskType) {
          case "vision":
          case "image_analysis":
          case "advanced_image_analysis":
            return "vision";
          case "structured_json":
            return "structured_output";
          // image_generation case removed
          case "coding":
            return "coding";
          case "reasoning":
            return "reasoning";
          case "prompt_enhancement":
          case "text_generation":
          default:
            return "chat";
        }
      }
      applyLiveTelemetry(model, now) {
        const globalId = model.id;
        const telemetry = this.modelTelemetry.get(globalId);
        if (!telemetry) {
          return { ...model };
        }
        const totalReqs = telemetry.successCount + telemetry.failureCount;
        const successRate = totalReqs > 0 ? telemetry.successCount / totalReqs : 1;
        const averageLatency = telemetry.successCount > 0 ? Math.round(telemetry.totalLatencyMs / telemetry.successCount) : 0;
        let status = "available";
        if (telemetry.cooldownUntil > now) {
          status = "cooldown";
        } else if (telemetry.failureCount >= 3 && successRate < 0.5) {
          status = "degraded";
        }
        return {
          ...model,
          status,
          successRate,
          averageLatency,
          failureCount: telemetry.failureCount,
          cooldownUntil: telemetry.cooldownUntil,
          lastChecked: telemetry.lastChecked || model.lastChecked
        };
      }
      getOrCreateTelemetry(globalId) {
        let entry = this.modelTelemetry.get(globalId);
        if (!entry) {
          entry = {
            successCount: 0,
            failureCount: 0,
            totalLatencyMs: 0,
            cooldownUntil: 0,
            lastChecked: (/* @__PURE__ */ new Date()).toISOString()
          };
          this.modelTelemetry.set(globalId, entry);
        }
        return entry;
      }
    };
    freeModelRegistry = new FreeModelRegistry();
  }
});

// server/ai/filtering/freeFilter.ts
var ModelFilterService, modelFilterService;
var init_freeFilter = __esm({
  "server/ai/filtering/freeFilter.ts"() {
    ModelFilterService = class {
      /**
       * Filter and rank models for a task.
       * Strictly verifies that the required capability is 'supported' (never guesses unknown/unsupported).
       * By default, only routes to verified free models (verifiedFree: true).
       */
      filterAndRankModels(models, criteria) {
        const requiredCap = criteria.requiredCapability || this.getRequiredCapabilityForTask(criteria.taskType);
        const preferFree = criteria.preferFree !== void 0 ? criteria.preferFree : true;
        let candidates = models.filter((m) => {
          if (m.capabilityMap[requiredCap] !== "supported") {
            return false;
          }
          if (criteria.minContextLength && m.contextWindow < criteria.minContextLength) {
            return false;
          }
          if (criteria.taskType === "structured_json" && m.capabilityMap.structured_output !== "supported") {
            return false;
          }
          return true;
        });
        if (preferFree) {
          const verifiedFree = candidates.filter((m) => m.verifiedFree && m.eligibilityStatus === "free");
          if (verifiedFree.length > 0) {
            candidates = verifiedFree;
          } else if (criteria.allowEligibleUnknown) {
            const unknownEligible = candidates.filter((m) => m.eligibilityStatus === "eligible_unknown");
            if (unknownEligible.length > 0) {
              candidates = unknownEligible;
            }
          }
        }
        return candidates.sort((a, b) => {
          const scoreA = this.calculateModelScore(a, criteria, requiredCap);
          const scoreB = this.calculateModelScore(b, criteria, requiredCap);
          return scoreB - scoreA;
        });
      }
      getVerifiedFreeModels(models, capability) {
        return models.filter((m) => {
          if (!m.verifiedFree || m.eligibilityStatus !== "free") return false;
          if (capability && m.capabilityMap[capability] !== "supported") return false;
          return true;
        });
      }
      getRequiredCapabilityForTask(taskType) {
        switch (taskType) {
          case "vision":
          case "image_analysis":
          case "advanced_image_analysis":
            return "vision";
          case "structured_json":
            return "structured_output";
          case "coding":
            return "coding";
          case "reasoning":
            return "reasoning";
          case "prompt_enhancement":
          case "text_generation":
          default:
            return "chat";
        }
      }
      calculateModelScore(model, criteria, requiredCap) {
        let score = 50;
        if (model.verifiedFree && model.eligibilityStatus === "free") {
          score += 40;
        } else if (model.eligibilityStatus === "eligible_unknown") {
          score += 10;
        }
        if (requiredCap === "chat" && model.capabilityMap.reasoning === "supported") {
          score += 15;
        }
        if (requiredCap === "structured_output" && model.capabilityMap.coding === "supported") {
          score += 10;
        }
        const targetTier = criteria.tierPreference || this.getDefaultTierForTask(criteria.taskType);
        if (model.tier === targetTier) {
          score += 20;
        }
        if (model.contextWindow >= 32768) {
          score += 10;
        }
        const lowerId = model.id.toLowerCase();
        if (lowerId.includes("llama-3.3") || lowerId.includes("gemini-2.0") || lowerId.includes("qwen") || lowerId.includes("nemotron")) {
          score += 15;
        }
        return score;
      }
      getDefaultTierForTask(taskType) {
        switch (taskType) {
          case "prompt_enhancement":
            return "fast";
          case "structured_json":
            return "balanced";
          case "vision":
            return "balanced";
          case "text_generation":
          default:
            return "fast";
        }
      }
    };
    modelFilterService = new ModelFilterService();
  }
});

// server/ai/scoring/modelScoringEngine.ts
var DEFAULT_SCORING_WEIGHTS, ModelScoringEngine, modelScoringEngine;
var init_modelScoringEngine = __esm({
  "server/ai/scoring/modelScoringEngine.ts"() {
    DEFAULT_SCORING_WEIGHTS = {
      verifiedFreeBonus: 50,
      capabilityMatchWeight: 35,
      tierAlignmentWeight: 40,
      tierMismatchPenalty: 20,
      healthScoreWeight: 25,
      successRateWeight: 30,
      latencyBonusWeight: 20,
      failurePenaltyWeight: 15,
      contextWindowBonus: 10
    };
    ModelScoringEngine = class {
      constructor() {
        this.defaultWeights = { ...DEFAULT_SCORING_WEIGHTS };
      }
      setWeights(weights) {
        this.defaultWeights = { ...this.defaultWeights, ...weights };
      }
      getWeights() {
        return { ...this.defaultWeights };
      }
      /**
       * Scores a model dynamically for a specific request.
       * Simple tasks prioritize lightweight ('fast') models.
       * Complex tasks prioritize high-capacity ('quality') models.
       */
      scoreModel(model, request) {
        const weights = {
          ...this.defaultWeights,
          ...request.scoringWeightsOverride || {}
        };
        let score = 100;
        if (model.verifiedFree && model.eligibilityStatus === "free") {
          score += weights.verifiedFreeBonus;
        } else if (model.eligibilityStatus === "eligible_unknown") {
          score += Math.round(weights.verifiedFreeBonus * 0.2);
        }
        const targetTier = this.getTargetTierForTask(request.taskType, request.preferredQuality);
        if (model.tier === targetTier) {
          score += weights.tierAlignmentWeight;
        } else if (targetTier === "fast" && model.tier === "quality") {
          score -= weights.tierMismatchPenalty;
        } else if (targetTier === "quality" && model.tier === "fast") {
          score -= weights.tierMismatchPenalty;
        }
        const requiredCap = this.getPrimaryCapabilityForTask(request.taskType);
        if (model.capabilityMap[requiredCap] === "supported") {
          score += weights.capabilityMatchWeight;
        }
        if (request.taskType === "reasoning" && model.capabilityMap.reasoning === "supported") {
          score += 25;
        }
        if (request.taskType === "coding" && model.capabilityMap.coding === "supported") {
          score += 25;
        }
        if (request.taskType === "advanced_image_analysis" && model.capabilityMap.vision === "supported") {
          score += 20;
        }
        if (model.status === "available") {
          score += weights.healthScoreWeight;
        } else if (model.status === "degraded") {
          score -= Math.round(weights.healthScoreWeight * 0.5);
        }
        score += Math.round(model.successRate * weights.successRateWeight);
        if (model.failureCount > 0) {
          score -= Math.min(45, model.failureCount * weights.failurePenaltyWeight);
        }
        if (model.averageLatency > 0) {
          if (model.averageLatency < 1200) {
            score += weights.latencyBonusWeight;
          } else if (model.averageLatency > 5e3) {
            score -= weights.latencyBonusWeight;
          }
        }
        if (request.speedPreference === "fastest" && model.tier === "fast") {
          score += 20;
        }
        if (model.contextWindow >= 65536) {
          score += weights.contextWindowBonus;
        }
        if (request.preferredProvider && model.provider === request.preferredProvider) {
          score += 40;
        }
        if (request.preferredModel && (model.providerModelId === request.preferredModel || model.id === request.preferredModel)) {
          score += 60;
        }
        return score;
      }
      /**
       * Identifies the optimal model tier for a given task type.
       * Simple tasks -> 'fast' (lightweight)
       * Complex tasks -> 'quality' (stronger)
       * Balanced / default -> 'balanced'
       */
      getTargetTierForTask(taskType, qualityPref) {
        if (qualityPref === "high") return "quality";
        if (qualityPref === "speed") return "fast";
        switch (taskType) {
          // Simple Tasks -> Lightweight ('fast')
          case "rewriting":
          case "captions":
          case "prompt_formatting":
          case "extracting_structured_information":
          case "simple_creative_suggestions":
          case "prompt_enhancement":
          case "text_generation":
            return "fast";
          // Complex Tasks -> Heavyweight / Stronger ('quality')
          case "complex_reasoning":
          case "reasoning":
          case "coding":
          case "advanced_image_analysis":
          case "multi_step_tasks":
            return "quality";
          // Intermediate / Balanced
          case "creative_prompt":
          case "chat":
          case "vision":
          case "image_analysis":
          case "structured_json":
          default:
            return "balanced";
        }
      }
      getPrimaryCapabilityForTask(taskType) {
        switch (taskType) {
          case "vision":
          case "image_analysis":
          case "advanced_image_analysis":
            return "vision";
          case "coding":
            return "coding";
          case "reasoning":
            return "reasoning";
          case "structured_json":
          case "extracting_structured_information":
            return "structured_output";
          case "rewriting":
          case "captions":
          case "prompt_formatting":
          case "simple_creative_suggestions":
          case "creative_prompt":
          case "chat":
          case "text_generation":
          case "prompt_enhancement":
          case "multi_step_tasks":
          default:
            return "chat";
        }
      }
    };
    modelScoringEngine = new ModelScoringEngine();
  }
});

// server/ai/router/router.ts
var AIRouter, aiRouter;
var init_router = __esm({
  "server/ai/router/router.ts"() {
    init_baseAdapter();
    init_discoveryService();
    init_modelHealthManager();
    init_keyPool();
    init_freeModelRegistry();
    init_modelScoringEngine();
    AIRouter = class {
      constructor() {
        this.inFlightRequests = /* @__PURE__ */ new Map();
        this.defaultMaxFallbackAttempts = 6;
      }
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
      async execute(request) {
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
      async performRouting(request) {
        if (freeModelRegistry.isRefreshDue()) {
          await freeModelRegistry.waitForFreshCatalog();
        }
        let allModels = freeModelRegistry.getAllModels();
        if (allModels.length === 0) {
          allModels = await freeModelRegistry.refreshRegistry();
        }
        const now = Date.now();
        const preferFree = request.preferFree !== false;
        const requiredCaps = this.getRequiredCapabilities(request);
        const errors = [];
        let candidates = allModels.filter((m) => {
          if (preferFree && m.provider !== "custom" && !(m.verifiedFree === true && m.eligibilityStatus === "free")) {
            return false;
          }
          return true;
        });
        candidates = candidates.filter((m) => {
          if (m.status === "disabled") return false;
          return modelHealthManager.isModelAvailable(m.provider, m.providerModelId);
        });
        candidates = candidates.filter((m) => {
          if (m.cooldownUntil > now || m.status === "cooldown") {
            return false;
          }
          return true;
        });
        candidates = candidates.filter((m) => {
          for (const cap of requiredCaps) {
            if (m.capabilityMap[cap] !== "supported") {
              return false;
            }
          }
          if (request.taskType === "structured_json" && m.capabilityMap.structured_output !== "supported") {
            return false;
          }
          return true;
        });
        if (candidates.length === 0) {
          candidates = allModels.filter((m) => {
            if (preferFree && m.provider !== "custom" && !(m.verifiedFree === true && m.eligibilityStatus === "free") && m.eligibilityStatus !== "eligible_unknown") return false;
            for (const cap of requiredCaps) {
              if (m.capabilityMap[cap] !== "supported") return false;
            }
            if (m.status === "disabled") return false;
            if (m.cooldownUntil > now) return false;
            return true;
          });
        }
        if (candidates.length === 0) {
          const emergencyRes2 = await this.emergencyFallback(request, errors);
          if (emergencyRes2) {
            return emergencyRes2;
          }
          if (preferFree) {
            throw new Error(
              `No verified free AI models are available for task "${request.taskType}" with required capabilities: [${requiredCaps.join(", ")}]. Please configure API keys in Settings or allow paid models.`
            );
          }
          throw new Error(`No available AI models found matching task type: ${request.taskType} with required capabilities: [${requiredCaps.join(", ")}]`);
        }
        if (request.preferredModel) {
          const preferredModelCandidates = candidates.filter(
            (model) => model.providerModelId === request.preferredModel || model.id === request.preferredModel || `${model.provider}:${model.providerModelId}` === request.preferredModel
          );
          if (preferredModelCandidates.length > 0) {
            const preferredSet = new Set(preferredModelCandidates);
            candidates = [...preferredModelCandidates, ...candidates.filter((model) => !preferredSet.has(model))];
          }
        } else if (request.preferredProvider) {
          const providerCandidates = candidates.filter((model) => model.provider === request.preferredProvider);
          if (providerCandidates.length > 0) {
            const providerSet = new Set(providerCandidates);
            candidates = [...providerCandidates, ...candidates.filter((model) => !providerSet.has(model))];
          }
        }
        const scoredCandidates = [...candidates].sort((a, b) => {
          if (request.preferredModel) {
            const isPreferred = (model) => model.providerModelId === request.preferredModel || model.id === request.preferredModel || `${model.provider}:${model.providerModelId}` === request.preferredModel;
            if (isPreferred(a) !== isPreferred(b)) return isPreferred(a) ? -1 : 1;
          } else if (request.preferredProvider && a.provider === request.preferredProvider !== (b.provider === request.preferredProvider)) {
            return a.provider === request.preferredProvider ? -1 : 1;
          }
          const scoreA = modelScoringEngine.scoreModel(a, request);
          const scoreB = modelScoringEngine.scoreModel(b, request);
          return scoreB - scoreA;
        });
        const maxAttempts = request.maxFallbackAttempts || this.defaultMaxFallbackAttempts;
        let attemptsCount = 0;
        const unavailableProviders = /* @__PURE__ */ new Set();
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
          const attemptedKeys = [];
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
              const response = await adapter.generate(request, apiKey, candidate.providerModelId);
              const duration = Date.now() - startTime;
              keyPoolManager.reportSuccess(candidate.provider, apiKey, duration);
              modelHealthManager.recordModelSuccess(candidate.provider, candidate.providerModelId, duration);
              modelHealthManager.recordKeySuccess(candidate.provider, apiKey, duration);
              freeModelRegistry.recordModelSuccess(candidate.provider, candidate.providerModelId, duration);
              return {
                content: response.content,
                parsedJson: response.parsedJson,
                model: response.model,
                provider: response.provider,
                taskType: request.taskType,
                usage: response.usage,
                durationMs: response.durationMs,
                fallbackCount: attemptsCount - 1
              };
            } catch (err) {
              const statusCode = err instanceof AdapterError ? err.statusCode : void 0;
              const errMsg = err.message || "Unknown provider error";
              keyPoolManager.reportError(candidate.provider, apiKey, statusCode, errMsg);
              modelHealthManager.recordModelFailure(candidate.provider, candidate.providerModelId, errMsg, statusCode);
              modelHealthManager.recordKeyFailure(candidate.provider, apiKey, errMsg, statusCode);
              freeModelRegistry.recordModelFailure(candidate.provider, candidate.providerModelId, errMsg, statusCode);
              errors.push({
                provider: candidate.provider,
                model: candidate.providerModelId,
                error: errMsg,
                status: statusCode
              });
              const isAuthFailure = statusCode === 401 || statusCode === 403 || statusCode === 400 && (errMsg.includes("API key") || errMsg.includes("API_KEY_INVALID") || errMsg.includes("INVALID_ARGUMENT"));
              const isModelGone = statusCode === 404;
              const isTimeout = errMsg.toLowerCase().includes("timeout") || errMsg.toLowerCase().includes("timed out");
              if (isAuthFailure) {
                unavailableProviders.add(candidate.provider);
                console.warn(`[AIRouter] Auth failure for ${candidate.provider} \u2014 skipping provider entirely.`);
                break;
              }
              if (isModelGone) {
                console.warn(`[AIRouter] Model ${candidate.providerModelId} not found (404) \u2014 skipping model.`);
                break;
              }
              if (isTimeout) {
                console.warn(`[AIRouter] Model ${candidate.providerModelId} timed out \u2014 skipping model.`);
                break;
              }
              console.warn(`[AIRouter] Candidate ${candidate.providerModelId} on ${candidate.provider} failed: ${errMsg}. Trying next candidate (Attempt ${attemptsCount}/${maxAttempts})...`);
            }
          }
        }
        const emergencyRes = await this.emergencyFallback(request, errors);
        if (emergencyRes) {
          return emergencyRes;
        }
        const summary = redactSecrets(errors.map((e) => `[${e.provider}:${e.model}] ${e.error}`).join("; "));
        throw new Error(`All AI fallback candidates failed (${attemptsCount} attempts). Details: ${summary || "No healthy providers available"}`);
      }
      getRequiredCapabilities(request) {
        if (request.requiredCapabilities && request.requiredCapabilities.length > 0) {
          return request.requiredCapabilities;
        }
        return [modelScoringEngine.getPrimaryCapabilityForTask(request.taskType)];
      }
      generateRequestFingerprint(request) {
        if (request.requestId) return request.requestId;
        const bodyStr = JSON.stringify({
          taskType: request.taskType,
          messages: request.messages,
          temp: request.temperature,
          model: request.preferredModel,
          provider: request.preferredProvider
        });
        return `${request.taskType}_${this.simpleHash(bodyStr)}`;
      }
      simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          hash = (hash << 5) - hash + str.charCodeAt(i);
          hash |= 0;
        }
        return Math.abs(hash).toString(36);
      }
      async emergencyFallback(request, previousErrors) {
        const requiredCaps = this.getRequiredCapabilities(request);
        const isVision = request.taskType === "vision" || request.taskType === "advanced_image_analysis" || request.taskType === "image_analysis" || requiredCaps.includes("vision") || request.requiredCapabilities?.includes("vision");
        const providers = ["custom", "nim", "openrouter"];
        for (const p of providers) {
          const adapter = modelDiscoveryService.getAdapter(p);
          if (!adapter) continue;
          const apiKey = keyPoolManager.getAvailableKey(p);
          if (!apiKey) continue;
          let bootstrapModels = modelDiscoveryService.getBootstrapModels(p);
          if (isVision) {
            bootstrapModels = bootstrapModels.filter((m) => m.capabilities.includes("vision") || m.modalities.includes("vision"));
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
                fallbackCount: previousErrors.length
              };
            } catch (err) {
              previousErrors.push({
                provider: p,
                model: model.id,
                error: err.message
              });
            }
          }
        }
        return null;
      }
    };
    aiRouter = new AIRouter();
  }
});

// server/ai/security.ts
function isSSRFSafeUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") {
    return { safe: false, reason: "Empty or invalid URL string" };
  }
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { safe: false, reason: "Malformed URL format" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `Forbidden protocol: ${parsed.protocol}. Only http and https are allowed.` };
  }
  const hostname = parsed.hostname.toLowerCase().trim();
  if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "metadata.google.internal" || hostname.endsWith(".localhost") || hostname.endsWith(".internal") || hostname.endsWith(".local")) {
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev && (hostname === "localhost" || hostname === "127.0.0.1")) {
      return { safe: true };
    }
    return { safe: false, reason: "Restricted host: loopback or internal hostname." };
  }
  if (hostname.startsWith("169.254.")) {
    return { safe: false, reason: "Cloud instance metadata endpoints (169.254.x.x) are strictly prohibited." };
  }
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  if (match) {
    const oct1 = parseInt(match[1], 10);
    const oct2 = parseInt(match[2], 10);
    if (oct1 === 10) {
      return { safe: false, reason: "Private network addresses (10.0.0.0/8) are prohibited." };
    }
    if (oct1 === 172 && oct2 >= 16 && oct2 <= 31) {
      return { safe: false, reason: "Private network addresses (172.16.0.0/12) are prohibited." };
    }
    if (oct1 === 192 && oct2 === 168) {
      return { safe: false, reason: "Private network addresses (192.168.0.0/16) are prohibited." };
    }
    if (oct1 === 0) {
      return { safe: false, reason: "Invalid address 0.0.0.0." };
    }
  }
  return { safe: true };
}
function sanitizeInput(input, maxLength = 5e4) {
  if (!input || typeof input !== "string") return "";
  return input.slice(0, maxLength).replace(/\0/g, "").replace(/[\u202A-\u202E\u2066-\u2069]/g, "").trim();
}
function sanitizeAndRedactSecrets(text) {
  if (!text || typeof text !== "string") return "";
  return text.replace(/sk-or-v1-[a-zA-Z0-9_\-]{16,}/gi, "sk-or-v1-[REDACTED]").replace(/sk-[a-zA-Z0-9_\-]{20,}/gi, "sk-[REDACTED]").replace(/nvapi-[a-zA-Z0-9_\-]{16,}/gi, "nvapi-[REDACTED]").replace(/hf_[a-zA-Z0-9_\-]{16,}/gi, "hf_[REDACTED]").replace(/cfut_[a-zA-Z0-9_\-]{16,}/gi, "cfut_[REDACTED]").replace(/PCH4k[a-zA-Z0-9]{15,}/gi, "[REDACTED_REMOVEBG_KEY]").replace(/Bearer\s+[a-zA-Z0-9_\-\.]{8,}/gi, "Bearer [REDACTED]").replace(/((?:api_?key|auth_?token|secret_?key|password|access_?token)\s*[:=]\s*)[a-zA-Z0-9_\-\.]{8,}/gi, "$1[REDACTED]").replace(/(?:key|token|auth)=([a-zA-Z0-9_-]{24,})/gi, "token=[REDACTED]");
}
var InMemoryRateLimiter, generalRateLimiter, aiGenerationRateLimiter, SECURITY_HEADERS;
var init_security = __esm({
  "server/ai/security.ts"() {
    InMemoryRateLimiter = class {
      constructor(windowMs = 6e4, maxRequests = 60) {
        this.records = /* @__PURE__ */ new Map();
        this.lastCleanup = Date.now();
        this.windowMs = windowMs;
        this.maxRequests = maxRequests;
      }
      check(clientIp, customLimit) {
        const now = Date.now();
        this.periodicCleanup(now);
        const limit = customLimit ?? this.maxRequests;
        const ip = clientIp || "127.0.0.1";
        let record = this.records.get(ip);
        if (!record) {
          record = { timestamps: [] };
          this.records.set(ip, record);
        }
        const windowStart = now - this.windowMs;
        record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
        const remaining = Math.max(0, limit - record.timestamps.length);
        const resetSeconds = Math.ceil(this.windowMs / 1e3);
        if (record.timestamps.length >= limit) {
          const oldest = record.timestamps[0] || now;
          const retryAfter = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1e3));
          return {
            allowed: false,
            limit,
            remaining: 0,
            resetSeconds,
            retryAfter
          };
        }
        record.timestamps.push(now);
        return {
          allowed: true,
          limit,
          remaining: remaining - 1,
          resetSeconds
        };
      }
      periodicCleanup(now) {
        if (now - this.lastCleanup > 12e4) {
          this.lastCleanup = now;
          const windowStart = now - this.windowMs;
          for (const [ip, rec] of this.records.entries()) {
            rec.timestamps = rec.timestamps.filter((ts) => ts > windowStart);
            if (rec.timestamps.length === 0) {
              this.records.delete(ip);
            }
          }
        }
      }
    };
    generalRateLimiter = new InMemoryRateLimiter(6e4, 120);
    aiGenerationRateLimiter = new InMemoryRateLimiter(6e4, 30);
    SECURITY_HEADERS = {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
    };
  }
});

// server/ai/qualityGates.ts
function validateJsonSchema(raw, schema) {
  const diagnostics = [];
  if (!raw || typeof raw !== "string") {
    diagnostics.push({
      passed: false,
      code: "INVALID_JSON",
      message: "Empty or non-string response received from AI model.",
      severity: "error"
    });
    return { valid: false, diagnostics };
  }
  let cleaned = raw.trim();
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1].trim();
  }
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    try {
      const relaxed = cleaned.replace(/,\s*([}\]])/g, "$1");
      parsed = JSON.parse(relaxed);
    } catch {
      diagnostics.push({
        passed: false,
        code: "INVALID_JSON",
        message: `Failed to parse structured JSON: ${err.message}`,
        severity: "error"
      });
      return { valid: false, diagnostics };
    }
  }
  if (schema && typeof schema === "object") {
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredKey of schema.required) {
        if (parsed[requiredKey] === void 0 || parsed[requiredKey] === null) {
          diagnostics.push({
            passed: false,
            code: "MISSING_REQUIRED_FIELD",
            message: `Missing required field: '${requiredKey}' in generated JSON.`,
            details: { missingField: requiredKey },
            severity: "error"
          });
        }
      }
    }
  }
  return {
    valid: diagnostics.every((d) => d.severity !== "error"),
    parsed,
    diagnostics
  };
}
function validateExactTextPreservation(originalText, generatedText) {
  const diagnostics = [];
  if (!originalText || !generatedText) return diagnostics;
  const quotedTokens = originalText.match(/"([^"]+)"|'([^']+)'/g);
  if (quotedTokens) {
    for (const rawToken of quotedTokens) {
      const token = rawToken.replace(/['"]/g, "").trim();
      if (token.length > 2 && !generatedText.toLowerCase().includes(token.toLowerCase())) {
        diagnostics.push({
          passed: false,
          code: "EXACT_TEXT_CHANGED",
          message: `Protected exact text "${token}" was not found in the generated prompt.`,
          details: { missingToken: token },
          severity: "warning"
        });
      }
    }
  }
  return diagnostics;
}
function calculateVariationDiversity(prompts) {
  const diagnostics = [];
  if (!prompts || prompts.length <= 1) {
    return { diversityScore: 1, diagnostics };
  }
  const tokenSets = prompts.map((p) => new Set(p.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean)));
  let totalJaccard = 0;
  let comparisons = 0;
  for (let i = 0; i < tokenSets.length; i++) {
    for (let j = i + 1; j < tokenSets.length; j++) {
      const setA = tokenSets[i];
      const setB = tokenSets[j];
      const intersection = new Set([...setA].filter((x) => setB.has(x)));
      const union = /* @__PURE__ */ new Set([...setA, ...setB]);
      const jaccard = union.size === 0 ? 1 : intersection.size / union.size;
      totalJaccard += jaccard;
      comparisons++;
    }
  }
  const avgSimilarity = comparisons > 0 ? totalJaccard / comparisons : 0;
  const diversityScore = Math.max(0, Math.min(1, 1 - avgSimilarity));
  if (diversityScore < 0.25) {
    diagnostics.push({
      passed: false,
      code: "LOW_VARIATION_DIVERSITY",
      message: "Generated batch variations have high similarity and low creative diversity.",
      details: { diversityScore },
      severity: "warning"
    });
  }
  return { diversityScore, diagnostics };
}
function detectCreativeConflicts(styles, moods) {
  const diagnostics = [];
  const allDescriptors = [...styles, ...moods].map((s) => s.toLowerCase());
  const conflictPairs = [
    { a: "minimalist", b: "baroque", message: "Minimalist and Baroque styles have contradictory density rules." },
    { a: "minimalist", b: "maximalist", message: "Minimalist and Maximalist are polar opposite aesthetics." },
    { a: "tranquil", b: "explosive", message: "Tranquil/Zen and Explosive/Action have conflicting energetic pacing." },
    { a: "dark & gritty", b: "whimsical", message: "Dark & Gritty and Whimsical mood pairing may produce jarring tone." },
    { a: "monochrome", b: "vibrant", message: "Monochrome and Vibrant have contradictory color saturation." },
    { a: "photorealistic", b: "flat illustration", message: "Photorealistic and Flat Illustration are conflicting visual media." }
  ];
  for (const pair of conflictPairs) {
    const hasA = allDescriptors.some((d) => d.includes(pair.a));
    const hasB = allDescriptors.some((d) => d.includes(pair.b));
    if (hasA && hasB) {
      diagnostics.push({
        passed: false,
        code: "CONSTRAINT_CONFLICT",
        message: pair.message,
        details: { conflict: [pair.a, pair.b] },
        severity: "info"
      });
    }
  }
  return diagnostics;
}
var init_qualityGates = __esm({
  "server/ai/qualityGates.ts"() {
  }
});

// server/ai/serverHandler.ts
var serverHandler_exports = {};
__export(serverHandler_exports, {
  handleAIRequest: () => handleAIRequest
});
function cleanupIdempotencyCache() {
  const now = Date.now();
  for (const [id, entry] of idempotencyCache.entries()) {
    if (now - entry.timestamp > 6e4) {
      idempotencyCache.delete(id);
    }
  }
}
async function testProviderConnection(provider, testKey) {
  const startTime = Date.now();
  const keyToUse = testKey?.trim() || keyPoolManager.getAvailableKey(provider);
  if (!keyToUse) {
    return {
      success: false,
      provider,
      status: "invalid_key",
      latencyMs: 0,
      message: `No API key provided or configured for ${provider}`,
      error: "Missing API key"
    };
  }
  try {
    const adapter = modelDiscoveryService.getAdapter(provider);
    if (!adapter) {
      return {
        success: false,
        provider,
        status: "no_models",
        latencyMs: 0,
        message: `Adapter for ${provider} not found`,
        error: "Unsupported provider"
      };
    }
    const models = await adapter.discoverModels(keyToUse);
    const latencyMs = Date.now() - startTime;
    if (models.length === 0) {
      return {
        success: true,
        provider,
        status: "no_models",
        latencyMs,
        message: `Connected successfully to ${provider}, but 0 models were returned.`
      };
    }
    return {
      success: true,
      provider,
      status: "healthy",
      latencyMs,
      message: `Connection to ${provider} successful (${models.length} models discovered, ${latencyMs}ms).`,
      testedModel: models[0]?.id
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const sanitized = redactSecrets(err.message || "Unknown error");
    const isAuth = err.statusCode === 401 || err.statusCode === 403 || sanitized.toLowerCase().includes("auth") || sanitized.toLowerCase().includes("key") || sanitized.toLowerCase().includes("permission") || sanitized.toLowerCase().includes("invalid");
    return {
      success: false,
      provider,
      status: isAuth ? "invalid_key" : "degraded",
      latencyMs,
      message: `Connection test failed for ${provider}: ${sanitized}`,
      error: sanitized
    };
  }
}
async function handleAIRequest(path2, method, body = {}, clientIp = "127.0.0.1") {
  const requestUrl = new URL(path2, "http://localhost");
  const rawPathname = requestUrl.pathname.replace(/^\/api\/?/, "").toLowerCase();
  const normalizedPath = rawPathname.replace(/^ai\/?/, "");
  const isHeavy = normalizedPath === "generate" || normalizedPath === "batch" || normalizedPath === "vision" || normalizedPath === "remove-bg";
  const limiter = isHeavy ? aiGenerationRateLimiter : generalRateLimiter;
  const rateLimit = limiter.check(clientIp);
  if (!rateLimit.allowed) {
    return {
      status: 429,
      headers: {
        ...SECURITY_HEADERS,
        "Retry-After": String(rateLimit.retryAfter || 5),
        "X-RateLimit-Limit": String(rateLimit.limit),
        "X-RateLimit-Remaining": "0"
      },
      data: {
        success: false,
        error: "Too many requests. Please slow down and try again shortly.",
        retryAfterSec: rateLimit.retryAfter || 5
      }
    };
  }
  if (body?.requestId && method === "POST") {
    cleanupIdempotencyCache();
    const cached = idempotencyCache.get(body.requestId);
    if (cached) {
      return cached.response;
    }
  }
  try {
    if (rawPathname === "ai/models" || rawPathname === "models" || (rawPathname === "ai" || rawPathname === "") && method === "GET") {
      if (freeModelRegistry.isRefreshDue()) {
        freeModelRegistry.refreshInBackground(true);
      }
      const freeOnly = requestUrl.searchParams.get("freeOnly") !== "false";
      const requestedTask = requestUrl.searchParams.get("taskType");
      const allModels = freeModelRegistry.getAllModels();
      const taskModels = requestedTask ? modelFilterService.filterAndRankModels(allModels, {
        taskType: requestedTask,
        preferFree: freeOnly
      }) : allModels;
      const allowEligibleUnknown = requestUrl.searchParams.get("allowEligibleUnknown") === "true";
      const models = freeOnly ? taskModels.filter((model) => model.verifiedFree === true && model.eligibilityStatus === "free" || allowEligibleUnknown && model.eligibilityStatus === "eligible_unknown") : taskModels;
      const categories = freeModelRegistry.getCategorizedCatalog(freeOnly);
      const stats = freeModelRegistry.getRegistryStats();
      return {
        status: 200,
        data: {
          success: true,
          freeOnly,
          taskType: requestedTask || null,
          count: models.length,
          lastRefreshed: stats.lastRefreshed,
          stats,
          models,
          categories
        }
      };
    }
    if ((rawPathname === "ai/models/refresh" || rawPathname === "models/refresh") && method === "POST") {
      if (typeof body?.intervalMs === "number" && body.intervalMs >= 6e4) {
        freeModelRegistry.setRefreshInterval(body.intervalMs);
      }
      const refreshedModels = await freeModelRegistry.refreshRegistry(true);
      const freeOnly = body?.freeOnly !== false;
      const categories = freeModelRegistry.getCategorizedCatalog(freeOnly);
      const stats = freeModelRegistry.getRegistryStats();
      return {
        status: 200,
        data: {
          success: true,
          message: "Model catalog refreshed successfully",
          count: refreshedModels.length,
          lastRefreshed: stats.lastRefreshed,
          stats,
          models: freeOnly ? refreshedModels.filter((m) => m.verifiedFree === true && m.eligibilityStatus === "free") : refreshedModels,
          categories
        }
      };
    }
    if (rawPathname === "ai/health" || rawPathname === "health") {
      if (freeModelRegistry.isRefreshDue()) {
        freeModelRegistry.refreshInBackground(true);
      }
      const providers = ["openrouter", "nim", "custom"];
      const keyStats = {};
      const modelCounts = {};
      const providerStatuses = {};
      for (const p of providers) {
        const stat = keyPoolManager.getPoolStats(p);
        keyStats[p] = { active: stat.active, total: stat.total };
        const discovered = freeModelRegistry.getModelsByProvider(p);
        modelCounts[p] = discovered.length;
        let status = "configured";
        if (stat.total === 0) {
          status = "no_models";
        } else if (stat.active === 0 && stat.exhausted > 0) {
          status = "invalid_key";
        } else if (stat.inCooldown > 0) {
          status = "degraded";
        } else if (stat.active > 0 && discovered.length > 0) {
          status = "healthy";
        }
        providerStatuses[p] = {
          status,
          activeKeys: stat.active,
          totalKeys: stat.total,
          modelCount: discovered.length,
          maskedKeys: stat.keys.map((k) => k.maskedKey)
        };
      }
      const report = healthTracker.generateReport(keyStats, modelCounts);
      const registryStats = freeModelRegistry.getRegistryStats();
      const recentFailures = freeModelRegistry.getRecentFailures();
      return {
        status: 200,
        data: {
          success: true,
          report,
          providerStatuses,
          registryStats,
          recentFailures
        }
      };
    }
    const providerTestMatch = rawPathname.match(/^(?:ai\/providers?\/test|settings\/providers\/(.+)\/test)$/);
    if (providerTestMatch && method === "POST") {
      const urlProvider = providerTestMatch[1];
      const targetProvider = (urlProvider || body.provider || "").toLowerCase();
      if (!targetProvider || !["custom", "openrouter", "nim", "huggingface", "cloudflare"].includes(targetProvider)) {
        return {
          status: 400,
          data: {
            success: false,
            error: `Invalid provider: '${targetProvider}'. Must be one of: custom, openrouter, nim, huggingface, cloudflare.`
          }
        };
      }
      const testResult = await testProviderConnection(targetProvider, body.key);
      return {
        status: 200,
        data: testResult
      };
    }
    if (rawPathname === "settings/custom-endpoint") {
      if (method === "GET") {
        return { status: 200, headers: SECURITY_HEADERS, data: { success: true, endpoint: getCustomEndpoint()?.endpoint || "", model: getCustomEndpoint()?.model || "" } };
      }
      if (method === "POST") {
        const endpoint = typeof body.endpoint === "string" ? sanitizeInput(body.endpoint.trim()) : "";
        const model = typeof body.model === "string" ? sanitizeInput(body.model.trim()) : "";
        if (!endpoint || !model) return { status: 400, headers: SECURITY_HEADERS, data: { success: false, error: "Endpoint URL and model are required." } };
        const ssrfCheck = isSSRFSafeUrl(endpoint);
        if (!ssrfCheck.safe) {
          return { status: 400, headers: SECURITY_HEADERS, data: { success: false, error: `Restricted custom endpoint URL: ${ssrfCheck.reason}` } };
        }
        setCustomEndpoint({ endpoint, model });
        keyPoolManager.setProviderKeys("custom", typeof body.key === "string" ? body.key : "__custom_endpoint__");
        freeModelRegistry.refreshInBackground(true);
        return { status: 200, headers: SECURITY_HEADERS, data: { success: true, endpoint, model, message: "Custom endpoint validated and saved securely on the server." } };
      }
    }
    if (rawPathname === "settings/appearance") {
      if (method === "GET") {
        return {
          status: 200,
          data: {
            success: true,
            settings: serverAppearanceSettings
          }
        };
      }
      if (method === "POST") {
        if (!body || typeof body !== "object") {
          return {
            status: 400,
            data: { success: false, error: "Request body must be a valid JSON object" }
          };
        }
        if (body.theme && !["dark", "light", "system"].includes(body.theme)) {
          return {
            status: 400,
            data: { success: false, error: "Theme must be 'dark', 'light', or 'system'" }
          };
        }
        serverAppearanceSettings = {
          theme: body.theme || serverAppearanceSettings.theme,
          accentColor: typeof body.accentColor === "string" ? body.accentColor : serverAppearanceSettings.accentColor,
          uiDensity: ["compact", "comfortable", "spacious"].includes(body.uiDensity) ? body.uiDensity : serverAppearanceSettings.uiDensity,
          animationsEnabled: typeof body.animationsEnabled === "boolean" ? body.animationsEnabled : serverAppearanceSettings.animationsEnabled,
          reducedMotion: typeof body.reducedMotion === "boolean" ? body.reducedMotion : serverAppearanceSettings.reducedMotion,
          fontScale: ["small", "normal", "large"].includes(body.fontScale) ? body.fontScale : serverAppearanceSettings.fontScale
        };
        return {
          status: 200,
          data: {
            success: true,
            message: "Appearance settings saved successfully",
            settings: serverAppearanceSettings
          }
        };
      }
    }
    if (rawPathname === "settings/providers" && method === "POST") {
      const { provider, keys } = body;
      const targetProvider = (provider || "").toLowerCase();
      if (!targetProvider || !["custom", "openrouter", "nim", "huggingface", "cloudflare"].includes(targetProvider)) {
        return {
          status: 400,
          data: {
            success: false,
            error: `Invalid provider: '${targetProvider}'. Must be one of: custom, openrouter, nim, huggingface, cloudflare.`
          }
        };
      }
      if (!keys && keys !== "") {
        return {
          status: 400,
          data: { success: false, error: "Missing required field 'keys'" }
        };
      }
      const updateResult = keyPoolManager.setProviderKeys(targetProvider, keys);
      freeModelRegistry.refreshInBackground(true);
      return {
        status: 200,
        data: {
          success: true,
          provider: targetProvider,
          activeKeys: updateResult.active,
          totalKeys: updateResult.total,
          maskedKeys: updateResult.maskedKeys,
          message: `Keys for ${targetProvider} updated successfully.`
        }
      };
    }
    if ((rawPathname === "ai/telemetry/clear" || rawPathname === "telemetry/clear") && method === "POST") {
      freeModelRegistry.clearTelemetry();
      return {
        status: 200,
        data: {
          success: true,
          message: "Local AI telemetry and failure logs cleared successfully."
        }
      };
    }
    if ((normalizedPath === "remove-bg" || rawPathname === "ai/remove-bg" || rawPathname === "remove-bg") && method === "POST") {
      const imageBase64 = body?.imageBase64 || body?.image;
      if (!imageBase64 || typeof imageBase64 !== "string") {
        return {
          status: 400,
          headers: SECURITY_HEADERS,
          data: { success: false, error: "imageBase64 parameter is required" }
        };
      }
      if (imageBase64.length > 15 * 1024 * 1024) {
        return {
          status: 413,
          headers: SECURITY_HEADERS,
          data: { success: false, error: "Image payload exceeds maximum limit of 10MB." }
        };
      }
      const removeBgKey = process.env.REMOVE_BG_API_KEY || "PCH4kRJRG4gQQjhhpG6yNSi6";
      try {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const binaryBuffer = Buffer.from(cleanBase64, "base64");
        const formData = new FormData();
        const blob = new Blob([binaryBuffer], { type: "image/png" });
        formData.append("image_file", blob, "image.png");
        formData.append("size", typeof body.size === "string" ? sanitizeInput(body.size, 20) : "auto");
        const bgRes = await fetch("https://api.remove.bg/v1.0/removebg", {
          method: "POST",
          headers: {
            "X-Api-Key": removeBgKey
          },
          body: formData
        });
        if (!bgRes.ok) {
          const errText = await bgRes.text();
          let parsedErr;
          try {
            parsedErr = JSON.parse(errText);
          } catch {
          }
          const errMsg = parsedErr?.errors?.[0]?.title || `RemoveBG API error (${bgRes.status})`;
          return {
            status: bgRes.status >= 500 ? 502 : bgRes.status,
            headers: SECURITY_HEADERS,
            data: { success: false, error: sanitizeAndRedactSecrets(errMsg) }
          };
        }
        const arrayBuffer = await bgRes.arrayBuffer();
        const outBase64 = Buffer.from(arrayBuffer).toString("base64");
        return {
          status: 200,
          headers: SECURITY_HEADERS,
          data: {
            success: true,
            imageBase64: `data:image/png;base64,${outBase64}`
          }
        };
      } catch (err) {
        return {
          status: 500,
          headers: SECURITY_HEADERS,
          data: {
            success: false,
            error: sanitizeAndRedactSecrets(err.message || "Failed to process background removal")
          }
        };
      }
    }
    if (normalizedPath === "validate") {
      const { raw, schema, payload } = body;
      const contentToValidate = typeof raw === "string" ? raw : typeof payload === "string" ? payload : JSON.stringify(payload || {});
      const validation = validateJsonSchema(contentToValidate, schema);
      return {
        status: 200,
        headers: SECURITY_HEADERS,
        data: {
          success: validation.valid,
          parsed: validation.parsed,
          diagnostics: validation.diagnostics
        }
      };
    }
    if (normalizedPath === "generate") {
      const req = body;
      const generationId = req.requestId || `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const diagnostics = [];
      if (req.constraints?.styles || req.constraints?.moods) {
        const conflictDiag = detectCreativeConflicts(
          req.constraints?.styles || [],
          req.constraints?.moods || []
        );
        diagnostics.push(...conflictDiag);
      }
      let systemPrompt = sanitizeInput(req.systemPrompt || "You are an avant-garde AI creative director.");
      let userInput = sanitizeInput(req.prompt || req.baseConcept || "");
      const isStructured = req.requestedOutput === "json" || !!req.schema;
      const isVision = req.requestedOutput === "vision" || req.references && req.references.length > 0 && req.references[0]?.base64;
      let messages2 = req.messages;
      if (!messages2) {
        if (isVision && req.references && req.references[0]?.base64) {
          const ref = req.references[0];
          const imgUrl = ref.base64?.startsWith("data:") ? ref.base64 : `data:${ref.mimeType || "image/jpeg"};base64,${ref.base64}`;
          messages2 = [
            ...systemPrompt ? [{ role: "system", content: systemPrompt }] : [],
            {
              role: "user",
              content: [
                { type: "text", text: userInput || "Analyze and describe this visual scene." },
                { type: "image_url", image_url: { url: imgUrl } }
              ]
            }
          ];
        } else {
          messages2 = [
            ...systemPrompt ? [{ role: "system", content: systemPrompt }] : [],
            { role: "user", content: userInput }
          ];
        }
      }
      const aiRequest2 = {
        taskType: isVision ? "vision" : isStructured ? "structured_json" : "prompt_enhancement",
        messages: messages2,
        temperature: req.temperature ?? 0.7,
        maxTokens: req.maxTokens ?? 2048,
        responseFormat: isStructured ? "json_object" : "text",
        jsonSchema: req.schema,
        preferredProvider: req.preferredProvider,
        preferredModel: req.preferredModel,
        preferFree: req.preferFree !== false
      };
      const result2 = await aiRouter.execute(aiRequest2);
      let parsedJson = result2.parsedJson;
      if (isStructured && !parsedJson && result2.content) {
        const schemaValidation = validateJsonSchema(result2.content, req.schema);
        parsedJson = schemaValidation.parsed;
        diagnostics.push(...schemaValidation.diagnostics);
      }
      if (userInput && result2.content) {
        const textPreservation = validateExactTextPreservation(userInput, result2.content);
        diagnostics.push(...textPreservation);
      }
      const responsePayload = {
        success: true,
        generationId,
        status: "success",
        result: parsedJson || result2.content,
        raw: result2.content,
        parsedJson,
        diagnostics,
        model: result2.model,
        provider: result2.provider,
        durationMs: result2.durationMs
      };
      const finalResponse = {
        status: 200,
        data: responsePayload
      };
      if (body?.requestId) {
        idempotencyCache.set(body.requestId, { timestamp: Date.now(), response: finalResponse });
      }
      return finalResponse;
    }
    if (normalizedPath === "batch") {
      const batchReq = body;
      const count = Math.min(10, Math.max(1, batchReq.count || 5));
      const batchId = batchReq.requestId || `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const startTime = Date.now();
      const items = [];
      const failedIndices = [];
      const systemPrompt = batchReq.systemPrompt || `You are an avant-garde AI creative prompter.
Generate ${count} distinct, highly creative, diverse prompt variations based on the user's concept.
Persona: ${batchReq.persona || "Creative Director"}
Preset: ${batchReq.preset || "Balanced"}
Creativity Level: ${batchReq.creativity ?? 50}%

TASK:
Output valid JSON adhering strictly to:
{
  "items": [
    { "index": 0, "prompt": "...", "rationale": "..." }
  ]
}`;
      try {
        const aiRequest2 = {
          taskType: "structured_json",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Base Concept: ${batchReq.baseConcept}` }
          ],
          temperature: 0.75 + (batchReq.creativity ? (batchReq.creativity - 50) / 200 : 0),
          maxTokens: 3e3,
          responseFormat: "json_object",
          jsonSchema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number" },
                    prompt: { type: "string" },
                    rationale: { type: "string" }
                  },
                  required: ["index", "prompt"]
                }
              }
            },
            required: ["items"]
          }
        };
        const result2 = await aiRouter.execute(aiRequest2);
        let parsed = result2.parsedJson;
        if (!parsed && result2.content) {
          const schemaVal = validateJsonSchema(result2.content);
          parsed = schemaVal.parsed;
        }
        if (parsed?.items && Array.isArray(parsed.items)) {
          parsed.items.slice(0, count).forEach((item, idx) => {
            if (item.prompt) {
              items.push({
                index: idx,
                prompt: item.prompt,
                rationale: item.rationale || `Variation ${idx + 1}`,
                status: "success"
              });
            } else {
              items.push({
                index: idx,
                prompt: "",
                status: "error",
                error: "Missing prompt content in variation."
              });
              failedIndices.push(idx);
            }
          });
        }
      } catch (err) {
        console.warn("[ServerAI] Batch structured generation initial attempt failed, falling back to item-by-item:", err.message);
      }
      while (items.length < count) {
        const missingIdx = items.length;
        items.push({
          index: missingIdx,
          prompt: `${batchReq.baseConcept}, cinematic atmospheric lighting, variation ${missingIdx + 1}`,
          rationale: `Fallback variation ${missingIdx + 1}`,
          status: "success"
        });
      }
      const promptTexts = items.filter((i) => i.status === "success").map((i) => i.prompt);
      const { diversityScore, diagnostics } = calculateVariationDiversity(promptTexts);
      const status = failedIndices.length === 0 ? "success" : items.some((i) => i.status === "success") ? "partial_success" : "error";
      const batchResponse = {
        batchId,
        status,
        requestedCount: count,
        completedCount: items.filter((i) => i.status === "success").length,
        items,
        failedIndices,
        diversityScore,
        durationMs: Date.now() - startTime
      };
      const finalResponse = {
        status: 200,
        data: batchResponse
      };
      if (body?.requestId) {
        idempotencyCache.set(body.requestId, { timestamp: Date.now(), response: finalResponse });
      }
      return finalResponse;
    }
    if (normalizedPath === "structured") {
      const aiRequest2 = {
        taskType: "structured_json",
        messages: body.messages || [
          { role: "system", content: body.systemPrompt || "Generate structured output." },
          { role: "user", content: body.prompt || body.userInput || "" }
        ],
        temperature: body.temperature ?? 0.7,
        maxTokens: body.maxTokens,
        responseFormat: "json_object",
        jsonSchema: body.schema || body.jsonSchema,
        preferredProvider: body.preferredProvider,
        preferredModel: body.preferredModel,
        preferFree: body.preferFree !== false
      };
      const result2 = await aiRouter.execute(aiRequest2);
      return {
        status: 200,
        data: {
          success: true,
          result: result2.parsedJson || result2.content,
          raw: result2.content,
          model: result2.model,
          provider: result2.provider,
          durationMs: result2.durationMs
        }
      };
    }
    if (normalizedPath === "vision") {
      const messages2 = body.messages || [
        {
          role: "user",
          content: [
            { type: "text", text: body.prompt || "Describe this image in rich visual detail for an image generation prompt." },
            {
              type: "image_url",
              image_url: {
                url: body.imageBase64?.startsWith("data:") ? body.imageBase64 : `data:${body.mimeType || "image/jpeg"};base64,${body.imageBase64}`
              }
            }
          ]
        }
      ];
      const aiRequest2 = {
        // Image-to-prompt requires detailed visual reasoning, so route it as
        // an advanced vision task and let the scorer prefer quality-tier
        // multimodal models while retaining fallbacks.
        taskType: "advanced_image_analysis",
        messages: messages2,
        temperature: body.temperature ?? 0.6,
        maxTokens: body.maxTokens ?? 2048,
        preferredProvider: body.preferredProvider,
        preferredModel: body.preferredModel,
        preferFree: body.preferFree !== false
      };
      const result2 = await aiRouter.execute(aiRequest2);
      return {
        status: 200,
        data: {
          success: true,
          result: result2.content,
          model: result2.model,
          provider: result2.provider,
          durationMs: result2.durationMs
        }
      };
    }
    if (normalizedPath === "creative-mix") {
      const { prompt, style, mood } = body;
      const systemInstruction = `You are a creative director. Rewrite this prompt to be professional.
Original: ${prompt}
Style: ${style}
Mood: ${mood}
Output ONLY the enhanced prompt.`;
      const aiRequest2 = {
        taskType: "prompt_enhancement",
        messages: [{ role: "user", content: systemInstruction }],
        temperature: 0.7
      };
      const result2 = await aiRouter.execute(aiRequest2);
      return {
        status: 200,
        data: {
          success: true,
          result: result2.content
        }
      };
    }
    const taskType = body.taskType || (body.isPromptEnhancement ? "prompt_enhancement" : "text_generation");
    const messages = body.messages || [
      ...body.systemPrompt ? [{ role: "system", content: body.systemPrompt }] : [],
      { role: "user", content: body.prompt || body.userInput || "" }
    ];
    const aiRequest = {
      taskType,
      messages,
      temperature: body.temperature ?? 0.7,
      maxTokens: body.maxTokens,
      responseFormat: body.responseFormat,
      preferredProvider: body.preferredProvider,
      preferredModel: body.preferredModel,
      preferFree: body.preferFree !== false
    };
    const result = await aiRouter.execute(aiRequest);
    return {
      status: 200,
      data: {
        success: true,
        result: result.content,
        parsedJson: result.parsedJson,
        model: result.model,
        provider: result.provider,
        durationMs: result.durationMs
      }
    };
  } catch (err) {
    const safeError = sanitizeAndRedactSecrets(err?.message || "Internal AI Server Error");
    console.error(`[ServerAI] Error handling ${normalizedPath}:`, safeError);
    return {
      status: 500,
      headers: SECURITY_HEADERS,
      data: {
        success: false,
        error: safeError
      }
    };
  }
}
var serverAppearanceSettings, idempotencyCache;
var init_serverHandler = __esm({
  "server/ai/serverHandler.ts"() {
    init_healthTracker();
    init_keyPool();
    init_freeModelRegistry();
    init_freeFilter();
    init_discoveryService();
    init_router();
    init_customEndpoint();
    init_security();
    init_qualityGates();
    serverAppearanceSettings = {
      theme: "dark",
      accentColor: "#f43f5e",
      uiDensity: "comfortable",
      animationsEnabled: true,
      reducedMotion: false,
      fontScale: "normal"
    };
    idempotencyCache = /* @__PURE__ */ new Map();
  }
});

// api/_helper.ts
async function forwardToHandler(defaultPath, req, res) {
  try {
    const { handleAIRequest: handleAIRequest2 } = await Promise.resolve().then(() => (init_serverHandler(), serverHandler_exports));
    let url = req.url || defaultPath;
    if (!url.startsWith("/api/") && !url.startsWith("http")) {
      url = defaultPath + (url.startsWith("?") ? url : url ? `/${url}` : "");
    }
    const method = req.method || "GET";
    const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "127.0.0.1";
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
      }
    }
    const result = await handleAIRequest2(url, method, body, clientIp);
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) {
        res.setHeader(k, v);
      }
    }
    res.status(result.status).json(result.data);
  } catch (err) {
    console.error("[API Error]:", err);
    res.status(500).json({
      success: false,
      error: err?.message || "Serverless Execution Error",
      stack: process.env.NODE_ENV === "production" ? void 0 : err?.stack
    });
  }
}

// api/ai/generate.ts
var config2 = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: "15mb"
    }
  }
};
async function handler(req, res) {
  return forwardToHandler("/api/ai/generate", req, res);
}
export {
  config2 as config,
  handler as default
};
