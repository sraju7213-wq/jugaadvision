/**
 * LocalRunner — loads GGUF models via node-llama-cpp v3 and runs text inference.
 *
 * v3 API flow (verified against node-llama-cpp@3.21.1):
 *   const llama   = await getLlama();                          // init runtime
 *   const model   = await llama.loadModel({modelPath})
 *   const context = await model.createContext({})
 *   const session = new LlamaChatSession({contextSequence: context.getSequence()})
 *   const text    = await session.prompt(userPrompt, {maxTokens, temperature})
 *
 * LlamaChatSession auto-applies the model's built-in chat template (ChatML for
 * Qwen, Llama-3 format, etc.) — no manual prompt formatting needed.
 * Sessions are cached and disposed to free memory (serverless-friendly).
 */

import fs from 'node:fs';
import path from 'node:path';
import { getLocalModelStore } from './localStore';
import type { LocalModelFile } from './localTypes';

// ── in-memory cache ──────────────────────────────────────────────────────────

interface LoadedSession {
  id: string;
  llama: any;      // Llama runtime
  model: any;      // LlamaModel
  context: any;    // LlamaContext
  session: any;    // LlamaChatSession
  loadedAt: number;
  loadDurationMs: number;
}

const loadedCache = new Map<string, LoadedSession>();
const MAX_CACHE_SIZE = 2;
const CACHE_TTL_MS = 5 * 60_000; // 5 min idle eviction

// ── shared llama.cpp runtime (one per process) ───────────────────────────────

let _llamaPromise: Promise<any> | null = null;

async function getLlamaRuntime(): Promise<any> {
  if (!_llamaPromise) {
    _llamaPromise = (async () => {
      const llm = await import('node-llama-cpp');
      // Small-VRAM GPUs (common in laptops) fail to allocate the KV cache and
      // compute buffers. Only enable GPU when there's comfortable headroom.
      let llama: any;
      try {
        llama = await llm.getLlama();
        const vram = llama.getVramState?.();
        const hasEnoughVram = vram && vram.total > 4 * 1024 * 1024 * 1024; // >4GB VRAM
        if (llama.gpu && !hasEnoughVram) {
          console.log(`[LocalRunner] GPU "${llama.gpu}" has only ${vram ? (vram.total / 1024 ** 3).toFixed(1) : '?'}GB VRAM — switching to CPU-only.`);
          llama.dispose();
          llama = await llm.getLlama({ gpu: false });
        }
      } catch (err: any) {
        console.warn('[LocalRunner] getLlama() failed, retrying CPU-only:', err?.message || err);
        llama = await llm.getLlama({ gpu: false });
      }
      return llama;
    })().catch(err => {
      _llamaPromise = null; // allow retry on next call
      throw err;
    });
  }
  return _llamaPromise;
}

// ── public API ────────────────────────────────────────────────────────────────

export async function loadModel(modelFile: LocalModelFile): Promise<{
  session: any;
  loadDurationMs: number;
}> {
  const absPath = path.resolve(modelFile.filePath);

  // 1. Cache hit (LRU touch)
  const cached = loadedCache.get(modelFile.id);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS && fs.existsSync(absPath)) {
    cached.loadedAt = Date.now();
    return { session: cached.session, loadDurationMs: cached.loadDurationMs };
  }

  // 2. Replace stale entry if present
  if (cached) unloadModel(modelFile.id);

  // 3. Validate file
  if (!fs.existsSync(absPath)) {
    throw new Error(`Model file not found: ${absPath}`);
  }
  const stat = fs.statSync(absPath);
  if (stat.size < 10 * 1024 * 1024) {
    throw new Error(`Model file too small (${stat.size} bytes) — not a valid GGUF: ${absPath}`);
  }

  // 4. Evict if cache full
  if (loadedCache.size >= MAX_CACHE_SIZE) {
    evictOldest();
  }

  const t0 = Date.now();

  // 5. Load via v3 API
  const llm = await import('node-llama-cpp');
  const llama = await getLlamaRuntime();
  const model = await llama.loadModel({ modelPath: absPath });
  const context = await model.createContext({});
  const session = new llm.LlamaChatSession({ contextSequence: context.getSequence() });

  const loadDurationMs = Date.now() - t0;

  loadedCache.set(modelFile.id, {
    id: modelFile.id,
    llama, model, context, session,
    loadedAt: Date.now(),
    loadDurationMs,
  });

  // 6. Track in store
  getLocalModelStore().markLoaded(modelFile.id, loadDurationMs);

  return { session, loadDurationMs };
}

/** Release a specific model from memory. Returns true if was loaded. */
export function unloadModel(id: string): boolean {
  const entry = loadedCache.get(id);
  if (!entry) return false;
  try { entry.session?.dispose?.(); } catch { /* ignore */ }
  try { entry.context?.dispose?.(); } catch { /* ignore */ }
  try { entry.model?.dispose?.(); } catch { /* ignore */ }
  loadedCache.delete(id);
  return true;
}

/** Release all cached models. */
export function unloadAll(): void {
  for (const id of Array.from(loadedCache.keys())) {
    unloadModel(id);
  }
}

/** Whether a model is currently resident in memory. */
export function isModelLoaded(id: string): boolean {
  return loadedCache.has(id);
}

/** Get list of currently loaded model IDs */
export function getLoadedModelIds(): string[] {
  return Array.from(loadedCache.keys());
}

/** Get memory cache statistics */
export function getLoadedMemoryInfo(): {
  loadedCount: number;
  maxCacheSize: number;
  loadedModelIds: string[];
} {
  return {
    loadedCount: loadedCache.size,
    maxCacheSize: MAX_CACHE_SIZE,
    loadedModelIds: Array.from(loadedCache.keys()),
  };
}

// ── text generation ──────────────────────────────────────────────────────────

export interface GenerateTextRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  stop?: string[];
}

export interface GenerateTextResult {
  content: string;
  tokensGenerated: number;
  loadDurationMs: number;
  generateDurationMs: number;
  totalDurationMs: number;
}

/**
 * Run text generation on a local model using its native chat template.
 */
export async function generateText(
  modelFile: LocalModelFile,
  request: GenerateTextRequest,
): Promise<GenerateTextResult> {
  const tTotal = Date.now();

  const { session, loadDurationMs } = await loadModel(modelFile);

  const tGen = Date.now();
  // Qwen3-family models emit <think> reasoning blocks by default, which
  // LlamaChatSession strips from the output — sometimes leaving it empty.
  // /no_think is Qwen3's official soft switch to disable reasoning mode.
  const isQwen3 = /qwen\s*3/i.test(modelFile.name) || /qwen3/i.test(modelFile.fileName);
  const promptText = isQwen3 && !request.prompt.includes('/no_think')
    ? `${request.prompt} /no_think`
    : request.prompt;

  const content = await session.prompt(promptText, {
    maxTokens: request.maxTokens ?? 512,
    temperature: request.temperature ?? 0.7,
    ...(request.stop && request.stop.length > 0 ? { stop: request.stop } : {}),
  });
  const generateDurationMs = Date.now() - tGen;
  const totalDurationMs = Date.now() - tTotal;

  return {
    content: String(content || ''),
    tokensGenerated: Math.ceil(String(content || '').length / 4), // ~4 chars/token estimate
    loadDurationMs,
    generateDurationMs,
    totalDurationMs,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function evictOldest(): void {
  let oldestKey: string | null = null;
  let oldestAt = Infinity;
  for (const [key, entry] of loadedCache.entries()) {
    if (entry.loadedAt < oldestAt) {
      oldestAt = entry.loadedAt;
      oldestKey = key;
    }
  }
  if (oldestKey) unloadModel(oldestKey);
}

// ── idle cleanup ─────────────────────────────────────────────────────────────

/**
 * Periodic cleanup: evict stale models. No-op on Vercel (timers don't persist).
 */
export function startIdleCleanup(intervalMs = CACHE_TTL_MS): void {
  if (process.env.VERCEL === '1') return;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of loadedCache.entries()) {
      if (now - entry.loadedAt > intervalMs) unloadModel(id);
    }
  }, intervalMs);
  if (timer && typeof timer.unref === 'function') timer.unref();
}
