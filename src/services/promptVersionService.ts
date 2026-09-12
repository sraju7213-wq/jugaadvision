/**
 * Prompt Version Control — localStorage backed append-only log.
 * Store shape: Record<promptId, VersionEntry[]>
 * Storage key: jv-prompt-versions:v1
 * Zero deps, strict TS.
 */

export const STORAGE_KEY = "jv-prompt-versions:v1" as const;

export interface VersionEntry {
  id: string;
  at: number;
  text: string;
  parentId: string | null;
  message?: string;
  author?: string;
}

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
  aLine?: number;
  bLine?: number;
}

type Store = Record<string, VersionEntry[]>;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeParse(raw: string | null): Store {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      // shallow validate each value is an array
      const out: Store = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (Array.isArray(v)) out[k] = v as VersionEntry[];
      }
      return out;
    }
    return {};
  } catch {
    return {};
  }
}

function loadStore(): Store {
  if (!isBrowser()) return {};
  try {
    return safeParse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

function saveStore(store: Store): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // quota exceeded or unavailable — silently ignore
  }
}

function generateId(): string {
  try {
    const c: Crypto | undefined = typeof crypto !== "undefined" ? crypto as Crypto : undefined;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    // ignore
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneEntries(entries: VersionEntry[]): VersionEntry[] {
  return entries.map((e) => ({ ...e }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve full history for a prompt, oldest → newest.
 * Returns a defensive copy; never throws.
 */
export function getHistory(promptId: string): VersionEntry[] {
  if (!promptId) return [];
  const store = loadStore();
  const arr = store[promptId];
  return Array.isArray(arr) ? cloneEntries(arr) : [];
}

/**
 * Append a new version. No-ops / de-duplicates if text unchanged vs last entry.
 * @param promptId - prompt identifier
 * @param text - prompt content to version
 * @param message - optional commit message
 * @param author - optional author label
 */
export function commitVersion(
  promptId: string,
  text: string,
  message?: string,
  author?: string
): VersionEntry | null {
  if (!promptId) return null;
  const normalizedText = String(text ?? "");
  const store = loadStore();
  const history = store[promptId] ?? [];

  const last = history.length > 0 ? history[history.length - 1] : null;
  // de-dupe identical successive commits
  if (last && last.text === normalizedText) {
    return { ...last };
  }

  const entry: VersionEntry = {
    id: generateId(),
    at: Date.now(),
    text: normalizedText,
    parentId: last ? last.id : null,
    ...(message !== undefined && message !== "" ? { message } : {}),
    ...(author !== undefined && author !== "" ? { author } : {}),
  };

  const next: Store = { ...store, [promptId]: [...history, entry] };
  saveStore(next);
  return { ...entry };
}

/**
 * Rollback by creating a new commit that restores the text of a prior version.
 * Returns the newly created entry, or null if versionId not found.
 */
export function rollback(promptId: string, versionId: string): VersionEntry | null {
  if (!promptId || !versionId) return null;
  const store = loadStore();
  const history = store[promptId];
  if (!Array.isArray(history) || history.length === 0) return null;

  const target = history.find((e) => e.id === versionId) ?? null;
  if (!target) return null;

  const last = history[history.length - 1] ?? null;
  // already at that version — no new commit needed; return target copy
  if (last && last.text === target.text && last.id === target.id) {
    return { ...target };
  }

  const entry: VersionEntry = {
    id: generateId(),
    at: Date.now(),
    text: target.text,
    parentId: last ? last.id : null,
    message: `rollback to ${versionId.slice(0, 8)}`,
  };

  const next: Store = { ...store, [promptId]: [...history, entry] };
  saveStore(next);
  return { ...entry };
}

/**
 * Simple line-oriented diff based on LCS.
 * Returns ordered DiffLine[] covering both inputs.
 */
export function diffVersions(a: string, b: string): DiffLine[] {
  const aLines = String(a ?? "").split("\n");
  const bLines = String(b ?? "").split("\n");

  // handle empty-string edge: "".split("\n") => [""] — treat as []
  const aNorm = a === "" ? [] : aLines;
  const bNorm = b === "" ? [] : bLines;

  const m = aNorm.length;
  const n = bNorm.length;

  // dp[i][j] = LCS length of aNorm[0..i-1], bNorm[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (aNorm[i - 1] === bNorm[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = dp[i - 1][j] >= dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1];
    }
  }

  // backtrack
  const result: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aNorm[i - 1] === bNorm[j - 1]) {
      result.push({ type: "unchanged", text: aNorm[i - 1], aLine: i, bLine: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", text: bNorm[j - 1], bLine: j });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      result.push({ type: "removed", text: aNorm[i - 1], aLine: i });
      i--;
    }
  }
  result.reverse();
  return result;
}

/**
 * Export full history as a git-style patch series (unified diff).
 * One patch per transition (v0→v1, v1→v2, ...). First version is treated as added.
 */
export function exportPatch(promptId: string): string {
  const history = getHistory(promptId);
  if (history.length === 0) return "";

  const lines: string[] = [];

  const escapeHeader = (s: string): string => s.replace(/\n/g, "\\n");

  for (let idx = 0; idx < history.length; idx++) {
    const cur = history[idx];
    const prevText = idx === 0 ? "" : (history[idx - 1]?.text ?? "");
    const curText = cur.text ?? "";

    const date = new Date(cur.at).toUTCString();
    const shortId = cur.id.slice(0, 8);
    const author = cur.author ?? "unknown";

    lines.push(`From ${cur.id} ${date}`);
    lines.push(`Author: ${author}`);
    lines.push(`Date: ${date}`);
    lines.push("");
    if (cur.message) lines.push(`    ${escapeHeader(cur.message)}`);
    else if (cur.parentId) lines.push(`    version ${shortId} (parent ${cur.parentId.slice(0, 8)})`);
    else lines.push(`    initial version ${shortId}`);
    lines.push("");
    lines.push("---");
    lines.push(`--- a/${promptId}`);
    lines.push(`+++ b/${promptId}`);

    const diff = diffVersions(prevText, curText);
    // emit classic unified hunk — single hunk covering whole file for simplicity
    // hunk header: @@ -<start>,<count> +<start>,<count> @@
    const aCount = prevText === "" ? 0 : prevText.split("\n").length;
    const bCount = curText === "" ? 0 : curText.split("\n").length;
    lines.push(`@@ -1,${aCount} +1,${bCount} @@`);
    for (const d of diff) {
      if (d.type === "unchanged") lines.push(` ${d.text}`);
      else if (d.type === "removed") lines.push(`-${d.text}`);
      else lines.push(`+${d.text}`);
    }
    if (idx < history.length - 1) lines.push("");
  }

  return lines.join("\n");
}

/** Test helper — clear a single prompt or entire store */
export function clearHistory(promptId?: string): void {
  if (!isBrowser()) return;
  if (!promptId) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return;
  }
  const store = loadStore();
  if (store[promptId]) {
    const { [promptId]: _, ...rest } = store;
    saveStore(rest);
  }
}
