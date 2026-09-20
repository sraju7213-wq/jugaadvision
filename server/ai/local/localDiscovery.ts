/**
 * HuggingFaceGGUFDiscovery — searches the HuggingFace Hub for GGUF models.
 *
 * Uses the public HuggingFace REST API directly (no auth needed for search):
 *   GET /api/models?search=<query>&filter=gguf&sort=downloads&limit=N
 *   GET /api/models/<repoId>?blobs=true   (file list with sizes)
 *
 * The @huggingface/hub SDK's listModels() doesn't support free-text search,
 * so we call the REST endpoints with fetch directly.
 */

import type { HuggingFaceModelResult } from './localTypes';

const HF_API = 'https://huggingface.co/api';
const MAX_FILE_SIZE = 20 * 1024 * 1024 * 1024; // 20 GB

const KNOWN_VISION_KW = [
  'vl', 'vision', 'glm-4.5v', 'glm-4.6v', 'aya-vision',
  'command-a-vision', 'florence', 'paligemma', 'multimodal',
  'internvl', 'idefics', 'llava', 'cogvlm', 'minicpm-v', 'moondream',
];

/** Heuristic: is this repo likely a vision-language model? */
function guessModality(repoId: string, description?: string): 'text' | 'vision' | 'unknown' {
  const haystack = `${repoId} ${description || ''}`.toLowerCase();
  if (KNOWN_VISION_KW.some(k => haystack.includes(k))) return 'vision';
  return 'text';
}

/** Extract quantization tag from a GGUF filename, e.g. "Q8_0" → "q8_0". */
function extractQuant(fileName: string): string {
  const m = fileName.toLowerCase().match(/q\d[_a-z0-9]*/);
  return m ? m[0] : 'unknown';
}

interface HFRepoFile {
  rfilename: string;
  size?: number;
}

interface HFModelInfo {
  id: string;
  downloads?: number;
  likes?: number;
  pipeline_tag?: string;
  tags?: string[];
  cardData?: { license?: string };
  siblings?: HFRepoFile[];
}

async function hfFetch<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'JugaadVision-LocalModelSearch/1.0' },
    });
    if (!res.ok) throw new Error(`HuggingFace API ${res.status}: ${res.statusText}`);
    return await res.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search HuggingFace Hub for GGUF models matching a query.
 * Returns one entry per repo (smallest GGUF file) for the top downloaded repos.
 */
export async function searchGGUFModels(
  query: string,
  limit = 25,
): Promise<HuggingFaceModelResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // 1. Search repos. "gguf" filter narrows to repos containing GGUF files.
  const searchUrl = `${HF_API}/models?search=${encodeURIComponent(cleanQuery)}&filter=gguf&sort=downloads&direction=-1&limit=${Math.min(limit * 2, 40)}`;
  const repos = await hfFetch<HFModelInfo[]>(searchUrl).catch(() => [] as HFModelInfo[]);

  const results: HuggingFaceModelResult[] = [];

  // 2. For each repo, list GGUF files (bounded parallelism: 4 at a time)
  const queue = repos.filter(r => r.id);
  const batchSize = 4;
  for (let i = 0; i < queue.length && results.length < limit; i += batchSize) {
    const batch = queue.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(repo => listRepoGgufFiles(repo.id).then(files => ({ repo, files })))
    );
    for (const s of settled) {
      if (results.length >= limit) break;
      if (s.status !== 'fulfilled' || !s.value.files.length) continue;
      const { repo, files } = s.value;

      // Smallest GGUF first (most likely to fit modest hardware)
      const smallest = files[0];
      results.push({
        repoId: repo.id,
        modelId: repo.id.split('/').pop() || repo.id,
        fileName: smallest.rfilename.split('/').pop() || smallest.rfilename,
        fileSize: smallest.size || 0,
        quantization: extractQuant(smallest.rfilename),
        modality: guessModality(repo.id),
        description: (repo.pipeline_tag || '') + (repo.downloads ? ` · ${repo.downloads.toLocaleString()} downloads` : ''),
        lastModified: new Date().toISOString(),
        downloadUrl: `https://huggingface.co/${repo.id}/resolve/main/${smallest.rfilename}`,
        license: repo.cardData?.license || 'unknown',
      });
    }
  }

  return results;
}

/** List .gguf files in a repo, sorted by size ascending. */
async function listRepoGgufFiles(repoId: string): Promise<HFRepoFile[]> {
  const info = await hfFetch<HFModelInfo>(`${HF_API}/models/${repoId}?blobs=true`);
  const files = (info.siblings || []).filter(s => s.rfilename.toLowerCase().endsWith('.gguf'));
  return files
    .filter(f => !f.size || f.size <= MAX_FILE_SIZE)
    .sort((a, b) => (a.size || 0) - (b.size || 0));
}

/**
 * Resolve a specific model file's metadata (size + download URL) from repo + filename.
 */
export async function resolveModelFile(
  repoId: string,
  fileName: string,
): Promise<HuggingFaceModelResult | null> {
  try {
    const info = await hfFetch<HFModelInfo>(`${HF_API}/models/${repoId}?blobs=true`);
    const match = (info.siblings || []).find(
      s => s.rfilename === fileName || s.rfilename.endsWith('/' + fileName)
    );
    if (!match) return null;

    return {
      repoId,
      modelId: repoId.split('/').pop() || repoId,
      fileName: match.rfilename.split('/').pop() || match.rfilename,
      fileSize: match.size || 0,
      quantization: extractQuant(match.rfilename),
      modality: guessModality(repoId),
      description: info.pipeline_tag || '',
      lastModified: new Date().toISOString(),
      downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${match.rfilename}`,
      license: info.cardData?.license || 'unknown',
    };
  } catch {
    return null;
  }
}
