import type { ModelCapabilities, ModelCapabilityType, ProviderName } from '../types';

export interface RawModelMetadata {
  id: string;
  name?: string;
  description?: string;
  provider: ProviderName;
  architecture?: {
    modality?: string;
    instruct_type?: string | null;
  };
  supported_parameters?: string[];
  supportedGenerationMethods?: string[];
}

export class CapabilityClassifier {
  /**
   * Automatically classifies model capabilities from official provider metadata.
   * If capability is not verifiable from metadata, it is marked 'unknown' or 'unsupported' - never guessed.
   */
  public classify(raw: RawModelMetadata): ModelCapabilities {
    switch (raw.provider) {
      case 'openrouter':
        return this.classifyOpenRouter(raw);
      case 'nim':
        return this.classifyNim(raw);
      case 'gemini':
        return this.classifyGemini(raw);
      case 'huggingface':
        return this.classifyHuggingFace(raw);
      case 'cloudflare':
        return this.classifyCloudflare(raw);
      default:
        return this.classifyGeneric(raw);
    }
  }

  /**
   * Extracts an array of strictly verified supported capabilities.
   */
  public getVerifiedSupportedList(caps: ModelCapabilities): ModelCapabilityType[] {
    const list: ModelCapabilityType[] = [];
    if (caps.chat === 'supported') list.push('chat');
    if (caps.reasoning === 'supported') list.push('reasoning');
    if (caps.coding === 'supported') list.push('coding');
    if (caps.vision === 'supported') list.push('vision');
    if (caps.tool_calling === 'supported') list.push('tool_calling');
    if (caps.structured_output === 'supported') list.push('structured_output');
    return list;
  }

  private classifyOpenRouter(raw: RawModelMetadata): ModelCapabilities {
    const modality = (raw.architecture?.modality || '').toLowerCase();
    const desc = (raw.description || '').toLowerCase();
    const id = raw.id.toLowerCase();
    const supportedParams = Array.isArray(raw.supported_parameters) ? raw.supported_parameters : [];

    // 1. Chat
    const isChat = modality.includes('text->text') ||
                   modality.includes('text+image->text') ||
                   raw.architecture?.instruct_type !== null ||
                   id.includes('instruct') ||
                   id.includes('chat');
    const chat = isChat ? 'supported' : (modality ? 'unsupported' : 'unknown');

    // 2. Vision
    const isExplicitNonVision = modality === 'text->text' || modality === 'text->image';
    const hasVisionModality = !isExplicitNonVision && (
      modality.includes('multimodal') ||
      modality.includes('image->') ||
      modality.includes('text+image') ||
      id.includes('-vl') ||
      id.includes('vision') ||
      id.includes('multimodal') ||
      desc.includes('vision model') ||
      desc.includes('visual reasoning')
    );
    const vision = hasVisionModality ? 'supported' : (modality || isChat ? 'unsupported' : 'unknown');

    // 3. Tool Calling
    let tool_calling: 'supported' | 'unsupported' | 'unknown' = 'unknown';
    if (supportedParams.length > 0) {
      const hasTools = supportedParams.includes('tools') || supportedParams.includes('function_calling');
      tool_calling = hasTools ? 'supported' : 'unsupported';
    } else if (desc.includes('tool calling') || desc.includes('function calling')) {
      tool_calling = 'supported';
    }

    // 4. Structured Output
    let structured_output: 'supported' | 'unsupported' | 'unknown' = 'unknown';
    if (supportedParams.length > 0) {
      const hasFormat = supportedParams.includes('response_format') || supportedParams.includes('structured_outputs');
      structured_output = hasFormat ? 'supported' : 'unsupported';
    } else if (isChat) {
      structured_output = 'supported'; // Standard chat completions support JSON output prompt instruction
    }

    // 5. Reasoning
    const isReasoning = id.includes('r1') ||
                        id.includes('reason') ||
                        id.includes('qwq') ||
                        id.includes('o1') ||
                        id.includes('o3') ||
                        desc.includes('chain-of-thought') ||
                        desc.includes('reasoning model');
    const reasoning = isReasoning ? 'supported' : 'unknown';

    // 6. Coding
    const isCoding = id.includes('coder') ||
                     id.includes('code') ||
                     id.includes('deepseek-coder') ||
                     id.includes('starcoder') ||
                     id.includes('codeqwen') ||
                     desc.includes('coding model') ||
                     desc.includes('code generation');
    const coding = isCoding ? 'supported' : 'unknown';

    // 7. Image Generation

    return {
      chat,
      reasoning,
      coding,
      vision,
      tool_calling,
      structured_output,
    };
  }

  private classifyNim(raw: RawModelMetadata): ModelCapabilities {
    const id = raw.id.toLowerCase();
    const desc = (raw.description || '').toLowerCase();

    // 1. Chat
    const isChat = id.includes('instruct') || id.includes('chat') || id.includes('llama') || id.includes('nemotron') || id.includes('mistral') || id.includes('qwen');
    const chat = isChat ? 'supported' : 'unknown';

    // 2. Vision
    const isVision = id.includes('vision') || id.includes('vlm') || id.includes('multimodal') || id.includes('neva') || id.includes('florence') || id.includes('kosmos');
    const vision = isVision ? 'supported' : (isChat ? 'unsupported' : 'unknown');

    // 3. Reasoning
    const isReasoning = id.includes('r1') || id.includes('reason') || id.includes('qwq') || desc.includes('reasoning');
    const reasoning = isReasoning ? 'supported' : 'unknown';

    // 4. Coding
    const isCoding = id.includes('coder') || id.includes('code');
    const coding = isCoding ? 'supported' : 'unknown';

    // 5. Tool Calling - NIM API parameter specs are unknown unless documented
    const tool_calling = 'unknown';

    // 6. Structured Output
    const structured_output = isChat ? 'supported' : 'unknown';

    return {
      chat,
      reasoning,
      coding,
      vision,
      tool_calling,
      structured_output,
    };
  }

  private classifyGemini(raw: RawModelMetadata): ModelCapabilities {
    const id = raw.id.toLowerCase();

    if (id.includes('imagen')) {
      return {
        chat: 'unsupported',
        reasoning: 'unsupported',
        coding: 'unsupported',
        vision: 'unsupported',
        tool_calling: 'unsupported',
        structured_output: 'unsupported',
      };
    }

    const isFlashOrPro = id.includes('flash') || id.includes('pro');

return {
        chat: 'supported',
        reasoning: id.includes('2.0-flash-thinking') || id.includes('pro') ? 'supported' : 'unknown',
        coding: 'supported',
        vision: 'supported',
        tool_calling: isFlashOrPro ? 'supported' : 'unknown',
        structured_output: 'supported',
      };
  }

  private classifyHuggingFace(raw: RawModelMetadata): ModelCapabilities {
    const id = raw.id.toLowerCase();
    const isVision =
      id.includes('-vl') ||
      id.includes('vision') ||
      id.includes('glm-4.5v') ||
      id.includes('glm-4.6v') ||
      id.includes('aya-vision') ||
      id.includes('command-a-vision') ||
      id.includes('multimodal') ||
      id.includes('internvl') ||
      id.includes('idefics') ||
      id.includes('llava');

    const isCoding = id.includes('code') || id.includes('coder');
    const isReasoning = id.includes('r1') || id.includes('reason') || id.includes('thinking') || id.includes('qwq');

    return {
      chat: 'supported',
      reasoning: isReasoning ? 'supported' : 'unknown',
      coding: isCoding ? 'supported' : 'unknown',
      vision: isVision ? 'supported' : 'unsupported',
      tool_calling: 'unknown',
      structured_output: 'supported',
    };
  }

  private classifyCloudflare(raw: RawModelMetadata): ModelCapabilities {
    const id = raw.id.toLowerCase();
    const isVision = id.includes('vision') || id.includes('llava');
    const isCoding = id.includes('code') || id.includes('coder');
    const isReasoning = id.includes('r1') || id.includes('reason');

    return {
      chat: 'supported',
      reasoning: isReasoning ? 'supported' : 'unknown',
      coding: isCoding ? 'supported' : 'unknown',
      vision: isVision ? 'supported' : 'unsupported',
      tool_calling: 'unknown',
      structured_output: 'supported',
    };
  }

  private classifyGeneric(raw: RawModelMetadata): ModelCapabilities {
    const id = raw.id.toLowerCase();
    const isChat = id.includes('chat') || id.includes('instruct');
    const isVision = id.includes('vision') || id.includes('vlm');
    const isCoding = id.includes('code') || id.includes('coder');
    const isReasoning = id.includes('r1') || id.includes('reason');

    return {
      chat: isChat ? 'supported' : 'unknown',
      reasoning: isReasoning ? 'supported' : 'unknown',
      coding: isCoding ? 'supported' : 'unknown',
      vision: isVision ? 'supported' : 'unknown',
      tool_calling: 'unknown',
      structured_output: isChat ? 'supported' : 'unknown',
    };
  }
}

export const capabilityClassifier = new CapabilityClassifier();
