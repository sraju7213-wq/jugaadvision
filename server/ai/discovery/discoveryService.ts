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
    this.registerAdapter(new OpenRouterAdapter());
    this.registerAdapter(new NvidiaNimAdapter());
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
    const allModels: AIModel[] = [];

    for (const p of providersToQuery) {
      const adapter = this.adapters.get(p);
      if (!adapter) continue;

      const cached = this.modelCache.get(p);
      const now = Date.now();

      // Return cached list if still fresh and not forced
      if (!forceRefresh && cached && (now - cached.lastUpdated < this.cacheTtlMs) && cached.models.length > 0) {
        allModels.push(...cached.models);
        continue;
      }

      const apiKey = keyPoolManager.getAvailableKey(p);
      if (!apiKey) {
        // If no active key is available, use cached models if present, else bootstrap
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
      } catch (err: any) {
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
        return [
          {
            id: 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1',
            name: 'NVIDIA Nemotron Nano VL 8B (Vision)',
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
            id: 'nvidia/nemotron-nano-12b-v2-vl',
            name: 'NVIDIA Nemotron Nano 12B VL (Vision)',
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
            tier: 'balanced',
          },
          {
            id: 'meta/llama-3.1-8b-instruct',
            name: 'Meta Llama 3.1 8B Instruct',
            provider: 'nim',
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
          {
            id: 'meta/llama-3.1-70b-instruct',
            name: 'Meta Llama 3.1 70B Instruct',
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
          {
            id: 'openai/gpt-oss-120b',
            name: 'GPT-OSS 120B Instruct',
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
          {
            id: 'stepfun-ai/step-3.7-flash',
            name: 'Step 3.7 Flash',
            provider: 'nim',
            inputCost: 0,
            outputCost: 0,
            contextLength: 65536,
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
            id: 'meta/muse-glimmer-30b',
            name: 'Meta Muse Glimmer 30B (Creative)',
            provider: 'nim',
            inputCost: 0,
            outputCost: 0,
            contextLength: 65536,
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
