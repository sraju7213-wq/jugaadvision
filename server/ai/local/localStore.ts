/**
 * LocalModelStore — durable on-disk manifest for downloaded GGUF models.
 *
 * Stores a JSON manifest alongside the model files so that server restarts
 * (Vercel cold boots, local restarts) survive without re-scanning the disk.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type { LocalModelFile, LocalStoreStats } from './localTypes';

/**
 * Default model directory.
 *
 * Serverless platforms (Vercel, AWS Lambda, …) ship a READ-ONLY project
 * directory. Resolving to `process.cwd()` there makes the first `mkdirSync`
 * throw `EACCES`, which crashed this module at import time and turned every
 * /api/* route into a 500. Use the writable temp dir instead and allow an
 * explicit override via LOCAL_MODEL_DIR.
 */
const DEFAULT_MODEL_DIR =
  process.env.LOCAL_MODEL_DIR ||
  (process.env.VERCEL
    ? path.join(os.tmpdir(), 'jugaad-local-models')
    : path.resolve(process.cwd(), '.local-models'));

// ── manifest ────────────────────────────────────────────────────────────────

interface Manifest {
  version: 1;
  updatedAt: string;
  models: Record<string, LocalModelFile>;
}

function manifestPath(dir: string): string {
  return path.join(dir, 'manifest.json');
}

/** Read the manifest; returns empty object when missing/corrupt. */
function readManifest(dir: string): Record<string, LocalModelFile> {
  const p = manifestPath(dir);
  if (!fs.existsSync(p)) return {};
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const m: Manifest = JSON.parse(raw);
    if (m && typeof m.models === 'object') return m.models;
  } catch {
    // corrupt — start fresh
  }
  return {};
}

/** Persist the manifest atomically (write to tmp + rename). */
function writeManifest(dir: string, models: Record<string, LocalModelFile>): void {
  const p = manifestPath(dir);
  const tmp = p + '.tmp';
  const m: Manifest = {
    version: 1,
    updatedAt: new Date().toISOString(),
    models,
  };
  try {
    const dirName = path.dirname(p);
    if (!fs.existsSync(dirName)) fs.mkdirSync(dirName, { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(m, null, 2), 'utf-8');
    fs.renameSync(tmp, p);
  } catch (err: any) {
    console.error(`[LocalModelStore] Failed to write manifest: ${err.message}`);
  }
}

// ── sanitise id ─────────────────────────────────────────────────────────────

function sanitiseId(name: string, sourceRepo: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9\-_.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  const digest = crypto.createHash('sha1').update(sourceRepo).digest('hex').slice(0, 8);
  return `${cleaned}-${digest}`.slice(0, 120) || `model-${digest}`;
}

// ── class ────────────────────────────────────────────────────────────────────

export class LocalModelStore {
  private dir: string;
  private models: Record<string, LocalModelFile> = {};

  constructor(modelDir?: string) {
    this.dir = modelDir || DEFAULT_MODEL_DIR;
    this.models = readManifest(this.dir);
    if (!fs.existsSync(this.dir)) {
      try {
        fs.mkdirSync(this.dir, { recursive: true });
      } catch (err: any) {
        // Read-only serverless filesystem: stay usable with the (empty)
        // in-memory manifest instead of throwing during module evaluation.
        console.warn(
          `[LocalModelStore] ${this.dir} is not writable (${err?.code || err?.message}); using in-memory manifest only.`
        );
      }
    }
  }

  directory(): string {
    return this.dir;
  }

  /** Full records for all registered models (including invalid ones). */
  listAll(): LocalModelFile[] {
    return Object.values(this.models);
  }

  /** Registered model ids */
  listIds(): string[] {
    return Object.keys(this.models);
  }

  /** Full record for a model id (supports prefix, case-insensitive, and filename matches) */
  get(id: string): LocalModelFile | undefined {
    if (this.models[id]) return this.models[id];
    const cleanId = id.replace(/^local:/i, '').toLowerCase().trim();
    if (this.models[cleanId]) return this.models[cleanId];
    return Object.values(this.models).find(m =>
      m.id.toLowerCase() === cleanId ||
      m.fileName.toLowerCase() === cleanId ||
      m.name.toLowerCase() === cleanId ||
      m.sourceRepo.toLowerCase() === cleanId
    );
  }

  /**
   * Register a model file that exists on disk.
   * Returns the stable id. Does NOT download — caller must ensure filePath exists.
   */
  register(file: Omit<LocalModelFile, 'id' | 'isValid' | 'downloadedAt' | 'loadCount' | 'lastLoadedAt' | 'lastInferenceMs'>): string {
    const id = sanitiseId(file.name, file.sourceRepo);
    const now = new Date().toISOString();
    const entry: LocalModelFile = {
      ...file,
      id,
      isValid: fs.existsSync(file.filePath) && fs.statSync(file.filePath).size > 0,
      downloadedAt: now,
      loadCount: 0,
    };
    this.models[id] = entry;
    writeManifest(this.dir, this.models);
    return id;
  }

  /** Mark a model as loaded (called after successful inference init). */
  markLoaded(id: string, latencyMs?: number): void {
    const m = this.models[id];
    if (!m) return;
    m.lastLoadedAt = new Date().toISOString();
    m.loadCount += 1;
    if (latencyMs !== undefined) m.lastInferenceMs = latencyMs;
    m.isValid = fs.existsSync(m.filePath) && fs.statSync(m.filePath).size > 0;
    writeManifest(this.dir, this.models);
  }

  /** Remove a model from the store and delete its file. */
  remove(id: string): boolean {
    const m = this.models[id];
    if (!m) return false;
    try {
      if (fs.existsSync(m.filePath)) fs.unlinkSync(m.filePath);
    } catch {
      // file may already be gone
    }
    delete this.models[id];
    writeManifest(this.dir, this.models);
    return true;
  }

  /** Re-validate all entries (used after server restart). */
  refreshIntegrity(): void {
    for (const [, m] of Object.entries(this.models)) {
      m.isValid = fs.existsSync(m.filePath) && fs.statSync(m.filePath).size > 0;
    }
    writeManifest(this.dir, this.models);
  }

  /** Disk usage summary. */
  stats(): LocalStoreStats {
    let totalSize = 0;
    const byModality: Record<string, { count: number; sizeBytes: number }> = {};
    const entries = fs.readdirSync(this.dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === 'manifest.json') continue;
      const full = path.join(this.dir, e.name);
      if (!e.isFile()) continue;
      try {
        const stat = fs.statSync(full);
        totalSize += stat.size;
        const mod = 'unknown';
        if (!byModality[mod]) byModality[mod] = { count: 0, sizeBytes: 0 };
        byModality[mod].count += 1;
        byModality[mod].sizeBytes += stat.size;
      } catch {
        // skip unreadable files
      }
    }
    const avail = diskSpaceAvailable(this.dir);
    return {
      modelDir: this.dir,
      totalFiles: entries.filter(e => e.isFile() && e.name !== 'manifest.json').length,
      totalSizeBytes: totalSize,
      totalSizeHuman: humanSize(totalSize),
      byModality,
      spaceAvailableBytes: avail,
      spaceAvailableHuman: humanSize(avail),
    };
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function diskSpaceAvailable(dir: string): number {
  try {
    // platform-specific — use a simple stat-based estimate
    const stat = fs.statSync(dir);
    // On most filesystems we can't get free space from fs.stat; return a large
    // placeholder. Real implementations would use `diskusage` package or OS call.
    if (process.platform === 'win32') {
      // Windows: use diskusage if available, else estimate
      return 50 * 1024 * 1024 * 1024; // 50 GB placeholder
    }
    return 50 * 1024 * 1024 * 1024; // 50 GB placeholder for unix
  } catch {
    return 0;
  }
}

// Singleton accessor.
//
// NOTE: this must stay lazy. A module-scope `export const localModelStore =
// getLocalModelStore()` would construct the store (and hit the filesystem) while
// the serverless bundle is merely being imported, which is fatal on read-only
// runtimes even for requests that never touch local models.
let _store: LocalModelStore | null = null;

export function getLocalModelStore(): LocalModelStore {
  if (!_store) {
    _store = new LocalModelStore();
  }
  return _store;
}
