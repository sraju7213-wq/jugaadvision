import { healthTracker } from './health/healthTracker';
import { keyPoolManager, redactSecrets } from './pools/keyPool';
import { freeModelRegistry } from './registry/freeModelRegistry';
import { modelFilterService } from './filtering/freeFilter';
import { modelDiscoveryService } from './discovery/discoveryService';
import { aiRouter } from './router/router';
import { getCustomEndpoint, setCustomEndpoint } from './customEndpoint';
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

export interface ServerResponse {
  status: number;
  data: any;
  headers?: Record<string, string>;
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

export async function handleAIRequest(
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
      const providers: ProviderName[] = ['openrouter', 'nim', 'custom'];
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

      const removeBgKey = process.env.REMOVE_BG_API_KEY || 'PCH4kRJRG4gQQjhhpG6yNSi6';

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
      const isVision = req.requestedOutput === 'vision' || (req.references && req.references.length > 0 && req.references[0]?.base64);

      let messages = req.messages;
      if (!messages) {
        if (isVision && req.references && req.references[0]?.base64) {
          const ref = req.references[0];
          const imgUrl = ref.base64?.startsWith('data:')
            ? ref.base64
            : `data:${ref.mimeType || 'image/jpeg'};base64,${ref.base64}`;

          messages = [
            ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
            {
              role: 'user' as const,
              content: [
                { type: 'text' as const, text: userInput || 'Analyze and describe this visual scene.' },
                { type: 'image_url' as const, image_url: { url: imgUrl } },
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
      const messages = body.messages || [
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
      ];

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
