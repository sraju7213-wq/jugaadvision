import React, { useEffect, useRef, useState } from "react";

export interface TourStep {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
}

const TOUR_STEPS: TourStep[] = [
  { id: "workbench", title: "Laboratory Workbench", description: "Tokens are your atoms. Click λ chips to tune weight, drag to reorder." },
  { id: "telemetry", title: "Telemetry & Optics", description: "Set platform, aspect, and controller budget (2000λ)." },
  { id: "vault", title: "Specimen Vault", description: "Browse templates, fork community prompts, save your own." },
  { id: "canvas", title: "Interactive Canvas", description: "Chain prompt blocks with logic gates (AND/OR/NOT) for guided generation." },
  { id: "fusion", title: "Creative Fusion", description: "Merge disparate concepts — molecular fusion across personas." },
];

interface Props {
  storageKey?: string;
  steps?: TourStep[];
}

const GuidedTour: React.FC<Props> = ({ storageKey = "jv-tour:v1", steps = TOUR_STEPS }) => {
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const done = localStorage.getItem(storageKey);
      if (!done) setActive(true);
    } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    if (active) dialogRef.current?.focus();
  }, [active, index]);

  const dismiss = (persist = true) => {
    setActive(false);
    if (persist) try { localStorage.setItem(storageKey, "done"); } catch { /* */ }
  };

  if (!active) {
    return (
      <button type="button" onClick={() => { setIndex(0); setActive(true); }} className="fixed bottom-4 right-4 z-40 px-3.5 py-2.5 text-xs font-mono font-bold border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-[var(--editorial-ink)] shadow-[2px_2px_0_var(--editorial-rule)] hover:border-[var(--editorial-violet)] hover:shadow-[2px_2px_0_var(--editorial-violet)] transition-all flex items-center gap-1.5">
        <span aria-hidden className="w-5 h-5 rounded-full bg-[var(--editorial-violet)] text-white grid place-items-center text-[10px]">?</span> Guided Tour
      </button>
    );
  }
  const step = steps[index];
  return (
    <div role="dialog" aria-modal="true" aria-label="Guided tour" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
      <div ref={dialogRef} tabIndex={-1} className="w-full max-w-md bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] p-5 flex flex-col gap-3 focus:outline-none shadow-[4px_4px_0_var(--editorial-violet)]" style={{ boxShadow: "4px 4px 0 var(--editorial-violet)" }}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 bg-[var(--editorial-ink)] text-[var(--editorial-paper)]">Step {index + 1} / {steps.length}</span>
          <button type="button" onClick={() => dismiss(true)} aria-label="Close tour" className="w-7 h-7 grid place-items-center border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-[var(--editorial-ink)] hover:border-[var(--editorial-ink)] text-xs">✕</button>
        </div>
        <h3 className="text-sm font-bold font-mono text-[var(--editorial-ink)] leading-tight">{step.title}</h3>
        <p className="text-sm leading-relaxed text-[var(--editorial-ink)] opacity-80">{step.description}</p>
        <div className="flex justify-between items-center pt-2 border-t border-[var(--editorial-rule)]">
          <button type="button" onClick={() => dismiss(true)} className="text-xs font-mono font-bold underline text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]">Skip tour</button>
          <span className="flex gap-2">
            <button type="button" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))} className="px-3.5 py-1.5 text-xs font-mono font-bold border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-[var(--editorial-ink)] disabled:opacity-40 hover:border-[var(--editorial-ink)]">Back</button>
            {index < steps.length - 1 ? (
              <button type="button" onClick={() => setIndex((i) => i + 1)} className="px-3.5 py-1.5 text-xs font-mono font-bold bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border border-[var(--editorial-ink)] hover:bg-[var(--editorial-ink-strong)]">Next</button>
            ) : (
              <button type="button" onClick={() => dismiss(true)} className="px-3.5 py-1.5 text-xs font-mono font-bold bg-[var(--editorial-violet)] text-white border border-[var(--editorial-violet)] hover:brightness-110">Finish</button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
