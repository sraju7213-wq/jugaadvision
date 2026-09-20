/**
 * LocalDownloader — downloads GGUF model files from HuggingFace Hub.
 *
 * Simple, robust implementation suitable for serverless (Vercel) functions
 * where partial-resume is less critical than correctness.
 */

import fs from 'node:fs';
import path from 'node:path';
import { resolveModelFile } from './localDiscovery';
import type { DownloadProgress, DownloadTaskState } from './localTypes';
import { getLocalModelStore } from './localStore';

const MAX_DOWNLOAD_RETRIES = 3;
const ABORT_DELAY_MS = 500;

// ── active download registry ──────────────────────────────────────────────────

const activeDownloads = new Map<string, DownloadTaskState>();
const downloadAbortControllers = new Map<string, AbortController>();

/** List all currently tracked downloads */
export function getActiveDownloadTasks(): DownloadTaskState[] {
  return Array.from(activeDownloads.values());
}

/** Get a single download task by task id (`${repoId}/${fileName}`) */
export function getDownloadTask(id: string): DownloadTaskState | undefined {
  return activeDownloads.get(id);
}

/** Cancel an in-progress download task */
export function cancelDownloadTask(id: string): boolean {
  const ctrl = downloadAbortControllers.get(id);
  const task = activeDownloads.get(id);
  if (ctrl) {
    try {
      ctrl.abort();
    } catch {
      // ignore
    }
    downloadAbortControllers.delete(id);
    if (task) {
      task.status = 'cancelled';
      task.message = 'Download cancelled by user';
      task.updatedAt = Date.now();
    }
    return true;
  }
  return false;
}

// ── download engine ──────────────────────────────────────────────────────────

export interface DownloadOptions {
  /** HuggingFace repo id, e.g. "Qwen/Qwen3-0.6B-GGUF" */
  repoId: string;
  /** GGUF file name within the repo */
  fileName: string;
  /** Target directory (defaults to localModelStore.directory()) */
  targetDir?: string;
  /** Progress callback */
  onProgress?: (p: DownloadProgress) => void;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Custom download URL (bypasses HF Hub lookup) */
  downloadUrl?: string;
  /** Expected file size for integrity check (optional) */
  expectedSize?: number;
}

/**
 * Download a GGUF model file from HuggingFace.
 * Returns the absolute path to the downloaded file.
 */
export async function downloadModelFile(opts: DownloadOptions): Promise<string> {
  const targetDir = opts.targetDir || getLocalModelStore().directory();
  const destPath = path.join(targetDir, opts.fileName);
  const taskId = `${opts.repoId}/${opts.fileName}`;

  // If already downloading, don't start duplicate process
  const existing = activeDownloads.get(taskId);
  if (existing && existing.status === 'downloading') {
    throw new Error(`Download for ${opts.fileName} is already in progress (${existing.progress}%).`);
  }

  const task: DownloadTaskState = {
    id: taskId,
    repoId: opts.repoId,
    fileName: opts.fileName,
    status: 'pending',
    progress: 0,
    loadedBytes: 0,
    totalBytes: opts.expectedSize || 0,
    speedBps: 0,
    etaSeconds: 0,
    message: `Resolving ${opts.fileName}...`,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
  activeDownloads.set(taskId, task);

  opts.onProgress?.({ event: 'start', message: `Downloading ${opts.fileName}...` });

  // Resolve metadata
  let downloadUrl = opts.downloadUrl;
  let expectedSize = opts.expectedSize;

  if (!downloadUrl && opts.repoId) {
    const info = await resolveModelFile(opts.repoId, opts.fileName).catch(() => null);
    if (!info) {
      task.status = 'error';
      task.error = `File not found in ${opts.repoId}`;
      task.updatedAt = Date.now();
      opts.onProgress?.({ event: 'error', message: `File not found in ${opts.repoId}` });
      throw new Error(`File ${opts.fileName} not found in ${opts.repoId}`);
    }
    downloadUrl = info.downloadUrl;
    expectedSize = info.fileSize;
    task.totalBytes = expectedSize;
  }

  if (!downloadUrl) {
    task.status = 'error';
    task.error = 'No download URL available';
    task.updatedAt = Date.now();
    opts.onProgress?.({ event: 'error', message: 'No download URL' });
    throw new Error('No download URL available');
  }

  // Clean up any partial file from prior attempt
  if (fs.existsSync(destPath)) {
    try { fs.unlinkSync(destPath); } catch {}
  }

  const internalCtrl = new AbortController();
  downloadAbortControllers.set(taskId, internalCtrl);

  // Combine external and internal abort signals
  const onExternalAbort = () => {
    internalCtrl.abort();
    task.status = 'cancelled';
    task.message = 'Cancelled';
    task.updatedAt = Date.now();
    opts.onProgress?.({ event: 'cancel', message: 'Cancelled' });
  };

  if (opts.signal) {
    if (opts.signal.aborted) {
      onExternalAbort();
      downloadAbortControllers.delete(taskId);
      throw new DOMException('Aborted', 'AbortError');
    }
    opts.signal.addEventListener('abort', onExternalAbort, { once: true });
  }

  let lastError: Error | null = null;
  task.status = 'downloading';
  task.message = `Starting download for ${opts.fileName}...`;
  task.updatedAt = Date.now();

  try {
    for (let attempt = 1; attempt <= MAX_DOWNLOAD_RETRIES; attempt++) {
      if (internalCtrl.signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      try {
        const totalBytes = await downloadWithProgress(
          downloadUrl,
          destPath,
          expectedSize || 0,
          (loaded, total, speed, eta) => {
            const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
            task.status = 'downloading';
            task.progress = pct;
            task.loadedBytes = loaded;
            task.totalBytes = total;
            task.speedBps = speed;
            task.etaSeconds = eta;
            task.updatedAt = Date.now();
            task.message = total > 0
              ? `${pct}% — ${formatBytes(loaded)} / ${formatBytes(total)} (${formatBytes(speed)}/s)`
              : `${formatBytes(loaded)} (${formatBytes(speed)}/s)`;

            opts.onProgress?.({
              event: 'progress',
              progress: pct,
              message: task.message,
            });
          },
          internalCtrl.signal,
        );

        // Integrity check
        task.status = 'verifying';
        task.message = `Verifying integrity (${formatBytes(totalBytes)})...`;
        task.updatedAt = Date.now();

        if (expectedSize && totalBytes !== expectedSize) {
          try { fs.unlinkSync(destPath); } catch {}
          throw new Error(`Size mismatch: got ${formatBytes(totalBytes)}, expected ${formatBytes(expectedSize)}`);
        }

        task.status = 'completed';
        task.progress = 100;
        task.loadedBytes = totalBytes;
        task.totalBytes = totalBytes;
        task.message = `Downloaded ${formatBytes(totalBytes)}`;
        task.updatedAt = Date.now();

        opts.onProgress?.({ event: 'complete', message: task.message });

        // Keep task completed in list for 3 minutes before removal
        setTimeout(() => {
          if (activeDownloads.get(taskId)?.status === 'completed') {
            activeDownloads.delete(taskId);
          }
        }, 180_000);

        return destPath;
      } catch (err: any) {
        lastError = err;
        if (internalCtrl.signal.aborted || err.name === 'AbortError') {
          task.status = 'cancelled';
          task.message = 'Download cancelled';
          task.updatedAt = Date.now();
          throw err;
        }

        if (attempt < MAX_DOWNLOAD_RETRIES) {
          task.message = `Retry ${attempt}/${MAX_DOWNLOAD_RETRIES}: ${err.message}`;
          task.updatedAt = Date.now();
          opts.onProgress?.({ event: 'progress', progress: 0, message: task.message });
          try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch {}
          await sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    task.status = 'error';
    task.error = lastError?.message || 'Download failed after retries';
    task.updatedAt = Date.now();
    opts.onProgress?.({ event: 'error', message: task.error });
    throw lastError || new Error('Download failed after retries');
  } finally {
    downloadAbortControllers.delete(taskId);
    if (opts.signal) {
      opts.signal.removeEventListener('abort', onExternalAbort);
    }
  }
}

// ── streaming download ───────────────────────────────────────────────────────

async function downloadWithProgress(
  url: string,
  destPath: string,
  expectedSize: number,
  onProgress: (loaded: number, total: number, speed: number, eta: number) => void,
  signal: AbortSignal,
): Promise<number> {
  const res = await fetch(url, {
    signal,
    headers: {
      'User-Agent': 'JugaadVision-LocalModelDownloader/1.0',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const contentLength = Number(res.headers.get('content-length')) || expectedSize;
  const body = res.body;
  if (!body) throw new Error('Empty response body');

  const reader = body.getReader();
  const fileStream = fs.createWriteStream(destPath, { flags: 'w' });

  let loaded = 0;
  const startTime = Date.now();
  let lastSpeedSampleTime = startTime;
  let lastSampleLoaded = 0;
  let currentSpeed = 0;

  try {
    while (true) {
      if (signal.aborted) {
        fileStream.destroy();
        try { fs.unlinkSync(destPath); } catch {}
        throw new DOMException('Aborted', 'AbortError');
      }

      const { done, value } = await reader.read();
      if (done) break;

      if (value) {
        fileStream.write(Buffer.from(value));
        loaded += value.length;

        const now = Date.now();
        const elapsedSinceSample = (now - lastSpeedSampleTime) / 1000;
        if (elapsedSinceSample >= 0.5) {
          currentSpeed = Math.round((loaded - lastSampleLoaded) / elapsedSinceSample);
          lastSpeedSampleTime = now;
          lastSampleLoaded = loaded;
        }

        const remainingBytes = Math.max(0, contentLength - loaded);
        const eta = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : 0;

        onProgress(loaded, contentLength, currentSpeed, eta);
      }
      await sleep(0);
    }

    await new Promise<void>((resolve, reject) => {
      fileStream.end((err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const stat = fs.statSync(destPath);
    return stat.size;
  } catch (err) {
    fileStream.destroy();
    try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch {}
    throw err;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── register after download ──────────────────────────────────────────────────

/**
 * Register a freshly downloaded model file into the local store.
 */
export function registerDownloadedModel(
  repoId: string,
  fileName: string,
  filePath: string,
  note?: string,
): string {
  const stats = fs.statSync(filePath);
  const quant = fileName.toLowerCase().match(/(q(?:\d+|_?k?_?m?)(?:\.nn)?)/)?.[1] || 'unknown';

  // Heuristic modality detection
  const clean = fileName.toLowerCase();
  let modality: 'text' | 'vision' | 'unknown' = 'unknown';
  if (clean.includes('vision') || clean.includes('-vl') || clean.includes('_vl')) {
    modality = 'vision';
  } else if (clean.includes('llm') || clean.includes('-lm') || clean.includes('text')) {
    modality = 'text';
  }

  return getLocalModelStore().register({
    name: fileName.replace(/\.gguf$/i, '').replace(/_/g, ' ').slice(0, 100),
    sourceRepo: repoId,
    filePath,
    fileName,
    fileSizeBytes: stats.size,
    quantization: quant,
    modality,
    note: note || undefined,
  });
}
