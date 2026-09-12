import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Platform, Prompt } from "../../types";
import PromptBuilder from "../PromptBuilder";
const InteractiveCanvas = React.lazy(
  () => import("../prompt-builder/InteractiveCanvas")
);
import FeatureHeader from "../FeatureHeader";
import { Atom, Network } from "lucide-react";

interface PromptBuilderPageProps {
  prompts: Prompt[];
  setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>;
  initialPrompt: Prompt | null;
}

const PromptBuilderPage: React.FC<PromptBuilderPageProps> = ({
  prompts,
  setPrompts,
  initialPrompt,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentInitialPrompt, setCurrentInitialPrompt] = useState<Prompt | null>(initialPrompt);

  // Top-level Workstation Switcher: "tokens" (Token Laboratory) vs "nodes" (Interactive Node Studio)
  const activeView = searchParams.get("view") === "nodes" ? "nodes" : "tokens";

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "image") {
      navigate("/image-to-prompt", { replace: true });
    } else if (tab === "mixer") {
      navigate("/creative-mixer", { replace: true });
    } else if (tab === "batch") {
      navigate("/batch-generator", { replace: true });
    } else if (tab === "banner") {
      navigate("/pro-prompter", { replace: true });
    }
  }, [searchParams, navigate]);

  const handleSwitchView = (view: "tokens" | "nodes") => {
    const newParams = new URLSearchParams(searchParams);
    if (view === "nodes") {
      newParams.set("view", "nodes");
    } else {
      newParams.delete("view");
    }
    setSearchParams(newParams, { replace: true });
  };

  const handleApplyFromCanvas = (composedText: string) => {
    if (!composedText.trim()) return;
    const newPrompt: Prompt = {
      id: `canvas_${Date.now()}`,
      text: composedText.trim(),
      platform: Platform.Natural,
      createdAt: new Date().toISOString(),
      tags: ["node-canvas", "graph-synthesized"],
    };
    setCurrentInitialPrompt(newPrompt);
    handleSwitchView("tokens");
  };

  return (
    <div className="feature-theme-builder w-full max-w-full w-full mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 pb-16 pt-2">
      <FeatureHeader
        currentId="builder"
        title="Prompt Builder"
        subtitle="Craft fine-tuned AI prompts with platform presets, keyword triggers, quality parameters, and node-graph synthesis."
        badge="TOKEN & SYNTAX ENGINE"
      />

      {/* Primary Workstation Switcher Header Band */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--editorial-rule)]">
        <div className="flex items-center gap-1.5 p-1 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] rounded shadow-sm">
          <button
            type="button"
            onClick={() => handleSwitchView("tokens")}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase transition-all flex items-center gap-2 rounded ${
              activeView === "tokens"
                ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
                : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
            }`}
          >
            <Atom className="w-3.5 h-3.5" />
            <span>Token Laboratory</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchView("nodes")}
            className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase transition-all flex items-center gap-2 rounded ${
              activeView === "nodes"
                ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
                : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
            }`}
          >
            <Network className="w-3.5 h-3.5 text-[var(--editorial-violet)]" />
            <span>Interactive Node Canvas</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--editorial-muted)]">
          <span className="hidden sm:inline">WORKSTATION //</span>
          <span className="font-bold text-[var(--editorial-ink)] uppercase">
            {activeView === "tokens" ? "3-Column Token & Matrix Studio" : "Full-Bleed Node Graph Studio"}
          </span>
        </div>
      </div>

      {activeView === "tokens" ? (
        <PromptBuilder
          prompts={prompts}
          setPrompts={setPrompts}
          initialPrompt={currentInitialPrompt || initialPrompt}
        />
      ) : (
        <React.Suspense
          fallback={
            <div className="w-full min-h-[420px] flex items-center justify-center border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] text-xs font-mono text-[var(--editorial-muted)]">
              Loading node canvas…
            </div>
          }
        >
          <div className="w-full flex flex-col gap-3 animate-fade-in">
            <InteractiveCanvas onCompose={handleApplyFromCanvas} />
          </div>
        </React.Suspense>
      )}
    </div>
  );
};

export default PromptBuilderPage;

