export type ProviderName = 'openrouter' | 'nim' | 'huggingface' | 'cloudflare' | 'custom' | string;

export type TaskCategory =
  | 'vision'
  | 'structured_json'
  | 'prompt_enhancement'
  | 'text_generation'
  | 'reasoning'
  | 'coding';

export type TaskType =
  | 'rewriting'
  | 'captions'
  | 'prompt_formatting'
  | 'extracting_structured_information'
  | 'simple_creative_suggestions'
  | 'creative_prompt'
  | 'chat'
  | 'coding'
  | 'reasoning'
  | 'image_analysis'
  | 'advanced_image_analysis'
  | 'vision'
  | 'multi_step_tasks'
  | 'structured_json'
  | 'text_generation'
  | 'prompt_enhancement';

export type ModelModality = 'text' | 'vision' | 'json';

export type FreeEligibility = 'free' | 'paid' | 'eligible_unknown';

export type ModelStatus = 'available' | 'cooldown' | 'degraded' | 'disabled';

export type HealthState =
  | 'healthy'
  | 'degraded'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'temporarily_unavailable'
  | 'disabled'
  | 'unknown';

export type CapabilityStatus = 'supported' | 'unsupported' | 'unknown';

export type ModelCapabilityType =
  | 'chat'
  | 'reasoning'
  | 'coding'
  | 'vision'
  | 'tool_calling'
  | 'structured_output';

export type QualityPreference = 'high' | 'balanced' | 'speed';
export type SpeedPreference = 'fastest' | 'balanced' | 'throughput';
export type ModelTier = 'fast' | 'balanced' | 'quality';

export interface TierGroupedModels {
  fast: AIModel[];
  balanced: AIModel[];
  quality: AIModel[];
}

export type CategorizedModelCatalog = Record<TaskCategory, TierGroupedModels>;

export interface AppearanceSettings {
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  uiDensity: 'compact' | 'comfortable' | 'spacious';
  animationsEnabled: boolean;
  reducedMotion: boolean;
  fontScale: 'small' | 'normal' | 'large';
}

export interface ModelPolicySettings {
  freeModelsOnly: boolean;
  allowPaidModels: boolean;
  autoRefreshInterval: '15m' | '30m' | '1h' | '6h' | '24h' | 'manual';
  preferredQuality: 'fast' | 'balanced' | 'quality';
  maxFallbackAttempts: number;
}

export interface ProviderTestRequest {
  provider: ProviderName;
  key?: string;
}

export interface ProviderTestResponse {
  success: boolean;
  provider: ProviderName;
  status: 'healthy' | 'degraded' | 'invalid_key' | 'no_models';
  latencyMs: number;
  message: string;
  testedModel?: string;
  error?: string;
}

export interface ProviderSettingsUpdate {
  provider: ProviderName;
  keys: string[] | string;
}

export interface SanitizedRecentFailure {
  id: string;
  timestamp: string;
  provider: ProviderName;
  modelId: string;
  error: string;
  statusCode?: number;
}

export interface ScoringWeights {
  verifiedFreeBonus: number;
  capabilityMatchWeight: number;
  tierAlignmentWeight: number;
  tierMismatchPenalty: number;
  healthScoreWeight: number;
  successRateWeight: number;
  latencyBonusWeight: number;
  failurePenaltyWeight: number;
  contextWindowBonus: number;
}

export interface ModelCapabilities {
  chat: CapabilityStatus;
  reasoning: CapabilityStatus;
  coding: CapabilityStatus;
  vision: CapabilityStatus;
  tool_calling: CapabilityStatus;
  structured_output: CapabilityStatus;
}

export interface ModelPricing {
  prompt: number; // input cost per token
  completion: number; // output cost per token
  isZeroCost: boolean;
}

export interface EntityHealthMetrics {
  state: HealthState;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  averageLatencyMs: number;
  lastSuccess?: string;
  lastFailure?: string;
  cooldownUntil: number;
  lastErrorReason?: string;
}

export interface KeyHealthData extends EntityHealthMetrics {
  maskedKey: string;
  provider: ProviderName;
}

export interface ModelHealthData extends EntityHealthMetrics {
  modelId: string;
  provider: ProviderName;
  providerModelId: string;
}

export interface ProviderHealthData extends EntityHealthMetrics {
  provider: ProviderName;
  activeKeys: number;
  totalKeys: number;
  availableModels: number;
  totalModels: number;
}

export interface AIModel {
  id: string; // Global unique identifier
  provider: ProviderName;
  providerModelId?: string;
  name: string;
  verifiedFree?: boolean;
  eligibilityStatus?: FreeEligibility;
  capabilities: any[];
  capabilityMap?: ModelCapabilities;
  contextWindow?: number;
  status?: ModelStatus;
  successRate?: number;
  averageLatency?: number;
  failureCount?: number;
  lastChecked?: string;
  cooldownUntil?: number;

  // Compatibility aliases & helper metadata
  isFree?: boolean;
  contextLength?: number;
  freeEligibility?: FreeEligibility;
  tier: 'fast' | 'balanced' | 'quality';
  pricing?: ModelPricing;
  modalities: ModelModality[];
  supportsStructuredJson: boolean;
  description?: string;
  inputCost?: number;
  outputCost?: number;
  discoveredTimestamp?: string;
}

export type DiscoveredModel = AIModel;

export interface KeyState {
  key: string;
  provider: ProviderName;
  consecutiveFailures: number;
  failureCount: number;
  successCount: number;
  requestCount: number;
  lastRequestTime: number;
  lastErrorTime: number;
  lastSuccessTime: number;
  backoffUntil: number;
  backoffReason?: string;
  consecutiveRateLimits: number;
  isExhausted: boolean;
}

export interface MessageContentItem {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string; // http(s) URL or data:image/png;base64,...
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContentItem[];
}

export interface AIRequest {
  taskType: TaskType;
  messages: ChatMessage[];
  requiredCapabilities?: ModelCapabilityType[];
  preferredQuality?: QualityPreference;
  speedPreference?: SpeedPreference;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
  jsonSchema?: Record<string, any>;
  preferredProvider?: ProviderName;
  preferredModel?: string;
  preferFree?: boolean;
  maxFallbackAttempts?: number;
  requestId?: string;
  scoringWeightsOverride?: Partial<ScoringWeights>;
}

export interface AIResponse {
  content: string;
  parsedJson?: any;
  model: string;
  provider: ProviderName;
  taskType?: TaskType;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  durationMs: number;
  fallbackCount?: number;
}

export interface ProviderHealth {
  provider: ProviderName;
  isAvailable: boolean;
  activeKeys: number;
  totalKeys: number;
  errorRate: number;
  avgLatencyMs: number;
  discoveredModelCount: number;
}

export interface HealthReport {
  timestamp: string;
  providers: Record<ProviderName, ProviderHealthData>;
  keys: Record<string, KeyHealthData>;
  models: Record<string, ModelHealthData>;
  discoveredModelsTotal: number;
  freeModelsTotal: number;
  verifiedFreeModelsTotal?: number;
}

export type GenerationFeature =
  | 'prompt_builder'
  | 'image_to_prompt'
  | 'creative_mixer'
  | 'batch_generator'
  | 'pro_prompter'
  | 'studio'
  | 'general';

export type GenerationLifecycleState =
  | 'idle'
  | 'validating'
  | 'queued'
  | 'generating'
  | 'validating_result'
  | 'success'
  | 'partial_success'
  | 'cancelled'
  | 'error';

export type QualityGateCode =
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_JSON'
  | 'OVER_LIMIT'
  | 'LOW_VARIATION_DIVERSITY'
  | 'CONSTRAINT_CONFLICT'
  | 'EXACT_TEXT_CHANGED'
  | 'UNSAFE_CONTENT'
  | 'NONE';

export interface QualityGateDiagnostic {
  passed: boolean;
  code: QualityGateCode;
  message: string;
  details?: any;
  severity: 'error' | 'warning' | 'info';
}

export interface UnifiedGenerateRequest {
  feature: GenerationFeature | string;
  mode?: string;
  baseConcept?: string;
  constraints?: Record<string, any>;
  references?: Array<{ url?: string; base64?: string; mimeType?: string; name?: string }>;
  requestedOutput?: 'text' | 'json' | 'vision' | 'mix';
  schema?: Record<string, any>;
  prompt?: string;
  systemPrompt?: string;
  messages?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  preferredProvider?: ProviderName;
  preferredModel?: string;
  preferFree?: boolean;
  requestId?: string;
}

export interface UnifiedGenerateResponse {
  success: boolean;
  generationId: string;
  status: GenerationLifecycleState;
  result: any;
  raw?: string;
  parsedJson?: any;
  diagnostics?: QualityGateDiagnostic[];
  model: string;
  provider: string;
  durationMs: number;
  error?: string;
}

export interface BatchGenerateRequest {
  baseConcept: string;
  count: number;
  preset?: string;
  persona?: string;
  creativity?: number;
  density?: number;
  systemPrompt?: string;
  requestId?: string;
}

export interface BatchItemResult {
  index: number;
  prompt: string;
  rationale?: string;
  status: 'success' | 'error';
  error?: string;
  diagnostics?: QualityGateDiagnostic[];
}

export interface BatchGenerateResponse {
  batchId: string;
  status: 'success' | 'partial_success' | 'error';
  requestedCount: number;
  completedCount: number;
  items: BatchItemResult[];
  failedIndices: number[];
  diversityScore: number;
  durationMs: number;
  error?: string;
}
