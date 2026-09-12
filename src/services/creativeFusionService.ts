/**
 * Creative Fusion Service — multi-agent brainstorm + molecular fusion
 * Zero deps, strict TS, graceful fetch failure handling.
 * Imports exclusively from ./aiGatewayClient.
 */

import { aiGenerateBatch, aiGenerateText } from "./aiGatewayClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreativeFusionResult {
  fusedPrompt: string;
  candidates: string[];
  scores: number[];
}

type Persona = {
  id: string;
  label: string;
  directive: string;
};

// ---------------------------------------------------------------------------
// Persona registry — photographer / painter / CGI are the canonical 3
// ---------------------------------------------------------------------------

const PERSONA_REGISTRY: Record<string, Persona> = {
  photographer: {
    id: "photographer",
    label: "Photographer",
    directive:
      "Act as an award-winning photographer / Director of Photography. Emphasize camera body, lens (35mm/85mm anamorphic), aperture, lighting ratios, volumetric depth, film stock, and color grading.",
  },
  painter: {
    id: "painter",
    label: "Painter",
    directive:
      "Act as a master painter. Emphasize brushwork, palette, pigment density, canvas texture, chiaroscuro, and painterly light.",
  },
  cgi: {
    id: "cgi",
    label: "CGI",
    directive:
      "Act as a senior CGI / Octane / Unreal Engine 5 artist. Emphasize PBR materials, raytraced lighting, subsurface scattering, volumetrics, and camera movement.",
  },
  cinematographer: {
    id: "cinematographer",
    label: "Cinematographer",
    directive:
      "Act as an award-winning cinematographer. Emphasize anamorphic optics, IMAX/ARRI bodies, prime lenses, lighting ratios, and film emulation.",
  },
  anime: {
    id: "anime",
    label: "Anime",
    directive:
      "Act as an anime director (Shinkai/Ghibli style). Emphasize sky gradients, light bloom, cel-shading, dramatic keyframe angles, and expressive character energy.",
  },
  concept: {
    id: "concept",
    label: "Concept Art",
    directive:
      "Act as a senior concept / matte painter for film. Emphasize monumental scale, atmospheric depth, terrain storytelling, and production readability.",
  },
  avant_garde: {
    id: "avant_garde",
    label: "Avant-Garde",
    directive:
      "Act as an avant-garde surrealist. Emphasize metaphorical juxtaposition, sculptural textures, chiaroscuro tension, and thought-provoking composition.",
  },
};

const DEFAULT_PERSONA_IDS: string[] = ["photographer", "painter", "cgi"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function resolvePersonas(modes?: string[]): Persona[] {
  if (!modes || modes.length === 0) {
    return DEFAULT_PERSONA_IDS.map((id) => PERSONA_REGISTRY[id]);
  }
  // Take up to 3 modes; fallback to default registry if unknown
  const ids = modes.slice(0, 3).map((m) => m.toLowerCase().trim());
  return ids.map((id) => {
    if (PERSONA_REGISTRY[id]) return PERSONA_REGISTRY[id];
    // Unknown mode → treat as generic creative director persona
    return {
      id,
      label: id,
      directive: `Act as a senior creative director specializing in "${id}" aesthetics. Bring distinctive visual language for that domain.`,
    };
  });
}

async function safeGenerateText(
  systemPrompt: string,
  userInput: string,
  temperature: number,
): Promise<string | null> {
  try {
    const res = await aiGenerateText({
      systemPrompt,
      userInput,
      taskType: "prompt_enhancement",
      temperature: clamp(temperature, 0, 1),
    });
    const out = res?.result?.trim();
    return out && out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Lightweight heuristic scorer — lexical density + distinctiveness, 0-100 */
function scoreCandidate(prompt: string, corpus: string[]): number {
  if (!prompt) return 0;
  const len = prompt.length;
  const words = prompt.toLowerCase().split(/[\s,;:.]+/).filter(Boolean);
  const unique = new Set(words);
  const uniqueRatio = words.length ? unique.size / words.length : 0;
  // Penalize near-duplicates already in corpus
  let duplicatePenalty = 0;
  for (const other of corpus) {
    if (other === prompt) continue;
    const overlap = jaccardOverlap(prompt, other);
    if (overlap > 0.7) duplicatePenalty += 12;
  }
  // Base: length bonus up to 30, uniqueness up to 30, baseline 40
  let score = 40 + Math.min(30, len / 28) + uniqueRatio * 30 - duplicatePenalty;
  // Bonus for carrying technical tokens
  if (/light|lens|mm|aperture|texture|material|volumetric|cinematic/i.test(prompt)) score += 5;
  return clamp(Math.round(score), 0, 100);
}

function jaccardOverlap(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wb = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  const union = wa.size + wb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function heuristicFusion(candidates: string[]): string {
  if (candidates.length === 0) return "";
  if (candidates.length === 1) return candidates[0];
  // Interleave comma-separated clauses by distinctness
  const clauseSets = candidates.map((c) => c.split(/,\s*/).map((s) => s.trim()).filter(Boolean));
  const merged: string[] = [];
  const seen = new Set<string>();
  const maxLen = Math.max(...clauseSets.map((s) => s.length));
  for (let i = 0; i < maxLen; i++) {
    for (const clauses of clauseSets) {
      const clause = clauses[i];
      if (!clause) continue;
      const key = clause.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(clause);
      }
    }
  }
  const fused = merged.join(", ");
  // Cap at ~1200 chars with ellipsis
  return fused.length > 1200 ? fused.slice(0, 1197) + "..." : fused;
}

/** Deterministic local mutation fallback — token perturbations */
function localMutate(prompt: string, intensity: number): string {
  if (!prompt) return prompt;
  const t = clamp(intensity, 0, 1);
  if (t === 0) return prompt;
  const swaps: Array<[RegExp, string[]]> = [
    [/\blighting\b/gi, ["volumetric god rays", "neon rim light", "softbox diffusion", "chiaroscuro"]],
    [/\bcinematic\b/gi, ["anamorphic", "Technicolor", "noir", "ethereal"]],
    [/\bdetailed\b/gi, ["hyper-detailed", "intricate micro-texture", "ultra-fidelity", "ornate"]],
    [/\bcolor\b/gi, ["palette", "chromatic harmony", "Kodak Portra grading", "prismatic hue"]],
    [/\bbackground\b/gi, ["atmospheric depth", "bokeh expanse", "matte-painted horizon", "hazy void"]],
  ];
  let out = prompt;
  // Intensity controls how many swaps fire
  const swapCount = Math.max(1, Math.round(t * swaps.length));
  for (let i = 0; i < swapCount; i++) {
    const [re, alts] = swaps[i % swaps.length];
    if (re.test(out)) {
      const pick = alts[Math.floor(Math.random() * alts.length)];
      // reset lastIndex for global regex
      re.lastIndex = 0;
      out = out.replace(re, pick);
    }
  }
  // For higher intensities, inject an atmospheric clause
  if (t > 0.55) {
    const injects = [
      "quantum chromatic aberration",
      "crystalline refraction, subsurface scattering",
      "hyper-dimensional geometric light",
      "bioluminescent haze, floating particulate",
    ];
    const inj = injects[Math.floor(Math.random() * injects.length)];
    out = out + ", " + inj;
  }
  if (t > 0.85) {
    // Mild shuffle of comma clauses to create radical divergence
    const clauses = out.split(/,\s*/);
    for (let i = clauses.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = clauses[i];
      clauses[i] = clauses[j];
      clauses[j] = tmp;
    }
    out = clauses.join(", ");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Multi-agent brainstorm + molecular fusion.
 * Fans `concept` to 3 personas in parallel via aiGenerateBatch when reachable,
 * otherwise falls back to sequential aiGenerateText calls.
 */
export async function runCreativeFusion(
  concept: string,
  modes?: string[],
): Promise<CreativeFusionResult> {
  const trimmed = (concept ?? "").trim();
  if (!trimmed) {
    return { fusedPrompt: "", candidates: [], scores: [] };
  }

  const personas = resolvePersonas(modes);
  let candidates: string[] = [];

  // ---- Preferred path: batch ----
  let batchSucceeded = false;
  try {
    // aiGenerateBatch is imported; if server route is missing it will throw — caught below
    const batchRes = await aiGenerateBatch({
      baseConcept: trimmed,
      count: personas.length,
      creativity: 72,
      // systemPrompt encodes persona directives so the server can diversify
      systemPrompt: `You are orchestrating ${personas.length} parallel persona writers: ${personas.map((p) => `${p.label} — ${p.directive}`).join(" | ")}. Generate exactly ${personas.length} distinct prompt variations (one per persona, in the listed order). Each must preserve the core concept "${trimmed}" while applying its persona lens. Return batch items in persona order.`,
    });

    if (batchRes && Array.isArray(batchRes.items) && batchRes.items.length > 0) {
      const extracted = batchRes.items
        .filter((it) => it.status === "success" && typeof it.prompt === "string" && it.prompt.trim().length > 0)
        .sort((a, b) => a.index - b.index)
        .map((it) => it.prompt.trim());

      // If server returned only partial success, fill gaps with fallbacks later
      if (extracted.length > 0) {
        candidates = extracted;
        batchSucceeded = extracted.length === personas.length;
      }
    }
  } catch {
    // batch unavailable — fall through to sequential
    batchSucceeded = false;
  }

  // ---- Fallback: sequential per-persona aiGenerateText ----
  if (!batchSucceeded) {
    const seqCandidates: string[] = [...candidates];
    // If batch gave us some but not all, we still need to fill remaining personas
    const startIdx = seqCandidates.length;
    for (let i = startIdx; i < personas.length; i++) {
      const persona = personas[i];
      const systemPrompt =
        `SYSTEM ROLE:\n${persona.directive}\n\nTASK:\n` +
        `Transform the user's concept into a single production-ready AI image prompt through your persona lens.\n` +
        `CONCEPT: "${trimmed}"\n` +
        `RULES:\n` +
        `- Preserve the core subject.\n` +
        `- Apply persona-specific craft (optics/materials/painterly or CG cues).\n` +
        `- Dense comma-separated tokens for Midjourney/SDXL; rich prose clauses otherwise.\n` +
        `- Under 700 characters.\n` +
        `- Output ONLY the prompt text. No prefix, no quotes, no explanation.`;

      const gen = await safeGenerateText(systemPrompt, trimmed, 0.72);
      if (gen) seqCandidates.push(gen);
      else {
        // Per-persona fetch failure → deterministic fallback so fusion still proceeds
        seqCandidates.push(`${trimmed}, ${persona.label} interpretation, cinematic lighting, ultra-detailed, 8k`);
      }
    }
    // If batch had zero results we built all 3; if batch had partial we filled gaps.
    // If candidates was already 3 but batchSucceeded was false due to mismatch count, prefer seqCandidates
    if (candidates.length === 0) candidates = seqCandidates;
    else if (candidates.length < personas.length) candidates = seqCandidates;
  }

  // Ensure exactly personas.length candidates (pad/truncate defensively)
  if (candidates.length > personas.length) candidates = candidates.slice(0, personas.length);
  while (candidates.length < personas.length) {
    candidates.push(`${trimmed}, creative variation ${candidates.length + 1}, intricate detail, dramatic lighting`);
  }

  // ---- Score ----
  const scores: number[] = candidates.map((c) => scoreCandidate(c, candidates));

  // ---- Fuse into final prompt ----
  let fusedPrompt: string | null = null;
  // Prefer AI synthesis for cohesion
  const fusionSystemPrompt =
    `SYSTEM: Creative Fusion Synthesizer.\n` +
    `TASK: Fuse the ${candidates.length} persona-specific prompt variations below into ONE cohesive, hyper-detailed production prompt.\n` +
    `Preserve the strongest subject, lighting, and material cues from each. Eliminate redundancy. Under 1000 characters. Output ONLY the fused prompt.`;

  const fusionUserInput = candidates.map((c, idx) => `Variant ${idx + 1} (${personas[idx]?.label ?? idx}): "${c}"`).join("\n");

  try {
    const fused = await safeGenerateText(fusionSystemPrompt, fusionUserInput, 0.65);
    if (fused && fused.length > 20) fusedPrompt = fused;
  } catch {
    // ignored — fallback below
  }

  if (!fusedPrompt) {
    // Rank by score and heuristic-merge so the strongest candidate leads
    const ranked = [...candidates].sort((a, b) => scoreCandidate(b, candidates) - scoreCandidate(a, candidates));
    fusedPrompt = heuristicFusion(ranked);
  }

  // Final guard — never return empty fusedPrompt when candidates exist
  if (!fusedPrompt && candidates.length > 0) {
    fusedPrompt = candidates.reduce((best, cur) => (cur.length > best.length ? cur : best), candidates[0]);
  }

  return { fusedPrompt: fusedPrompt ?? "", candidates, scores };
}

/**
 * Molecular fusion — chemically fuses two prompts.
 * Mirrors aiMolecularRecombination from geminiService but scoped to aiGatewayClient only.
 */
export async function molecularFusion(promptA: string, promptB: string): Promise<string> {
  const a = (promptA ?? "").trim();
  const b = (promptB ?? "").trim();
  if (!a && !b) return "";
  if (!a) return b;
  if (!b) return a;

  const systemPrompt =
    `SYSTEM: Creative Scientist Molecular Prompt Synthesizer.\n` +
    `TASK: Chemically fuse Compound A and Compound B into a single avant-garde, hyper-detailed prompt.\n` +
    `Compound A Weight: 50%\nCompound B Weight: 50%\n` +
    `RULES:\n` +
    `- Synthesize an organic hybrid where visual motifs, shaders, and materials from both compounds intertwine seamlessly.\n` +
    `- Preserve key subject traits while cross-pollinating lighting, optics, and aesthetic DNA.\n` +
    `- Strictly under 960 characters.\n` +
    `- Output ONLY the synthesized prompt string.`;

  const userInput = `Compound A: "${a}"\nCompound B: "${b}"\nFusion Ratio: 50%`;

  const aiResult = await safeGenerateText(systemPrompt, userInput, 0.7);
  if (aiResult) return aiResult;

  // Graceful fallback — balanced interleaving without AI
  return heuristicFusion([a, b]);
}

/**
 * Quantum mutation — perturbs a prompt with entropy controlled by intensity (0-1).
 * intensity 0 => identity, 1 => radical divergence.
 */
export async function quantumMutate(prompt: string, intensity: number): Promise<string> {
  const base = (prompt ?? "").trim();
  if (!base) return "";
  const t = clamp(intensity, 0, 1);
  if (t === 0) return base;

  const entropy = Math.round(t * 100);
  const levelLabel = entropy < 30 ? "Subtle harmonic drift" : entropy < 70 ? "Moderate stylistic mutation" : "Radical avant-garde quantum divergence";

  const systemPrompt =
    `SYSTEM: Quantum Prompt Mutation Engine.\n` +
    `TASK: Apply controlled quantum entropy / genetic mutation to the input prompt.\n` +
    `Entropy Level: ${entropy}% (${levelLabel})\n` +
    `MUTATION DIRECTIVES:\n` +
    `- Swap predictable adjectives for exotic optical, material, or biological descriptors.\n` +
    `- Modulate the lighting wavelength, camera lens geometry, and atmospheric viscosity.\n` +
    `- Keep the core semantic anchor recognizable if entropy < 60%.\n` +
    `- Strictly under 960 characters.\n` +
    `- Output ONLY the mutated prompt string.`;

  const aiResult = await safeGenerateText(
    systemPrompt,
    base,
    clamp(0.3 + t * 0.7, 0, 1),
  );
  if (aiResult) return aiResult;

  return localMutate(base, t);
}
