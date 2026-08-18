import type { AIModel, AIRequest, AIResponse, ModelModality } from '../types.ts';
import { getCustomEndpoint } from '../customEndpoint.ts';
import { AdapterError, fetchWithTimeout, type IProviderAdapter } from './baseAdapter.ts';

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
    const body: Record<string, any> = { model: modelId || current.model, messages: request.messages, temperature: request.temperature ?? 0.7, max_tokens: request.maxTokens ?? 2048 };
    if (request.responseFormat === 'json_object' || request.taskType === 'structured_json') body.response_format = { type: 'json_object' };
    try {
      const res = await fetchWithTimeout(current.endpoint, { method: 'POST', headers: { ...this.headers(apiKey), 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 45000);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new AdapterError(`Custom endpoint error (${res.status}): ${json.error?.message || res.statusText}`, this.name, res.status);
      const content = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || json.output_text || '';
      let parsedJson: any;
      if (request.responseFormat === 'json_object' || request.taskType === 'structured_json') { try { parsedJson = JSON.parse(content); } catch { /* validation handles invalid JSON */ } }
      return { content, parsedJson, model: body.model, provider: this.name, durationMs: Date.now() - startTime };
    } catch (err: any) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(err.message || 'Custom endpoint request failed', this.name);
    }
  }
  private headers(apiKey: string): Record<string, string> { return apiKey && apiKey !== '__custom_endpoint__' ? { Authorization: `Bearer ${apiKey}` } : {}; }
  private model(id: string, name: string): AIModel {
    const modalities: ModelModality[] = ['text', 'json'];
    return { id, name, provider: this.name, inputCost: 0, outputCost: 0, contextLength: 32768, capabilities: ['text', 'json'], modalities, isFree: false, freeEligibility: 'eligible_unknown', discoveredTimestamp: new Date().toISOString(), tier: 'balanced', pricing: { prompt: 0, completion: 0, isZeroCost: false }, supportsStructuredJson: true };
  }
}
