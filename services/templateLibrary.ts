/**
 * services/templateLibrary.ts
 * Typed template registry with localStorage persistence.
 * Zero dependencies, strict TypeScript.
 */

const STORAGE_KEY = "jv-templates:v1" as const;

// ---------------------------------------------------------------------------
// Domain presets
// ---------------------------------------------------------------------------

export const DOMAIN_PRESETS = [
  "storytelling",
  "coding",
  "scientific thinking",
  "marketing",
  "anime/concept",
  "cinematic",
] as const;

export type Domain = (typeof DOMAIN_PRESETS)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateVariable {
  name: string;
  label?: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface PromptTemplate {
  id: string;
  domain: Domain | string;
  title: string;
  description: string;
  body: string;
  variables: string[];
  forkedFrom?: string;
  author?: string;
  isCommunity?: boolean;
  createdAt: string; // ISO-8601
}

// ---------------------------------------------------------------------------
// Built-in templates (at least 8, covering all DOMAIN_PRESETS)
// Uses {{variable}} interpolation.
// ---------------------------------------------------------------------------

export const BUILT_IN_TEMPLATES: PromptTemplate[] = [
  {
    id: "storytelling-hero-journey",
    domain: "storytelling",
    title: "Hero's Journey Micro-Story",
    description: "Craft a compact hero-journey narrative with clear arc and tone control.",
    body: "Write a {{genre}} story about {{protagonist}} who must {{conflict}} in {{setting}}. The tone is {{tone}} and the ending should feel {{ending_mood}}. Keep it under {{word_count}} words, with vivid sensory detail.",
    variables: ["genre", "protagonist", "conflict", "setting", "tone", "ending_mood", "word_count"],
    author: "system",
    createdAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "storytelling-dialogue-scene",
    domain: "storytelling",
    title: "Dialogue-Driven Scene",
    description: "Two-character dialogue scene with subtext and stage direction.",
    body: "Write a dialogue scene between {{character_a}} and {{character_b}} set in {{location}}. {{character_a}} wants {{desire_a}} while {{character_b}} hides {{secret}}. Style: {{dialogue_style}}, include brief action beats and end on {{cliffhanger}}.",
    variables: ["character_a", "character_b", "location", "desire_a", "secret", "dialogue_style", "cliffhanger"],
    author: "system",
    createdAt: "2025-01-01T00:00:01.000Z",
  },
  {
    id: "coding-code-review",
    domain: "coding",
    title: "Senior Code Review",
    description: "Structured senior-level review with focus areas and output format.",
    body: "Act as a senior {{language}} engineer. Review this {{codeContext}} for {{focus}}:\n\n```{{language}}\n{{codeSnippet}}\n```\n\nProvide feedback as {{outputFormat}}. Prioritize correctness, then performance, then readability. List issues with severity and suggested fix.",
    variables: ["language", "codeContext", "focus", "codeSnippet", "outputFormat"],
    author: "system",
    createdAt: "2025-01-01T00:00:02.000Z",
  },
  {
    id: "coding-generate-tests",
    domain: "coding",
    title: "Test Generator (Strict TDD)",
    description: "Generate unit tests with edge-cases before implementation.",
    body: "For the {{language}} function `{{functionName}}` described as: {{description}}\nGenerate {{testFramework}} tests covering happy path, edge cases ({{edgeCases}}), and error handling. Use {{assertion_style}} assertions. Keep tests isolated and deterministic.",
    variables: ["language", "functionName", "description", "testFramework", "edgeCases", "assertion_style"],
    author: "system",
    createdAt: "2025-01-01T00:00:03.000Z",
  },
  {
    id: "scientific-thinking-explainer",
    domain: "scientific thinking",
    title: "First-Principles Explainer",
    description: "Explain a concept from first principles with hypothesis and evidence.",
    body: "Explain {{concept}} from first principles for a {{audience}}. Framework: {{framework}}. Hypothesis: {{hypothesis}}. Evidence to weigh: {{evidence}}. Conclude with falsifiability criteria and one open question about {{open_question}}.",
    variables: ["concept", "audience", "framework", "hypothesis", "evidence", "open_question"],
    author: "system",
    createdAt: "2025-01-01T00:00:04.000Z",
  },
  {
    id: "scientific-thinking-paper-critique",
    domain: "scientific thinking",
    title: "Paper Critique & Repro Checklist",
    description: "Critical reading of a scientific paper with reproducibility lens.",
    body: "Critique the paper titled \"{{paper_title}}\" ({{field}}). Methods claim: {{methods}}. Evaluate: internal validity, external validity, statistical power ({{sample_size}}), and confounders ({{confounders}}). Output a repro checklist and a one-paragraph revision plan in {{tone}} tone.",
    variables: ["paper_title", "field", "methods", "sample_size", "confounders", "tone"],
    author: "system",
    createdAt: "2025-01-01T00:00:05.000Z",
  },
  {
    id: "marketing-campaign-brief",
    domain: "marketing",
    title: "Campaign Brief Generator",
    description: "Positioning, USP, and CTA for a product campaign.",
    body: "Create a {{contentType}} for {{product}} targeting {{audience}} ({{persona}}). Core USP: {{usp}}. Key channels: {{channels}}. Tone: {{tone}}. Include headline, 3 value bullets, and a CTA: \"{{cta}}\". Add SEO keywords: {{keywords}}.",
    variables: ["contentType", "product", "audience", "persona", "usp", "channels", "tone", "cta", "keywords"],
    author: "system",
    createdAt: "2025-01-01T00:00:06.000Z",
  },
  {
    id: "marketing-ad-variants",
    domain: "marketing",
    title: "Ad Variant Matrix",
    description: "Generate A/B ad variants from a single positioning.",
    body: "Generate {{count}} ad variants for {{product}} ({{platform}}). Audience: {{audience}}. Promise: {{promise}}. Objection to overcome: {{objection}}. Constraints: each under {{char_limit}} chars, include emoji {{emoji_style}}, and end with CTA {{cta}}.",
    variables: ["count", "product", "platform", "audience", "promise", "objection", "char_limit", "emoji_style", "cta"],
    author: "system",
    createdAt: "2025-01-01T00:00:07.000Z",
  },
  {
    id: "anime-concept-key-visual",
    domain: "anime/concept",
    title: "Anime Key Visual — Cel-Shaded",
    description: "MAPPA / Ghibli-inspired anime key visual prompt.",
    body: "Anime key visual, {{character}} in {{pose}} wearing {{outfit}}, {{environment}} background, {{lighting}} lighting, {{artStyle}} cel shading, intricate linework, painted light, cinematic framing --ar {{aspectRatio}} --style {{stylePreset}}",
    variables: ["character", "pose", "outfit", "environment", "lighting", "artStyle", "aspectRatio", "stylePreset"],
    author: "system",
    createdAt: "2025-01-01T00:00:08.000Z",
  },
  {
    id: "cinematic-still",
    domain: "cinematic",
    title: "Cinematic Still — Photoreal",
    description: "Photoreal cinematic still with camera and grade control.",
    body: "Cinematic still, {{subject}} in {{environment}}, {{lighting}} lighting, shot on {{camera}} with {{lens}} lens, {{colorGrade}} color grading, {{mood}} mood, volumetric atmosphere, ultra-detailed, 8k --ar {{aspectRatio}}",
    variables: ["subject", "environment", "lighting", "camera", "lens", "colorGrade", "mood", "aspectRatio"],
    author: "system",
    createdAt: "2025-01-01T00:00:09.000Z",
  },
  {
    id: "cinematic-sequence-prompt",
    domain: "cinematic",
    title: "Cinematic Sequence (5 Shots)",
    description: "Expand a premise into a 5-shot cinematic sequence.",
    body: "Expand \"{{premise}}\" into a 5-shot cinematic sequence for {{genre}} film. Protagonist: {{protagonist}}. Visual motif: {{motif}}. Camera language: {{camera_language}}. Lighting progression: {{lighting_arc}}. Deliver as numbered shots, each one sentence, ending on {{ending_beat}}.",
    variables: ["premise", "genre", "protagonist", "motif", "camera_language", "lighting_arc", "ending_beat"],
    author: "system",
    createdAt: "2025-01-01T00:00:10.000Z",
  },
];

// Quick lookup for validation / UI
const BUILT_IN_IDS = new Set<string>(BUILT_IN_TEMPLATES.map((t) => t.id));

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function extractVariables(body: string): string[] {
  const re = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    seen.add(m[1]);
  }
  return [...seen];
}

function nowISO(): string {
  return new Date().toISOString();
}

function isValidDomain(d: string): boolean {
  return (DOMAIN_PRESETS as readonly string[]).includes(d);
}

function assertValidTemplate(t: PromptTemplate): void {
  if (!t.id || typeof t.id !== "string" || !t.id.trim()) throw new Error("Template id is required");
  if (!t.title || typeof t.title !== "string") throw new Error("Template title is required");
  if (!t.body || typeof t.body !== "string") throw new Error("Template body is required");
  if (!t.domain || typeof t.domain !== "string") throw new Error("Template domain is required");
  if (!Array.isArray(t.variables)) throw new Error("Template variables must be string[]");
  // Optional strict domain check — allow custom domains but warn via type
  // No throw for extensibility; built-ins are validated at module load.
}

function loadStored(): PromptTemplate[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Narrow & validate shape
    const out: PromptTemplate[] = [];
    for (const item of parsed as unknown[]) {
      if (
        item !== null &&
        typeof item === "object" &&
        "id" in item &&
        "title" in item &&
        "body" in item &&
        "domain" in item &&
        "variables" in item &&
        "createdAt" in item
      ) {
        const t = item as PromptTemplate;
        if (typeof t.id === "string" && typeof t.body === "string" && Array.isArray(t.variables)) {
          out.push(t);
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

function persist(templates: PromptTemplate[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // quota exceeded or disabled — silently ignore; caller still gets in-memory result
  }
}

function collectionMap(): Map<string, PromptTemplate> {
  const map = new Map<string, PromptTemplate>();
  for (const t of BUILT_IN_TEMPLATES) map.set(t.id, t);
  for (const t of loadStored()) map.set(t.id, t); // stored overrides built-in with same id
  return map;
}

// ---------------------------------------------------------------------------
// Public API — core registry
// ---------------------------------------------------------------------------

/** List all templates: built-ins merged with persisted user templates (user overrides win). */
export function listTemplates(): PromptTemplate[] {
  return [...collectionMap().values()].sort((a, b) => {
    // community templates last, then alphabetical by title
    const ca = a.isCommunity ? 1 : 0;
    const cb = b.isCommunity ? 1 : 0;
    if (ca !== cb) return ca - cb;
    return a.title.localeCompare(b.title);
  });
}

/** Get a single template by id, or undefined if not found. */
export function getTemplate(id: string): PromptTemplate | undefined {
  return collectionMap().get(id);
}

/**
 * Save (create or update) a template. Persists to localStorage.
 * Auto-syncs variables from body if caller left it empty.
 */
export function saveTemplate(t: PromptTemplate): PromptTemplate {
  assertValidTemplate(t);
  const normalized: PromptTemplate = {
    ...t,
    id: t.id.trim(),
    title: t.title.trim(),
    description: t.description ?? "",
    body: t.body,
    // If variables was empty/missing, derive from body; otherwise keep caller's list deduplicated
    variables:
      t.variables.length === 0 ? extractVariables(t.body) : [...new Set<string>(t.variables.map((v) => v.trim()).filter(Boolean))],
    createdAt: t.createdAt || nowISO(),
  };

  // Ensure domain is at least a non-empty string
  if (!normalized.domain.trim()) normalized.domain = "cinematic";

  const stored = loadStored();
  const idx = stored.findIndex((x) => x.id === normalized.id);
  if (idx >= 0) stored[idx] = normalized;
  else stored.push(normalized);
  persist(stored);
  return normalized;
}

/**
 * Delete a template by id. Built-ins cannot be deleted from code — they are simply
 * removed from the persisted layer if previously overridden. Returns true if something was removed.
 */
export function deleteTemplate(id: string): boolean {
  const stored = loadStored();
  const next = stored.filter((t) => t.id !== id);
  if (next.length === stored.length) {
    // Not in stored layer — if it's a built-in we treat as no-op (cannot delete built-in definition)
    return false;
  }
  persist(next);
  return true;
}

/**
 * Fork (duplicate) an existing template. Returns the new fork and persists it.
 * The fork gets a new id, forkedFrom pointer, updated author and timestamp.
 */
export function forkTemplate(id: string, author?: string): PromptTemplate {
  const src = getTemplate(id);
  if (!src) throw new Error(`Template not found: ${id}`);
  const forked: PromptTemplate = {
    ...src,
    id: `${src.id}-fork-${Date.now().toString(36)}`,
    title: `${src.title} (Fork)`,
    forkedFrom: src.id,
    author: author?.trim() || "you",
    isCommunity: false,
    createdAt: nowISO(),
  };
  return saveTemplate(forked);
}

/**
 * Interpolate {{variable}} placeholders in a template body with provided values.
 * - Whitespace inside braces is ignored: {{ name }} == {{name}}
 * - Missing keys are replaced with empty string (no throw)
 * - Values are coerced to string
 */
export function interpolate(templateBody: string, vars: Record<string, string>): string {
  if (!templateBody) return "";
  return templateBody.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

/** Export a template as a pretty-printed JSON string. */
export function exportTemplate(id: string): string {
  const t = getTemplate(id);
  if (!t) throw new Error(`Template not found: ${id}`);
  return JSON.stringify(t, null, 2);
}

/**
 * Import a template from a JSON string. Validates shape, assigns createdAt if missing,
 * normalizes variables, and persists. Throws on invalid JSON or shape.
 */
export function importTemplate(json: string): PromptTemplate {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON for template import");
  }
  if (parsed === null || typeof parsed !== "object" || !("id" in parsed) || !("body" in parsed)) {
    throw new Error("Imported JSON is not a valid PromptTemplate");
  }
  const raw = parsed as PromptTemplate;
  // Re-derive variables if they don't match body, but keep caller's list if plausible
  const derived = extractVariables(raw.body);
  const variables =
    Array.isArray(raw.variables) && raw.variables.length > 0
      ? [...new Set<string>([...raw.variables.map(String), ...derived])].filter(Boolean)
      : derived;

  const normalized: PromptTemplate = {
    id: String(raw.id).trim(),
    domain: String((raw.domain as string) ?? "cinematic").trim() || "cinematic",
    title: String(raw.title ?? raw.id).trim(),
    description: String(raw.description ?? ""),
    body: String(raw.body),
    variables,
    forkedFrom: raw.forkedFrom ? String(raw.forkedFrom) : undefined,
    author: raw.author ? String(raw.author) : undefined,
    isCommunity: Boolean(raw.isCommunity),
    createdAt: raw.createdAt ? String(raw.createdAt) : nowISO(),
  };
  assertValidTemplate(normalized);
  return saveTemplate(normalized);
}

// ---------------------------------------------------------------------------
// Community fork/share helpers
// ---------------------------------------------------------------------------

/** All templates flagged as community (isCommunity === true). */
export function getCommunityTemplates(): PromptTemplate[] {
  return listTemplates().filter((t) => t.isCommunity);
}

/**
 * Publish a template to the community layer (sets isCommunity=true and persists).
 * If id is a built-in, it forks first so the original is preserved.
 */
export function publishTemplate(id: string): PromptTemplate {
  const t = getTemplate(id);
  if (!t) throw new Error(`Template not found: ${id}`);
  if (t.isCommunity) return t;
  // If publishing a built-in directly, fork to avoid mutating the immutable definition in storage semantics
  if (BUILT_IN_IDS.has(id) && loadStored().findIndex((s) => s.id === id) === -1) {
    const forked = forkTemplate(id, t.author);
    forked.isCommunity = true;
    forked.title = t.title; // keep original title for published copy
    return saveTemplate(forked);
  }
  return saveTemplate({ ...t, isCommunity: true });
}

/** Remove community flag (unpublish). */
export function unpublishTemplate(id: string): PromptTemplate {
  const t = getTemplate(id);
  if (!t) throw new Error(`Template not found: ${id}`);
  if (!t.isCommunity) return t;
  return saveTemplate({ ...t, isCommunity: false });
}

/**
 * Share helper — returns a portable JSON string suitable for copy/paste or download.
 * Alias of exportTemplate with explicit community intent.
 */
export function shareTemplate(id: string): string {
  return exportTemplate(id);
}

/**
 * Create a share payload that encodes metadata for safer import (wraps template with version).
 * Useful for file-share or clipboard workflows.
 */
export function createSharePayload(id: string): string {
  const t = getTemplate(id);
  if (!t) throw new Error(`Template not found: ${id}`);
  const payload = {
    v: 1,
    exportedAt: nowISO(),
    template: t,
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Import a share payload created by createSharePayload or a raw template JSON.
 * Handles both shapes gracefully.
 */
export function importSharePayload(json: string): PromptTemplate {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON for share payload import");
  }
  if (parsed !== null && typeof parsed === "object" && "template" in parsed) {
    const inner = (parsed as { template: unknown }).template;
    return importTemplate(JSON.stringify(inner));
  }
  return importTemplate(json);
}

/**
 * Fork a community template into the user's private collection.
 * Convenience wrapper around forkTemplate that clears the community flag on the fork.
 */
export function forkCommunityTemplate(id: string, author?: string): PromptTemplate {
  const src = getTemplate(id);
  if (!src) throw new Error(`Template not found: ${id}`);
  const forked = forkTemplate(id, author);
  // Forks are private by default
  if (forked.isCommunity) {
    return saveTemplate({ ...forked, isCommunity: false });
  }
  return forked;
}

/**
 * Clone any template as a community template (useful for seeding community from a private fork).
 */
export function cloneAsCommunityTemplate(id: string, author?: string): PromptTemplate {
  const forked = forkTemplate(id, author);
  return saveTemplate({ ...forked, isCommunity: true });
}

// ---------------------------------------------------------------------------
// Utility re-exports for consumers
// ---------------------------------------------------------------------------

export const STORAGE_KEY_EXPORT = STORAGE_KEY;

export function getDomainPresets(): readonly string[] {
  return DOMAIN_PRESETS;
}

/** Re-derive variables for a body string (public helper for form UIs). */
export function parseVariables(body: string): string[] {
  return extractVariables(body);
}

/** Validate domain helper exposed for UI. */
export function isValidDomainExport(domain: string): boolean {
  return isValidDomain(domain);
}
