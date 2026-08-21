import type { AIModel, AIRequest, AIResponse, ChatMessage, FreeEligibility, ModelModality } from '../types';
import { AdapterError, fetchWithTimeout, type IProviderAdapter } from './baseAdapter';

const KNOWN_VISION_MODEL_PATTERNS = [
  'vl',
  'vision',
  'glm-4.5v',
  'glm-4.6v',
  'aya-vision',
  'command-a-vision',
  'florence',
  'paligemma',
  'multimodal',
  'internvl',
  'idefics',
  'llava',
  'cogvlm',
];

export class HuggingFaceAdapter implements IProviderAdapter {
  public readonly name = 'huggingface' as const;
  private baseUrl = 'https://router.huggingface.co/v1';

  public isConfigured(): boolean {
    return !!(
      process.env.HUGGINGFACE_API_KEY_1 ||
      process.env.HUGGINGFACE_API_KEYS ||
      process.env.HUGGINGFACE_API_KEY ||
      process.env.HF_TOKEN ||
      process.env.HF_API_KEY
    );
  }

  /**
   * Discovers models available on the Hugging Face Inference Router.
   * Hugging Face Serverless Inference is free for authenticated users.
   */
  public async discoverModels(apiKey: string): Promise<AIModel[]> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }, 15000);

      if (!res.ok) {
        throw new AdapterError(`Failed to fetch Hugging Face models: ${res.statusText}`, this.name, res.status);
      }

      const json = await res.json();
      const rawModels: any[] = json.data || [];
      const timestamp = new Date().toISOString();

      return rawModels.map(m => {
        const id: string = m.id;
        const lowerId = id.toLowerCase();

        const capabilities: string[] = ['text', 'json'];
        const modalities: ModelModality[] = ['text', 'json'];

        const hasVision = KNOWN_VISION_MODEL_PATTERNS.some(pat => lowerId.includes(pat));
        if (hasVision) {
          capabilities.push('vision');
          modalities.push('vision');
        }

        if (lowerId.includes('r1') || lowerId.includes('reason') || lowerId.includes('thinking') || lowerId.includes('qwq')) {
          capabilities.push('reasoning');
        }

        if (lowerId.includes('code') || lowerId.includes('coder')) {
          capabilities.push('coding');
        }

        let tier: 'fast' | 'balanced' | 'quality' = 'balanced';
        if (lowerId.includes('flash') || lowerId.includes('tiny') || lowerId.includes('small') || lowerId.includes('3b') || lowerId.includes('4b') || lowerId.includes('7b') || lowerId.includes('8b') || lowerId.includes('9b') || lowerId.includes('11b') || lowerId.includes('12b')) {
          tier = 'fast';
        } else if (lowerId.includes('70b') || lowerId.includes('72b') || lowerId.includes('120b') || lowerId.includes('235b') || lowerId.includes('405b') || lowerId.includes('pro') || lowerId.includes('r1') || lowerId.includes('ultra')) {
          tier = 'quality';
        }

        return {
          id,
          name: id.split('/').pop() || id,
          provider: this.name,
          inputCost: 0,
          outputCost: 0,
          contextLength: 32768,
          capabilities,
          isFree: true,
          freeEligibility: 'free' as FreeEligibility,
          discoveredTimestamp: timestamp,
          description: `Hugging Face Serverless: ${id}`,
          tier,
          pricing: {
            prompt: 0,
            completion: 0,
            isZeroCost: true,
          },
          modalities,
          supportsStructuredJson: true,
        };
      });
    } catch (err: any) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(err.message || 'Hugging Face model discovery failed', this.name);
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
    };

    if (request.responseFormat === 'json_object' || request.taskType === 'structured_json') {
      body.response_format = { type: 'json_object' };
    }

    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }, 28000);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new AdapterError(
          `Hugging Face API error (${res.status}): ${errorText || res.statusText}`,
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
      throw new AdapterError(err.message || 'Hugging Face generation failed', this.name);
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
