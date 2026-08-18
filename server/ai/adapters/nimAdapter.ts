import type { AIModel, AIRequest, AIResponse, ChatMessage, FreeEligibility, ModelModality } from '../types.ts';
import { AdapterError, fetchWithTimeout, type IProviderAdapter } from './baseAdapter.ts';

const KNOWN_FREE_NIM_MODEL_IDS = new Set([
  'meta/llama-3.2-11b-vision-instruct',
  'meta/llama-3.2-90b-vision-instruct',
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.1-405b-instruct',
  'mistralai/mistral-7b-instruct-v0.3',
  'mistralai/mixtral-8x7b-instruct-v0.1',
  'mistralai/mixtral-8x22b-instruct-v0.1',
  'nvidia/nemotron-4-340b-instruct',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'google/gemma-2-9b-it',
  'google/gemma-2-27b-it',
  'microsoft/phi-3-mini-128k-instruct',
  'microsoft/phi-3-medium-128k-instruct',
]);

export class NvidiaNimAdapter implements IProviderAdapter {
  public readonly name = 'nim' as const;
  private baseUrl = 'https://integrate.api.nvidia.com/v1';

  public isConfigured(): boolean {
    return !!(
      process.env.NVIDIA_NIM_API_KEY_1 ||
      process.env.NVIDIA_NIM_API_KEYS ||
      process.env.NVIDIA_API_KEY
    );
  }

  /**
   * Automatic model discovery for NVIDIA NIM.
   * If pricing metadata cannot be determined programmatically from the API,
   * models are marked as 'eligible_unknown' (isFree: false) to prevent assuming all NIM models are free.
   */
  public async discoverModels(apiKey: string): Promise<AIModel[]> {
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }, 15000);

      if (!res.ok) {
        throw new AdapterError(`Failed to fetch NVIDIA NIM models: ${res.statusText}`, this.name, res.status);
      }

      const json = await res.json();
      const rawModels: any[] = json.data || [];
      const timestamp = new Date().toISOString();

      return rawModels.map(m => {
        const id: string = m.id;
        const lowerId = id.toLowerCase();

        // Check if explicit zero pricing metadata is present in response
        let inputCost = -1;
        let outputCost = -1;
        let isFree = false;
        let freeEligibility: FreeEligibility = 'eligible_unknown';

        if (m.pricing) {
          inputCost = parseFloat(m.pricing.prompt ?? '-1');
          outputCost = parseFloat(m.pricing.completion ?? '-1');
          if (inputCost === 0 && outputCost === 0) {
            isFree = true;
            freeEligibility = 'free';
          } else if (inputCost > 0 || outputCost > 0) {
            isFree = false;
            freeEligibility = 'paid';
          }
        } else if (KNOWN_FREE_NIM_MODEL_IDS.has(id)) {
          inputCost = 0;
          outputCost = 0;
          isFree = true;
          freeEligibility = 'free';
        } else {
          // Exact pricing not exposed in API response -> mark as eligible_unknown
          inputCost = -1;
          outputCost = -1;
          isFree = false;
          freeEligibility = 'eligible_unknown';
        }

        const capabilities: string[] = ['text', 'json'];
        const modalities: ModelModality[] = ['text', 'json'];

        if (lowerId.includes('vision') || lowerId.includes('vlm') || lowerId.includes('multimodal') || lowerId.includes('neva') || lowerId.includes('florence') || lowerId.includes('kosmos')) {
          capabilities.push('vision');
          modalities.push('vision');
        }

        if (lowerId.includes('r1') || lowerId.includes('reason') || lowerId.includes('instruct')) {
          capabilities.push('reasoning');
        }

        let tier: 'fast' | 'balanced' | 'quality' = 'balanced';
        if (lowerId.includes('8b') || lowerId.includes('7b') || lowerId.includes('mini') || lowerId.includes('flash') || lowerId.includes('small') || lowerId.includes('lite') || lowerId.includes('11b') || lowerId.includes('12b')) {
          tier = 'fast';
        } else if (lowerId.includes('70b') || lowerId.includes('90b') || lowerId.includes('405b') || lowerId.includes('large') || lowerId.includes('deepseek-r1') || lowerId.includes('llama-3.3-70b')) {
          tier = 'quality';
        }

        return {
          id,
          name: id.split('/').pop() || id,
          provider: this.name,
          inputCost,
          outputCost,
          contextLength: 16384,
          capabilities,
          isFree,
          freeEligibility,
          discoveredTimestamp: timestamp,
          description: `NVIDIA NIM Hosted Model: ${id}`,
          tier,
          pricing: {
            prompt: Math.max(0, inputCost),
            completion: Math.max(0, outputCost),
            isZeroCost: isFree,
          },
          modalities,
          supportsStructuredJson: true,
        };
      });
    } catch (err: any) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError(err.message || 'NVIDIA NIM model discovery failed', this.name);
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
      }, 60000);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new AdapterError(
          `NVIDIA NIM API error (${res.status}): ${errorText || res.statusText}`,
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
      throw new AdapterError(err.message || 'NVIDIA NIM generation failed', this.name);
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
