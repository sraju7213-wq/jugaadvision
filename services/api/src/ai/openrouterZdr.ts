import { fetchWithTimeout } from './adapters/baseAdapter';

/**
 * OpenRouter Zero Data Retention (ZDR) helpers.
 *
 * When an account enables ZDR, OpenRouter removes every endpoint that is not
 * ZDR-classified. Free endpoints almost always collect/train on data, so
 * free models frequently have zero eligible endpoints and the request fails
 * with a 404 `zdr-violation-by-account`.
 *
 * `GET /api/v1/endpoints/zdr` is the authoritative list of ZDR-classified
 * endpoints. We use it to (a) detect that failure and (b) transparently retry
 * with the closest ZDR-compatible model.
 */

const ZDR_ENDPOINTS_URL = 'https://openrouter.ai/api/v1/endpoints/zdr';
const MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_TTL_MS = 10 * 60 * 1000;

interface ZdrEntry {
  model_id: string;
  pricing?: { prompt?: string; completion?: string };
}

interface OpenRouterModel {
  id: string;
  architecture?: { input_modalities?: string[] };
  pricing?: { prompt?: string; completion?: string };
}

let zdrCache: { entries: ZdrEntry[]; at: number } | null = null;
let modelsCache: { models: OpenRouterModel[]; at: number } | null = null;

/** Non-chat models that technically accept image input but cannot analyze images. */
const NON_VISION_CHAT_MODEL = /(embed|rerank|guard|safety|moderation|summar|extract|lyria|audio|tts|whisper|image-gen|flux|stable-diffusion|sdxl|dall-e|midjourney)/i;

/**
 * Cheap, reliable ZDR-classified vision models, tried before falling back to
 * pure price sorting. Reasoning-only models can return an empty answer when
 * the token budget is small, so they are not ideal as a silent fallback.
 */
const PREFERRED_ZDR_VISION_MODELS = [
  'google/gemma-4-26b-a4b-it',
  'google/gemma-4-31b-it',
  'google/gemma-3-12b-it',
  'google/gemma-3-4b-it',
  'mistralai/mistral-small-3.2-24b-instruct',
  'meta-llama/llama-3.2-11b-vision-instruct',
];

function authHeaders(apiKey?: string): Record<string, string> {
  return apiKey
    ? { Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': 'https://jugaadvisuals.app', 'X-Title': 'JugaadVision AI Toolkit' }
    : { 'HTTP-Referer': 'https://jugaadvisuals.app', 'X-Title': 'JugaadVision AI Toolkit' };
}

export function isZdrViolationError(message?: string): boolean {
  if (!message) return false;
  return /zdr[-\s]?violation|zero data retention|guardrail restrictions/i.test(message);
}

async function fetchZdrEntries(apiKey?: string): Promise<ZdrEntry[]> {
  if (zdrCache && Date.now() - zdrCache.at < CACHE_TTL_MS) return zdrCache.entries;
  try {
    const res = await fetchWithTimeout(ZDR_ENDPOINTS_URL, { headers: authHeaders(apiKey) }, 15000);
    if (!res.ok) throw new Error(`ZDR catalog request failed (${res.status})`);
    const json: any = await res.json();
    const entries: ZdrEntry[] = Array.isArray(json?.data) ? json.data : [];
    zdrCache = { entries, at: Date.now() };
    return entries;
  } catch (err: any) {
    console.warn('[OpenRouterZDR] Unable to fetch ZDR catalog:', err?.message || err);
    return zdrCache?.entries || [];
  }
}

async function fetchModels(apiKey?: string): Promise<OpenRouterModel[]> {
  if (modelsCache && Date.now() - modelsCache.at < CACHE_TTL_MS) return modelsCache.models;
  try {
    const res = await fetchWithTimeout(MODELS_URL, { headers: authHeaders(apiKey) }, 15000);
    if (!res.ok) throw new Error(`Model catalog request failed (${res.status})`);
    const json: any = await res.json();
    const models: OpenRouterModel[] = Array.isArray(json?.data) ? json.data : [];
    modelsCache = { models, at: Date.now() };
    return models;
  } catch (err: any) {
    console.warn('[OpenRouterZDR] Unable to fetch model catalog:', err?.message || err);
    return modelsCache?.models || [];
  }
}

/**
 * Pick the best model that is actually routable while ZDR is enforced.
 *
 * Order of preference:
 *  1. The paid twin of the requested free model (e.g. `foo/bar:free` → `foo/bar`).
 *  2. The cheapest ZDR-classified model that can still handle the task.
 */
export async function resolveZdrFallbackModel(options: {
  apiKey?: string;
  preferredModel?: string;
  vision?: boolean;
}): Promise<string | null> {
  const entries = await fetchZdrEntries(options.apiKey);
  if (entries.length === 0) return null;

  const zdrModelIds = new Set(entries.map(entry => entry.model_id));
  const models = await fetchModels(options.apiKey);
  const modelById = new Map(models.map(model => [model.id, model]));

  const supportsRequestedTask = (id: string) => {
    if (!options.vision) return true;
    const inputModalities = (modelById.get(id)?.architecture?.input_modalities || [])
      .map(modality => modality.toLowerCase());
    return inputModalities.includes('image');
  };

  const paidTwin = options.preferredModel?.replace(/:free$/i, '');
  if (paidTwin && zdrModelIds.has(paidTwin) && supportsRequestedTask(paidTwin)) return paidTwin;

  const candidates: Array<{ id: string; cost: number }> = [];

  for (const model of models) {
    if (!zdrModelIds.has(model.id)) continue;
    if (NON_VISION_CHAT_MODEL.test(model.id)) continue;
    if (!supportsRequestedTask(model.id)) continue;
    const prompt = parseFloat(model.pricing?.prompt ?? '0') || 0;
    const completion = parseFloat(model.pricing?.completion ?? '0') || 0;
    candidates.push({ id: model.id, cost: prompt + completion });
  }

  for (const preferredId of PREFERRED_ZDR_VISION_MODELS) {
    if (candidates.some(candidate => candidate.id === preferredId)) return preferredId;
  }

  candidates.sort((a, b) => a.cost - b.cost);
  return candidates[0]?.id ?? null;
}
