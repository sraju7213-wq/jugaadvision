/**
 * LocalModelManager — orchestrates local model lifecycle:
 *   - search HuggingFace for GGUF models
 *   - download + register
 *   - load + run inference
 *   - remove / forget
 *
 * Acts as the single facade that the LocalAdapter and Vercel endpoints use.
 */

import type { LocalModelFile, DownloadProgress, HuggingFaceModelResult, LocalStoreStats, DownloadTaskState } from './localTypes';
import { getLocalModelStore } from './localStore';
import { searchGGUFModels, resolveModelFile } from './localDiscovery';
import { downloadModelFile, registerDownloadedModel, getActiveDownloadTasks, getDownloadTask, cancelDownloadTask } from './localDownloader';
import {
  generateText,
  unloadModel,
  unloadAll,
  loadModel,
  isModelLoaded,
  getLoadedModelIds,
  getLoadedMemoryInfo,
  type GenerateTextRequest,
  type GenerateTextResult,
} from './localRunner';

// ── search ───────────────────────────────────────────────────────────────────

export async function searchLocalModels(
  query: string,
  limit = 25,
): Promise<HuggingFaceModelResult[]> {
  return searchGGUFModels(query, limit);
}

export async function resolveLocalModel(
  repoId: string,
  fileName: string,
): Promise<HuggingFaceModelResult | null> {
  return resolveModelFile(repoId, fileName);
}

// ── active downloads ─────────────────────────────────────────────────────────

export function getActiveDownloads(): DownloadTaskState[] {
  return getActiveDownloadTasks();
}

export function getActiveDownload(id: string): DownloadTaskState | undefined {
  return getDownloadTask(id);
}

export function cancelDownload(id: string): boolean {
  return cancelDownloadTask(id);
}

// ── download + register ──────────────────────────────────────────────────────

export async function downloadAndRegisterModel(
  repoId: string,
  fileName: string,
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<LocalModelFile> {
  const filePath = await downloadModelFile({
    repoId,
    fileName,
    onProgress,
    signal,
  });

  const store = getLocalModelStore();
  const id = registerDownloadedModel(repoId, fileName, filePath);
  const model = store.get(id);
  if (!model) throw new Error(`Failed to register downloaded model: ${id}`);

  return model;
}

// ── store management ─────────────────────────────────────────────────────────

export function getLocalModel(id: string): LocalModelFile | undefined {
  return getLocalModelStore().get(id);
}

export function listLocalModels(): LocalModelFile[] {
  return getLocalModelStore().listAll().filter(m => m.isValid);
}

export function getLocalStoreStats(): LocalStoreStats {
  return getLocalModelStore().stats();
}

export function removeLocalModel(id: string): boolean {
  unloadModel(id);
  return getLocalModelStore().remove(id);
}

export function refreshLocalModelIntegrity(): void {
  getLocalModelStore().refreshIntegrity();
}

// ── inference & memory management ───────────────────────────────────────────

export function isLocalModelLoaded(id: string): boolean {
  return isModelLoaded(id);
}

export async function loadLocalModelIntoMemory(modelId: string): Promise<{
  success: boolean;
  loadDurationMs: number;
  model: LocalModelFile;
}> {
  const store = getLocalModelStore();
  const model = store.get(modelId);
  if (!model) {
    throw new Error(`Local model not found: ${modelId}`);
  }
  if (!model.isValid) {
    throw new Error(`Local model file invalid: ${modelId}`);
  }

  const { loadDurationMs } = await loadModel(model);
  return { success: true, loadDurationMs, model };
}

export function unloadLocalModel(id: string): boolean {
  return unloadModel(id);
}

export function unloadAllLocalModels(): void {
  unloadAll();
}

export function getLocalMemoryStatus(): {
  loadedCount: number;
  maxCacheSize: number;
  loadedModelIds: string[];
} {
  return getLoadedMemoryInfo();
}

export async function runLocalInference(
  modelId: string,
  request: GenerateTextRequest,
): Promise<GenerateTextResult> {
  const store = getLocalModelStore();
  const model = store.get(modelId);
  if (!model) {
    throw new Error(`Local model not found: ${modelId}`);
  }
  if (!model.isValid) {
    throw new Error(`Local model file invalid (may have been deleted): ${modelId}`);
  }

  return generateText(model, request);
}

// ── local adapter auto-registration ───────────────────────────────────────────

let _localAdapterRegistered = false;

/**
 * Ensures the LocalAdapter is registered with modelDiscoveryService.
 * Safe to call multiple times — only registers once.
 */
export async function ensureLocalAdapterRegistered(): Promise<void> {
  if (_localAdapterRegistered) return;
  try {
    const { LocalAdapter, initAdapter } = await import('./localAdapter');
    const adapter = new LocalAdapter();
    const { modelDiscoveryService } = await import('../discovery/discoveryService');
    modelDiscoveryService.registerAdapter(adapter);
    initAdapter();
    _localAdapterRegistered = true;
    console.log('[LocalModelManager] LocalAdapter registered');
  } catch (err) {
    console.warn('[LocalModelManager] LocalAdapter unavailable:', (err as Error).message || err);
  }
}

// ── fast health check ────────────────────────────────────────────────────────

/**
 * Returns whether the local model subsystem is capable of running inference.
 * Checks that node-llama-cpp is importable and at least one model file exists.
 */
export async function checkLocalInferenceReady(): Promise<{
  ok: boolean;
  reason?: string;
  modelsAvailable: number;
}> {
  try {
    // Check if node-llama-cpp is available
    await import('node-llama-cpp');
  } catch (err: any) {
    return { ok: false, reason: `node-llama-cpp unavailable: ${err.message || err}`, modelsAvailable: 0 };
  }

  const models = listLocalModels();
  if (models.length === 0) {
    return { ok: false, reason: 'No local models downloaded yet', modelsAvailable: 0 };
  }

  return { ok: true, modelsAvailable: models.length };
}
