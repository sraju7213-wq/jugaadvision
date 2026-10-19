/**
 * Runs before every test module is imported.
 *
 * Three jobs:
 *  1. Make the suite hermetic — clear any real provider API keys that happen
 *     to be exported in the developer's shell or .env, so KeyPoolManager's
 *     import-time constructor cannot pick them up.
 *  2. Keep KeyPoolManager off the repo working tree. Its persistence path is
 *     derived at module scope, so VERCEL has to be set before the first
 *     import; otherwise a test would read and rewrite .local-keys.json.
 *  3. Fail loudly if production code reaches for the network during a
 *     mutation run (Stryker executes the suite hundreds of times).
 */

const PROVIDER_ENV_VARS = [
  'OPENROUTER_API_KEY', 'OPENROUTER_API_KEYS', 'OPENROUTER_KEY',
  'OPENROUTER_API_KEY_1', 'OPENROUTER_API_KEY_2', 'OPENROUTER_API_KEY_3',
  'NVIDIA_NIM_API_KEY', 'NVIDIA_NIM_API_KEYS', 'NVIDIA_API_KEY', 'NVIDIA_API_KEYS',
  'HUGGINGFACE_API_KEY', 'HUGGINGFACE_API_KEYS', 'HF_TOKEN', 'HF_API_KEY',
  'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_TOKENS', 'CLOUDFLARE_API_KEY', 'CLOUDFLARE_TOKEN',
  'GEMINI_WEB_API_KEY', 'GEMINI_WEB_KEY', 'GEMINI_WEB2API_KEY',
  'FREELLMAPI_API_KEY', 'FREELLMAPI_KEY',
  'CUSTOM_API_KEY', 'CUSTOM_KEY',
  'CUSTOM_ENDPOINT_URL', 'CUSTOM_ENDPOINT', 'CUSTOM_MODEL', 'OLLAMA_BASE_URL',
  'GEMINI_WEB_BASE_URL', 'GEMINI_WEB2API_URL',
];

for (const key of PROVIDER_ENV_VARS) {
  delete process.env[key];
}

// Point the credential store at the tmpdir, never at <cwd>/.local-keys.json.
process.env.VERCEL = process.env.VERCEL || '1';

// Block accidental live HTTP during unit tests / mutation runs.
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: unknown, init?: unknown) => {
  const url = typeof input === 'string' ? input : String((input as { url?: string })?.url ?? input);
  throw new Error(
    `Unit tests must not perform network I/O (attempted: ${url}). ` +
      `Stub globalThis.fetch in the test that needs it.`,
  );
}) as typeof fetch;

export { realFetch };
