/**
 * Central API base for the website.
 *
 * Same-origin by default: the Vercel build serves both the SPA and the
 * /api/* serverless functions from one host, so the browser just uses
 * relative '/api/...' paths.
 *
 * Overrides (in order):
 *   1. user custom backend URL (Settings, persisted in localStorage)
 *   2. VITE_API_BASE_URL env var (staging / self-hosted / LAN backends)
 */

export const STORAGE_KEY_CUSTOM_BACKEND = 'jugaad_custom_backend_url';
export const PRODUCTION_API_ORIGIN = 'https://jugaadvision-main.vercel.app';

function normalizeApiOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/$/, '');
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return trimmed;
  } catch {
    return '';
  }
}

export function getCustomBackendUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeApiOrigin(localStorage.getItem(STORAGE_KEY_CUSTOM_BACKEND) || '');
  } catch {
    return '';
  }
}

export function setCustomBackendUrl(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = normalizeApiOrigin(url);
    if (!trimmed) {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_BACKEND);
    } else {
      localStorage.setItem(STORAGE_KEY_CUSTOM_BACKEND, trimmed);
    }
  } catch {}
}

export function resetCustomBackendUrl(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY_CUSTOM_BACKEND);
  } catch {}
}

export function apiBase(): string {
  const custom = getCustomBackendUrl();
  if (custom) return custom;

  // NOTE: keep `import.meta.env.VITE_API_BASE_URL` in analyzable form —
  // Vite statically replaces it at build time. Indirections like
  // `(import.meta as any)?.env?....` survive into the bundle as undefined.
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!raw) return '';
  return raw.replace(/\/$/, '');
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase()}${p}`;
}
