import type { AIModel, AIRequest, AIResponse, ModelModality } from '../types';
import { getCustomEndpoint } from '../customEndpoint';
import { AdapterError, fetchWithTimeout, type IProviderAdapter } from './baseAdapter';

/** OpenAI-compatible custom endpoint adapter. */
export class CustomEndpointAdapter implements IProviderAdapter {
  public readonly name = 'custom' as const;
  public isConfigured(): boolean { return !!getCustomEndpoint()?.endpoint; }
  public async discoverModels(apiKey: string): Promise<AIModel[]> {
    const current = getCustomEndpoint();
    if (!current) return [];
    const modelsUrl = current.endpoint.replace(/\/chat\/completions\/?$/, '/models');
    try {
      const res = await fetchWithTimeout(modelsUrl, { headers: this.headers(apiKey) }, 15000);
      if (res.ok) {
        const json = await res.json();
        const models = (json.data || []).map((model: any) => this.model(model.id, model.name || model.id));
        if (models.length) return models;
      }
    } catch { /* local endpoints may not expose /models */ }
    return current.model ? [this.model(current.model, current.model)] : [];
  }
  public async generate(request: AIRequest, apiKey: string, modelId: string): Promise<AIResponse> {
    const current = getCustomEndpoint();
    if (!current) throw new AdapterError('Custom endpoint is not configured', this.name, 400);
    const startTime = Date.now();
    const cleanModelId = modelId?.replace(/^custom:/, '');
    const effectiveModel = (cleanModelId && cleanModelId !== 'custom') ? cleanModelId : (current.model || 'qwen2.5-coder:7b');
    const maxTokens = request.maxTokens ? Math.min(request.maxTokens, 1024) : (request.taskType === 'structured_json' ? 800 : 400);
    const body: Record<string, any> = {
      model: effectiveModel,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: maxTokens,
    };
    if (request.responseFormat === 'json_object' || request.taskType === 'structured_json') body.response_format = { type: 'json_object' };
    try {
      const res = await fetchWithTimeout(current.endpoint, { method: 'POST', headers: { ...this.headers(apiKey), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 120000);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new AdapterError(`Custom endpoint error (${res.status}): ${json.error?.message || res.statusText}`, this.name, res.status);
      let content = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || json.output_text || '';
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      let parsedJson: any;
      if (request.responseFormat === 'json_object' || request.taskType === 'structured_json') {
        try {
          parsedJson = JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
        } catch {
          const match = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (match) {
            try { parsedJson = JSON.parse(match[1].trim()); } catch {}
          }
        }
      }
      return { content, parsedJson, model: body.model, provider: this.name, durationMs: Date.now() - startTime };
    } catch (err: any) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(err.message || 'Custom endpoint request failed', this.name);
    }
  }
  private headers(apiKey: string): Record<string, string> { return apiKey && apiKey !== '__custom_endpoint__' ? { Authorization: `Bearer ${apiKey}` } : {}; }
  private model(id: string, name: string): AIModel {
    // OpenAI-compatible chat-completions endpoints carry text, JSON mode and
    // base64 image_url vision parts, so advertise all three explicitly.
    const modalities: ModelModality[] = ['text', 'json', 'vision'];
    return { id, name, provider: this.name, inputCost: 0, outputCost: 0, contextLength: 32768, capabilities: ['text', 'json', 'vision'], modalities, isFree: true, freeEligibility: 'free', discoveredTimestamp: new Date().toISOString(), tier: 'balanced', pricing: { prompt: 0, completion: 0, isZeroCost: true }, supportsStructuredJson: true };
  }
}
