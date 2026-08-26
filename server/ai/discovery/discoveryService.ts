import type { IProviderAdapter } from '../adapters/baseAdapter';
import { CloudflareAdapter } from '../adapters/cloudflareAdapter';
import { CustomEndpointAdapter } from '../adapters/customEndpointAdapter';
import { HuggingFaceAdapter } from '../adapters/huggingfaceAdapter';
import { NvidiaNimAdapter } from '../adapters/nimAdapter';
import { OpenRouterAdapter } from '../adapters/openrouterAdapter';
import { keyPoolManager } from '../pools/keyPool';
import type { AIModel, ProviderName } from '../types';

export class ModelDiscoveryService {
  private adapters: Map<ProviderName, IProviderAdapter> = new Map();
  private modelCache: Map<ProviderName, { models: AIModel[]; lastUpdated: number }> = new Map();
  private cacheTtlMs = parseInt(process.env.AI_CACHE_TTL_MS || '3600000', 10); // 1 hour

  constructor() {
    // NIM has live, account-verified cold-start fallbacks. Register it first so
    // equally scored free models do not prefer stale third-party bootstraps.
    this.registerAdapter(new NvidiaNimAdapter());
    this.registerAdapter(new OpenRouterAdapter());
    this.registerAdapter(new HuggingFaceAdapter());
    this.registerAdapter(new CloudflareAdapter());
    this.registerAdapter(new CustomEndpointAdapter());
  }

  public registerAdapter(adapter: IProviderAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  public getAdapter(provider: ProviderName): IProviderAdapter | undefined {
    return this.adapters.get(provider);
  }

  public getAllAdapters(): IProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get models for a provider or all providers.
   * Leverages in-memory caching.
   * If a refresh fails, gracefully falls back to the last valid cached model list.
   */
  public async getDiscoveredModels(provider?: ProviderName, forceRefresh = false): Promise<AIModel[]> {
    const providersToQuery = provider ? [provider] : Array.from(this.adapters.keys());

    // Fast path: if not forced, return cached models synchronously when all are fresh
    if (!forceRefresh) {
      const now = Date.now();
      const allFresh = providersToQuery.every(p => {
        const cached = this.modelCache.get(p);
        return cached && (now - cached.lastUpdated < this.cacheTtlMs) && cached.models.length > 0;
      });
      if (allFresh) {
        return providersToQuery.flatMap(p => this.modelCache.get(p)!.models);
      }
    }

    // Parallel discovery with per-provider timeout
    const results = await Promise.allSettled(
      providersToQuery.map(async (p): Promise<AIModel[]> => {
        const adapter = this.adapters.get(p);
        if (!adapter) return [];

        const cached = this.modelCache.get(p);
        const now = Date.now();

        if (!forceRefresh && cached && (now - cached.lastUpdated < this.cacheTtlMs) && cached.models.length > 0) {
          return cached.models;
        }

        const apiKey = keyPoolManager.getAvailableKey(p);
        if (!apiKey) {
          if (cached && cached.models.length > 0) return cached.models;
          return this.getBootstrapModels(p);
        }

        try {
          // 8s per-provider budget to avoid blocking whole catalog on one slow provider
          const discovered = await Promise.race([
            adapter.discoverModels(apiKey),
            new Promise<AIModel[]>((_, reject) => setTimeout(() => reject(new Error('discovery timeout 8s')), 8000)),
          ]);
          if (discovered && discovered.length > 0) {
            this.modelCache.set(p, { models: discovered, lastUpdated: now });
            console.log(`[ModelDiscovery] Refreshed ${discovered.length} models for ${p}.`);
            return discovered;
          }
          if (cached && cached.models.length > 0) return cached.models;
          return this.getBootstrapModels(p);
        } catch (err: any) {
          console.warn(`[ModelDiscovery] Refresh failed for ${p}: ${err.message}. Retaining existing cache.`);
          if (cached && cached.models.length > 0) return cached.models;
          const bootstrap = this.getBootstrapModels(p);
          this.modelCache.set(p, { models: bootstrap, lastUpdated: now });
          return bootstrap;
        }
      })
    );

    const allModels: AIModel[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') allModels.push(...r.value);
    }
    return allModels;
  }

  public getBootstrapModels(provider: ProviderName): AIModel[] {
    const timestamp = new Date().toISOString();
    switch (provider) {
      case 'openrouter':
        return [
          {
            id: 'google/gemma-2-9b-it:free',
            name: 'Google Gemma 2 9B (Free)',
            provider: 'openrouter',
            inputCost: 0,
            outputCost: 0,
            contextLength: 8192,
            capabilities: ['text', 'json'],
            modalities: ['text', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'fast',
          },
          {
            id: 'meta-llama/llama-3.3-70b-instruct:free',
            name: 'Meta Llama 3.3 70B (Free)',
            provider: 'openrouter',
            inputCost: 0,
            outputCost: 0,
            contextLength: 131072,
            capabilities: ['text', 'json', 'reasoning'],
            modalities: ['text', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'quality',
          },
          {
            id: 'z-ai/glm-5.2:free',
            name: 'GLM 5.2 (Free)',
            provider: 'openrouter',
            inputCost: 0,
            outputCost: 0,
            contextLength: 32768,
            capabilities: ['text', 'json'],
            modalities: ['text', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'balanced',
          },
        ];

      case 'nim':
        // These are live, account-verified models used while an instance
        // refreshes its provider catalog. Retired models must never be used on
        // a cold serverless request because they consume the retry budget.
        return [
          {
            id: 'meta/llama-3.2-11b-vision-instruct',
            name: 'Meta Llama 3.2 11B Vision Instruct',
            provider: 'nim',
            inputCost: 0,
            outputCost: 0,
            contextLength: 131072,
            capabilities: ['text', 'vision', 'json'],
            modalities: ['text', 'vision', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'fast',
          },
          {
            id: 'nvidia/nemotron-3-nano-30b-a3b',
            name: 'NVIDIA Nemotron 3 Nano 30B',
            provider: 'nim',
            inputCost: 0,
            outputCost: 0,
            contextLength: 32768,
            capabilities: ['text', 'json'],
            modalities: ['text', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'balanced',
          },
          {
            id: 'openai/gpt-oss-20b',
            name: 'GPT-OSS 20B Instruct',
            provider: 'nim',
            inputCost: 0,
            outputCost: 0,
            contextLength: 131072,
            capabilities: ['text', 'json', 'reasoning'],
            modalities: ['text', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'quality',
          },
        ];

      case 'huggingface':
        return [
          {
            id: 'Qwen/Qwen2.5-VL-72B-Instruct',
            name: 'Qwen 2.5 VL 72B Instruct (Hugging Face)',
            provider: 'huggingface',
            inputCost: 0,
            outputCost: 0,
            contextLength: 32768,
            capabilities: ['text', 'vision', 'json'],
            modalities: ['text', 'vision', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'quality',
          },
          {
            id: 'zai-org/GLM-4.6V-Flash',
            name: 'GLM 4.6V Flash (Hugging Face)',
            provider: 'huggingface',
            inputCost: 0,
            outputCost: 0,
            contextLength: 32768,
            capabilities: ['text', 'vision', 'json'],
            modalities: ['text', 'vision', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'fast',
          },
          {
            id: 'CohereLabs/aya-vision-32b',
            name: 'Aya Vision 32B (Hugging Face)',
            provider: 'huggingface',
            inputCost: 0,
            outputCost: 0,
            contextLength: 32768,
            capabilities: ['text', 'vision', 'json'],
            modalities: ['text', 'vision', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'balanced',
          },
          {
            id: 'meta-llama/Llama-3.3-70B-Instruct',
            name: 'Meta Llama 3.3 70B Instruct (Hugging Face)',
            provider: 'huggingface',
            inputCost: 0,
            outputCost: 0,
            contextLength: 131072,
            capabilities: ['text', 'json', 'reasoning'],
            modalities: ['text', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'quality',
          },
        ];

      case 'cloudflare':
        return [
          {
            id: '@cf/meta/llama-3.2-11b-vision-instruct',
            name: 'Meta Llama 3.2 11B Vision (Cloudflare)',
            provider: 'cloudflare',
            inputCost: 0,
            outputCost: 0,
            contextLength: 131072,
            capabilities: ['text', 'vision', 'json'],
            modalities: ['text', 'vision', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'balanced',
          },
          {
            id: '@cf/meta/llama-3.1-8b-instruct',
            name: 'Llama 3.1 8B Instruct (Cloudflare)',
            provider: 'cloudflare',
            inputCost: 0,
            outputCost: 0,
            contextLength: 131072,
            capabilities: ['text', 'json'],
            modalities: ['text', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'fast',
          },
        ];

      case 'custom':
        return [
          {
            id: 'custom',
            name: 'Custom Endpoint Model',
            provider: 'custom',
            inputCost: 0,
            outputCost: 0,
            contextLength: 1048576,
            capabilities: ['text', 'vision', 'json'],
            modalities: ['text', 'vision', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'fast',
          },
          {
            id: 'custom',
            name: 'Custom Endpoint Model',
            provider: 'custom',
            inputCost: 0,
            outputCost: 0,
            contextLength: 1048576,
            capabilities: ['text', 'vision', 'json'],
            modalities: ['text', 'vision', 'json'],
            isFree: true,
            freeEligibility: 'free',
            discoveredTimestamp: timestamp,
            pricing: { prompt: 0, completion: 0, isZeroCost: true },
            supportsStructuredJson: true,
            tier: 'balanced',
          },
        ];

      default:
        return [];
    }
  }
}

export const modelDiscoveryService = new ModelDiscoveryService();
