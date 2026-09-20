/**
 * Local AI Model Types — shared across server and client via bundle-api.mjs
 *
 * Extends the existing AIModel / AIRequest / AIResponse types from server/ai/types.ts
 * with local-model-specific metadata.
 */

/** Where a local model lives on disk */
export interface LocalModelFile {
  /** Unique local id: `local:<sanitized-name>` */
  id: string;
  /** Human-readable display name, e.g. "Qwen3 0.6B Q8" */
  name: string;
  /** HuggingFace repo id the file was downloaded from, e.g. "Qwen/Qwen3-0.6B-GGUF" */
  sourceRepo: string;
  /** Exact file path on disk (absolute) */
  filePath: string;
  /** GGUF file name, e.g. "qwen3-0.6b-q8_0.gguf" */
  fileName: string;
  /** Approximate size in bytes */
  fileSizeBytes: number;
  /** Quantization / precision tag extracted from filename, e.g. "q8_0", "q4_k_m" */
  quantization?: string;
  /** Model architecture hint: "text" | "vision" | "unknown" */
  modality: 'text' | 'vision' | 'unknown';
  /** ISO timestamp of when the file was downloaded/extracted */
  downloadedAt: string;
  /** ISO timestamp of last load attempt */
  lastLoadedAt?: string;
  /** Number of times loaded successfully */
  loadCount: number;
  /** Last inference latency in ms (0 if never run) */
  lastInferenceMs?: number;
  /** Whether the file passes a basic integrity check (file exists + non-zero size) */
  isValid: boolean;
  /** Optional user note */
  note?: string;
  /** Whether the model is currently loaded in RAM/VRAM session cache */
  isLoaded?: boolean;
}

/** Active download task state for real-time progress tracking */
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

/** A model that is registered in the local store AND known to the broader catalog */
export interface LocalRegisteredModel extends LocalModelFile {
  /** Global model id in the format `local:<id>` */
  globalId: string;
  /** Whether the model has been loaded at least once successfully */
  everLoaded: boolean;
  /** Last inference latency in ms (0 if never run) */
  lastInferenceMs?: number;
}

/** Disk usage summary for the local model directory */
export interface LocalStoreStats {
  modelDir: string;
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeHuman: string;
  byModality: Record<string, { count: number; sizeBytes: number }>;
  spaceAvailableBytes: number;
  spaceAvailableHuman: string;
}

/** Progress callback shape for downloads */
export interface DownloadProgress {
  event: 'start' | 'progress' | 'complete' | 'error' | 'cancel';
  /** 0-100 when event === 'progress' */
  progress?: number;
  /** Human-readable status message */
  message?: string;
  /** Error description when event === 'error' */
  error?: string;
}

/** Search result from HuggingFace model hub (GGUF-focused) */
export interface HuggingFaceModelResult {
  repoId: string;
  modelId: string; // short name
  fileName: string;
  fileSize: number;
  quantization: string;
  modality: 'text' | 'vision' | 'unknown';
  description: string;
  lastModified: string;
  downloadUrl: string;
  license: string;
}

