/**
 * Central API base for web + Capacitor Android.
 * Web: relative '/api/...' (same origin, Vercel).
 * Android WebView: absolute 'https://<prod-host>/api/...' via VITE_API_BASE_URL.
 */
export const STORAGE_KEY_CUSTOM_BACKEND = 'jugaad_custom_backend_url';

export function getCustomBackendUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY_CUSTOM_BACKEND) || '';
  } catch {
    return '';
  }
}

export function setCustomBackendUrl(url: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = url.trim().replace(/\/$/, '');
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
