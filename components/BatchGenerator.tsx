import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { ProcessingAnimation } from "./ProcessingAnimation";
import { generateBatchPrompts, BatchGenerationOptions } from "../services/geminiService";
import { aiGenerateBatch } from "../services/aiGatewayClient";
import {
  LIGHTING_LABELS,
  CAMERA_LABELS,
} from "../lib/schemas/cinematicPrompt";
import { BATCH_PRESETS, BatchPreset } from "../lib/batchPresets";
import {
  BrainCircuitIcon,
  CopyIcon,
  CheckIcon,
  FolderIcon,
  MagicWandIcon,
  PlusCircleIcon,
  XIcon,
  SlidersIcon,
  PenCircuitIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SparklesIcon,
  RefreshIcon,
} from "./icons";

interface BatchGeneratorProps {
  onSendToBuilder: (prompt: string) => void;
  onSaveToLibrary: (prompt: string, platform?: any, imageUrl?: string, tags?: string[]) => void;
}

interface ResultItemState {
  index: number;
  prompt: string;
  rationale?: string;
  status: "success" | "error";
  error?: string;
}

interface ResultCardProps {
  item: ResultItemState;
  copiedIndex: number | null;
  savedIndex: number | null;
  onResultChange: (index: number, newValue: string) => void;
  onCopy: (text: string, index: number) => void;
  onSave: (text: string, index: number) => void;
  onFocus: (index: number) => void;
  onSendToBuilder: (prompt: string) => void;
  onRetryItem: (index: number) => void;
  resultRefs: React.MutableRefObject<(HTMLTextAreaElement | null)[]>;
  animationDelay: number;
}

// Memoized ResultCard with stagger animation & error handling
const ResultCard = React.memo(
  ({
    item,
    copiedIndex,
    savedIndex,
    onResultChange,
    onCopy,
    onSave,
    onFocus,
    onSendToBuilder,
    onRetryItem,
    resultRefs,
    animationDelay,
  }: ResultCardProps) => {
    const { index, prompt, status, error, rationale } = item;
    const formattedNum = String(index + 1).padStart(2, "0");

    if (status === "error") {
      return (
        <div
          className="editorial-panel p-4 border-red-500/30 bg-red-500/5 animate-fade-in flex flex-col justify-between"
          style={{ animationDelay: `${animationDelay}ms` }}
        >
          <div>
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-red-500/20">
              <span className="font-mono text-[10px] font-bold text-red-500 uppercase tracking-wider">
                Variation {formattedNum} / Error
              </span>
            </div>
            <p className="font-mono text-xs text-red-600 dark:text-red-400">
              {error || "Generation error on this variation."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRetryItem(index)}
            className="editorial-button editorial-button--sm editorial-button--secondary mt-3 self-start text-red-500 border-red-500/30 hover:bg-red-500/10"
          >
            <RefreshIcon className="w-3.5 h-3.5" />
            Retry Variation
          </button>
        </div>
      );
    }

    return (
      <div
        className="editorial-panel flex flex-col justify-between animate-fade-in"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        <div>
          {/* Header */}
          <div className="editorial-panel__header py-2.5 px-3.5 bg-[var(--editorial-surface-strong)]">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[var(--editorial-gold)]">
                {formattedNum}
              </span>
              {rationale && (
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--editorial-muted)] truncate max-w-[200px]">
                  {rationale}
                </span>
              )}
            </div>
            <span className="editorial-badge editorial-badge--gold">
              Spec {formattedNum}
            </span>
          </div>

          {/* Editable Prompt Area */}
          <div className="p-3.5">
            <textarea
              ref={(el) => {
                resultRefs.current[index] = el;
              }}
              value={prompt}
              onChange={(e) => onResultChange(index, e.target.value)}
              className="editorial-textarea min-h-[110px] text-xs font-mono leading-relaxed"
            />
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-2.5 px-3.5 bg-[var(--editorial-surface)] border-t border-[var(--editorial-rule)] flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onCopy(prompt, index)}
              className="editorial-button editorial-button--sm editorial-button--secondary p-1.5"
              title="Copy to clipboard"
            >
              {copiedIndex === index ? (
                <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <CopyIcon className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onFocus(index)}
              className="editorial-button editorial-button--sm editorial-button--secondary p-1.5"
              title="Focus for editing"
            >
              <PenCircuitIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSave(prompt, index)}
              className="editorial-button editorial-button--sm editorial-button--secondary p-1.5"
              title="Save to vault"
            >
              {savedIndex === index ? (
                <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <FolderIcon className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onSendToBuilder(prompt)}
            className="editorial-button editorial-button--sm editorial-button--primary"
          >
            <SparklesIcon className="w-3 h-3" />
            <span>To Builder</span>
          </button>
        </div>
      </div>
    );
  }
);

const BatchGenerator: React.FC<BatchGeneratorProps> = ({
  onSendToBuilder,
  onSaveToLibrary,
}) => {
  // State
  const [basePrompt, setBasePrompt] = useState("");
  const [focusKeywords, setFocusKeywords] = useState<string[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState("");

  // Controls
  const [count, setCount] = useState(5);
  const [detailLevel, setDetailLevel] = useState<"minimal" | "balanced" | "elaborate">("balanced");
  const [tone, setTone] = useState<"professional" | "creative" | "dramatic" | "whimsical">("creative");
  const [complexity, setComplexity] = useState<"simple" | "moderate" | "complex">("moderate");
  const [perspective, setPerspective] = useState<"neutral" | "artistic" | "technical" | "cinematic">("artistic");

  // Advanced options
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [lighting, setLighting] = useState<string[]>([]);
  const [cameraAngle, setCameraAngle] = useState<string>("");
  const [aspectRatio, setAspectRatio] = useState<string>("");
  const [artStyle, setArtStyle] = useState<string>("");
  const [negativePrompt, setNegativePrompt] = useState<string>("");
  const [promptLength, setPromptLength] = useState<"short" | "medium" | "long">("medium");
  const [includeHooks, setIncludeHooks] = useState(false);
  const [targetPlatform, setTargetPlatform] = useState<"midjourney" | "dalle" | "sdxl" | "flux" | "general">("general");

  // Creative Brain v2 options
  const [showCreativeBrain, setShowCreativeBrain] = useState(true);
  const [creativeMode, setCreativeMode] = useState<"structured" | "experimental">("structured");
  const [narrativeArc, setNarrativeArc] = useState<"establishing" | "tension" | "resolution" | "mixed">("mixed");
  const [visualDensity, setVisualDensity] = useState(60);
  const [originalityLevel, setOriginalityLevel] = useState(50);
  const [persona, setPersona] = useState<"cinematographer" | "art_director" | "storyteller" | "balanced">("balanced");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Results & Lifecycle
  const [items, setItems] = useState<ResultItemState[]>([]);
  const [diversityScore, setDiversityScore] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const resultRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const PERSONAS = useMemo(() => [
    { id: "balanced", label: "Balanced", icon: "⚖️" },
    { id: "cinematographer", label: "Cinematographer", icon: "🎬" },
    { id: "art_director", label: "Art Director", icon: "🎨" },
    { id: "storyteller", label: "Storyteller", icon: "📖" },
  ], []);

  const handleAddKeyword = useCallback(() => {
    if (currentKeyword.trim() && !focusKeywords.includes(currentKeyword.trim())) {
      setFocusKeywords((prev) => [...prev, currentKeyword.trim()]);
      setCurrentKeyword("");
    }
  }, [currentKeyword, focusKeywords]);

  const handleKeywordKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddKeyword();
      }
    },
    [handleAddKeyword]
  );

  const removeKeyword = useCallback((keywordToRemove: string) => {
    setFocusKeywords((prev) => prev.filter((k) => k !== keywordToRemove));
  }, []);

  const applyPreset = useCallback((preset: BatchPreset) => {
    setActivePreset(preset.id);
    setTone(preset.config.tone);
    setDetailLevel(preset.config.detailLevel);
    setComplexity(preset.config.complexity);
    setPerspective(preset.config.perspective);
    setCreativeMode(preset.config.creativeMode);
    setOriginalityLevel(preset.config.originalityLevel);
    setVisualDensity(preset.config.visualDensity);
    setPersona(preset.config.persona);
    setNarrativeArc(preset.config.narrativeArc);
    setPromptLength(preset.config.promptLength);
    setIncludeHooks(preset.config.includeHooks);
  }, []);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  const handleGenerate = useCallback(async () => {
    if (!basePrompt.trim()) return;

    setIsGenerating(true);
    setItems([]);
    setErrorMessage(null);
    setDiversityScore(null);

    abortControllerRef.current = new AbortController();

    try {
      const batchRes = await aiGenerateBatch({
        baseConcept: basePrompt,
        count,
        preset: activePreset || undefined,
        persona,
        creativity: originalityLevel,
        density: visualDensity,
        signal: abortControllerRef.current.signal,
      });

      if (batchRes.items && Array.isArray(batchRes.items)) {
        setItems(batchRes.items);
        setDiversityScore(batchRes.diversityScore);
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.warn("Batch generation via API failed, attempting local fallback:", err.message);
        // Fallback to local batch generator
        try {
          const fallbackPrompts = await generateBatchPrompts({
            basePrompt,
            count,
            creativity: originalityLevel,
            focusKeywords,
            persona,
          });
          setItems(
            fallbackPrompts.map((p, idx) => ({
              index: idx,
              prompt: p,
              rationale: `Variation #${idx + 1}`,
              status: "success",
            }))
          );
        } catch (fbErr: any) {
          setErrorMessage(fbErr.message || "Failed to generate batch prompts.");
        }
      }
    } finally {
      setIsGenerating(false);
    }
  }, [basePrompt, count, activePreset, persona, originalityLevel, visualDensity, focusKeywords]);

  const handleRetryFailedOnly = async () => {
    const failedIndices = items.filter((i) => i.status === "error").map((i) => i.index);
    if (failedIndices.length === 0) return;

    setIsGenerating(true);
    try {
      const fallbackPrompts = await generateBatchPrompts({
        basePrompt,
        count: failedIndices.length,
        creativity: originalityLevel,
      });

      setItems((prev) => {
        const next = [...prev];
        failedIndices.forEach((idx, i) => {
          if (fallbackPrompts[i]) {
            next[idx] = {
              index: idx,
              prompt: fallbackPrompts[i],
              rationale: `Retried Variation #${idx + 1}`,
              status: "success",
            };
          }
        });
        return next;
      });
    } catch (err: any) {
      setErrorMessage("Retry failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetrySingleItem = async (index: number) => {
    try {
      const single = await generateBatchPrompts({
        basePrompt,
        count: 1,
        creativity: originalityLevel + 10,
      });
      if (single[0]) {
        setItems((prev) => {
          const next = [...prev];
          next[index] = {
            index,
            prompt: single[0],
            rationale: `Refreshed #${index + 1}`,
            status: "success",
          };
          return next;
        });
      }
    } catch (err) {
      // ignore
    }
  };

  const handleResultChange = useCallback((index: number, newValue: string) => {
    setItems((prev) => {
      const newItems = [...prev];
      if (newItems[index]) {
        newItems[index] = { ...newItems[index], prompt: newValue };
      }
      return newItems;
    });
  }, []);

  const copyToClipboard = useCallback((text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const savePrompt = useCallback(
    (text: string, index: number) => {
      onSaveToLibrary(text, undefined, undefined, ["batch-generator", persona]);
      setSavedIndex(index);
      setTimeout(() => setSavedIndex(null), 2000);
    },
    [onSaveToLibrary, persona]
  );

  const focusResult = useCallback((index: number) => {
    resultRefs.current[index]?.focus();
  }, []);

  const exportBatch = useCallback(() => {
    if (items.length === 0) return;
    const exportData = {
      timestamp: new Date().toISOString(),
      basePrompt,
      settings: { tone, detailLevel, complexity, perspective, creativeMode, originalityLevel, visualDensity, persona, narrativeArc },
      prompts: items.map((i) => ({ index: i.index, prompt: i.prompt, rationale: i.rationale })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `batch-prompts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [items, basePrompt, tone, detailLevel, complexity, perspective, creativeMode, originalityLevel, visualDensity, persona, narrativeArc]);

  const hasFailedItems = items.some((i) => i.status === "error");

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 animate-fade-in items-start">
      {/* Left Panel: Advanced Controls */}
      <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 editorial-panel">
        <div className="editorial-panel__header">
          <div className="flex items-center gap-2">
            <span className="editorial-badge editorial-badge--gold">01 / Controls</span>
            <h2 className="editorial-panel__title m-0 text-base">Batch Ideation Spec</h2>
          </div>
          {isGenerating && (
            <span className="editorial-badge editorial-badge--gold animate-pulse">
              Generating...
            </span>
          )}
        </div>

        <div className="editorial-panel__body space-y-5">
          {/* Base Concept */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                Base Scene / Prompt Theme
              </label>
            </div>
            <textarea
              value={basePrompt}
              onChange={(e) => setBasePrompt(e.target.value)}
              placeholder="Describe your core scene, thematic anchor, or character setup..."
              className="editorial-textarea min-h-[90px] text-xs font-mono"
            />
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider flex items-center gap-1.5">
              <SparklesIcon className="w-3.5 h-3.5 text-[var(--editorial-gold)]" /> Style Archetypes
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {BATCH_PRESETS.slice(0, 8).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`p-2 border text-center transition-all flex flex-col items-center gap-0.5 ${
                    activePreset === preset.id
                      ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)] shadow-[2px_2px_0_var(--editorial-gold)]"
                      : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-ink)] hover:border-[var(--editorial-gold)]"
                  }`}
                >
                  <span className="text-sm">{preset.icon}</span>
                  <span className="font-mono text-[9px] font-bold uppercase truncate w-full">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Creative Persona & Originality */}
          <div className="p-3.5 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] space-y-3.5">
            {/* Persona Selector */}
            <div className="space-y-1.5">
              <span className="font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                Creative Persona
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPersona(p.id as typeof persona)}
                    className={`py-1.5 px-2.5 text-xs font-mono border transition-all flex items-center gap-1.5 ${
                      persona === p.id
                        ? "bg-[var(--editorial-gold)] text-white border-[var(--editorial-gold)] font-bold shadow-[2px_2px_0_var(--editorial-ink)]"
                        : "bg-[var(--editorial-paper)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-ink)]"
                    }`}
                  >
                    <span>{p.icon}</span>
                    <span className="truncate">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Originality Slider */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                  Originality Divergence
                </span>
                <span className="font-mono text-[10px] font-bold text-[var(--editorial-gold)]">
                  {originalityLevel}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={originalityLevel}
                onChange={(e) => setOriginalityLevel(parseInt(e.target.value))}
                className="w-full h-1.5 bg-[var(--editorial-rule)] rounded-none appearance-none cursor-pointer accent-[var(--editorial-coral)]"
              />
            </div>
          </div>

          {/* Variation Count (1, 5, 10) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider flex items-center gap-1">
                <SlidersIcon className="w-3.5 h-3.5 text-[var(--editorial-gold)]" /> Variation Output Count
              </label>
              <span className="editorial-badge editorial-badge--gold">
                {count} Prompts
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 5, 10].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCount(num)}
                  className={`py-2 text-xs font-mono font-bold uppercase tracking-wider border transition-all ${
                    count === num
                      ? "bg-[var(--editorial-gold)] text-white border-[var(--editorial-gold)] shadow-[2px_2px_0_var(--editorial-ink)]"
                      : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:border-[var(--editorial-gold)] hover:text-[var(--editorial-ink)]"
                  }`}
                >
                  {num} {num === 1 ? "Prompt" : "Prompts"}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Action */}
          <div className="pt-2">
            {isGenerating ? (
              <button
                type="button"
                onClick={handleCancel}
                className="editorial-button editorial-button--secondary w-full justify-center text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
              >
                <XIcon className="w-4 h-4" /> Cancel Generation
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!basePrompt.trim()}
                className="editorial-button editorial-button--primary editorial-button--coral w-full justify-center text-xs"
              >
                <BrainCircuitIcon className="w-4 h-4" />
                Synthesize {count} Variations
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel: Results View */}
      <div className="flex-1 editorial-panel w-full">
        <div className="editorial-panel__header">
          <div className="flex items-center gap-2">
            <span className="editorial-badge editorial-badge--gold">02 / Spectrum</span>
            <h3 className="editorial-panel__title m-0 text-base">
              Batch Variations {items.length > 0 ? `(${items.filter((i) => i.status === "success").length}/${count})` : ''}
            </h3>
            {diversityScore !== null && (
              <span className="editorial-badge editorial-badge--teal">
                ✨ {Math.round(diversityScore * 100)}% Divergence
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasFailedItems && (
              <button
                type="button"
                onClick={handleRetryFailedOnly}
                disabled={isGenerating}
                className="editorial-button editorial-button--sm editorial-button--secondary text-red-500 border-red-500/30 hover:bg-red-500/10"
              >
                <RefreshIcon className="w-3 h-3" />
                Retry Failed
              </button>
            )}
            {items.length > 0 && !isGenerating && (
              <button
                type="button"
                onClick={exportBatch}
                className="editorial-button editorial-button--sm editorial-button--secondary"
              >
                📥 Export JSON
              </button>
            )}
          </div>
        </div>

        <div className="editorial-panel__body">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-xs font-mono text-red-500 mb-4">
              ⚠️ {errorMessage}
            </div>
          )}

          {items.length === 0 && !isGenerating ? (
            <div className="py-16 text-center">
              <p className="font-mono text-xs text-[var(--editorial-muted)] uppercase tracking-widest mb-1">
                Awaiting Inputs
              </p>
              <p className="font-serif text-lg text-[var(--editorial-ink)] m-0">
                Configure your concept on the left to spawn high-fidelity variations.
              </p>
            </div>
          ) : (
            <div>
              {isGenerating && items.length === 0 && (
                <div className="mb-6">
                  <ProcessingAnimation
                    variant="panel"
                    theme="gold"
                    badge="Batch Synthesis"
                    title={`Synthesizing ${count} Variation Matrix`}
                    stages={[
                      "Parsing base prompt template variables...",
                      "Permuting camera, lighting & thematic modifiers...",
                      "Validating visual coherence across batch items...",
                      "Assembling multi-variant prompt tokens...",
                    ]}
                    stageIntervalMs={1900}
                    subtext="Generating diversified variations with distinct stylistic signatures."
                  />
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

              {items.map((item, index) => (
                <ResultCard
                  key={index}
                  item={item}
                  copiedIndex={copiedIndex}
                  savedIndex={savedIndex}
                  onResultChange={handleResultChange}
                  onCopy={copyToClipboard}
                  onSave={savePrompt}
                  onFocus={focusResult}
                  onSendToBuilder={onSendToBuilder}
                  onRetryItem={handleRetrySingleItem}
                  resultRefs={resultRefs}
                  animationDelay={index * 60}
                />
              ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchGenerator;
