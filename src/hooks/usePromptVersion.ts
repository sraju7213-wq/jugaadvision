import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getHistory,
  commitVersion,
  rollback as serviceRollback,
  diffVersions,
  exportPatch as serviceExportPatch,
  type VersionEntry,
  type DiffLine,
} from "../services/promptVersionService";

export type { VersionEntry, DiffLine };

export interface UsePromptVersionReturn {
  history: VersionEntry[];
  commit: (message?: string, author?: string) => VersionEntry | null;
  rollback: (versionId: string) => VersionEntry | null;
  diff: (a: string, b: string) => DiffLine[];
  canRollback: boolean;
  exportPatch: () => string;
  refresh: () => void;
}

/**
 * usePromptVersion — React hook over promptVersionService.
 *
 * @param promptId - stable id for the prompt whose versions are tracked
 * @param currentText - live editor text; commit() snapshots this value
 */
export function usePromptVersion(
  promptId: string,
  currentText: string
): UsePromptVersionReturn {
  const [history, setHistory] = useState<VersionEntry[]>(() => {
    if (!promptId) return [];
    return getHistory(promptId);
  });

  const refresh = useCallback(() => {
    if (!promptId) {
      setHistory([]);
      return;
    }
    setHistory(getHistory(promptId));
  }, [promptId]);

  // reload when promptId changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  // keep in sync across tabs
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent): void => {
      if (e.key === null || e.key === "jv-prompt-versions:v1") refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const commit = useCallback(
    (message?: string, author?: string): VersionEntry | null => {
      if (!promptId) return null;
      const entry = commitVersion(promptId, currentText, message, author);
      if (entry) refresh();
      return entry;
    },
    [promptId, currentText, refresh]
  );

  const rollback = useCallback(
    (versionId: string): VersionEntry | null => {
      if (!promptId) return null;
      const entry = serviceRollback(promptId, versionId);
      if (entry) refresh();
      return entry;
    },
    [promptId, refresh]
  );

  const diff = useCallback((a: string, b: string): DiffLine[] => {
    return diffVersions(a, b);
  }, []);

  const exportPatch = useCallback((): string => {
    if (!promptId) return "";
    return serviceExportPatch(promptId);
  }, [promptId]);

  const canRollback = useMemo(() => history.length > 1, [history.length]);

  return {
    history,
    commit,
    rollback,
    diff,
    canRollback,
    exportPatch,
    refresh,
  };
}

export default usePromptVersion;
