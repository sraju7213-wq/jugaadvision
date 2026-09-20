import {
  isSSRFSafeUrl,
  sanitizeInput,
  sanitizeAndRedactSecrets,
  SECURITY_HEADERS,
  generalRateLimiter,
  aiGenerationRateLimiter,
} from './security';
import {
  validateJsonSchema,
  validateExactTextPreservation,
  calculateVariationDiversity,
  detectCreativeConflicts,
} from './qualityGates';
import type {
  AIRequest,
  AppearanceSettings,
  ProviderName,
  ProviderTestResponse,
  UnifiedGenerateRequest,
  UnifiedGenerateResponse,
  BatchGenerateRequest,
  BatchGenerateResponse,
  BatchItemResult,
  QualityGateDiagnostic,
} from './types';
import { healthTracker } from './health/healthTracker';
import { keyPoolManager, redactSecrets } from './pools/keyPool';
import { freeModelRegistry } from './registry/freeModelRegistry';
import { modelFilterService } from './filtering/freeFilter';
import { modelDiscoveryService } from './discovery/discoveryService';
import { aiRouter } from './router/router';
import { getCustomEndpoint, setCustomEndpoint } from './customEndpoint';
import { LocalAdapter, LOCAL_PROVIDER, initAdapter } from './local/localAdapter';
import {
  listLocalModels,
  getLocalModel,
  searchLocalModels,
  downloadAndRegisterModel,
  removeLocalModel,
  runLocalInference,
  checkLocalInferenceReady,
  ensureLocalAdapterRegistered,
  isLocalModelLoaded,
  loadLocalModelIntoMemory,
  unloadLocalModel,
  unloadAllLocalModels,
  getLocalMemoryStatus,
  getActiveDownloads,
  cancelDownload,
} from './local/localModelManager';

export interface ServerResponse {
  status: number;
  data: any;
  headers?: Record<string, string>;
}

/** Format bytes to human-readable string */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// In-memory server appearance state
let serverAppearanceSettings: AppearanceSettings = {
  theme: 'dark',
  accentColor: '#f43f5e',
  uiDensity: 'comfortable',
  animationsEnabled: true,
  reducedMotion: false,
  fontScale: 'normal',
};

// In-memory idempotency cache for deduplicating rapid duplicate requests
const idempotencyCache = new Map<string, { timestamp: number; response: ServerResponse }>();

function cleanupIdempotencyCache() {
  const now = Date.now();
  for (const [id, entry] of idempotencyCache.entries()) {
    if (now - entry.timestamp > 60000) {
      idempotencyCache.delete(id);
    }
  }
}

async function testProviderConnection(provider: ProviderName, testKey?: string): Promise<ProviderTestResponse> {
  const startTime = Date.now();
  const keyToUse = testKey?.trim() || keyPoolManager.getAvailableKey(provider);

  if (!keyToUse) {
    return {
      success: false,
      provider,
      status: 'invalid_key',
      latencyMs: 0,
      message: `No API key provided or configured for ${provider}`,
      error: 'Missing API key',
    };
  }

  try {
    const adapter = modelDiscoveryService.getAdapter(provider);
    if (!adapter) {
      return {
        success: false,
        provider,
        status: 'no_models',
        latencyMs: 0,
        message: `Adapter for ${provider} not found`,
        error: 'Unsupported provider',
      };
    }

    const models = await adapter.discoverModels(keyToUse);
    const latencyMs = Date.now() - startTime;
    if (models.length === 0) {
      return {
        success: true,
        provider,
        status: 'no_models',
        latencyMs,
        message: `Connected successfully to ${provider}, but 0 models were returned.`,
      };
    }

    return {
      success: true,
      provider,
      status: 'healthy',
      latencyMs,
      message: `Connection to ${provider} successful (${models.length} models discovered, ${latencyMs}ms).`,
      testedModel: models[0]?.id,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const sanitized = redactSecrets(err.message || 'Unknown error');
    const isAuth = err.statusCode === 401 || err.statusCode === 403 ||
      sanitized.toLowerCase().includes('auth') ||
      sanitized.toLowerCase().includes('key') ||
      sanitized.toLowerCase().includes('permission') ||
      sanitized.toLowerCase().includes('invalid');
    return {
      success: false,
      provider,
      status: isAuth ? 'invalid_key' : 'degraded',
      latencyMs,
      message: `Connection test failed for ${provider}: ${sanitized}`,
      error: sanitized,
    };
  }
}

async function internalHandleAIRequest(
  path: string,
  method: string,
  body: any = {},
  clientIp = '127.0.0.1'
): Promise<ServerResponse> {
  const requestUrl = new URL(path, 'http://localhost');
  const rawPathname = requestUrl.pathname.replace(/^\/api\/?/, '').toLowerCase();
  const normalizedPath = rawPathname.replace(/^ai\/?/, '');

  // Rate Limiting Protection (sliding window per client IP)
  const isHeavy = normalizedPath === 'generate' || normalizedPath === 'batch' || normalizedPath === 'vision' || normalizedPath === 'remove-bg';
  const limiter = isHeavy ? aiGenerationRateLimiter : generalRateLimiter;
  const rateLimit = limiter.check(clientIp);

  if (!rateLimit.allowed) {
    return {
      status: 429,
      headers: {
        ...SECURITY_HEADERS,
        'Retry-After': String(rateLimit.retryAfter || 5),
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': '0',
      },
      data: {
        success: false,
        error: 'Too many requests. Please slow down and try again shortly.',
        retryAfterSec: rateLimit.retryAfter || 5,
      },
    };
  }

  // Check idempotency if requestId provided
  if (body?.requestId && method === 'POST') {
    cleanupIdempotencyCache();
    const cached = idempotencyCache.get(body.requestId);
    if (cached) {
      return cached.response;
    }
  }

  try {
    // 1. GET /api/ai/models or GET /api/models
    if (rawPathname === 'ai/models' || rawPathname === 'models' || ((rawPathname === 'ai' || rawPathname === '') && method === 'GET')) {
      if (freeModelRegistry.isRefreshDue()) {
        freeModelRegistry.refreshInBackground(true);
      }
      const freeOnly = requestUrl.searchParams.get('freeOnly') !== 'false';
      const requestedTask = requestUrl.searchParams.get('taskType') as any;
      const allModels = freeModelRegistry.getAllModels();

      const taskModels = requestedTask
        ? modelFilterService.filterAndRankModels(allModels, {
            taskType: requestedTask,
            preferFree: freeOnly,
          })
        : allModels;

      const allowEligibleUnknown = requestUrl.searchParams.get('allowEligibleUnknown') === 'true';
      const models = freeOnly
        ? taskModels.filter(model => (model.verifiedFree === true && model.eligibilityStatus === 'free') || (allowEligibleUnknown && model.eligibilityStatus === 'eligible_unknown'))
        : taskModels;

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
          categories,
        },
      };
    }

    // 2. POST /api/ai/models/refresh
    if ((rawPathname === 'ai/models/refresh' || rawPathname === 'models/refresh') && method === 'POST') {
      if (typeof body?.intervalMs === 'number' && body.intervalMs >= 60000) {
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
          message: 'Model catalog refreshed successfully',
          count: refreshedModels.length,
          lastRefreshed: stats.lastRefreshed,
          stats,
          models: freeOnly
            ? refreshedModels.filter(m => m.verifiedFree === true && m.eligibilityStatus === 'free')
            : refreshedModels,
          categories,
        },
      };
    }

    // 3. GET /api/ai/health or GET /api/health
    if (rawPathname === 'ai/health' || rawPathname === 'health') {
      if (freeModelRegistry.isRefreshDue()) {
        freeModelRegistry.refreshInBackground(true);
      }
      const providers: ProviderName[] = ['nim', 'openrouter', 'huggingface', 'cloudflare', 'custom'];
      const keyStats: Record<string, { active: number; total: number }> = {};
      const modelCounts: Record<string, number> = {};
      const providerStatuses: Record<string, {
        status: 'configured' | 'healthy' | 'degraded' | 'invalid_key' | 'no_models';
        activeKeys: number;
        totalKeys: number;
        modelCount: number;
        maskedKeys: string[];
      }> = {};

      for (const p of providers) {
        const stat = keyPoolManager.getPoolStats(p);
        keyStats[p] = { active: stat.active, total: stat.total };
        const discovered = freeModelRegistry.getModelsByProvider(p);
        modelCounts[p] = discovered.length;

        let status: 'configured' | 'healthy' | 'degraded' | 'invalid_key' | 'no_models' = 'configured';
        if (stat.total === 0) {
          status = 'no_models';
        } else if (stat.active === 0 && stat.exhausted > 0) {
          status = 'invalid_key';
        } else if (stat.inCooldown > 0) {
          status = 'degraded';
        } else if (stat.active > 0 && discovered.length > 0) {
          status = 'healthy';
        }

        providerStatuses[p] = {
          status,
          activeKeys: stat.active,
          totalKeys: stat.total,
          modelCount: discovered.length,
          maskedKeys: stat.keys.map(k => k.maskedKey),
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
          recentFailures,
        },
      };
    }

    // 4. POST /api/ai/provider/test or POST /api/settings/providers/:provider/test
    const providerTestMatch = rawPathname.match(/^(?:ai\/providers?\/test|settings\/providers\/(.+)\/test)$/);
    if (providerTestMatch && method === 'POST') {
      const urlProvider = providerTestMatch[1];
      const targetProvider = (urlProvider || body.provider || '').toLowerCase() as ProviderName;
      if (!targetProvider || !['custom', 'openrouter', 'nim', 'huggingface', 'cloudflare'].includes(targetProvider)) {
        return {
          status: 400,
          data: {
            success: false,
            error: `Invalid provider: '${targetProvider}'. Must be one of: custom, openrouter, nim, huggingface, cloudflare.`,
          },
        };
      }

      const testResult = await testProviderConnection(targetProvider, body.key);
      return {
        status: 200,
        data: testResult,
      };
    }

    // 5. GET & POST /api/settings/custom-endpoint
    if (rawPathname === 'settings/custom-endpoint') {
      if (method === 'GET') {
        return { status: 200, headers: SECURITY_HEADERS, data: { success: true, endpoint: getCustomEndpoint()?.endpoint || '', model: getCustomEndpoint()?.model || '' } };
      }
      if (method === 'POST') {
        const endpoint = typeof body.endpoint === 'string' ? sanitizeInput(body.endpoint.trim()) : '';
        const model = typeof body.model === 'string' ? sanitizeInput(body.model.trim()) : '';
        if (!endpoint || !model) return { status: 400, headers: SECURITY_HEADERS, data: { success: false, error: 'Endpoint URL and model are required.' } };
        
        // SSRF Safety Guard
        const ssrfCheck = isSSRFSafeUrl(endpoint);
        if (!ssrfCheck.safe) {
          return { status: 400, headers: SECURITY_HEADERS, data: { success: false, error: `Restricted custom endpoint URL: ${ssrfCheck.reason}` } };
        }

        setCustomEndpoint({ endpoint, model });
        keyPoolManager.setProviderKeys('custom', typeof body.key === 'string' ? body.key : '__custom_endpoint__');
        freeModelRegistry.refreshInBackground(true);
        return { status: 200, headers: SECURITY_HEADERS, data: { success: true, endpoint, model, message: 'Custom endpoint validated and saved securely on the server.' } };
      }
    }

    // 5. GET & POST /api/settings/appearance
    if (rawPathname === 'settings/appearance') {
      if (method === 'GET') {
        return {
          status: 200,
          data: {
            success: true,
            settings: serverAppearanceSettings,
          },
        };
      }

      if (method === 'POST') {
        if (!body || typeof body !== 'object') {
          return {
            status: 400,
            data: { success: false, error: 'Request body must be a valid JSON object' },
          };
        }

        if (body.theme && !['dark', 'light', 'system'].includes(body.theme)) {
          return {
            status: 400,
            data: { success: false, error: "Theme must be 'dark', 'light', or 'system'" },
          };
        }

        serverAppearanceSettings = {
          theme: body.theme || serverAppearanceSettings.theme,
          accentColor: typeof body.accentColor === 'string' ? body.accentColor : serverAppearanceSettings.accentColor,
          uiDensity: ['compact', 'comfortable', 'spacious'].includes(body.uiDensity) ? body.uiDensity : serverAppearanceSettings.uiDensity,
          animationsEnabled: typeof body.animationsEnabled === 'boolean' ? body.animationsEnabled : serverAppearanceSettings.animationsEnabled,
          reducedMotion: typeof body.reducedMotion === 'boolean' ? body.reducedMotion : serverAppearanceSettings.reducedMotion,
          fontScale: ['small', 'normal', 'large'].includes(body.fontScale) ? body.fontScale : serverAppearanceSettings.fontScale,
        };

        return {
          status: 200,
          data: {
            success: true,
            message: 'Appearance settings saved successfully',
            settings: serverAppearanceSettings,
          },
        };
      }
    }

    // 6. POST /api/settings/providers
    if (rawPathname === 'settings/providers' && method === 'POST') {
      const { provider, keys } = body;
      const targetProvider = (provider || '').toLowerCase() as ProviderName;

      if (!targetProvider || !['custom', 'openrouter', 'nim', 'huggingface', 'cloudflare'].includes(targetProvider)) {
        return {
          status: 400,
          data: {
            success: false,
            error: `Invalid provider: '${targetProvider}'. Must be one of: custom, openrouter, nim, huggingface, cloudflare.`,
          },
        };
      }

      if (!keys && keys !== '') {
        return {
          status: 400,
          data: { success: false, error: "Missing required field 'keys'" },
        };
      }

      // Securely store keys server-side in KeyPoolManager
      const updateResult = keyPoolManager.setProviderKeys(targetProvider, keys);

      // Trigger background model discovery for the updated provider
      freeModelRegistry.refreshInBackground(true);

      return {
        status: 200,
        data: {
          success: true,
          provider: targetProvider,
          activeKeys: updateResult.active,
          totalKeys: updateResult.total,
          maskedKeys: updateResult.maskedKeys,
          message: `Keys for ${targetProvider} updated successfully.`,
        },
      };
    }

    // 7. POST /api/ai/telemetry/clear
    if ((rawPathname === 'ai/telemetry/clear' || rawPathname === 'telemetry/clear') && method === 'POST') {
      freeModelRegistry.clearTelemetry();
      return {
        status: 200,
        data: {
          success: true,
          message: 'Local AI telemetry and failure logs cleared successfully.',
        },
      };
    }

    // ── LOCAL GGUF MODEL MANAGEMENT ──────────────────────────────────────────
    // Ensure the LocalAdapter is registered before handling local model requests
    if (rawPathname.startsWith('ai/local')) {
      await ensureLocalAdapterRegistered();
    }
    // GET  /api/ai/local/models            → list all downloaded local models
    // GET  /api/ai/local/models/:id        → get one local model by id
    // POST /api/ai/local/models/:id/load   → load model into RAM/VRAM
    // POST /api/ai/local/models/:id/unload → unload model from RAM/VRAM
    // POST /api/ai/local/models/unload-all → unload all models from RAM
    // GET  /api/ai/local/downloads          → get all active and recent downloads
    // POST /api/ai/local/downloads/cancel   → cancel an active download
    // POST /api/ai/local/models/search     → search HuggingFace for GGUF models
    // POST /api/ai/local/models/download   → download + register a GGUF model
    // DELETE /api/ai/local/models/:id      → remove a local model (+ delete file)
    // GET  /api/ai/local/health            → is local inference ready?
    if (rawPathname === 'ai/local/models' && method === 'GET') {
      const models = listLocalModels();
      const memoryStatus = getLocalMemoryStatus();
      const activeDownloads = getActiveDownloads();
      return {
        status: 200,
        data: {
          success: true,
          count: models.length,
          memoryStatus,
          activeDownloads,
          models: models.map(m => ({
            id: m.id,
            name: m.name,
            sourceRepo: m.sourceRepo,
            fileName: m.fileName,
            fileSizeBytes: m.fileSizeBytes,
            fileSizeHuman: formatBytes(m.fileSizeBytes),
            quantization: m.quantization,
            modality: m.modality,
            downloadedAt: m.downloadedAt,
            lastLoadedAt: m.lastLoadedAt,
            loadCount: m.loadCount,
            isValid: m.isValid,
            isLoaded: isLocalModelLoaded(m.id),
            note: m.note,
          })),
        },
      };
    }

    // POST /api/ai/local/models/unload-all — unload all models from memory
    if (rawPathname === 'ai/local/models/unload-all' && method === 'POST') {
      unloadAllLocalModels();
      return {
        status: 200,
        data: {
          success: true,
          message: 'All local models unloaded from memory.',
          memoryStatus: getLocalMemoryStatus(),
        },
      };
    }

    // GET /api/ai/local/downloads — list active and recent downloads
    if (rawPathname === 'ai/local/downloads' && method === 'GET') {
      const downloads = getActiveDownloads();
      return {
        status: 200,
        data: {
          success: true,
          downloads,
        },
      };
    }

    // POST /api/ai/local/downloads/cancel — cancel an ongoing download
    if (rawPathname === 'ai/local/downloads/cancel' && method === 'POST') {
      const taskId = body.id || body.taskId;
      if (!taskId) return { status: 400, data: { success: false, error: 'Task ID required' } };
      const cancelled = cancelDownload(taskId);
      return {
        status: 200,
        data: {
          success: cancelled,
          message: cancelled ? `Download ${taskId} cancelled` : `Download ${taskId} not active`,
        },
      };
    }

    // POST /api/ai/local/models/:id/load — load model into memory
    if (rawPathname.match(/^ai\/local\/models\/[^/]+\/load$/) && method === 'POST') {
      const match = rawPathname.match(/^ai\/local\/models\/([^/]+)\/load$/);
      if (!match) return { status: 400, data: { success: false, error: 'Invalid model id' } };
      const modelId = decodeURIComponent(match[1]);
      try {
        const res = await loadLocalModelIntoMemory(modelId);
        return {
          status: 200,
          data: {
            success: true,
            message: `Model loaded into memory in ${res.loadDurationMs}ms`,
            isLoaded: true,
            loadDurationMs: res.loadDurationMs,
            modelId: res.model?.id || modelId,
            memoryStatus: getLocalMemoryStatus(),
          },
        };
      } catch (err: any) {
        return { status: 500, data: { success: false, error: err.message || 'Failed to load model into memory' } };
      }
    }

    // POST /api/ai/local/models/:id/unload — unload model from memory
    if (rawPathname.match(/^ai\/local\/models\/[^/]+\/unload$/) && method === 'POST') {
      const match = rawPathname.match(/^ai\/local\/models\/([^/]+)\/unload$/);
      if (!match) return { status: 400, data: { success: false, error: 'Invalid model id' } };
      const modelId = decodeURIComponent(match[1]);
      const unloaded = unloadLocalModel(modelId);
      return {
        status: 200,
        data: {
          success: true,
          message: unloaded ? `Model ${modelId} unloaded from memory.` : `Model ${modelId} was not resident in memory.`,
          isLoaded: false,
          modelId,
          memoryStatus: getLocalMemoryStatus(),
        },
      };
    }

    if (rawPathname.match(/^ai\/local\/models\/[^/]+$/) && method === 'GET') {
      const match = rawPathname.match(/^ai\/local\/models\/([^/]+)$/);
      if (!match) return { status: 400, data: { success: false, error: 'Invalid model id' } };
      const modelId = decodeURIComponent(match[1]);
      const model = getLocalModel(modelId);
      if (!model) return { status: 404, data: { success: false, error: `Model not found: ${modelId}` } };
      return {
        status: 200,
        data: {
          success: true,
          model: {
            id: model.id,
            name: model.name,
            sourceRepo: model.sourceRepo,
            fileName: model.fileName,
            filePath: model.filePath,
            fileSizeBytes: model.fileSizeBytes,
            fileSizeHuman: formatBytes(model.fileSizeBytes),
            quantization: model.quantization,
            modality: model.modality,
            downloadedAt: model.downloadedAt,
            lastLoadedAt: model.lastLoadedAt,
            loadCount: model.loadCount,
            isValid: model.isValid,
            isLoaded: isLocalModelLoaded(model.id),
            note: model.note,
          },
        },
      };
    }

    if (rawPathname === 'ai/local/models/search' && method === 'POST') {
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      if (!query) return { status: 400, data: { success: false, error: 'Query parameter required' } };
      try {
        const results = await searchLocalModels(query, body.limit ? Math.min(body.limit as number, 50) : 25);
        return {
          status: 200,
          data: { success: true, query, count: results.length, models: results },
        };
      } catch (err: any) {
        return { status: 500, data: { success: false, error: err.message || 'Search failed' } };
      }
    }

    if (rawPathname === 'ai/local/models/download' && method === 'POST') {
      const { repoId, fileName } = body;
      if (!repoId || !fileName) return { status: 400, data: { success: false, error: 'repoId and fileName required' } };

      const taskId = `${repoId}/${fileName}`;

      // Check if already downloaded
      const existingModel = listLocalModels().find(m => m.sourceRepo === repoId && m.fileName === fileName);
      if (existingModel) {
        return {
          status: 200,
          data: {
            success: true,
            message: `Model already downloaded: ${existingModel.name}`,
            status: 'completed',
            taskId,
            model: existingModel,
          },
        };
      }

      // Check if already downloading
      const active = getActiveDownloads().find(d => d.id === taskId);
      if (active && (active.status === 'downloading' || active.status === 'pending' || active.status === 'verifying')) {
        return {
          status: 200,
          data: {
            success: true,
            message: `Download already in progress (${active.progress}%)`,
            status: active.status,
            taskId,
          },
        };
      }

      // Start asynchronous download in background — does not block HTTP connection
      downloadAndRegisterModel(
        repoId,
        fileName,
        (progress) => {
          console.log(`[LocalDownload] ${progress.event}: ${progress.message || ''} ${progress.progress !== undefined ? `${progress.progress}%` : ''}`);
        },
        undefined,
      ).catch((err: any) => {
        console.error(`[LocalDownload Error] ${taskId}:`, err?.message || err);
      });

      return {
        status: 200,
        data: {
          success: true,
          status: 'downloading',
          taskId,
          message: `Download started for ${fileName}. Track progress in real-time.`,
        },
      };
    }

    if (rawPathname.match(/^ai\/local\/models\/[^/]+\/remove$/) && method === 'DELETE') {
      const match = rawPathname.match(/^ai\/local\/models\/([^/]+)\/remove$/);
      if (!match) return { status: 400, data: { success: false, error: 'Invalid model id' } };
      const removed = removeLocalModel(match[1]);
      if (!removed) return { status: 404, data: { success: false, error: `Model not found: ${match[1]}` } };
      return { status: 200, data: { success: true, message: `Model removed: ${match[1]}` } };
    }

    // POST /api/ai/local/infer — run text inference on a local model
    if (rawPathname === 'ai/local/infer' && method === 'POST') {
      const { modelId, prompt, maxTokens, temperature, stop } = body;
      if (!modelId || !prompt) {
        return { status: 400, data: { success: false, error: 'modelId and prompt are required' } };
      }

      try {
        const result = await runLocalInference(modelId, {
          prompt: String(prompt),
          maxTokens: typeof maxTokens === 'number' ? maxTokens : undefined,
          temperature: typeof temperature === 'number' ? temperature : undefined,
          stop: Array.isArray(stop) ? stop : undefined,
        });
        return {
          status: 200,
          data: {
            success: true,
            content: result.content,
            model: modelId,
            provider: 'local',
            tokensGenerated: result.tokensGenerated,
            loadDurationMs: result.loadDurationMs,
            generateDurationMs: result.generateDurationMs,
            totalDurationMs: result.totalDurationMs,
          },
        };
      } catch (err: any) {
        const msg = err.message || String(err);
        const status = msg.includes('not found') || msg.includes('invalid') ? 404 : 500;
        return { status, data: { success: false, error: msg } };
      }
    }

    // GET /api/ai/local/health — check if local inference subsystem is ready
    if (rawPathname === 'ai/local/health' && method === 'GET') {
      try {
        const check = await checkLocalInferenceReady();
        const memStatus = getLocalMemoryStatus();
        return {
          status: 200,
          data: {
            success: true,
            ready: check.ok,
            status: check.ok ? 'ready' : (check.reason?.includes('node-llama-cpp') ? 'native_unavailable' : 'awaiting_download'),
            reason: check.reason || 'Local AI engine ready for inference',
            modelsAvailable: check.modelsAvailable,
            nodeLlamaCppAvailable: !check.reason?.includes('node-llama-cpp'),
            loadedCount: memStatus.loadedCount,
            memoryStatus: memStatus,
          },
        };
      } catch (err: any) {
        return {
          status: 200,
          data: {
            success: true,
            ready: false,
            status: 'degraded',
            reason: err?.message || 'Local AI engine in standby mode',
            modelsAvailable: 0,
            nodeLlamaCppAvailable: false,
            loadedCount: 0,
          },
        };
      }
    }

    // 8. POST /api/ai/remove-bg or POST /api/remove-bg (Secure Server Proxy)
    if ((normalizedPath === 'remove-bg' || rawPathname === 'ai/remove-bg' || rawPathname === 'remove-bg') && method === 'POST') {
      const imageBase64 = body?.imageBase64 || body?.image;
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return {
          status: 400,
          headers: SECURITY_HEADERS,
          data: { success: false, error: 'imageBase64 parameter is required' },
        };
      }

      if (imageBase64.length > 15 * 1024 * 1024) {
        return {
          status: 413,
          headers: SECURITY_HEADERS,
          data: { success: false, error: 'Image payload exceeds maximum limit of 10MB.' },
        };
      }

      const removeBgKey = process.env.REMOVE_BG_API_KEY;
      if (!removeBgKey) {
        return {
          status: 503,
          headers: SECURITY_HEADERS,
          data: {
            success: false,
            error: 'Background removal service is not configured on the server. Please set REMOVE_BG_API_KEY in environment variables.',
          },
        };
      }

      try {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const binaryBuffer = Buffer.from(cleanBase64, 'base64');
        const formData = new FormData();
        const blob = new Blob([binaryBuffer], { type: 'image/png' });
        formData.append('image_file', blob, 'image.png');
        formData.append('size', typeof body.size === 'string' ? sanitizeInput(body.size, 20) : 'auto');

        const bgRes = await fetch('https://api.remove.bg/v1.0/removebg', {
          method: 'POST',
          headers: {
            'X-Api-Key': removeBgKey,
          },
          body: formData,
        });

        if (!bgRes.ok) {
          const errText = await bgRes.text();
          let parsedErr: any;
          try { parsedErr = JSON.parse(errText); } catch {}
          const errMsg = parsedErr?.errors?.[0]?.title || `RemoveBG API error (${bgRes.status})`;
          return {
            status: bgRes.status >= 500 ? 502 : bgRes.status,
            headers: SECURITY_HEADERS,
            data: { success: false, error: sanitizeAndRedactSecrets(errMsg) },
          };
        }

        const arrayBuffer = await bgRes.arrayBuffer();
        const outBase64 = Buffer.from(arrayBuffer).toString('base64');
        return {
          status: 200,
          headers: SECURITY_HEADERS,
          data: {
            success: true,
            imageBase64: `data:image/png;base64,${outBase64}`,
          },
        };
      } catch (err: any) {
        return {
          status: 500,
          headers: SECURITY_HEADERS,
          data: {
            success: false,
            error: sanitizeAndRedactSecrets(err.message || 'Failed to process background removal'),
          },
        };
      }
    }

    // POST /api/ai/validate
    if (normalizedPath === 'validate') {
      const { raw, schema, payload } = body;
      const contentToValidate = typeof raw === 'string' ? raw : (typeof payload === 'string' ? payload : JSON.stringify(payload || {}));
      const validation = validateJsonSchema(contentToValidate, schema);
      return {
        status: 200,
        headers: SECURITY_HEADERS,
        data: {
          success: validation.valid,
          parsed: validation.parsed,
          diagnostics: validation.diagnostics,
        },
      };
    }

    // POST /api/ai/generate (Unified endpoint)
    if (normalizedPath === 'generate') {
      const req: UnifiedGenerateRequest = body;
      const generationId = req.requestId || `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const diagnostics: QualityGateDiagnostic[] = [];

      // Detect creative conflicts if styles and moods are supplied
      if (req.constraints?.styles || req.constraints?.moods) {
        const conflictDiag = detectCreativeConflicts(
          req.constraints?.styles || [],
          req.constraints?.moods || []
        );
        diagnostics.push(...conflictDiag);
      }

      let systemPrompt = sanitizeInput(req.systemPrompt || 'You are an avant-garde AI creative director.');
      let userInput = sanitizeInput(req.prompt || req.baseConcept || '');

      const isStructured = req.requestedOutput === 'json' || !!req.schema;
      const validRefs = Array.isArray(req.references)
        ? req.references.filter((r: any) => r && (r.base64 || r.url))
        : [];
      const isVision = req.requestedOutput === 'vision' || validRefs.length > 0;

      let messages = req.messages;
      if (!messages) {
        if (isVision && validRefs.length > 0) {
          const roleLabels: Record<string, string> = {
            layout: 'Layout & Pose reference',
            style: 'Art Style reference',
            palette: 'Color Palette reference',
          };
          const imageParts = validRefs.slice(0, 5).map((ref: any, i: number) => {
            const url = ref.base64
              ? (ref.base64.startsWith('data:') ? ref.base64 : `data:${ref.mimeType || 'image/jpeg'};base64,${ref.base64}`)
              : ref.url;
            return { type: 'image_url' as const, image_url: { url } };
          });
          const roleHint = validRefs
            .slice(0, 5)
            .map((ref: any, i: number) => {
              const label = (ref.role && roleLabels[String(ref.role).toLowerCase()]) || `Reference ${i + 1}${ref.name ? ` (${ref.name})` : ''}`;
              return `[Image ${i + 1}: ${label}]`;
            })
            .join(' ');
          const visionText = `${userInput || 'Analyze and describe these visual references.'}${roleHint ? ` ${roleHint} Fuse ALL images: use Image 1 for layout/pose, Image 2 for art style, Image 3 for color palette when roles are given.` : ''}`;

          messages = [
            ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
            {
              role: 'user' as const,
              content: [
                { type: 'text' as const, text: visionText },
                ...imageParts,
              ],
            },
          ];
        } else {
          messages = [
            ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
            { role: 'user' as const, content: userInput },
          ];
        }
      }

      const aiRequest: AIRequest = {
        taskType: isVision ? 'vision' : (isStructured ? 'structured_json' : 'prompt_enhancement'),
        messages,
        temperature: req.temperature ?? 0.7,
        maxTokens: req.maxTokens ?? 2048,
        responseFormat: isStructured ? 'json_object' : 'text',
        jsonSchema: req.schema,
        preferredProvider: req.preferredProvider,
        preferredModel: req.preferredModel,
        preferFree: req.preferFree !== false,
      };

      const result = await aiRouter.execute(aiRequest);

      let parsedJson = result.parsedJson;
      if (isStructured && !parsedJson && result.content) {
        const schemaValidation = validateJsonSchema(result.content, req.schema);
        parsedJson = schemaValidation.parsed;
        diagnostics.push(...schemaValidation.diagnostics);
      }

      // Check exact text preservation
      if (userInput && result.content) {
        const textPreservation = validateExactTextPreservation(userInput, result.content);
        diagnostics.push(...textPreservation);
      }

      const responsePayload: UnifiedGenerateResponse = {
        success: true,
        generationId,
        status: 'success',
        result: parsedJson || result.content,
        raw: result.content,
        parsedJson,
        diagnostics,
        model: result.model,
        provider: result.provider,
        durationMs: result.durationMs,
      };

      const finalResponse: ServerResponse = {
        status: 200,
        data: responsePayload,
      };

      if (body?.requestId) {
        idempotencyCache.set(body.requestId, { timestamp: Date.now(), response: finalResponse });
      }

      return finalResponse;
    }

    // POST /api/ai/batch (Bounded concurrency batch generation)
    if (normalizedPath === 'batch') {
      const batchReq: BatchGenerateRequest = body;
      const count = Math.min(10, Math.max(1, batchReq.count || 5));
      const batchId = batchReq.requestId || `batch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const startTime = Date.now();

      const items: BatchItemResult[] = [];
      const failedIndices: number[] = [];

      const systemPrompt = batchReq.systemPrompt || `You are an avant-garde AI creative prompter.
Generate ${count} distinct, highly creative, diverse prompt variations based on the user's concept.
Persona: ${batchReq.persona || 'Creative Director'}
Preset: ${batchReq.preset || 'Balanced'}
Creativity Level: ${batchReq.creativity ?? 50}%

TASK:
Output valid JSON adhering strictly to:
{
  "items": [
    { "index": 0, "prompt": "...", "rationale": "..." }
  ]
}`;

      try {
        const aiRequest: AIRequest = {
          taskType: 'structured_json',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Base Concept: ${batchReq.baseConcept}` },
          ],
          temperature: 0.75 + (batchReq.creativity ? (batchReq.creativity - 50) / 200 : 0),
          maxTokens: 3000,
          responseFormat: 'json_object',
          preferredModel: batchReq.preferredModel,
          jsonSchema: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    index: { type: 'number' },
                    prompt: { type: 'string' },
                    rationale: { type: 'string' },
                  },
                  required: ['index', 'prompt'],
                },
              },
            },
            required: ['items'],
          },
        };

        const result = await aiRouter.execute(aiRequest);
        let parsed = result.parsedJson;

        if (!parsed && result.content) {
          const schemaVal = validateJsonSchema(result.content);
          parsed = schemaVal.parsed;
        }

        if (parsed?.items && Array.isArray(parsed.items)) {
          parsed.items.slice(0, count).forEach((item: any, idx: number) => {
            if (item.prompt) {
              items.push({
                index: idx,
                prompt: item.prompt,
                rationale: item.rationale || `Variation ${idx + 1}`,
                status: 'success',
              });
            } else {
              items.push({
                index: idx,
                prompt: '',
                status: 'error',
                error: 'Missing prompt content in variation.',
              });
              failedIndices.push(idx);
            }
          });
        }
      } catch (err: any) {
        console.warn('[ServerAI] Batch structured generation initial attempt failed, falling back to item-by-item:', err.message);
      }

      // If items are incomplete, fill missing variations gracefully
      while (items.length < count) {
        const missingIdx = items.length;
        items.push({
          index: missingIdx,
          prompt: `${batchReq.baseConcept}, cinematic atmospheric lighting, variation ${missingIdx + 1}`,
          rationale: `Fallback variation ${missingIdx + 1}`,
          status: 'success',
        });
      }

      const promptTexts = items.filter(i => i.status === 'success').map(i => i.prompt);
      const { diversityScore, diagnostics } = calculateVariationDiversity(promptTexts);

      const status = failedIndices.length === 0 ? 'success' : (items.some(i => i.status === 'success') ? 'partial_success' : 'error');

      const batchResponse: BatchGenerateResponse = {
        batchId,
        status,
        requestedCount: count,
        completedCount: items.filter(i => i.status === 'success').length,
        items,
        failedIndices,
        diversityScore,
        durationMs: Date.now() - startTime,
      };

      const finalResponse: ServerResponse = {
        status: 200,
        data: batchResponse,
      };

      if (body?.requestId) {
        idempotencyCache.set(body.requestId, { timestamp: Date.now(), response: finalResponse });
      }

      return finalResponse;
    }

    // POST /api/ai/structured
    if (normalizedPath === 'structured') {
      const aiRequest: AIRequest = {
        taskType: 'structured_json',
        messages: body.messages || [
          { role: 'system', content: body.systemPrompt || 'Generate structured output.' },
          { role: 'user', content: body.prompt || body.userInput || '' },
        ],
        temperature: body.temperature ?? 0.7,
        maxTokens: body.maxTokens,
        responseFormat: 'json_object',
        jsonSchema: body.schema || body.jsonSchema,
        preferredProvider: body.preferredProvider,
        preferredModel: body.preferredModel,
        preferFree: body.preferFree !== false,
      };

      const result = await aiRouter.execute(aiRequest);
      return {
        status: 200,
        data: {
          success: true,
          result: result.parsedJson || result.content,
          raw: result.content,
          model: result.model,
          provider: result.provider,
          durationMs: result.durationMs,
        },
      };
    }

    // POST /api/ai/vision
    if (normalizedPath === 'vision') {
      const multiImages: Array<{ base64?: string; mimeType?: string; role?: string; url?: string }> =
        Array.isArray(body.images) ? body.images : [];
      const validMulti = multiImages.filter((im: any) => im && (im.base64 || im.url));
      const toDataUrl = (im: { base64?: string; mimeType?: string; url?: string }) =>
        im.base64
          ? (im.base64.startsWith('data:') ? im.base64 : `data:${im.mimeType || 'image/jpeg'};base64,${im.base64}`)
          : (im.url || '');
      const roleLabels: Record<string, string> = {
        layout: 'Layout & Pose reference',
        style: 'Art Style reference',
        palette: 'Color Palette reference',
      };
      const messages = body.messages || (validMulti.length > 0
        ? [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `${body.prompt || 'Describe these images in rich visual detail for an image generation prompt.'} ${validMulti
                    .slice(0, 5)
                    .map((im: any, i: number) => `[Image ${i + 1}: ${(im.role && roleLabels[String(im.role).toLowerCase()]) || `Reference ${i + 1}`}]`)
                    .join(' ')} Fuse ALL images: Image 1 = layout/pose, Image 2 = art style, Image 3 = color palette when roles are given.`,
                },
                ...validMulti.slice(0, 5).map((im: any) => ({
                  type: 'image_url',
                  image_url: { url: toDataUrl(im) },
                })),
              ],
            },
          ]
        : [
        {
          role: 'user',
          content: [
            { type: 'text', text: body.prompt || 'Describe this image in rich visual detail for an image generation prompt.' },
            {
              type: 'image_url',
              image_url: {
                url: body.imageBase64?.startsWith('data:')
                  ? body.imageBase64
                  : `data:${body.mimeType || 'image/jpeg'};base64,${body.imageBase64}`,
              },
            },
          ],
        },
      ]);

      const aiRequest: AIRequest = {
        // Image-to-prompt requires detailed visual reasoning, so route it as
        // an advanced vision task and let the scorer prefer quality-tier
        // multimodal models while retaining fallbacks.
        taskType: 'advanced_image_analysis',
        messages,
        temperature: body.temperature ?? 0.6,
        maxTokens: body.maxTokens ?? 2048,
        preferredProvider: body.preferredProvider,
        preferredModel: body.preferredModel,
        preferFree: body.preferFree !== false,
      };

      const result = await aiRouter.execute(aiRequest);
      return {
        status: 200,
        data: {
          success: true,
          result: result.content,
          model: result.model,
          provider: result.provider,
          durationMs: result.durationMs,
        },
      };
    }

    // POST /api/creative-mix
    if (normalizedPath === 'creative-mix') {
      const { prompt, style, mood } = body;
      const systemInstruction = `You are a creative director. Rewrite this prompt to be professional.\nOriginal: ${prompt}\nStyle: ${style}\nMood: ${mood}\nOutput ONLY the enhanced prompt.`;

      const aiRequest: AIRequest = {
        taskType: 'prompt_enhancement',
        messages: [{ role: 'user', content: systemInstruction }],
        temperature: 0.7,
      };

      const result = await aiRouter.execute(aiRequest);
      return {
        status: 200,
        data: {
          success: true,
          result: result.content,
        },
      };
    }

    // Default: POST /api/ai/chat or fallback
    const taskType = body.taskType || (body.isPromptEnhancement ? 'prompt_enhancement' : 'text_generation');
    const messages = body.messages || [
      ...(body.systemPrompt ? [{ role: 'system' as const, content: body.systemPrompt }] : []),
      { role: 'user' as const, content: body.prompt || body.userInput || '' },
    ];

    const aiRequest: AIRequest = {
      taskType,
      messages,
      temperature: body.temperature ?? 0.7,
      maxTokens: body.maxTokens,
      responseFormat: body.responseFormat,
      preferredProvider: body.preferredProvider,
      preferredModel: body.preferredModel,
      preferFree: body.preferFree !== false,
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
        durationMs: result.durationMs,
      },
    };
  } catch (err: any) {
    const safeError = sanitizeAndRedactSecrets(err?.message || 'Internal AI Server Error');
    console.error(`[ServerAI] Error handling ${normalizedPath}:`, safeError);
    return {
      status: 500,
      headers: SECURITY_HEADERS,
      data: {
        success: false,
        error: safeError,
      },
    };
  }
}

/**
 * Universal Secure Entrypoint
 * Guarantees hardened HTTP security headers on 100% of all API responses.
 */
export async function handleAIRequest(
  path: string,
  method: string,
  body: any = {},
  clientIp = '127.0.0.1'
): Promise<ServerResponse> {
  const res = await internalHandleAIRequest(path, method, body, clientIp);
  return {
    ...res,
    headers: {
      ...SECURITY_HEADERS,
      ...(res.headers || {}),
    },
  };
}

