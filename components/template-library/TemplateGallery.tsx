import React, { useMemo, useState } from "react";
import { DOMAIN_PRESETS, BUILT_IN_TEMPLATES, listTemplates, saveTemplate, deleteTemplate, forkTemplate, interpolate, exportTemplate, importTemplate, PromptTemplate } from "../../services/templateLibrary";

interface Props {
  onUse?: (filled: string) => void;
}
const TemplateGallery: React.FC<Props> = ({ onUse }) => {
  const [domain, setDomain] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [vars, setVars] = useState<Record<string, Record<string, string>>>({});
  const [refresh, setRefresh] = useState(0);

  const templates = useMemo(() => {
    const all = listTemplates();
    const filtered = domain === "all" ? all : all.filter((t) => t.domain === domain);
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter((t) => `${t.title} ${t.description} ${t.body}`.toLowerCase().includes(q));
  }, [domain, search, refresh]);

  const handleFork = (id: string) => {
    const forked = forkTemplate(id);
    if (forked) { saveTemplate({ ...forked, title: `${forked.title} (fork)` }); setRefresh((x) => x + 1); }
  };

  const handleDelete = (id: string) => {
    if (BUILT_IN_TEMPLATES.some((b) => b.id === id)) return;
    deleteTemplate(id); setRefresh((x) => x + 1);
  };

  const handleShare = async (t: PromptTemplate) => {
    const json = exportTemplate(t.id);
    if (!json) return;
    try { await navigator.clipboard.writeText(json); alert("Template JSON copied to clipboard"); } catch { prompt("Copy template JSON:", json); }
  };

  const handleImport = async () => {
    const raw = prompt("Paste template JSON to import:");
    if (!raw) return;
    try { importTemplate(raw); setRefresh((x) => x + 1); } catch (e: any) { alert(e?.message ?? "Import failed"); }
  };

  return (
    <div className="flex flex-col gap-3" role="region" aria-label="Template library">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--editorial-ink)]">Template Library</h3>
        <button type="button" onClick={handleImport} className="px-2 py-1 text-[10px] font-mono font-bold border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-[var(--editorial-ink)] hover:border-[var(--editorial-violet)] transition-colors">Import</button>
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…" aria-label="Search templates" className="w-full border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-[var(--editorial-ink)] placeholder:text-[var(--editorial-muted)] px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-[var(--editorial-violet)] focus:ring-1 focus:ring-[var(--editorial-violet)]" />
      <div className="flex flex-wrap gap-1">
        <button type="button" onClick={() => setDomain("all")} className={`px-2 py-1 text-[10px] font-mono font-bold border transition-colors ${domain === "all" ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]" : "bg-[var(--editorial-paper)] text-[var(--editorial-ink)] border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)]"}`}>All</button>
        {DOMAIN_PRESETS.map((d) => (
          <button key={d} type="button" onClick={() => setDomain(d)} className={`px-2 py-1 text-[10px] font-mono font-bold border transition-colors ${domain === d ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]" : "bg-[var(--editorial-paper)] text-[var(--editorial-ink)] border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)]"}`}>{d}</button>
        ))}
      </div>
      <div className="flex flex-col gap-2 max-h-[520px] overflow-auto pr-1 custom-scrollbar">
        {templates.map((t) => {
          const filled = interpolate(t.body, vars[t.id] ?? {});
          return (
            <div key={t.id} className="border border-[var(--editorial-rule)] p-2.5 bg-[var(--editorial-paper)] flex flex-col gap-2 shadow-sm hover:border-[var(--editorial-violet)]/40 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-mono font-bold text-[var(--editorial-ink)] truncate">{t.title}</div>
                  <div className="text-[11px] leading-snug text-[var(--editorial-ink)] opacity-80">{t.description}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wide text-[var(--editorial-muted)]">{t.domain} · {t.variables.length} vars{t.forkedFrom ? ` · fork of ${t.forkedFrom}` : ""}</div>
                </div>
                <span className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => handleFork(t.id)} className="px-2 py-1 text-[10px] font-mono font-bold border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] text-[var(--editorial-ink)] hover:border-[var(--editorial-violet)]" aria-label={`Fork ${t.title}`}>Fork</button>
                  <button type="button" onClick={() => handleShare(t)} className="px-2 py-1 text-[10px] font-mono font-bold border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-[var(--editorial-ink)] hover:border-[var(--editorial-violet)]">Share</button>
                </span>
              </div>
              {t.variables.length > 0 && (
                <div className="grid grid-cols-2 gap-1">
                  {t.variables.map((v) => (
                    <input
                      key={v}
                      placeholder={v}
                      value={vars[t.id]?.[v] ?? ""}
                      onChange={(e) => setVars((prev) => ({ ...prev, [t.id]: { ...(prev[t.id] ?? {}), [v]: e.target.value } }))}
                      aria-label={`${t.title} variable ${v}`}
                      className="border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-[var(--editorial-ink)] placeholder:text-[var(--editorial-muted)] px-1.5 py-1 text-xs font-mono focus:outline-none focus:border-[var(--editorial-violet)]"
                    />
                  ))}
                </div>
              )}
              <div className="text-xs font-mono p-2 border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] text-[var(--editorial-ink)] whitespace-pre-wrap break-words leading-relaxed">{filled.slice(0, 400)}{filled.length > 400 ? "…" : ""}</div>
              <div className="flex gap-1">
                <button type="button" onClick={() => onUse?.(filled)} className="flex-1 py-1.5 text-xs font-mono font-bold bg-[var(--editorial-ink)] text-[var(--editorial-paper)] hover:bg-[var(--editorial-ink-strong)] border border-[var(--editorial-ink)] transition-colors">Use template</button>
                {!BUILT_IN_TEMPLATES.some((b) => b.id === t.id) && (
                  <button type="button" onClick={() => handleDelete(t.id)} className="px-3 py-1.5 text-xs font-mono font-bold border border-red-300 text-red-600 bg-[var(--editorial-paper)] hover:bg-red-50">Delete</button>
                )}
              </div>
            </div>
          );
        })}
        {templates.length === 0 && <div className="text-sm font-mono text-[var(--editorial-muted)] p-3 border border-dashed border-[var(--editorial-rule)] bg-[var(--editorial-surface)]">No templates match.</div>}
      </div>
    </div>
  );
};

export default TemplateGallery;
