/**
 * LocalAdapter — IProviderAdapter implementation that routes requests to
 * locally-downloaded GGUF models via node-llama-cpp.
 *
 * Integrates into the existing JugaadVision AI Router as a new provider
 * called 'local'. The router selects it like any other provider when
 * - a local model is registered and valid, AND
 * - the request prefers local models (or no other provider is available).
 */

import type {
  AIModel,
  AIRequest,
  AIResponse,
  ChatMessage,
  MessageContentItem,
  ProviderName,
  FreeEligibility,
  ModelModality,
} from '../types';
import { AdapterError, fetchWithTimeout, type IProviderAdapter } from '../adapters/baseAdapter';
import { getLocalModelStore } from './localStore';
import {
  listLocalModels,
  getLocalModel,
  runLocalInference,
  checkLocalInferenceReady,
  ensureLocalAdapterRegistered,
} from './localModelManager';

// ── Provider name ─────────────────────────────────────────────────────────────

export const LOCAL_PROVIDER: ProviderName = 'local';

// ── Adapter implementation ────────────────────────────────────────────────────

export class LocalAdapter implements IProviderAdapter {
  public readonly name = LOCAL_PROVIDER;

  /**
   * Local models are always "configured" if at least one valid model file
   * exists on disk. Unlike cloud providers, no API key is needed.
   */
  public isConfigured(): boolean {
    const models = listLocalModels();
    return models.length > 0;
  }

  /**
   * "Discover" local models — returns models currently stored on disk.
   * This is used by the FreeModelRegistry to surface local models in the
   * model catalog alongside cloud models.
   */
  public async discoverModels(_apiKey?: string): Promise<AIModel[]> {
    const localModels = listLocalModels();

    return localModels.map(m => ({
      id: `local:${m.id}`,
      provider: LOCAL_PROVIDER,
      providerModelId: m.id,
      name: m.name,
      verifiedFree: true,
      eligibilityStatus: 'free' as FreeEligibility,
      capabilities: capabilityList(m),
      capabilityMap: {
        chat: m.modality === 'text' ? 'supported' : 'unsupported',
        reasoning: 'unknown',
        coding: 'unknown',
        vision: m.modality === 'vision' ? 'supported' : 'unsupported',
        tool_calling: 'unknown',
        structured_output: 'supported',
      },
      contextWindow: 2048,  // conservative default — model-specific could be stored in manifest
      status: 'available',
      successRate: 1,
      averageLatency: 0,
      failureCount: 0,
      lastChecked: m.lastLoadedAt || new Date().toISOString(),
      cooldownUntil: 0,
      isFree: true,
      contextLength: 2048,
      freeEligibility: 'free' as FreeEligibility,
      tier: 'fast',         // local models are typically fast for their size
      pricing: {
        prompt: 0,
        completion: 0,
        isZeroCost: true,
      },
      modalities: m.modality === 'vision'
        ? (['text', 'vision'] as ModelModality[])
        : (['text'] as ModelModality[]),
      supportsStructuredJson: true,
      description: m.note || `Local GGUF: ${m.fileName}`,
      inputCost: 0,
      outputCost: 0,
      discoveredTimestamp: m.downloadedAt,
    }));
  }

  /**
   * Run inference on a locally stored model.
   *
   * @param request   AIRequest from the router
   * @param _apiKey   Ignored — local models don't need keys
   * @param modelId   The local model id (e.g. `local:qwen3-0-6b-q8_0-...`)
   */
  public async generate(
    request: AIRequest,
    _apiKey: string,
    modelId: string,
  ): Promise<AIResponse> {
    const t0 = Date.now();

    // Strip local: prefix if present
    const cleanId = modelId.startsWith('local:') ? modelId.slice(6) : modelId;

    const model = getLocalModel(cleanId);
    if (!model) {
      throw new AdapterError(`Local model not found: ${modelId}`, this.name);
    }

    if (!model.isValid) {
      throw new AdapterError(`Local model file invalid: ${modelId}`, this.name);
    }

    // Build the prompt from chat messages
    const prompt = this.buildPrompt(request.messages);

    // Supported task types
    const isVisionTask = request.taskType === 'vision' ||
      request.taskType === 'advanced_image_analysis' ||
      request.requiredCapabilities?.includes('vision');

    if (isVisionTask && model.modality !== 'vision') {
      throw new AdapterError(
        `Local model "${model.name}" does not support vision. ` +
        `Use a vision-capable cloud provider or download a vision model.`,
        this.name,
      );
    }

    if (isVisionTask) {
      // Vision support via node-llama-cpp is experimental; return a clear error
      // rather than silently failing. When vision support lands in node-llama-cpp,
      // this branch will be replaced with actual image inference.
      throw new AdapterError(
        `Vision inference with local models is not yet supported. ` +
        `The model "${model.name}" is registered but vision processing requires ` +
        `additional infrastructure (image embedding + multimodal context). ` +
        `Please use a cloud vision provider for now.`,
        this.name,
      );
    }

    // Text generation
    const inferenceRequest: Parameters<typeof runLocalInference>[1] = {
      prompt,
      maxTokens: request.maxTokens ?? 512,
      temperature: request.temperature ?? 0.7,
      stop: request.requiredCapabilities?.includes('structured_output')
        ? ['\n```json', '\n```']
        : undefined,
    };

    let inferenceResult;
    try {
      inferenceResult = await runLocalInference(cleanId, inferenceRequest);
    } catch (err: any) {
      const msg = err.message || String(err);
      throw new AdapterError(msg, this.name);
    }

    return {
      content: inferenceResult.content,
      parsedJson: undefined,
      model: `local:${cleanId}`,
      provider: LOCAL_PROVIDER,
      taskType: request.taskType,
      usage: {
        promptTokens: 0,       // node-llama-cpp doesn't expose prompt token count easily
        completionTokens: inferenceResult.tokensGenerated,
        totalTokens: inferenceResult.tokensGenerated,
      },
      durationMs: inferenceResult.totalDurationMs,
    };
  }

  // ── prompt building ────────────────────────────────────────────────────────
  // LlamaChatSession applies the model's native chat template automatically.
  // We only need to flatten the message history into a readable transcript;
  // the session wrapper handles ChatML / Llama-3 / etc. formatting.

  private buildPrompt(messages: ChatMessage[]): string {
    const parts: string[] = [];

    // System message first (if any)
    const system = messages.find(m => m.role === 'system');
    if (system) {
      const sysText = extractText(system);
      if (sysText) parts.push(sysText);
    }

    // Conversation history in original order (skip system, already added)
    for (const m of messages) {
      if (m.role === 'system') continue;
      const text = extractText(m);
      if (!text) continue;
      if (m.role === 'assistant') {
        parts.push(`[Previous assistant response]: ${text}`);
      } else {
        parts.push(text);
      }
    }

    // If nothing usable, fall back to raw concatenation
    if (parts.length === 0) {
      const all = messages.map(m => extractText(m)).filter(Boolean);
      return all.length > 0 ? all.join('\n\n') : 'Hello';
    }

    return parts.join('\n\n');
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function extractText(msg: ChatMessage): string {
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((c): c is MessageContentItem => c.type === 'text')
      .map(c => c.text || '')
      .join('\n');
  }
  return '';
}

function capabilityList(model: { modality: 'text' | 'vision' | 'unknown' }): string[] {
  const caps: string[] = ['text', 'json'];
  if (model.modality === 'vision') caps.push('vision');
  return caps;
}

// ── initialisation ───────────────────────────────────────────────────────────

/**
 * Called once at server startup to refresh the local model store integrity.
 */
export function initAdapter(): void {
  getLocalModelStore().refreshIntegrity();
}

/**
 * Returns whether the local adapter is capable of running inference right now.
 */
export async function isLocalInferenceReady(): Promise<{ ready: boolean; reason?: string; modelCount: number }> {
  const check = await checkLocalInferenceReady();
  return {
    ready: check.ok,
    reason: check.reason,
    modelCount: check.modelsAvailable,
  };
}
