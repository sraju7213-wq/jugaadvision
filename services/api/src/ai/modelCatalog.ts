import type { AIModel } from '@jugaad/core/types';
import { keyPoolManager, SUPPORTED_PROVIDERS } from './pools/keyPool';
import { CustomEndpointAdapter } from './adapters/customEndpointAdapter';
import { OpenRouterAdapter } from './adapters/openrouterAdapter';
import type { IProviderAdapter } from './adapters/baseAdapter';

/**
 * Live model catalog.
 *
 * After a provider key is configured the client expects to see every
 * vision-capable, zero-cost model that the provider currently exposes. This
 * module discovers models straight from each configured provider's adapter
 * (`/models`) and keeps a short-lived cache so the catalog endpoint does not
 * hammer upstream providers on every render.
 */

/** Task types that require image/vision understanding. */
const VISION_TASKS = new Set<string>(['vision', 'advanced_image_analysis', 'image_analysis']);

/** How long a discovery result is considered fresh before a GET re-discovers. */
const CACHE_TTL_MS = 5 * 60 * 1000;

const adapters: Record<string, IProviderAdapter> = {
  custom: new CustomEndpointAdapter(),
  openrouter: new OpenRouterAdapter(),
};

interface CatalogCache {
  models: AIModel[];
  lastRefreshed: number;
}

let cache: CatalogCache | null = null;
let inFlight: Promise<AIModel[]> | null = null;

export function isVisionCapableModel(model: AIModel): boolean {
  return Boolean(
    model?.capabilityMap?.vision === 'supported' ||
      (Array.isArray(model?.capabilities) && model.capabilities.includes('vision')) ||
      (Array.isArray(model?.modalities) && model.modalities.includes('vision')),
  );
}

export function isFreeModel(model: AIModel): boolean {
  if (model?.isFree === true) return true;
  if (model?.freeEligibility === 'free') return true;
  if (model?.pricing && model.pricing.prompt === 0 && model.pricing.completion === 0) return true;
  return model?.inputCost === 0 && model?.outputCost === 0;
}

const TIER_ORDER: Record<string, number> = { quality: 0, balanced: 1, fast: 2 };

function sortModels(a: AIModel, b: AIModel): number {
  const tierDiff = (TIER_ORDER[String(a.tier)] ?? 1) - (TIER_ORDER[String(b.tier)] ?? 1);
  if (tierDiff !== 0) return tierDiff;
  return String(a.name || a.id).localeCompare(String(b.name || b.id));
}

/** Discover models from every provider that currently has a usable key. */
export async function refreshModelCatalog(): Promise<AIModel[]> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const discovered: AIModel[] = [];
    const seen = new Set<string>();

    for (const provider of SUPPORTED_PROVIDERS) {
      const adapter = adapters[provider];
      if (!adapter || !adapter.isConfigured()) continue;

      const key =
        keyPoolManager.getAvailableKey(provider) ||
        (provider === 'custom' ? '__custom_endpoint__' : '');
      if (!key) continue;

      try {
        const models = await adapter.discoverModels(key);
        for (const model of models || []) {
          const providerModelId = model.providerModelId || model.id;
          const dedupeKey = `${model.provider || provider}:${providerModelId}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          discovered.push({ ...model, providerModelId });
        }
      } catch (err: any) {
        console.warn(`[ModelCatalog] Discovery failed for provider '${provider}':`, err?.message || err);
      }
    }

    cache = { models: discovered, lastRefreshed: Date.now() };
    return discovered;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export interface ModelCatalogResult {
  success: true;
  freeOnly: boolean;
  taskType: string | null;
  count: number;
  lastRefreshed: string;
  models: AIModel[];
  categories: Record<string, { fast: AIModel[]; balanced: AIModel[]; quality: AIModel[] }>;
}

export async function getModelCatalog(
  options: { taskType?: string; freeOnly?: boolean } = {},
): Promise<ModelCatalogResult> {
  const freeOnly = options.freeOnly !== false;
  const taskType = options.taskType || null;
  const visionTask = !!taskType && VISION_TASKS.has(taskType);

  const isStale = !cache || Date.now() - cache.lastRefreshed > CACHE_TTL_MS;
  if (isStale || !cache || cache.models.length === 0) {
    try {
      await refreshModelCatalog();
    } catch (err: any) {
      console.warn('[ModelCatalog] Refresh failed:', err?.message || err);
    }
  }

  let models = cache?.models ?? [];
  if (freeOnly) models = models.filter(isFreeModel);
  if (visionTask) models = models.filter(isVisionCapableModel);
  models = [...models].sort(sortModels);

  const lastRefreshed = new Date(cache?.lastRefreshed ?? Date.now()).toISOString();

  // Keep the legacy categorized shape available; the client groups by `tier`
  // already, so a single vision bucket is sufficient here.
  const categories: ModelCatalogResult['categories'] = {
    vision: { fast: [], balanced: [], quality: [] },
  };
  for (const model of models) {
    const tier = (['fast', 'balanced', 'quality'] as const).includes(model.tier as any)
      ? (model.tier as 'fast' | 'balanced' | 'quality')
      : 'balanced';
    categories.vision[tier].push(model);
  }

  return {
    success: true,
    freeOnly,
    taskType,
    count: models.length,
    lastRefreshed,
    models,
    categories,
  };
}

/** Drop the cached catalog so the next GET re-discovers (e.g. after a key change). */
export function invalidateModelCatalog(): void {
  cache = null;
}
