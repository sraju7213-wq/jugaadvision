import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { ProcessingAnimation } from "./ProcessingAnimation";
import { Platform, Prompt } from "../types";
import {
  SMART_WORD_LIBRARY,
  RANDOM_SUBJECTS,
  RANDOM_SETTINGS,
  RANDOM_MOODS,
  RANDOM_STYLES,
  NEGATIVE_PROMPT_SUGGESTIONS,
} from "../constants";
import { enhancePromptWithCreativity } from "../services/geminiService";
import { convertToStructuredPrompt } from "../services/cinematicPromptService";
import { aiValidateStructured } from "../services/aiGatewayClient";

import {
  CopyIcon,
  CheckIcon,
  ChevronDownIcon,
  SlidersIcon,
  TrashIcon,
  XIcon,
  FolderIcon,
  SearchIcon,
  MicIcon,
  MicOffIcon,
  TemplateIcon,
  MagicWandIcon,
  SparklesIcon,
  BrainCircuitIcon,
} from "./icons";
import { Loader2 } from "lucide-react";
import useSpeechToText from "../hooks/useSpeechToText";
import Tooltip from "./Tooltip";

interface PromptBuilderProps {
  prompts: Prompt[];
  setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>;
  initialPrompt: Prompt | null;
}

const MAX_CHARS = 1000;

const PLATFORMS: { id: Platform; label: string; icon: string; badge: string }[] = [
  { id: Platform.Natural, label: "Natural Language", icon: "🌐", badge: "Universal" },
  { id: Platform.Midjourney, label: "Midjourney v6.1", icon: "🎨", badge: "Parameters" },
  { id: Platform.Flux, label: "Flux AI Pro", icon: "⚡", badge: "High Fidelity" },
  { id: Platform.SDXL, label: "SDXL", icon: "🖼️", badge: "Diffusion" },
  { id: Platform.DallE3, label: "DALL-E 3", icon: "🤖", badge: "Descriptive" },
];

const ASPECT_RATIOS = [
  { ratio: "1:1", label: "1:1 Square", sub: "Instagram Post" },
  { ratio: "16:9", label: "16:9 Cinematic", sub: "Landscape / YouTube" },
  { ratio: "9:16", label: "9:16 Vertical", sub: "Story / Reels / TikTok" },
  { ratio: "4:5", label: "4:5 Portrait", sub: "Social Feed" },
  { ratio: "21:9", label: "21:9 Ultrawide", sub: "Panoramic" },
  { ratio: "3:2", label: "3:2 Classic", sub: "Photography 35mm" },
];

const Chip: React.FC<{ text: string; onRemove?: () => void }> = ({
  text,
  onRemove,
}) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] text-[var(--editorial-ink)] shadow-[1px_1px_0_var(--editorial-rule)] transition-all hover:border-[var(--editorial-violet)] cursor-default">
    <span>{text}</span>
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${text}`}
        className="p-0.5 text-[var(--editorial-muted)] hover:text-[var(--editorial-coral)] focus:outline-none transition-colors"
      >
        <XIcon className="h-3 w-3" />
      </button>
    )}
  </span>
);

const PromptBuilder: React.FC<PromptBuilderProps> = ({
  prompts,
  setPrompts,
  initialPrompt,
}) => {
  const [promptId, setPromptId] = useState<string | null>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [platform, setPlatform] = useState<Platform>(Platform.Natural);
  const [dimension, setDimension] = useState("16:9");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [stylizeValue, setStylizeValue] = useState(250);
  const [styleRaw, setStyleRaw] = useState(false);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creativity, setCreativity] = useState(50);

  // Lifecycle & State Handling
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isJsonConverting, setIsJsonConverting] = useState(false);
  const [showEnhancePanel, setShowEnhancePanel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState(false);

  // Non-Destructive Enhancement Comparison State
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [enhancedResultText, setEnhancedResultText] = useState<string | null>(null);
  const [originalPromptSnapshot, setOriginalPromptSnapshot] = useState<string>("");
  const [enhancedCopied, setEnhancedCopied] = useState(false);

  // Structured JSON Viewer State
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [structuredData, setStructuredData] = useState<any | null>(null);
  const [rawJsonString, setRawJsonString] = useState<string>("");
  const [jsonCopied, setJsonCopied] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairDiagnostic, setRepairDiagnostic] = useState<string | null>(null);

  // Abort Controller for Cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const { isListening, isSupported, startListening } = useSpeechToText(
    (text) => {
      const parts = text.split(" ");
      parts.forEach((p) => {
        if (p.trim()) addChip(p.trim());
      });
    },
  );

  useEffect(() => {
    if (initialPrompt) {
      setPromptId(
        initialPrompt.id.startsWith("temp-") ? null : initialPrompt.id,
      );

      let text = initialPrompt.text;
      
      // Extract Midjourney parameters if present
      const arMatch = text.match(/--ar\s+([^\s]+)/);
      if (arMatch) {
        setDimension(arMatch[1]);
        text = text.replace(/--ar\s+[^\s]+/, "");
      }

      const stylizeMatch = text.match(/--s(?:tylize)?\s+(\d+)/);
      if (stylizeMatch) {
        setStylizeValue(parseInt(stylizeMatch[1], 10));
        text = text.replace(/--s(?:tylize)?\s+\d+/, "");
      }

      if (text.includes("--style raw")) {
        setStyleRaw(true);
        text = text.replace(/--style\s+raw/, "");
      }

      const noMatch = text.match(/--no\s+([^--]+)/);
      if (noMatch) {
        setNegativePrompt(noMatch[1].trim());
        text = text.replace(/--no\s+[^--]+/, "");
      }

      text = text.replace(/--v\s+[^\s]+/, "").trim();

      const parts = text.split(/,\s*/).filter(Boolean);
      setChips(parts);
      setPlatform(initialPrompt.platform || Platform.Natural);
    } else {
      handleClear();
    }
  }, [initialPrompt]);

  const promptText = useMemo(() => chips.join(", "), [chips]);

  const finalPrompt = useMemo(() => {
    if (!promptText) return "";

    if (platform === Platform.Midjourney) {
      let params = "";
      if (dimension) params += ` --ar ${dimension}`;
      if (stylizeValue !== 250) params += ` --s ${stylizeValue}`;
      if (styleRaw) params += ` --style raw`;
      params += ` --v 6.1`;
      if (negativePrompt.trim()) params += ` --no ${negativePrompt.trim()}`;
      return `${promptText}${params}`;
    }

    if (platform === Platform.SDXL || platform === Platform.Flux) {
      let text = promptText;
      if (dimension) text += ` [Ratio: ${dimension}]`;
      if (negativePrompt.trim()) text += ` | Negative: ${negativePrompt.trim()}`;
      return text;
    }

    return promptText;
  }, [promptText, platform, dimension, stylizeValue, styleRaw, negativePrompt]);

  const charCount = finalPrompt.length;
  const isOverLimit = charCount > MAX_CHARS;

  const addChip = (text: string) => {
    const clean = text.trim();
    if (
      !clean ||
      chips.includes(clean) ||
      promptText.length + clean.length + 2 > MAX_CHARS
    )
      return;
    setChips([...chips, clean]);
    setInputValue("");
    setError(null);
  };

  const removeChip = (index: number) => {
    setChips(chips.filter((_, i) => i !== index));
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addChip(inputValue);
    } else if (e.key === "Backspace" && !inputValue && chips.length > 0) {
      removeChip(chips.length - 1);
    }
  };

  const handleWordClick = useCallback(
    (word: string) => addChip(word),
    [chips, promptText],
  );

  const handleTemplateSelect = (template: string) => {
    setChips(template.split(/,\s*/).filter(Boolean));
    setError(null);
  };

  const handleSave = () => {
    if (!finalPrompt.trim()) {
      setError("Please add prompt text before saving.");
      return;
    }
    const promptToSave: Prompt = {
      id: promptId || `prompt_${Date.now()}`,
      text: finalPrompt,
      platform: platform,
      sourceFeature: "prompt-builder",
      tags: promptId ? (initialPrompt?.tags ?? ["builder"]) : ["builder"],
      createdAt: new Date().toISOString(),
      originalInput: { chips, dimension, platform, negativePrompt, stylizeValue, styleRaw },
      version: 1,
    };
    if (promptId) {
      setPrompts(prompts.map((p) => (p.id === promptId ? promptToSave : p)));
    } else {
      setPrompts([promptToSave, ...prompts]);
      setPromptId(promptToSave.id);
    }
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2000);
  };

  const handleClear = () => {
    setChips([]);
    setInputValue("");
    setDimension("16:9");
    setNegativePrompt("");
    setStylizeValue(250);
    setStyleRaw(false);
    setPromptId(null);
    setPlatform(Platform.Natural);
    setError(null);
  };

  const handleCopyPrompt = () => {
    if (!finalPrompt) return;
    navigator.clipboard.writeText(finalPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsEnhancing(false);
    setIsJsonConverting(false);
    setError("Generation cancelled by user.");
  };

  // Non-Destructive AI Enhance Handler
  const handleEnhance = async () => {
    if (isEnhancing) return;
    if (!finalPrompt.trim()) {
      setError("Please enter a concept or words before enhancing.");
      return;
    }

    setIsEnhancing(true);
    setError(null);
    setShowEnhancePanel(false);
    setOriginalPromptSnapshot(finalPrompt);

    abortControllerRef.current = new AbortController();

    try {
      const enhanced = await enhancePromptWithCreativity(promptText, creativity);

      if (isMounted.current && enhanced) {
        setEnhancedResultText(enhanced);
        setComparisonModalOpen(true);
      }
    } catch (err: any) {
      console.error("Enhancement failed:", err);
      if (isMounted.current && err.name !== "AbortError") {
        setError(err.message || "AI enhancement failed. Please try again.");
      }
    } finally {
      if (isMounted.current) {
        setIsEnhancing(false);
      }
    }
  };

  const handleApplyEnhancedResult = () => {
    if (enhancedResultText) {
      const parts = enhancedResultText.split(/,\s*/).filter(Boolean);
      setChips(parts);
      setComparisonModalOpen(false);
      setEnhancedResultText(null);
    }
  };

  // Structured JSON Conversion Handler
  const handleJsonConvert = async () => {
    if (isJsonConverting || !finalPrompt.trim()) {
      if (!finalPrompt.trim()) setError("Please enter a prompt concept before converting to JSON.");
      return;
    }
    setIsJsonConverting(true);
    setError(null);
    setRepairDiagnostic(null);

    abortControllerRef.current = new AbortController();

    try {
      const result = await convertToStructuredPrompt(promptText || finalPrompt);
      if (isMounted.current) {
        if (result.success && result.data) {
          setStructuredData(result.data);
          setRawJsonString(JSON.stringify(result.data, null, 2));
          setJsonModalOpen(true);
        } else if (result.enhancedPrompt) {
          const fallbackObj = {
            subject: promptText || finalPrompt,
            enhancedPrompt: result.enhancedPrompt,
            style: "Cinematic",
          };
          setStructuredData(fallbackObj);
          setRawJsonString(JSON.stringify(fallbackObj, null, 2));
          setJsonModalOpen(true);
        } else {
          setError("JSON conversion produced an unparseable response.");
        }
      }
    } catch (err: any) {
      console.error("JSON conversion failed:", err);
      if (isMounted.current && err.name !== "AbortError") {
        setError(err.message || "JSON conversion failed. Please try again.");
      }
    } finally {
      if (isMounted.current) {
        setIsJsonConverting(false);
      }
    }
  };

  const handleRepairJson = async () => {
    if (!rawJsonString) return;
    setIsRepairing(true);
    setRepairDiagnostic(null);

    try {
      const validation = await aiValidateStructured(rawJsonString);
      if (validation.success && validation.parsed) {
        setStructuredData(validation.parsed);
        setRawJsonString(JSON.stringify(validation.parsed, null, 2));
        setRepairDiagnostic("JSON schema verified & repaired successfully.");
      } else {
        const msgs = validation.diagnostics.map((d) => d.message).join("; ");
        setRepairDiagnostic(msgs || "Schema validation found issues.");
      }
    } catch (err: any) {
      setRepairDiagnostic(`Repair error: ${err.message}`);
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative animate-fade-in">
      {/* Left Main Editorial Workspace */}
      <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
        
        {/* Error Alert Banner */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 flex items-center justify-between text-red-600 dark:text-red-400 text-xs font-mono">
            <span className="flex items-center gap-2">⚠️ {error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:text-red-500">
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Target Platform Selector Bar */}
        <div className="editorial-panel">
          <div className="editorial-panel__header">
            <div className="flex items-center gap-2">
              <span className="editorial-badge editorial-badge--violet">01 / Preset</span>
              <h2 className="editorial-panel__title m-0 text-base">Target Platform Syntax</h2>
            </div>
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-violet)]">
              {platform}
            </span>
          </div>

          <div className="editorial-panel__body">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PLATFORMS.map((p) => {
                const isActive = platform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`p-2.5 flex flex-col items-center justify-center gap-1.5 border text-xs font-bold transition-all ${
                      isActive
                        ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)] shadow-[2px_2px_0_var(--editorial-violet)]"
                        : "bg-[var(--editorial-surface)] text-[var(--editorial-ink)] border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)] hover:bg-[var(--editorial-violet-soft)]"
                    }`}
                  >
                    <span className="text-base leading-none">{p.icon}</span>
                    <span className="truncate w-full text-center font-mono text-[10.5px] uppercase tracking-wider">
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Prompt Input Writing Canvas */}
        <div className="editorial-panel flex-grow flex flex-col">
          <div className="editorial-panel__header">
            <div className="flex items-center gap-2">
              <span className="editorial-badge editorial-badge--violet">02 / Canvas</span>
              <h2 className="editorial-panel__title m-0 text-base">Prompt Composition Space</h2>
              {isEnhancing && (
                <span className="editorial-badge editorial-badge--gold animate-pulse">
                  AI Enhancing...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-mono px-2.5 py-0.5 border transition-colors ${
                  isOverLimit
                    ? "text-red-500 border-red-500 bg-red-500/10 font-bold"
                    : charCount >= 800
                    ? "text-[var(--editorial-gold)] border-[var(--editorial-gold)] bg-[var(--editorial-gold-soft)]"
                    : "text-[var(--editorial-muted)] border-[var(--editorial-rule)] bg-[var(--editorial-surface)]"
                }`}
              >
                {charCount} / {MAX_CHARS} CHARS
              </span>
            </div>
          </div>

          <div
            className="flex-grow p-5 overflow-y-auto cursor-text bg-[var(--editorial-surface)] relative min-h-[220px] max-h-[380px] border-b border-[var(--editorial-rule)]"
            onClick={() => inputRef.current?.focus()}
          >
            {(isEnhancing || isJsonConverting) && (
              <div className="mb-4">
                <ProcessingAnimation
                  variant="compact"
                  theme="violet"
                  title={isJsonConverting ? "Structuring Cinematic JSON" : "Neural Prompt Enhancement"}
                  status={isJsonConverting ? "Extracting composition layers..." : "Synthesizing descriptive modifiers & optical depth..."}
                  stages={[
                    "Analyzing scene semantics & core subject...",
                    "Expanding atmospheric lighting & textural details...",
                    "Balancing camera framing & optical depth of field...",
                    "Assembling high-fidelity prompt directives...",
                  ]}
                  stageIntervalMs={1800}
                />
              </div>
            )}
            <div className="flex flex-wrap gap-2 items-start content-start">
              {chips.length === 0 && !inputValue && !isEnhancing && !isJsonConverting && (
                <div className="w-full text-center text-[var(--editorial-muted)] pt-10 pointer-events-none text-xs font-mono uppercase tracking-wider select-none">
                  Select keywords from the library or type custom tokens &amp; press Enter...
                </div>
              )}
              {chips.map((chip, index) => (
                <Chip
                  key={`${chip}-${index}`}
                  text={chip}
                  onRemove={() => removeChip(index)}
                />
              ))}
              <input
                aria-label="Prompt Input"
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-grow bg-transparent border-none outline-none text-[var(--editorial-ink)] min-w-[140px] py-1 text-xs font-mono placeholder-[var(--editorial-muted)]"
                maxLength={MAX_CHARS - charCount}
                placeholder={chips.length === 0 ? "Type tokens & press Enter..." : "Add more tags..."}
              />
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="p-3 bg-[var(--editorial-paper)] flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              {isSupported && (
                <Tooltip content={isListening ? "Stop Listening" : "Voice Input"}>
                  <button
                    type="button"
                    onClick={startListening}
                    aria-label={isListening ? "Stop listening" : "Start voice input"}
                    className={`editorial-button editorial-button--sm ${
                      isListening
                        ? "bg-red-500 text-white animate-pulse"
                        : "editorial-button--secondary"
                    }`}
                  >
                    {isListening ? <MicOffIcon className="w-3.5 h-3.5" /> : <MicIcon className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isListening ? "Listening" : "Speak"}</span>
                  </button>
                </Tooltip>
              )}

              <button
                type="button"
                onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                className={`editorial-button editorial-button--sm ${
                  showAdvancedParams || negativePrompt || dimension !== "16:9"
                    ? "editorial-button--violet"
                    : "editorial-button--secondary"
                }`}
              >
                <SlidersIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Parameters</span>
              </button>

              <button
                type="button"
                onClick={() => setIsLibraryOpen(!isLibraryOpen)}
                aria-label="Toggle Library"
                className="editorial-button editorial-button--sm editorial-button--secondary lg:hidden"
              >
                <FolderIcon className="w-3.5 h-3.5" />
                <span>Library</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {/* Enhance Button with Popover */}
              <div className="relative">
                <Tooltip content="AI Enhance Prompt (Non-destructive)">
                  <button
                    type="button"
                    onClick={() => setShowEnhancePanel(!showEnhancePanel)}
                    disabled={!finalPrompt.trim() || isEnhancing}
                    className={`editorial-button editorial-button--sm ${
                      isEnhancing
                        ? "editorial-button--enhancing"
                        : showEnhancePanel
                        ? "editorial-button--violet"
                        : "editorial-button--secondary"
                    }`}
                    aria-live="polite"
                  >
                    {isEnhancing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 shrink-0" />
                    ) : (
                      <SparklesIcon className="w-3.5 h-3.5" />
                    )}
                    <span>{isEnhancing ? "Enhancing..." : "Enhance"}</span>
                  </button>
                </Tooltip>

                {showEnhancePanel && (
                  <div className="absolute bottom-full mb-2 right-0 sm:left-0 sm:right-auto p-4 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] shadow-2xl w-[280px] z-50 animate-slide-up-fade">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                        Creativity Level
                      </span>
                      <span className="editorial-badge editorial-badge--violet">
                        {creativity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={creativity}
                      onChange={(e) => setCreativity(parseInt(e.target.value))}
                      className="editorial-range editorial-range--coral"
                      style={{ "--range-progress": `${creativity}%` } as React.CSSProperties}
                    />
                    <div className="flex justify-between font-mono text-[9px] text-[var(--editorial-muted)] mt-1.5 mb-4 uppercase tracking-wider">
                      <span>Refined</span>
                      <span>Balanced</span>
                      <span>Visionary</span>
                    </div>
                    <div className="editorial-range-status" role="status" aria-live="polite">
                      <span className="editorial-range-status__dot" aria-hidden="true" />
                      <span>
                        {creativity >= 70
                          ? "Visionary glow active"
                          : creativity >= 35
                            ? "Balanced glow active"
                            : "Refined glow active"}
                      </span>
                      <span className="editorial-range-status__value">{creativity}%</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleEnhance}
                      disabled={isEnhancing}
                      className="editorial-button editorial-button--primary editorial-button--violet w-full justify-center"
                    >
                      {isEnhancing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-1.5 shrink-0" />
                          <span>Enhancing...</span>
                        </>
                      ) : (
                        <>
                          <SparklesIcon className="w-4 h-4 mr-1.5" />
                          <span>Run Non-Destructive Enhance</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* JSON Convert Button */}
              <Tooltip content="Convert to structured JSON Schema">
                <button
                  type="button"
                  onClick={handleJsonConvert}
                  disabled={!finalPrompt.trim() || isJsonConverting}
                  className="editorial-button editorial-button--sm editorial-button--secondary"
                >
                  <BrainCircuitIcon className="w-3.5 h-3.5" />
                  <span>{isJsonConverting ? "Converting..." : "JSON"}</span>
                </button>
              </Tooltip>

              {/* Surprise Me */}
              <Tooltip content="Surprise Me (Deterministic Random Prompt)">
                <button
                  type="button"
                  onClick={() => {
                    const subject = RANDOM_SUBJECTS[Math.floor(Math.random() * RANDOM_SUBJECTS.length)];
                    const setting = RANDOM_SETTINGS[Math.floor(Math.random() * RANDOM_SETTINGS.length)];
                    const mood = RANDOM_MOODS[Math.floor(Math.random() * RANDOM_MOODS.length)];
                    const style = RANDOM_STYLES[Math.floor(Math.random() * RANDOM_STYLES.length)];
                    // The descriptive tail guarantees a useful, image-ready prompt of
                    // at least 15 words, even when a short random option is selected.
                    const randomPrompt = `${subject} ${setting}, ${mood}, ${style}, intricate cinematic composition with layered atmospheric depth, dramatic lighting, richly detailed environment`;
                    setChips(randomPrompt.split(/,\s*/).filter(Boolean));
                    setError(null);
                  }}
                  aria-label="Generate Random Prompt"
                  className="editorial-button editorial-button--sm editorial-button--secondary"
                >
                  <MagicWandIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Surprise Me</span>
                </button>
              </Tooltip>

              {/* Cancel Button */}
              {(isEnhancing || isJsonConverting) && (
                <button
                  type="button"
                  onClick={handleCancelRequest}
                  className="editorial-button editorial-button--sm text-red-500 border-red-500 hover:bg-red-500/10"
                >
                  Cancel
                </button>
              )}

              {/* Clear button */}
              <Tooltip content="Clear All">
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Clear Prompt"
                  className="editorial-button editorial-button--sm editorial-button--quiet"
                >
                  Clear
                </button>
              </Tooltip>
            </div>
          </div>

          {/* Collapsible Advanced Parameters */}
          {showAdvancedParams && (
            <div className="p-4 border-t border-[var(--editorial-rule)] bg-[var(--editorial-paper)] space-y-4 animate-slide-up-fade">
              {/* Aspect Ratio Selector */}
              <div>
                <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block mb-2">
                  Aspect Ratio
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {ASPECT_RATIOS.map((ar) => {
                    const isSelected = dimension === ar.ratio;
                    return (
                      <button
                        key={ar.ratio}
                        type="button"
                        onClick={() => setDimension(ar.ratio)}
                        className={`p-2 text-left border transition-all ${
                          isSelected
                            ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)] shadow-[2px_2px_0_var(--editorial-coral)]"
                            : "bg-[var(--editorial-surface)] text-[var(--editorial-ink)] border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)]"
                        }`}
                      >
                        <div className="font-mono font-bold text-xs">{ar.ratio}</div>
                        <div className="text-[10px] text-[var(--editorial-muted)] truncate font-mono">
                          {ar.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Midjourney Specific Parameters */}
              {platform === Platform.Midjourney && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--editorial-rule)]">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                        Stylize Level (--s)
                      </label>
                      <span className="font-mono text-xs font-bold text-[var(--editorial-violet)]">{stylizeValue}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1000"
                      step="50"
                      value={stylizeValue}
                      onChange={(e) => setStylizeValue(parseInt(e.target.value, 10))}
                      className="editorial-range editorial-range--violet"
                      style={{ "--range-progress": `${(stylizeValue / 1000) * 100}%` } as React.CSSProperties}
                    />
                    <div className="flex justify-between font-mono text-[9px] text-[var(--editorial-muted)] mt-1 uppercase">
                      <span>0 (Exact)</span>
                      <span>250 (Default)</span>
                      <span>1000 (Artistic)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                    <div>
                      <div className="text-xs font-bold text-[var(--editorial-ink)]">Style Raw</div>
                      <div className="text-[10px] text-[var(--editorial-muted)] font-mono">Less automatic Midjourney styling</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStyleRaw(!styleRaw)}
                      className={`editorial-button editorial-button--sm ${
                        styleRaw
                          ? "editorial-button--violet"
                          : "editorial-button--secondary"
                      }`}
                    >
                      {styleRaw ? "Enabled (--style raw)" : "Disabled"}
                    </button>
                  </div>
                </div>
              )}

              {/* Negative Prompt Input */}
              <div className="pt-3 border-t border-[var(--editorial-rule)]">
                <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block mb-1">
                  Negative Prompt Elements {platform === Platform.Midjourney ? "(--no)" : ""}
                </label>
                <input
                  type="text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="e.g. blurry, text, watermark, bad anatomy, deformed"
                  className="editorial-input w-full text-xs font-mono"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {NEGATIVE_PROMPT_SUGGESTIONS.slice(0, 8).map((neg) => {
                    const isAdded = negativePrompt.includes(neg);
                    return (
                      <button
                        key={neg}
                        type="button"
                        onClick={() => {
                          if (isAdded) {
                            setNegativePrompt(
                              negativePrompt
                                .split(",")
                                .map((s) => s.trim())
                                .filter((s) => s !== neg)
                                .join(", ")
                            );
                          } else {
                            setNegativePrompt(
                              negativePrompt ? `${negativePrompt}, ${neg}` : neg
                            );
                          }
                        }}
                        className={`px-2 py-0.5 text-[10px] font-mono font-medium border transition-all ${
                          isAdded
                            ? "bg-red-500/10 text-red-500 border-red-500/30"
                            : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)] hover:text-[var(--editorial-coral)]"
                        }`}
                      >
                        {isAdded ? `✕ ${neg}` : `+ ${neg}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Assembled Prompt Preview Box */}
        {finalPrompt && (
          <div className="editorial-panel">
            <div className="editorial-panel__header">
              <div className="flex items-center gap-2">
                <span className="editorial-badge editorial-badge--coral">03 / Output</span>
                <h3 className="editorial-panel__title m-0 text-sm">Formatted Generation String</h3>
              </div>
              <span className="font-mono text-[11px] text-[var(--editorial-muted)] uppercase tracking-wider">
                {platform} Preset
              </span>
            </div>
            <div className="editorial-panel__body">
              <p className="m-0 font-mono text-xs sm:text-sm text-[var(--editorial-ink)] leading-relaxed break-words bg-[var(--editorial-surface)] p-3 border border-[var(--editorial-rule)] select-all">
                {finalPrompt}
              </p>
            </div>
          </div>
        )}

        {/* Primary Bottom Actions */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!finalPrompt.trim()}
            className="editorial-button editorial-button--secondary w-full justify-center"
          >
            {saveFeedback ? (
              <>
                <CheckIcon className="w-4 h-4 text-green-500" />
                <span>Saved to Library!</span>
              </>
            ) : (
              <span>{promptId ? "Update in Library" : "Save to Library"}</span>
            )}
          </button>
          
          <button
            type="button"
            onClick={handleCopyPrompt}
            disabled={!finalPrompt.trim()}
            className="editorial-button editorial-button--primary w-full justify-center"
          >
            {copied ? (
              <>
                <CheckIcon className="w-4 h-4" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <CopyIcon className="w-4 h-4" />
                <span>Copy Prompt</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Word/Template Library Panel */}
      <div
        className={`col-span-1 lg:col-span-4 h-auto editorial-panel flex flex-col transition-all duration-300 overflow-hidden ${
          isLibraryOpen ? "block" : "hidden lg:flex"
        }`}
      >
        <RightPanel
          onWordClick={handleWordClick}
          onTemplateSelect={handleTemplateSelect}
          selectedWords={chips}
          onClose={() => setIsLibraryOpen(false)}
        />
      </div>

      {/* NON-DESTRUCTIVE ENHANCEMENT COMPARISON MODAL */}
      {comparisonModalOpen && enhancedResultText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="editorial-panel p-6 max-w-2xl w-full shadow-2xl animate-pop">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[var(--editorial-rule)]">
              <div className="flex items-center gap-2">
                <span className="editorial-badge editorial-badge--violet">AI Enhance</span>
                <h3 className="editorial-panel__title m-0 text-base">
                  Compare Prompt Variations
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setComparisonModalOpen(false)}
                className="p-1.5 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Original Snapshot */}
              <div className="p-4 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] flex flex-col">
                <span className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider mb-2">
                  Original Input
                </span>
                <p className="font-mono text-xs text-[var(--editorial-ink)] leading-relaxed flex-grow">
                  {originalPromptSnapshot}
                </p>
                <span className="font-mono text-[10px] text-[var(--editorial-muted)] mt-3">
                  {originalPromptSnapshot.length} chars
                </span>
              </div>

              {/* AI Enhanced Version */}
              <div className="p-4 bg-[var(--editorial-violet-soft)] border border-[var(--editorial-violet)] flex flex-col">
                <span className="font-mono text-[10.5px] font-bold text-[var(--editorial-violet)] uppercase tracking-wider mb-2 flex items-center gap-1">
                  <SparklesIcon className="w-3.5 h-3.5" /> AI Enhanced
                </span>
                <p className="font-mono text-xs text-[var(--editorial-ink)] leading-relaxed font-medium flex-grow">
                  {enhancedResultText}
                </p>
                <span className="font-mono text-[10px] text-[var(--editorial-violet)] mt-3">
                  {enhancedResultText.length} chars
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--editorial-rule)]">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(enhancedResultText);
                  setEnhancedCopied(true);
                  setTimeout(() => setEnhancedCopied(false), 1500);
                }}
                className="editorial-button editorial-button--secondary editorial-button--sm"
              >
                {enhancedCopied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                <span>{enhancedCopied ? "Copied" : "Copy Result"}</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setComparisonModalOpen(false)}
                  className="editorial-button editorial-button--quiet editorial-button--sm"
                >
                  Keep Original
                </button>
                <button
                  type="button"
                  onClick={handleApplyEnhancedResult}
                  className="editorial-button editorial-button--primary editorial-button--sm"
                >
                  Use Enhanced Result
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STRUCTURED JSON SCHEMA VIEWER MODAL */}
      {jsonModalOpen && structuredData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="editorial-panel p-6 max-w-2xl w-full shadow-2xl animate-pop flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-3 pb-3 border-b border-[var(--editorial-rule)]">
              <div className="flex items-center gap-2">
                <span className="editorial-badge editorial-badge--teal">JSON Schema</span>
                <h3 className="editorial-panel__title m-0 text-base">
                  Structured Syntax Object
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setJsonModalOpen(false)}
                className="p-1.5 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {repairDiagnostic && (
              <div className="mb-3 p-2.5 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] text-xs font-mono text-[var(--editorial-ink)]">
                ℹ️ {repairDiagnostic}
              </div>
            )}

            <div className="flex-grow overflow-y-auto bg-black text-gray-200 font-mono text-xs leading-relaxed my-2 p-4 border border-[var(--editorial-rule)] custom-scrollbar">
              <pre>{rawJsonString}</pre>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--editorial-rule)] mt-2">
              <button
                type="button"
                onClick={handleRepairJson}
                disabled={isRepairing}
                className="editorial-button editorial-button--secondary editorial-button--sm"
              >
                {isRepairing ? "Validating..." : "Auto-Repair / Validate Schema"}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(rawJsonString);
                    setJsonCopied(true);
                    setTimeout(() => setJsonCopied(false), 1500);
                  }}
                  className="editorial-button editorial-button--secondary editorial-button--sm"
                >
                  {jsonCopied ? <CheckIcon className="w-4 h-4 text-green-500" /> : <CopyIcon className="w-4 h-4" />}
                  <span>{jsonCopied ? "Copied" : "Copy JSON"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (structuredData?.enhancedPrompt) {
                      setChips(structuredData.enhancedPrompt.split(/,\s*/).filter(Boolean));
                    }
                    setJsonModalOpen(false);
                  }}
                  className="editorial-button editorial-button--primary editorial-button--sm"
                >
                  Apply Assembled Prompt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RightPanel: React.FC<{
  selectedWords: string[];
  onWordClick: (word: string) => void;
  onTemplateSelect: (template: string) => void;
  onClose: () => void;
}> = ({ selectedWords, onWordClick, onTemplateSelect, onClose }) => {
  const [activeTab, setActiveTab] = useState<"library" | "templates">(
    "library",
  );
  return (
    <>
      <div className="editorial-panel__header">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("library")}
            className={`px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider border transition-all ${
              activeTab === "library"
                ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-ink)]"
            }`}
          >
            Keywords
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={`px-3 py-1 text-xs font-mono font-bold uppercase tracking-wider border transition-all ${
              activeTab === "templates"
                ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-ink)]"
            }`}
          >
            Templates
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Library"
          className="lg:hidden text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
        {activeTab === "library" && (
          <SmartWordLibrary
            selectedWords={selectedWords}
            onWordClick={onWordClick}
          />
        )}
        {activeTab === "templates" && (
          <PromptTemplates onSelect={onTemplateSelect} />
        )}
      </div>
    </>
  );
};

const TEMPLATE_CATEGORIES: Record<string, Record<string, string>> = {
  "📸 Photography": {
    "Portrait": "portrait photography, 85mm lens, natural lighting, sharp focus, shallow depth of field",
    "Landscape": "landscape photography, golden hour, wide angle, dramatic sky, vivid colors",
    "Macro": "macro photography, extreme close-up, water droplets, intricate details, bokeh background",
    "Street": "street photography, candid moment, urban setting, natural light, documentary style",
    "Product": "product photography, studio lighting, clean background, professional, commercial quality",
    "Fashion": "high fashion photography, editorial style, dramatic lighting, magazine quality, couture",
    "Wildlife": "wildlife photography, National Geographic style, natural habitat, telephoto lens, action shot",
  },
  "🎬 Cinematic": {
    "Movie Scene": "cinematic lighting, 8k, highly detailed, dramatic atmosphere, widescreen aspect",
    "Film Noir": "film noir style, high contrast, dramatic shadows, black and white, 1940s aesthetic",
    "Sci-Fi Epic": "sci-fi blockbuster, futuristic, neon lights, epic scale, volumetric lighting",
    "Cyberpunk": "cyberpunk city, rainy night, neon reflections, holographic signs, flying vehicles",
    "Fantasy Epic": "epic fantasy landscape, magical atmosphere, glowing runes, ancient ruins, majestic",
    "Horror/Thriller": "dark and gritty atmosphere, subtle fog, eerie shadows, cinematic framing, suspenseful",
  },
  "🎨 Digital Art": {
    "Concept Art": "digital concept art, trending on ArtStation, dynamic composition, rich colors, detailed",
    "Anime Style": "anime aesthetic, Makoto Shinkai style, vibrant sky, expressive lighting, detailed scenery",
    "Oil Painting": "classic oil painting, visible brushstrokes, rich texture, warm tones, masterpiece",
    "Watercolor": "delicate watercolor, soft color bleeds, textured paper, pastel palette, artistic",
    "3D Render": "3D octane render, Ray tracing, subsurface scattering, studio quality, pristine details",
    "Pixel Art": "detailed pixel art, 16-bit aesthetic, vibrant color palette, nostalgic gaming style",
  },
};

const PromptTemplates: React.FC<{ onSelect: (template: string) => void }> = ({
  onSelect,
}) => {
  const [search, setSearch] = useState("");
  const [expandedCategory, setExpandedCategory] = useState<string | null>("📸 Photography");

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return TEMPLATE_CATEGORIES;
    const q = search.toLowerCase();
    const result: Record<string, Record<string, string>> = {};
    for (const [cat, templates] of Object.entries(TEMPLATE_CATEGORIES)) {
      const matching: Record<string, string> = {};
      for (const [name, tpl] of Object.entries(templates)) {
        if (name.toLowerCase().includes(q) || tpl.toLowerCase().includes(q)) {
          matching[name] = tpl;
        }
      }
      if (Object.keys(matching).length > 0) {
        result[cat] = matching;
      }
    }
    return result;
  }, [search]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="editorial-input w-full pl-8 text-xs font-mono"
        />
        <SearchIcon className="w-3.5 h-3.5 text-[var(--editorial-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]">
            <XIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {Object.entries(filteredCategories).map(([category, templates]) => {
          const isExpanded = expandedCategory === category || search.trim().length > 0;
          return (
            <div key={category} className="border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                className="w-full p-2.5 flex items-center justify-between text-xs font-bold text-[var(--editorial-ink)] hover:bg-[var(--editorial-paper)] transition-colors"
              >
                <span>{category}</span>
                <span className="text-[10px] text-[var(--editorial-muted)] font-mono">
                  {Object.keys(templates).length}
                </span>
              </button>
              {isExpanded && (
                <div className="p-2 pt-0 flex flex-col gap-1.5 border-t border-[var(--editorial-rule)]">
                  {Object.entries(templates).map(([name, template]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => onSelect(template)}
                      className="w-full text-left p-2 text-xs hover:bg-[var(--editorial-violet-soft)] text-[var(--editorial-ink)] border border-transparent hover:border-[var(--editorial-violet)] transition-all group"
                    >
                      <div className="font-bold text-xs group-hover:text-[var(--editorial-violet)]">
                        {name}
                      </div>
                      <div className="font-mono text-[10px] text-[var(--editorial-muted)] line-clamp-1 mt-0.5">
                        {template}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SmartWordLibrary: React.FC<{
  selectedWords: string[];
  onWordClick: (word: string) => void;
}> = ({ selectedWords, onWordClick }) => {
  const [search, setSearch] = useState("");
  const categories = useMemo(() => Object.keys(SMART_WORD_LIBRARY), []);
  const [activeCategory, setActiveCategory] = useState<string>(
    categories[0] || "Art Styles"
  );

  // Grouped subcategories & words for the active category or matching search
  const subcategorySections = useMemo(() => {
    const rawCategoryData =
      (SMART_WORD_LIBRARY as Record<string, Record<string, string[]>>)[
        activeCategory
      ] || {};

    const q = search.trim().toLowerCase();

    if (!q) {
      return Object.entries(rawCategoryData).map(([subCatName, words]) => ({
        subCatName,
        words,
      }));
    }

    // When searching, look across current category's subcategories
    const matchingSections: { subCatName: string; words: string[] }[] = [];
    for (const [subCatName, words] of Object.entries(rawCategoryData)) {
      const matched = words.filter((w) => w.toLowerCase().includes(q));
      if (matched.length > 0) {
        matchingSections.push({ subCatName, words: matched });
      }
    }

    // If no match in current category, search all categories
    if (matchingSections.length === 0) {
      for (const [catName, subCats] of Object.entries(SMART_WORD_LIBRARY)) {
        for (const [subCatName, words] of Object.entries(subCats)) {
          const matched = words.filter((w) => w.toLowerCase().includes(q));
          if (matched.length > 0) {
            matchingSections.push({
              subCatName: `${catName} › ${subCatName}`,
              words: matched,
            });
          }
        }
      }
    }

    return matchingSections;
  }, [activeCategory, search]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter keywords (e.g. 35mm, Golden Hour)..."
          className="editorial-input w-full pl-8 text-xs font-mono"
        />
        <SearchIcon className="w-3.5 h-3.5 text-[var(--editorial-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
          >
            <XIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              setActiveCategory(cat);
              setSearch("");
            }}
            className={`px-2 py-0.5 text-[10.5px] font-mono font-bold uppercase tracking-wider border transition-all ${
              activeCategory === cat && !search
                ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-ink)]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Subcategory Sections with Word Chips */}
      <div className="space-y-4 pt-1 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
        {subcategorySections.length === 0 ? (
          <div className="text-center text-xs font-mono text-[var(--editorial-muted)] py-6">
            No keywords found matching &ldquo;{search}&rdquo;
          </div>
        ) : (
          subcategorySections.map(({ subCatName, words }) => (
            <div key={subCatName} className="space-y-1.5">
              <div className="text-[10px] font-mono font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                {subCatName}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {words.map((word) => {
                  const isSelected = selectedWords.includes(word);
                  return (
                    <button
                      key={word}
                      type="button"
                      onClick={() => onWordClick(word)}
                      disabled={isSelected}
                      className={`px-2 py-1 text-xs font-mono transition-all border ${
                        isSelected
                          ? "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] opacity-40 cursor-not-allowed"
                          : "bg-[var(--editorial-surface)] hover:bg-[var(--editorial-violet-soft)] text-[var(--editorial-ink)] hover:text-[var(--editorial-violet)] border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)] shadow-[1px_1px_0_var(--editorial-rule)]"
                      }`}
                    >
                      + {word}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PromptBuilder;
