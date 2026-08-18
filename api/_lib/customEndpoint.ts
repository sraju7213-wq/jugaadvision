export interface CustomEndpointConfig { endpoint: string; model: string; }
let config: CustomEndpointConfig | null = null;
export function getCustomEndpoint(): CustomEndpointConfig | null { return config; }
export function setCustomEndpoint(next: CustomEndpointConfig | null): CustomEndpointConfig | null { config = next; return config; }
export function customEndpointKey(): string | null { return config ? '__custom_endpoint__' : null; }
