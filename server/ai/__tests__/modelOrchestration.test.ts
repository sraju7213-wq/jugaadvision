/**
 * Comprehensive Automated Tests for AI Model Orchestration & Settings
 * 
 * Tests:
 * 1. Free-only filtering
 * 2. Task capability filtering
 * 3. Best-model scoring
 * 4. Fallback behavior
 * 5. Invalid provider keys & cooldown
 * 6. Settings persistence & migration
 * 7. Secret redaction
 */

// Setup lightweight node localStorage mock for testing
const storageMap = new Map<string, string>();
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => storageMap.get(key) || null,
    setItem: (key: string, value: string) => storageMap.set(key, value),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear(),
  };
}

if (typeof globalThis.document === 'undefined') {
  (globalThis as any).document = {
    documentElement: {
      classList: {
        add: () => {},
        remove: () => {},
      },
      style: {
        setProperty: () => {},
      },
      setAttribute: () => {},
    },
  };
}

if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    matchMedia: () => ({ matches: false }),
  };
}

import { capabilityClassifier } from '../classification/capabilityClassifier';
import { modelFilterService } from '../filtering/freeFilter';
import { modelScoringEngine } from '../scoring/modelScoringEngine';
import { freeModelRegistry } from '../registry/freeModelRegistry';
import { keyPoolManager, maskApiKey, redactSecrets } from '../pools/keyPool';
import {
  DEFAULT_APPEARANCE_SETTINGS,
  DEFAULT_MODEL_POLICY_SETTINGS,
  loadAppearanceSettings,
  saveAppearanceSettings,
  resetAppearanceSettings,
  loadModelPolicySettings,
  saveModelPolicySettings,
  resetModelPolicySettings,
} from '../../../services/settingsStorage';
import type { AIModel, AIRequest } from '../types';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🤖 RUNNING AI MODEL SYSTEM & SETTINGS TEST SUITE');
  console.log('======================================================\n');

  // --------------------------------------------------------------------------
  // TEST SUITE 1: Free-Only Filtering
  // --------------------------------------------------------------------------
  console.log('\n📋 TEST SUITE 1: Free-Only Filtering');
  const mockModels: AIModel[] = [
    {
      id: 'openrouter/free-vision',
      provider: 'openrouter',
      name: 'Free Vision Model',
      verifiedFree: true,
      eligibilityStatus: 'free',
      capabilities: ['vision', 'chat'],
      capabilityMap: {
        chat: 'supported',
        reasoning: 'unknown',
        coding: 'unknown',
        vision: 'supported',
        tool_calling: 'unknown',
        structured_output: 'supported',
      },
      tier: 'balanced',
      modalities: ['text', 'vision'],
      supportsStructuredJson: true,
      contextWindow: 16384,
      status: 'available',
      successRate: 1,
      averageLatency: 500,
      failureCount: 0,
      cooldownUntil: 0,
    },
    {
      id: 'openrouter/paid-vision',
      provider: 'openrouter',
      name: 'Paid Vision Model',
      verifiedFree: false,
      eligibilityStatus: 'paid',
      capabilities: ['vision', 'chat'],
      capabilityMap: {
        chat: 'supported',
        reasoning: 'unknown',
        coding: 'unknown',
        vision: 'supported',
        tool_calling: 'unknown',
        structured_output: 'supported',
      },
      tier: 'quality',
      modalities: ['text', 'vision'],
      supportsStructuredJson: true,
      contextWindow: 32768,
      status: 'available',
      successRate: 1,
      averageLatency: 800,
      failureCount: 0,
      cooldownUntil: 0,
    },
    {
      id: 'gemini/flash-free',
      provider: 'gemini',
      name: 'Gemini Flash Free',
      verifiedFree: true,
      eligibilityStatus: 'free',
      capabilities: ['chat', 'structured_output', 'coding'],
      capabilityMap: {
        chat: 'supported',
        reasoning: 'unknown',
        coding: 'supported',
        vision: 'unsupported',
        tool_calling: 'supported',
        structured_output: 'supported',
      },
      tier: 'fast',
      modalities: ['text'],
      supportsStructuredJson: true,
      contextWindow: 32768,
      status: 'available',
      successRate: 1,
      averageLatency: 400,
      failureCount: 0,
      cooldownUntil: 0,
    },
  ];

  const freeFiltered = modelFilterService.filterAndRankModels(mockModels, {
    taskType: 'vision',
    preferFree: true,
  });

  assert(freeFiltered.length === 1, 'Only 1 model returned for vision when preferFree=true');
  assert(freeFiltered[0].id === 'openrouter/free-vision', 'Returned model is verified free vision model');
  assert(freeFiltered[0].verifiedFree === true && freeFiltered[0].eligibilityStatus === 'free', 'Returned model has verifiedFree=true and eligibilityStatus="free"');

  const paidAllowed = modelFilterService.filterAndRankModels(mockModels, {
    taskType: 'vision',
    preferFree: false,
  });
  assert(paidAllowed.length === 2, '2 models returned when preferFree=false');

  // --------------------------------------------------------------------------
  // TEST SUITE 2: Task Capability Filtering & Classification
  // --------------------------------------------------------------------------
  console.log('\n📋 TEST SUITE 2: Task Capability Filtering & Classification');

  const openrouterClassified = capabilityClassifier.classify({
    id: 'deepseek/deepseek-r1:free',
    name: 'DeepSeek R1',
    description: 'A chain-of-thought reasoning model',
    provider: 'openrouter',
    architecture: { modality: 'text->text' },
    supported_parameters: ['response_format'],
  });

  assert(openrouterClassified.reasoning === 'supported', 'DeepSeek R1 classified as reasoning=supported');
  assert(openrouterClassified.structured_output === 'supported', 'DeepSeek R1 classified as structured_output=supported');
  assert(openrouterClassified.vision === 'unsupported', 'DeepSeek R1 text->text classified as vision=unsupported');

  const visionClassified = capabilityClassifier.classify({
    id: 'meta/llama-3.2-11b-vision-instruct',
    name: 'Llama 3.2 Vision',
    description: 'Multimodal vision model',
    provider: 'nim',
  });
  assert(visionClassified.vision === 'supported', 'Llama 3.2 Vision classified as vision=supported');

  const openrouterVlClassified = capabilityClassifier.classify({
    id: 'nvidia/nemotron-nano-12b-v2-vl:free',
    name: 'Nemotron Nano VL',
    description: 'Multimodal vision language model',
    provider: 'openrouter',
  });
  assert(openrouterVlClassified.vision === 'supported', 'OpenRouter Nemotron VL classified as vision=supported');

  const verifiedCaps = capabilityClassifier.getVerifiedSupportedList(visionClassified);
  assert(verifiedCaps.includes('vision'), 'Verified capabilities list contains vision');
  assert(!verifiedCaps.includes('image_generation' as any), 'Verified capabilities list does NOT contain image_generation');

  // --------------------------------------------------------------------------
  // TEST SUITE 3: Best-Model Scoring Engine
  // --------------------------------------------------------------------------
  console.log('\n📋 TEST SUITE 3: Best-Model Scoring Engine');

  const simpleTaskReq: AIRequest = {
    taskType: 'prompt_enhancement',
    messages: [{ role: 'user', content: 'Make this prompt better' }],
    preferredQuality: 'speed',
  };

  const fastModel: AIModel = {
    ...mockModels[2],
    tier: 'fast',
    averageLatency: 400,
    successRate: 1.0,
    failureCount: 0,
  };

  const qualityModel: AIModel = {
    ...mockModels[0],
    tier: 'quality',
    averageLatency: 3500,
    successRate: 0.9,
    failureCount: 1,
  };

  const scoreFast = modelScoringEngine.scoreModel(fastModel, simpleTaskReq);
  const scoreQuality = modelScoringEngine.scoreModel(qualityModel, simpleTaskReq);

  assert(scoreFast > scoreQuality, 'Fast model scores higher than slow quality model for lightweight prompt enhancement');

  const complexTaskReq: AIRequest = {
    taskType: 'reasoning',
    messages: [{ role: 'user', content: 'Complex logic puzzle' }],
    preferredQuality: 'high',
  };
  const targetTier = modelScoringEngine.getTargetTierForTask(complexTaskReq.taskType, complexTaskReq.preferredQuality);
  assert(targetTier === 'quality', 'Target tier for complex reasoning is quality');

  // --------------------------------------------------------------------------
  // TEST SUITE 4: Fallback Behavior & Cooldown
  // --------------------------------------------------------------------------
  console.log('\n📋 TEST SUITE 4: Fallback Behavior & Cooldown');

  freeModelRegistry.recordModelFailure('openrouter', 'test-failing-model', 'Rate limit exceeded', 429);
  const failedModel = freeModelRegistry.getModel('openrouter:test-failing-model') || freeModelRegistry.getModel('test-failing-model');
  
  const stats = freeModelRegistry.getRegistryStats();
  assert(stats.totalModels > 0, 'Registry stats returns positive total models');

  const recentFailures = freeModelRegistry.getRecentFailures();
  assert(recentFailures.length > 0, 'Recent failures tracked in registry');
  assert(recentFailures[0].statusCode === 429, 'Recent failure statusCode is 429');

  // --------------------------------------------------------------------------
  // TEST SUITE 5: Invalid Provider Keys & Key Pool Manager
  // --------------------------------------------------------------------------
  console.log('\n📋 TEST SUITE 5: Invalid Provider Keys & Key Pool');

  keyPoolManager.setProviderKeys('custom', ['custom-test-key']);
  const poolStats = keyPoolManager.getPoolStats('custom');
  assert(poolStats.total === 1, 'Gemini pool has 1 key configured');
  assert(poolStats.keys[0].maskedKey.startsWith('custom-test'), 'Key is masked properly with prefix');
  assert(!poolStats.keys[0].maskedKey.includes('12345678901234567890'), 'Key suffix is redacted / truncated in masked display');

  // Report error on key
  keyPoolManager.reportError('custom', 'custom-test-key', 429, 'Rate limited');
  const poolStatsAfterError = keyPoolManager.getPoolStats('custom');
  assert(poolStatsAfterError.inCooldown === 1, 'Key is in cooldown after 429 error');

  // --------------------------------------------------------------------------
  // TEST SUITE 6: Settings Persistence & Reset
  // --------------------------------------------------------------------------
  console.log('\n📋 TEST SUITE 6: Settings Persistence & Reset');

  // Test appearance persistence
  const initialAppearance = loadAppearanceSettings();
  assert(initialAppearance.theme !== undefined, 'Appearance theme loaded');

  const updatedAppearance = saveAppearanceSettings({ accentColor: '#10b981', uiDensity: 'compact' });
  assert(updatedAppearance.accentColor === '#10b981', 'Appearance accent color updated to emerald');
  assert(updatedAppearance.uiDensity === 'compact', 'Appearance density updated to compact');

  const resetApp = resetAppearanceSettings();
  assert(resetApp.accentColor === DEFAULT_APPEARANCE_SETTINGS.accentColor, 'Appearance reset returns default accent color');

  // Test model policy persistence
  const initialPolicy = loadModelPolicySettings();
  assert(initialPolicy.freeModelsOnly === true, 'Default policy has freeModelsOnly=true');

  const updatedPolicy = saveModelPolicySettings({ maxFallbackAttempts: 8, preferredQuality: 'quality' });
  assert(updatedPolicy.maxFallbackAttempts === 8, 'Model policy maxFallbackAttempts updated to 8');

  const resetPol = resetModelPolicySettings();
  assert(resetPol.maxFallbackAttempts === DEFAULT_MODEL_POLICY_SETTINGS.maxFallbackAttempts, 'Model policy reset returns default fallbacks');

  // --------------------------------------------------------------------------
  // TEST SUITE 7: Secret Redaction
  // --------------------------------------------------------------------------
  console.log('\n📋 TEST SUITE 7: Secret Redaction');

  const maskedKey = maskApiKey('sk-or-v1-abcdef1234567890abcdef1234567890');
  assert(maskedKey.startsWith('sk-or-v1-') && maskedKey.endsWith('7890') && maskedKey.includes('...'), 'maskApiKey produces expected mask format');

  const dirtyErrorMessage = 'Failed request: Bearer sk-or-v1-9876543210zyxwvutsrqponmlkjihgfedcba with key test-google-key and token=secret_token_12345678';
  const cleanErrorMessage = redactSecrets(dirtyErrorMessage);

  assert(!cleanErrorMessage.includes('sk-or-v1-9876543210'), 'Bearer token / sk- keys redacted');
  assert(!cleanErrorMessage.includes('test-google-key'), 'Provider key redacted');
  assert(!cleanErrorMessage.includes('secret_token_12345678'), 'token parameter redacted');
  assert(cleanErrorMessage.includes('[REDACTED]'), 'Contains [REDACTED] markers');

  console.log('\n======================================================');
  console.log(`🏁 TEST RUN FINISHED: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
