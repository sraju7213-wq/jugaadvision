import { beforeEach, describe, expect, it, vi } from 'vitest';

const { DISCOVERED } = vi.hoisted(() => ({
  DISCOVERED: [
    {
      id: 'free-vision',
      provider: 'openrouter',
      name: 'Free Vision',
      capabilities: ['text', 'vision'],
      modalities: ['text', 'vision'],
      isFree: true,
      freeEligibility: 'free',
      tier: 'balanced',
      supportsStructuredJson: true,
      pricing: { prompt: 0, completion: 0, isZeroCost: true },
    },
    {
      id: 'paid-vision',
      provider: 'openrouter',
      name: 'Paid Vision',
      capabilities: ['text', 'vision'],
      modalities: ['text', 'vision'],
      isFree: false,
      freeEligibility: 'paid',
      tier: 'quality',
      supportsStructuredJson: true,
      pricing: { prompt: 0.000001, completion: 0.000002, isZeroCost: false },
    },
    {
      id: 'free-text',
      provider: 'openrouter',
      name: 'Free Text',
      capabilities: ['text'],
      modalities: ['text'],
      isFree: true,
      freeEligibility: 'free',
      tier: 'fast',
      supportsStructuredJson: true,
      pricing: { prompt: 0, completion: 0, isZeroCost: true },
    },
  ],
}));

vi.mock('@jugaad/api/ai/pools/keyPool', () => ({
  SUPPORTED_PROVIDERS: ['openrouter'],
  keyPoolManager: { getAvailableKey: vi.fn(() => 'test-key'), hasConfiguredKeys: vi.fn(() => true) },
}));

vi.mock('@jugaad/api/ai/adapters/openrouterAdapter', () => ({
  OpenRouterAdapter: class {
    isConfigured() {
      return true;
    }
    async discoverModels() {
      return DISCOVERED;
    }
  },
}));

vi.mock('@jugaad/api/ai/adapters/customEndpointAdapter', () => ({
  CustomEndpointAdapter: class {
    isConfigured() {
      return false;
    }
    async discoverModels() {
      return [];
    }
  },
}));

import {
  getModelCatalog,
  invalidateModelCatalog,
  isFreeModel,
  isVisionCapableModel,
} from '@jugaad/api/ai/modelCatalog';

describe('modelCatalog capability helpers', () => {
  it('detects free models from flags and zero pricing', () => {
    expect(isFreeModel({ isFree: true } as any)).toBe(true);
    expect(isFreeModel({ pricing: { prompt: 0, completion: 0, isZeroCost: true } } as any)).toBe(true);
    expect(isFreeModel({ pricing: { prompt: 1, completion: 1, isZeroCost: false } } as any)).toBe(false);
  });

  it('detects vision support from capabilities or modalities', () => {
    expect(isVisionCapableModel({ capabilities: ['text', 'vision'] } as any)).toBe(true);
    expect(isVisionCapableModel({ modalities: ['text', 'vision'] } as any)).toBe(true);
    expect(isVisionCapableModel({ capabilityMap: { vision: 'supported' } } as any)).toBe(true);
    expect(isVisionCapableModel({ capabilities: ['text'] } as any)).toBe(false);
  });
});

describe('getModelCatalog', () => {
  beforeEach(() => invalidateModelCatalog());

  it('returns only vision-capable free models for a vision task', async () => {
    const catalog = await getModelCatalog({ taskType: 'advanced_image_analysis' });
    expect(catalog.success).toBe(true);
    expect(catalog.models.map(m => m.id)).toEqual(['free-vision']);
    expect(catalog.count).toBe(1);
    expect(catalog.lastRefreshed).toEqual(expect.any(String));
  });

  it('keeps free text models for non-vision tasks', async () => {
    const catalog = await getModelCatalog({ taskType: 'text_generation' });
    expect(catalog.models.map(m => m.id).sort()).toEqual(['free-text', 'free-vision']);
  });

  it('can include paid models when freeOnly is disabled', async () => {
    const catalog = await getModelCatalog({ taskType: 'advanced_image_analysis', freeOnly: false });
    expect(catalog.models.map(m => m.id).sort()).toEqual(['free-vision', 'paid-vision']);
  });
});
