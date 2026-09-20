/**
 * Client-side Local AI Model Service
 *
 * Search, download, manage, and run inference on local GGUF models —
 * for both web and Capacitor Android via the shared /api/ai/local/* endpoints.
 */

import { apiUrl } from '../lib/apiBase';
import type { HuggingFaceModelResult } from '../../server/ai/local/localTypes';

// ── fetch helpers ────────────────────────────────────────────────────────────

async function post<T>(path: string, body: any, timeoutMs = 60000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl(`/api/ai/local${path}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(`/api/ai/local${path}`));
  const data = await res.json();
  if (!res.ok && data?.error) throw new Error(data.error);
  return data;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(`/api/ai/local${path}`), { method: 'DELETE' });
  return res.json();
}

// ── public types ─────────────────────────────────────────────────────────────

export interface LocalModelInfo {
  id: string;
  name: string;
  sourceRepo: string;
  fileName: string;
  filePath?: string;
  fileSizeBytes: number;
  fileSizeHuman?: string;
  quantization?: string;
  modality: 'text' | 'vision' | 'unknown';
  downloadedAt: string;
  lastLoadedAt?: string;
  loadCount: number;
  isValid: boolean;
  isLoaded?: boolean;
  note?: string;
}

export interface LocalSearchResult extends HuggingFaceModelResult {}

export interface LocalInferenceResult {
  success: boolean;
  content: string;
  model: string;
  provider: string;
  tokensGenerated: number;
  loadDurationMs: number;
  generateDurationMs: number;
  totalDurationMs: number;
  error?: string;
}

export interface LocalDownloadProgress {
  event: 'start' | 'progress' | 'complete' | 'error' | 'cancel';
  progress?: number;
  message?: string;
  error?: string;
}

export interface DownloadTaskState {
  id: string; // `${repoId}/${fileName}`
  repoId: string;
  fileName: string;
  status: 'pending' | 'downloading' | 'verifying' | 'completed' | 'error' | 'cancelled';
  progress: number; // 0 to 100
  loadedBytes: number;
  totalBytes: number;
  speedBps: number;
  etaSeconds: number;
  message: string;
  startedAt: number;
  updatedAt: number;
  error?: string;
}

export interface LocalMemoryStatus {
  loadedCount: number;
  maxCacheSize: number;
  loadedModelIds: string[];
}

export interface LocalHealthStatus {
  success: boolean;
  ready: boolean;
  reason?: string;
  modelsAvailable: number;
  nodeLlamaCppAvailable: boolean;
}

export interface RecommendedModel {
  id: string;
  name: string;
  tagline: string;
  repoId: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeHuman: string;
  modality: 'text' | 'vision';
  quantization: string;
  minRam: string;
  targetDevice: string;
  badge: string;
  badgeVariant: 'mobile' | 'ultra-light' | 'balanced' | 'vision' | 'pro';
  speedEstimate: string;
  recommendedFor: string;
  description: string;
}

// ── Curated Recommended Models for Mobile & Low-End Devices ──────────────────

export const RECOMMENDED_MODELS: RecommendedModel[] = [
  {
    id: 'smollm2-135m',
    name: 'SmolLM2 135M Instruct',
    tagline: 'Pocket-Sized & Instant (~96MB) — Runs on Any Phone',
    repoId: 'bartowski/SmolLM2-135M-Instruct-GGUF',
    fileName: 'SmolLM2-135M-Instruct-Q4_K_M.gguf',
    fileSizeBytes: 96600064,
    fileSizeHuman: '96 MB',
    modality: 'text',
    quantization: 'Q4_K_M',
    minRam: '256 MB – 512 MB RAM',
    targetDevice: 'Any Android phone, older devices, battery-conscious mobile use',
    badge: 'ULTRA-TINY (<100MB)',
    badgeVariant: 'ultra-light',
    speedEstimate: '~60–100 tok/s on mobile CPU',
    recommendedFor: 'Instant prompt tuning, keywords, fast mobile generation on 4G/5G',
    description: 'The smallest production instruction LLM in the world. Downloads in under 10 seconds, runs with zero perceptible lag on any Android phone.',
  },
  {
    id: 'qwen2.5-0.5b',
    name: 'Qwen2.5 0.5B Instruct',
    tagline: 'Best All-Round Micro LLM for Mobile & Budget PCs',
    repoId: 'Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    fileName: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    fileSizeBytes: 491400032,
    fileSizeHuman: '491 MB',
    modality: 'text',
    quantization: 'Q4_K_M',
    minRam: '1 GB available RAM',
    targetDevice: 'Any Android phone, iPhone, budget laptop, low-end CPU',
    badge: 'RECOMMENDED FOR MOBILE',
    badgeVariant: 'mobile',
    speedEstimate: '~35–55 tok/s on mobile CPU',
    recommendedFor: 'Prompt crafting, creative expansion, multi-lingual (English, Hindi, multilingual)',
    description: 'Outstanding balance of intelligence, speed, and compact size. Fits easily in under 650MB RAM with high prompt accuracy.',
  },
  {
    id: 'smollm2-360m',
    name: 'SmolLM2 360M Instruct',
    tagline: 'Ultra-Lightweight & Instant (~270MB)',
    repoId: 'bartowski/SmolLM2-360M-Instruct-GGUF',
    fileName: 'SmolLM2-360M-Instruct-Q4_K_M.gguf',
    fileSizeBytes: 270590880,
    fileSizeHuman: '270 MB',
    modality: 'text',
    quantization: 'Q4_K_M',
    minRam: '512 MB – 1 GB RAM',
    targetDevice: 'Older phones, budget hardware, battery-conscious devices',
    badge: 'ULTRA-LIGHT (<300MB)',
    badgeVariant: 'ultra-light',
    speedEstimate: '~45–75 tok/s on CPU',
    recommendedFor: 'Rapid prompt enhancement, keywords, short taglines, instant generation',
    description: 'Featherweight instruction model by HuggingFace. Downloads in seconds, runs effortlessly on low-end CPUs, and uses almost no battery.',
  },
  {
    id: 'danube3-500m',
    name: 'Danube3 500M Chat',
    tagline: 'Engineered Specifically for Mobile Edge Computing',
    repoId: 'bartowski/h2o-danube3-500m-chat-GGUF',
    fileName: 'h2o-danube3-500m-chat-Q4_K_M.gguf',
    fileSizeBytes: 317877760,
    fileSizeHuman: '318 MB',
    modality: 'text',
    quantization: 'Q4_K_M',
    minRam: '750 MB available RAM',
    targetDevice: 'Smartphones, ARM devices, Chromebooks, low-power laptops',
    badge: 'EDGE SPECIALIST',
    badgeVariant: 'mobile',
    speedEstimate: '~35–60 tok/s on CPU',
    recommendedFor: 'Clean prompt adjustments, creative directions, conversational editing',
    description: 'Purpose-built by H2O.ai for edge intelligence. Exceptionally low memory consumption with fast CPU generation.',
  },
  {
    id: 'llama-3.2-1b',
    name: 'Llama 3.2 1B Instruct',
    tagline: "Meta's Official Mobile Flagship Model",
    repoId: 'bartowski/Llama-3.2-1B-Instruct-GGUF',
    fileName: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    fileSizeBytes: 807694464,
    fileSizeHuman: '808 MB',
    modality: 'text',
    quantization: 'Q4_K_M',
    minRam: '1.5 GB – 2 GB available RAM',
    targetDevice: 'Standard modern smartphones (3GB+ RAM), laptops, PCs',
    badge: 'BALANCED QUALITY',
    badgeVariant: 'balanced',
    speedEstimate: '~20–35 tok/s on CPU',
    recommendedFor: 'Cinematic image prompts, rich descriptive vocabulary, art styles, structured prompt logic',
    description: "Meta's flagship compact model with superior prose, deep visual descriptive ability, and rich prompt crafting skills.",
  },
  {
    id: 'liquid-lfm-450m',
    name: 'Liquid LFM-2.5-VL 450M',
    tagline: 'On-Device Vision & Image Analysis',
    repoId: 'LiquidAI/LFM2.5-VL-450M-GGUF',
    fileName: 'LFM2.5-VL-450M-Q4_K_M.gguf',
    fileSizeBytes: 229313568,
    fileSizeHuman: '229 MB',
    modality: 'vision',
    quantization: 'Q4_K_M',
    minRam: '1 GB available RAM',
    targetDevice: 'Phones and laptops with camera or local photo uploads',
    badge: 'ON-DEVICE VISION',
    badgeVariant: 'vision',
    speedEstimate: 'Fast on-device vision inference',
    recommendedFor: 'Image-to-prompt analysis, visual inspection without cloud APIs',
    description: 'Revolutionary compact vision-language model by Liquid AI. Analyzes photos directly on your device without sending images over the network.',
  },
  {
    id: 'moondream2',
    name: 'Moondream2 1.86B Vision',
    tagline: 'The Gold Standard Compact On-Device Vision Specialist',
    repoId: 'vikhyatk/moondream2',
    fileName: 'moondream2-text-model-f16.gguf',
    fileSizeBytes: 838860800,
    fileSizeHuman: '800 MB',
    modality: 'vision',
    quantization: 'Q4_K_M',
    minRam: '1.5 GB available RAM',
    targetDevice: 'Smartphones, laptops, PCs with camera or local photo uploads',
    badge: 'VISION SPECIALIST',
    badgeVariant: 'vision',
    speedEstimate: '~25–45 tok/s on CPU',
    recommendedFor: 'Detailed scene captioning, camera angle detection, color & lighting breakdown',
    description: 'Engineered specifically for edge vision tasks. Excels at detecting visual aesthetic elements and reconstructing prompts from photos.',
  },
  {
    id: 'smolvlm-500m',
    name: 'SmolVLM 500M Instruct',
    tagline: 'Ultra-Compact Mobile Multimodal VLM (~350MB)',
    repoId: 'HuggingFaceTB/SmolVLM-500M-Instruct-GGUF',
    fileName: 'SmolVLM-500M-Instruct-Q4_K_M.gguf',
    fileSizeBytes: 356515840,
    fileSizeHuman: '356 MB',
    modality: 'vision',
    quantization: 'Q4_K_M',
    minRam: '800 MB available RAM',
    targetDevice: 'Budget Android phones, older hardware, battery-conscious mobile devices',
    badge: 'ULTRA-LIGHT VISION',
    badgeVariant: 'vision',
    speedEstimate: '~40–70 tok/s on mobile CPU',
    recommendedFor: 'Fast mobile image-to-prompt, style detection, color palette extraction',
    description: 'Hugging Face flagship compact multimodal model designed for edge devices with exceptional memory efficiency.',
  },
  {
    id: 'smolvlm-256m',
    name: 'SmolVLM 256M Instruct',
    tagline: 'Pocket-Sized Vision (~189MB) — Runs on Any Phone',
    repoId: 'HuggingFaceTB/SmolVLM-256M-Instruct-GGUF',
    fileName: 'SmolVLM-256M-Instruct-Q4_K_M.gguf',
    fileSizeBytes: 198180864,
    fileSizeHuman: '189 MB',
    modality: 'vision',
    quantization: 'Q4_K_M',
    minRam: '512 MB available RAM',
    targetDevice: 'Entry-level Android devices, older phones, battery saver mode',
    badge: 'POCKET VISION',
    badgeVariant: 'ultra-light',
    speedEstimate: '~60–90 tok/s on mobile CPU',
    recommendedFor: 'Rapid image keywording, mood extraction, fast offline prompting',
    description: 'The smallest multimodal vision model available. Ultra-fast download and near-instant inference with minimal battery footprint.',
  },
  {
    id: 'qwen2-vl-2b',
    name: 'Qwen2-VL 2B Instruct',
    tagline: 'High-Resolution Detail Parsing & Visual Intelligence',
    repoId: 'Qwen/Qwen2-VL-2B-Instruct-GGUF',
    fileName: 'qwen2-vl-2b-instruct-q4_k_m.gguf',
    fileSizeBytes: 1468006400,
    fileSizeHuman: '1.46 GB',
    modality: 'vision',
    quantization: 'Q4_K_M',
    minRam: '3 GB available RAM',
    targetDevice: 'High-spec smartphones (6GB+ RAM), PCs, Macs',
    badge: 'PRO VISION',
    badgeVariant: 'pro',
    speedEstimate: '~18–30 tok/s on CPU',
    recommendedFor: 'Complex fine-grained lighting analysis, studio equipment recognition, multi-subject scenes',
    description: 'Exceptional visual detail parsing from Alibaba. Resolves intricate details, lenses, textures, and typography inside images.',
  },
  {
    id: 'qwen2.5-1.5b',
    name: 'Qwen2.5 1.5B Instruct',
    tagline: 'High Precision for 4GB+ RAM Devices',
    repoId: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    fileName: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    fileSizeBytes: 1117320736,
    fileSizeHuman: '1.11 GB',
    modality: 'text',
    quantization: 'Q4_K_M',
    minRam: '2.5 GB available RAM',
    targetDevice: 'Modern smartphones (6GB+ RAM), Macs, laptops, desktops',
    badge: 'HIGH PRECISION',
    badgeVariant: 'pro',
    speedEstimate: '~15–28 tok/s on CPU',
    recommendedFor: 'Complex multi-concept prompts, intricate lighting/camera descriptions, deep nuance',
    description: 'Higher reasoning fidelity and vocabulary depth for devices with comfortable memory headroom.',
  },
];

// ── API functions ────────────────────────────────────────────────────────────

/** List all locally stored models with memory and download status */
export async function listLocalModels(): Promise<LocalModelInfo[]> {
  const data = await get<{
    success: boolean;
    count: number;
    models: LocalModelInfo[];
    memoryStatus?: LocalMemoryStatus;
  }>('/models');
  return data.models || [];
}

/** Get memory status of local models (how many in RAM) */
export async function getLocalMemoryStatus(): Promise<LocalMemoryStatus | null> {
  try {
    const data = await get<{
      success: boolean;
      memoryStatus?: LocalMemoryStatus;
    }>('/models');
    return data.memoryStatus || null;
  } catch {
    return null;
  }
}

/** Pre-load a model into memory (RAM/VRAM) */
export async function loadLocalModel(id: string): Promise<{
  success: boolean;
  isLoaded: boolean;
  loadDurationMs: number;
  message: string;
}> {
  return post<{
    success: boolean;
    isLoaded: boolean;
    loadDurationMs: number;
    message: string;
  }>(`/models/${encodeURIComponent(id)}/load`, {}, 60000);
}

/** Unload a model from memory to free RAM (crucial for mobile/low-end devices) */
export async function unloadLocalModel(id: string): Promise<{
  success: boolean;
  isLoaded: boolean;
  message: string;
}> {
  return post<{
    success: boolean;
    isLoaded: boolean;
    message: string;
  }>(`/models/${encodeURIComponent(id)}/unload`, {}, 15000);
}

/** Unload all cached models from memory */
export async function unloadAllLocalModels(): Promise<{
  success: boolean;
  message: string;
}> {
  return post<{
    success: boolean;
    message: string;
  }>('/models/unload-all', {}, 15000);
}

/** List all active and recent downloads with real-time speed & progress */
export async function getActiveDownloads(): Promise<DownloadTaskState[]> {
  try {
    const data = await get<{ success: boolean; downloads: DownloadTaskState[] }>('/downloads');
    return data.downloads || [];
  } catch {
    return [];
  }
}

/** Cancel an active download task */
export async function cancelDownload(id: string): Promise<{ success: boolean; message: string }> {
  return post<{ success: boolean; message: string }>('/downloads/cancel', { id }, 10000);
}

/** Get a single model by id */
export async function getLocalModel(id: string): Promise<LocalModelInfo | null> {
  try {
    const data = await get<{ success: boolean; model?: LocalModelInfo }>(`/models/${encodeURIComponent(id)}`);
    return data.model || null;
  } catch {
    return null;
  }
}

/** Search HuggingFace Hub for downloadable GGUF models */
export async function searchLocalModels(
  query: string,
  limit?: number,
): Promise<LocalSearchResult[]> {
  const data = await post<{ success: boolean; models: LocalSearchResult[] }>(
    '/models/search',
    { query, limit },
    45000,
  );
  return data.models || [];
}

/**
 * Download a GGUF model from HuggingFace.
 * Initiates the download task asynchronously on the server and polls
 * active downloads in real-time with live percentage & speed progress updates.
 */
export async function downloadLocalModel(
  repoId: string,
  fileName: string,
  onProgress?: (p: LocalDownloadProgress) => void,
): Promise<LocalModelInfo> {
  onProgress?.({ event: 'start', message: `Starting download for ${fileName}…` });
  try {
    const data = await post<{
      success: boolean;
      message?: string;
      status?: string;
      taskId?: string;
      model?: LocalModelInfo;
    }>(
      '/models/download',
      { repoId, fileName },
      30000,
    );

    if (data.model && data.status === 'completed') {
      onProgress?.({ event: 'complete', message: data.message || 'Download complete' });
      return data.model;
    }

    const taskId = data.taskId || `${repoId}/${fileName}`;

    // Poll until task finishes
    return await new Promise<LocalModelInfo>((resolve, reject) => {
      let lastReportedProgress = -1;
      const interval = setInterval(async () => {
        try {
          const dls = await getActiveDownloads();
          const task = dls.find(d => d.id === taskId);
          if (task) {
            if (task.status === 'downloading' || task.status === 'pending' || task.status === 'verifying') {
              if (task.progress !== lastReportedProgress) {
                lastReportedProgress = task.progress;
                onProgress?.({
                  event: 'progress',
                  progress: task.progress,
                  message: `${task.progress}% (${task.speedBps ? `${(task.speedBps / (1024 * 1024)).toFixed(1)} MB/s` : 'downloading'})`,
                });
              }
            } else if (task.status === 'completed') {
              clearInterval(interval);
              onProgress?.({ event: 'complete', message: 'Download complete' });
              const models = await listLocalModels();
              const found = models.find(m => m.sourceRepo === repoId || m.fileName === fileName);
              if (found) {
                resolve(found);
              } else {
                resolve({
                  id: taskId,
                  name: fileName.replace(/\.gguf$/i, ''),
                  sourceRepo: repoId,
                  fileName,
                  fileSizeBytes: task.totalBytes || 0,
                  modality: 'text',
                  downloadedAt: new Date().toISOString(),
                  loadCount: 0,
                  isValid: true,
                });
              }
            } else if (task.status === 'error' || task.status === 'cancelled') {
              clearInterval(interval);
              const errMsg = task.error || task.message || 'Download cancelled or failed';
              onProgress?.({ event: 'error', error: errMsg, message: errMsg });
              reject(new Error(errMsg));
            }
          }
        } catch {
          // keep polling
        }
      }, 1000);

      // Safety timeout: 15 minutes max
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error('Download timed out after 15 minutes'));
      }, 900_000);
    });
  } catch (err: any) {
    onProgress?.({ event: 'error', error: err.message, message: err.message });
    throw err;
  }
}

/** Remove a local model (deletes file + manifest entry) */
export async function removeLocalModel(id: string): Promise<{ success: boolean; message: string }> {
  return del(`/models/${encodeURIComponent(id)}/remove`);
}

/** Run text inference on a local model */
export async function inferLocalModel(
  modelId: string,
  prompt: string,
  options?: { maxTokens?: number; temperature?: number; stop?: string[] },
): Promise<LocalInferenceResult> {
  try {
    return await post<LocalInferenceResult>('/infer', {
      modelId,
      prompt,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      stop: options?.stop,
    }, 290_000);
  } catch (err: any) {
    return {
      success: false,
      content: '',
      model: modelId,
      provider: 'local',
      tokensGenerated: 0,
      loadDurationMs: 0,
      generateDurationMs: 0,
      totalDurationMs: 0,
      error: err.message || String(err),
    };
  }
}

/** Check if local inference is ready (node-llama-cpp + models available) */
export async function checkLocalHealth(): Promise<LocalHealthStatus> {
  try {
    return await get<LocalHealthStatus>('/health');
  } catch {
    return {
      success: false,
      ready: false,
      reason: 'Unable to connect to server',
      modelsAvailable: 0,
      nodeLlamaCppAvailable: false,
    };
  }
}

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
