import type { AIModel, AIRequest, AIResponse, ChatMessage, FreeEligibility, ModelModality } from '../types';
import { AdapterError, fetchWithTimeout, type IProviderAdapter } from './baseAdapter';

export class OpenRouterAdapter implements IProviderAdapter {
  public readonly name = 'openrouter' as const;
  private baseUrl = 'https://openrouter.ai/api/v1';

  public isConfigured(): boolean {
    return !!(
      process.env.OPENROUTER_API_KEY_1 ||
      process.env.OPENROUTER_API_KEYS ||
      process.env.OPENROUTER_API_KEY
    );
  }

  /**
   * Fetch live models dynamically from official OpenRouter models API.
   * Free models are determined purely by checking if both input and output pricing are 0.
   */
  public async discoverModels(apiKey: string): Promise<AIModel[]> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://jugaadvisuals.app',
          'X-Title': 'JugaadVision AI Toolkit',
        },
      }, 15000);

      if (!res.ok) {
        throw new AdapterError(`Failed to fetch OpenRouter models: ${res.statusText}`, this.name, res.status);
      }

      const json = await res.json();
      const rawModels: any[] = json.data || [];
      const timestamp = new Date().toISOString();

      return rawModels.map(m => {
        // Price per token as reported by OpenRouter (string or number)
        const inputCost = parseFloat(m.pricing?.prompt ?? '0') || 0;
        const outputCost = parseFloat(m.pricing?.completion ?? '0') || 0;

        // A model is strictly free when BOTH input and output cost are 0
        const isFree = inputCost === 0 && outputCost === 0;
        const freeEligibility: FreeEligibility = isFree ? 'free' : 'paid';

        const capabilities: string[] = ['text'];
        const modalities: ModelModality[] = ['text'];

        const modStr = (m.architecture?.modality || '').toLowerCase();
        const desc = (m.description || '').toLowerCase();
        const lowerId = m.id.toLowerCase();

        const isExplicitNonVision = modStr === 'text->text' || modStr === 'text->image';
        if (!isExplicitNonVision && (
          modStr.includes('multimodal') ||
          modStr.includes('image->') ||
          modStr.includes('text+image') ||
          modStr.includes('vision') ||
          lowerId.includes('-vl') ||
          lowerId.includes('vision') ||
          desc.includes('vision model') ||
          desc.includes('visual reasoning')
        )) {
          capabilities.push('vision');
          modalities.push('vision');
        }

        capabilities.push('json');
        modalities.push('json');

        if (m.supported_parameters?.includes('tools') || m.supported_parameters?.includes('function_calling') || desc.includes('function call')) {
          capabilities.push('tools');
        }

        if (desc.includes('reasoning') || desc.includes('chain-of-thought') || m.id.includes('r1') || m.id.includes('reason')) {
          capabilities.push('reasoning');
        }

        let tier: 'fast' | 'balanced' | 'quality' = 'balanced';
        if (lowerId.includes('flash') || lowerId.includes('mini') || lowerId.includes('haiku') || lowerId.includes('lite') || lowerId.includes('7b') || lowerId.includes('8b') || lowerId.includes('tiny')) {
          tier = 'fast';
        } else if (lowerId.includes('pro') || lowerId.includes('opus') || lowerId.includes('70b') || lowerId.includes('large') || lowerId.includes('r1') || lowerId.includes('405b')) {
          tier = 'quality';
        }

        return {
          id: m.id,
          name: m.name || m.id,
          provider: this.name,
          inputCost,
          outputCost,
          contextLength: m.context_length || 8192,
          capabilities,
          isFree,
          freeEligibility,
          discoveredTimestamp: timestamp,
          description: m.description || '',
          tier,
          pricing: {
            prompt: inputCost,
            completion: outputCost,
            isZeroCost: isFree,
          },
          modalities,
          supportsStructuredJson: true,
        };
      });
    } catch (err: any) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(err.message || 'OpenRouter model discovery failed', this.name);
    }
  }

  public async generate(request: AIRequest, apiKey: string, modelId: string): Promise<AIResponse> {
    const startTime = Date.now();
    const formattedMessages = this.formatMessages(request.messages, request);

    const body: Record<string, any> = {
      model: modelId,
      messages: formattedMessages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2048,
      provider: {
        data_collection: 'allow',
        allow_fallbacks: true,
      },
    };

    if (request.responseFormat === 'json_object' || request.taskType === 'structured_json') {
      body.response_format = { type: 'json_object' };
    }

    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://jugaadvisuals.app',
          'X-Title': 'JugaadVision AI Toolkit',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }, 60000);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new AdapterError(
          `OpenRouter API error (${res.status}): ${errorText || res.statusText}`,
          this.name,
          res.status
        );
      }

      const json = await res.json();
      const choice = json.choices?.[0];
      const rawContent = choice?.message?.content || '';
      const durationMs = Date.now() - startTime;

      let parsedJson: any = undefined;
      if (request.responseFormat === 'json_object' || request.taskType === 'structured_json') {
        try {
          parsedJson = JSON.parse(this.cleanJsonString(rawContent));
        } catch {
          const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            try {
              parsedJson = JSON.parse(jsonMatch[1]);
            } catch {
              // fallback
            }
          }
        }
      }

      return {
        content: rawContent,
        parsedJson,
        model: modelId,
        provider: this.name,
        usage: {
          promptTokens: json.usage?.prompt_tokens,
          completionTokens: json.usage?.completion_tokens,
          totalTokens: json.usage?.total_tokens,
        },
        durationMs,
      };
    } catch (err: any) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(err.message || 'OpenRouter generation failed', this.name);
    }
  }

  private formatMessages(messages: ChatMessage[], request: AIRequest): any[] {
    const formatted = messages.map(m => {
      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content };
      }
      const contentParts = m.content.map(part => {
        if (part.type === 'text') {
          return { type: 'text', text: part.text || '' };
        }
        if (part.type === 'image_url') {
          return {
            type: 'image_url',
            image_url: { url: part.image_url?.url || '' },
          };
        }
        return part;
      });
      return { role: m.role, content: contentParts };
    });

    if (request.taskType === 'structured_json' && request.jsonSchema) {
      const schemaInstruction = `\nYou MUST output your response strictly as valid JSON adhering to this schema:\n${JSON.stringify(request.jsonSchema, null, 2)}`;
      const sysIndex = formatted.findIndex(m => m.role === 'system');
      if (sysIndex >= 0) {
        formatted[sysIndex].content = `${formatted[sysIndex].content}\n${schemaInstruction}`;
      } else {
        formatted.unshift({ role: 'system', content: schemaInstruction });
      }
    }

    return formatted;
  }

  private cleanJsonString(str: string): string {
    return str.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  }
}
