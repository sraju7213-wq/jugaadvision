export interface CustomEndpointConfig { endpoint: string; model: string; }
let config: CustomEndpointConfig | null = null;

function initFromEnv(): CustomEndpointConfig | null {
  const endpoint = process.env.CUSTOM_ENDPOINT_URL || process.env.CUSTOM_ENDPOINT || process.env.OLLAMA_BASE_URL;
  if (endpoint) {
    const cleanEndpoint = endpoint.endsWith('/chat/completions') ? endpoint : (endpoint.replace(/\/+$/, '') + (endpoint.includes('/v1') ? '/chat/completions' : '/v1/chat/completions'));
    return {
      endpoint: cleanEndpoint,
      model: process.env.CUSTOM_MODEL || 'qwen2.5-coder:7b',
    };
  }
  return null;
}

export function getCustomEndpoint(): CustomEndpointConfig | null {
  if (!config) {
    config = initFromEnv();
  }
  return config;
}
export function setCustomEndpoint(next: CustomEndpointConfig | null): CustomEndpointConfig | null { config = next; return config; }
export function customEndpointKey(): string | null { return getCustomEndpoint() ? '__custom_endpoint__' : null; }
