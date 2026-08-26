import React, { useMemo } from "react";

interface Props {
  records: Array<{ grade?: string; overallScore?: number; createdAt?: string; text?: string; tags?: string[] }>;
}

function gradeToScore(g: string): number { const m: Record<string, number> = { S: 95, A: 85, B: 70, C: 55, D: 30 }; return m[g] ?? 50; }

const AnalyticsDashboard: React.FC<Props> = ({ records }) => {
  const stats = useMemo(() => {
    if (!records.length) return { avg: 0, breakthroughs: [] as number[], trend: [] as number[] };
    const scores = records.map((r) => r.overallScore ?? gradeToScore(r.grade ?? "B"));
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const breakthroughs: number[] = [];
    for (let i = 1; i < scores.length; i++) if (scores[i] - scores[i - 1] >= 20) breakthroughs.push(i);
    return { avg, breakthroughs, trend: scores.slice(-12) };
  }, [records]);

  const max = Math.max(100, ...stats.trend);
  return (
    <div className="editorial-panel flex flex-col gap-3" role="region" aria-label="Prompt analytics">
      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--editorial-ink)]">Analytics — Breakthrough Moments</h3>
      <div className="grid grid-cols-3 gap-2">
        <div className="border border-[var(--editorial-rule)] p-2.5 bg-[var(--editorial-surface)]"><div className="text-[10px] font-mono font-bold uppercase tracking-wide text-[var(--editorial-muted)]">Avg Quality</div><div className="text-lg font-mono font-bold text-[var(--editorial-ink)]">{stats.avg || "—"}</div></div>
        <div className="border border-[var(--editorial-rule)] p-2.5 bg-[var(--editorial-surface)]"><div className="text-[10px] font-mono font-bold uppercase tracking-wide text-[var(--editorial-muted)]">Prompts</div><div className="text-lg font-mono font-bold text-[var(--editorial-ink)]">{records.length}</div></div>
        <div className="border border-[var(--editorial-rule)] p-2.5 bg-[var(--editorial-surface)]"><div className="text-[10px] font-mono font-bold uppercase tracking-wide text-[var(--editorial-muted)]">Breakthroughs</div><div className="text-lg font-mono font-bold text-[var(--editorial-ink)]">{stats.breakthroughs.length}</div></div>
      </div>
      <div className="border border-[var(--editorial-rule)] p-2.5 bg-[var(--editorial-paper)]">
        <div className="flex items-end gap-1 h-[64px]">
          {stats.trend.length ? stats.trend.map((v, i) => (
            <div key={i} className={`flex-1 rounded-t-sm ${stats.breakthroughs.includes(records.length - stats.trend.length + i) ? "bg-emerald-500" : "bg-[var(--editorial-violet)]"}`} style={{ height: `${(v / max) * 100}%` }} title={`${v}`} />
          )) : <div className="text-xs font-mono text-[var(--editorial-muted)]">No data yet — generate prompts to see trends.</div>}
        </div>
        <div className="text-[10px] font-mono text-[var(--editorial-muted)] mt-1">Last {stats.trend.length} prompts — <span className="inline-block w-2 h-2 bg-emerald-500 align-middle mr-1"></span>breakthrough (Δ≥20)</div>
      </div>
      {stats.breakthroughs.length > 0 && (
        <ul className="text-xs font-mono text-[var(--editorial-ink)] list-disc pl-4 space-y-0.5">
          {stats.breakthroughs.map((idx) => <li key={idx}>Breakthrough at #{idx + 1}: {records[idx]?.text?.slice(0, 80) ?? "prompt"}…</li>)}
        </ul>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
