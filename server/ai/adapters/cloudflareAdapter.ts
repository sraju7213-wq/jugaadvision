import type { AIModel, AIRequest, AIResponse, ChatMessage, FreeEligibility, ModelModality } from '../types.ts';
import { AdapterError, fetchWithTimeout, type IProviderAdapter } from './baseAdapter.ts';

const CLOUDFLARE_BOOTSTRAP_MODELS: Array<{
  id: string;
  name: string;
  contextLength: number;
  capabilities: string[];
  modalities: ModelModality[];
  tier: 'fast' | 'balanced' | 'quality';
}> = [
  {
    id: '@cf/meta/llama-3.2-11b-vision-instruct',
    name: 'Cloudflare Llama 3.2 11B Vision Instruct',
    contextLength: 131072,
    capabilities: ['text', 'vision', 'json'],
    modalities: ['text', 'vision', 'json'],
    tier: 'balanced',
  },
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Cloudflare Llama 3.1 8B Instruct',
    contextLength: 131072,
    capabilities: ['text', 'json'],
    modalities: ['text', 'json'],
    tier: 'fast',
  },
  {
    id: '@cf/meta/llama-3.1-70b-instruct',
    name: 'Cloudflare Llama 3.1 70B Instruct',
    contextLength: 131072,
    capabilities: ['text', 'json', 'reasoning'],
    modalities: ['text', 'json'],
    tier: 'quality',
  },
  {
    id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    name: 'Cloudflare DeepSeek R1 Distill Qwen 32B',
    contextLength: 32768,
    capabilities: ['text', 'json', 'reasoning'],
    modalities: ['text', 'json'],
    tier: 'quality',
  },
];

export class CloudflareAdapter implements IProviderAdapter {
  public readonly name = 'cloudflare' as const;
  private verifyUrl = 'https://api.cloudflare.com/client/v4/user/tokens/verify';

  public isConfigured(): boolean {
    return !!(
      process.env.CLOUDFLARE_API_TOKEN ||
      process.env.CLOUDFLARE_API_KEY ||
      process.env.CLOUDFLARE_TOKEN
    );
  }

  public async discoverModels(apiKey: string): Promise<AIModel[]> {
    try {
      // Validate token with Cloudflare API
      const res = await fetchWithTimeout(this.verifyUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }, 10000);

      if (!res.ok) {
        throw new AdapterError(`Cloudflare token verification failed: ${res.statusText}`, this.name, res.status);
      }

      const json = await res.json();
      if (!json.success) {
        const msg = json.errors?.[0]?.message || 'Invalid Cloudflare token';
        throw new AdapterError(msg, this.name, 401);
      }

      const timestamp = new Date().toISOString();
      return CLOUDFLARE_BOOTSTRAP_MODELS.map(m => ({
        id: m.id,
        name: m.name,
        provider: this.name,
        inputCost: 0,
        outputCost: 0,
        contextLength: m.contextLength,
        capabilities: m.capabilities,
        isFree: true,
        freeEligibility: 'free' as FreeEligibility,
        discoveredTimestamp: timestamp,
        description: `Cloudflare Workers AI: ${m.name}`,
        tier: m.tier,
        pricing: { prompt: 0, completion: 0, isZeroCost: true },
        modalities: m.modalities,
        supportsStructuredJson: true,
      }));
    } catch (err: any) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(err.message || 'Cloudflare discovery failed', this.name);
    }
  }

  public async generate(request: AIRequest, apiKey: string, modelId: string): Promise<AIResponse> {
    const startTime = Date.now();
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!accountId) {
      // If no account ID is provided, verify token and throw helpful instruction
      const res = await fetchWithTimeout(this.verifyUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      }, 5000).catch(() => null);

      if (!res || !res.ok) {
        throw new AdapterError('Invalid Cloudflare API token', this.name, 401);
      }

      throw new AdapterError(
        'Cloudflare Workers AI requires CLOUDFLARE_ACCOUNT_ID in environment variables.',
        this.name,
        400
      );
    }

    const runUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`;
    const formattedMessages = this.formatMessages(request.messages);

    const body: Record<string, any> = {
      messages: formattedMessages,
      max_tokens: request.maxTokens ?? 2048,
    };

    try {
      const res = await fetchWithTimeout(runUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }, 60000);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new AdapterError(
          `Cloudflare Workers AI error (${res.status}): ${errorText || res.statusText}`,
          this.name,
          res.status
        );
      }

      const json = await res.json();
      const rawContent = json.result?.response || json.result?.description || JSON.stringify(json.result || '');
      const durationMs = Date.now() - startTime;

      let parsedJson: any = undefined;
      if (request.responseFormat === 'json_object' || request.taskType === 'structured_json') {
        try {
          parsedJson = JSON.parse(rawContent);
        } catch {
          // fallback
        }
      }

      return {
        content: rawContent,
        parsedJson,
        model: modelId,
        provider: this.name,
        durationMs,
      };
    } catch (err: any) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(err.message || 'Cloudflare generation failed', this.name);
    }
  }

  private formatMessages(messages: ChatMessage[]): any[] {
    return messages.map(m => {
      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content };
      }
      const textParts = m.content
        .filter(p => p.type === 'text')
        .map(p => p.text || '')
        .join('\n');
      return { role: m.role, content: textParts };
    });
  }
}
