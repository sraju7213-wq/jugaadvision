/**
 * Central API base for web + Capacitor Android.
 * Web: relative '/api/...' (same origin, Vercel).
 * Android WebView: absolute 'https://<prod-host>/api/...' via VITE_API_BASE_URL.
 */
export function apiBase(): string {
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
