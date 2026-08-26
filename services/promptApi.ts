/**
 * Minimal REST-ish prompt API + plugin registry.
 * Frontend-only mock that mirrors /api/prompts shape for future server wiring.
 */
export interface PluginManifest {
  id: string;
  label: string;
  hooks: Array<"beforeGenerate" | "afterGenerate">;
  run: (input: string, ctx?: any) => Promise<string> | string;
}

const plugins: Map<string, PluginManifest> = new Map();

export function registerPlugin(manifest: PluginManifest) {
  plugins.set(manifest.id, manifest);
}

export function listPlugins(): PluginManifest[] {
  return [...plugins.values()];
}

export async function runPlugins(hook: PluginManifest["hooks"][number], input: string, ctx?: any): Promise<string> {
  let out = input;
  for (const p of plugins.values()) {
    if (p.hooks.includes(hook)) {
      try { out = await p.run(out, ctx); } catch (e) { console.warn(`Plugin ${p.id} failed:`, e); }
    }
  }
  return out;
}

// Lightweight local "REST" helpers (swap to fetch('/api/prompts') when server route exists)
export const promptRestApi = {
  async list() {
    try { const raw = localStorage.getItem("prompt-library"); return raw ? JSON.parse(raw) : []; } catch { return []; }
  },
  async create(record: any) {
    const list = await promptRestApi.list();
    const next = [...list, { ...record, id: record.id ?? `p_${Date.now()}`, createdAt: new Date().toISOString() }];
    try { localStorage.setItem("prompt-library", JSON.stringify(next)); } catch { /* quota */ }
    return next.at(-1);
  },
};

export default promptRestApi;
