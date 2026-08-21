import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { ProcessingAnimation } from "./ProcessingAnimation";
import { Platform, Prompt, TokenItem, FormulaSlots, PromptQualityReport, DissectedPrompt } from "../types";
import {
  SMART_WORD_LIBRARY,
  MASTER_FORMULA_ARCHETYPES,
  NEGATIVE_PROMPT_CATEGORIES,
  WILDCARD_TEMPLATES,
  RANDOM_SUBJECTS,
  RANDOM_SETTINGS,
  RANDOM_MOODS,
  RANDOM_STYLES,
} from "../constants";
import {
  aiElaboratePromptWithPersona,
  aiCompressPrompt,
  aiGeneratePromptVariations,
  aiDissectPrompt,
  aiAnalyzePromptQuality,
  aiGenerateSmartNegative,
  aiMolecularRecombination,
  aiQuantumEntropyMutate,
  PROMPT_ENGINEERING_PERSONAS,
} from "../services/geminiService";
import { convertToStructuredPrompt } from "../services/cinematicPromptService";

import {
  CopyIcon,
  CheckIcon,
  ChevronDownIcon,
  XIcon,
  SearchIcon,
  MicIcon,
  MicOffIcon,
  SparklesIcon,
} from "./icons";
import {
  Loader2,
  SlidersHorizontal,
  Dices,
  ScanText,
  ArrowRightLeft,
  Minimize2,
  Undo2,
  Redo2,
  ShieldAlert,
  FlaskConical,
  Atom,
  Dna,
  Zap,
  Cpu,
  Layers,
  Terminal,
  Binary,
  Maximize2,
} from "lucide-react";
import useSpeechToText from "../hooks/useSpeechToText";
import Tooltip from "./Tooltip";

interface PromptBuilderProps {
  prompts: Prompt[];
  setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>;
  initialPrompt: Prompt | null;
}

type BuilderMode = "canvas" | "fusion" | "mutation" | "formula" | "dissect" | "wildcard";
type MobilePane = "canvas" | "params" | "vault";

const PLATFORMS: { id: Platform; label: string; code: string; icon: string; badge: string }[] = [
  { id: Platform.Natural, label: "Natural Language", code: "NATURAL::LLM", icon: "🌐", badge: "Universal" },
  { id: Platform.Midjourney, label: "Midjourney v6.1", code: "MJ::V6.1", icon: "🎨", badge: "--params" },
  { id: Platform.Flux, label: "Flux AI Pro", code: "FLUX::PHYSICS", icon: "⚡", badge: "Physics" },
  { id: Platform.SDXL, label: "SDXL Diffusion", code: "SDXL::LATENT", icon: "🖼️", badge: "Weights" },
  { id: Platform.DallE3, label: "DALL-E 3", code: "DALLE::PROSE", icon: "🤖", badge: "Prose" },
  { id: Platform.Video, label: "Video AI Latent", code: "GEN3::MOTION", icon: "🎥", badge: "Motion" },
];

const ASPECT_RATIOS = [
  { ratio: "1:1", label: "1:1", sub: "Square" },
  { ratio: "16:9", label: "16:9", sub: "Cinemascope" },
  { ratio: "9:16", label: "9:16", sub: "Vertical" },
  { ratio: "4:5", label: "4:5", sub: "Portrait" },
  { ratio: "21:9", label: "21:9", sub: "Anamorphic" },
  { ratio: "3:2", label: "3:2", sub: "35mm Full" },
];

const PROMPT_BUDGET_PRESETS = [
  { label: "500", desc: "Compact", value: 500 },
  { label: "1,000", desc: "Standard", value: 1000 },
  { label: "1,500", desc: "Extended", value: 1500 },
  { label: "2,000", desc: "Master Ultra", value: 2000 },
];

const VIDEO_MOTIONS = [
  "Tracking push-in",
  "360° orbit around subject",
  "Dolly zoom vertigo",
  "FPV drone dive",
  "Handheld camera drift",
  "Slow-motion 120fps fluid",
  "Hyper-lapse atmospheric drift",
];

// Interactive Chip with Token Weight / Valence Modifier
const QuantumTokenChip: React.FC<{
  token: TokenItem;
  onRemove: () => void;
  onWeightChange: (delta: number) => void;
}> = ({ token, onRemove, onWeightChange }) => {
  const [showWeightMenu, setShowWeightMenu] = useState(false);
  const weight = token.weight ?? 1.0;

  const isEmphasized = weight > 1.0;
  const isDeemphasized = weight < 1.0;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium border transition-all select-none relative group ${
        isEmphasized
          ? "bg-[var(--editorial-violet-soft)] border-[var(--editorial-violet)] text-[var(--editorial-ink)] shadow-[2px_2px_0_var(--editorial-violet)]"
          : isDeemphasized
          ? "bg-[var(--editorial-surface)] border-[var(--editorial-rule)] text-[var(--editorial-muted)] opacity-75"
          : "bg-[var(--editorial-surface)] border-[var(--editorial-rule)] text-[var(--editorial-ink)] shadow-[1px_1px_0_var(--editorial-rule)] hover:border-[var(--editorial-violet)]"
      }`}
    >
      <span className="text-[10px] text-[var(--editorial-violet)] font-bold opacity-60">λ</span>
      <span className="cursor-default tracking-tight">{token.text}</span>

      {weight !== 1.0 && (
        <span
          className={`text-[8.5px] px-1 rounded font-mono font-bold ${
            isEmphasized
              ? "bg-[var(--editorial-violet)] text-white"
              : "bg-[var(--editorial-rule)] text-[var(--editorial-muted)]"
          }`}
        >
          {weight.toFixed(1)}Ψ
        </span>
      )}

      {/* Weight Adjuster Trigger */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowWeightMenu(!showWeightMenu);
        }}
        title="Adjust Token Valence / Weight"
        className="text-[var(--editorial-muted)] hover:text-[var(--editorial-violet)] p-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
      >
        <SlidersHorizontal className="w-2.5 h-2.5" />
      </button>

      {/* Remove Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${token.text}`}
        className="p-0.5 text-[var(--editorial-muted)] hover:text-[var(--editorial-coral)] focus:outline-none transition-colors"
      >
        <XIcon className="h-3 w-3" />
      </button>

      {/* Inline Popover for Token Weighting */}
      {showWeightMenu && (
        <div
          className="absolute left-0 bottom-full mb-1 z-30 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] p-2 shadow-2xl flex items-center gap-1.5 animate-pop"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[8.5px] font-mono uppercase text-[var(--editorial-muted)]">Valence</span>
          <button
            type="button"
            onClick={() => onWeightChange(-0.1)}
            className="px-1.5 py-0.5 bg-[var(--editorial-surface)] hover:bg-[var(--editorial-violet-soft)] text-xs font-bold border border-[var(--editorial-rule)]"
          >
            -
          </button>
          <span className="font-mono text-xs font-bold text-[var(--editorial-violet)] min-w-[32px] text-center">
            {weight.toFixed(1)}x
          </span>
          <button
            type="button"
            onClick={() => onWeightChange(0.1)}
            className="px-1.5 py-0.5 bg-[var(--editorial-surface)] hover:bg-[var(--editorial-violet-soft)] text-xs font-bold border border-[var(--editorial-rule)]"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              onWeightChange(1.0 - weight);
              setShowWeightMenu(false);
            }}
            className="text-[8.5px] font-mono px-1 py-0.5 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)] border border-[var(--editorial-rule)] ml-1"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => setShowWeightMenu(false)}
            className="text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)] p-0.5"
          >
            <XIcon className="w-3 h-3" />
          </button>
        </div>
      )}
    </span>
  );
};

// Spectral Oscilloscope & Harmonic Density Visualizer
const SpectralWaveform: React.FC<{ tokenCount: number; charCount: number; maxChars: number; active: boolean }> = ({
  tokenCount,
  charCount,
  maxChars,
  active,
}) => {
  const bars = 24;
  const ratio = Math.min(1, charCount / maxChars);

  return (
    <div className="flex items-center gap-0.5 h-4 px-2 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] overflow-hidden">
      <span className="text-[8px] font-mono text-[var(--editorial-violet)] mr-1.5 font-bold uppercase tracking-wider hidden sm:inline">
        SPECTRAL.λ
      </span>
      {Array.from({ length: bars }).map((_, i) => {
        const barIndexRatio = i / bars;
        const isFilled = barIndexRatio <= ratio;
        const heightPercent = Math.max(
          20,
          Math.min(100, (Math.sin(i * 0.45 + (tokenCount * 0.3)) * 40 + 60) * (isFilled ? 1 : 0.35))
        );
        return (
          <div
            key={i}
            className={`w-1 rounded-none transition-all duration-300 ${
              isFilled
                ? active
                  ? "bg-[var(--editorial-violet)]"
                  : "bg-[var(--editorial-coral)]"
                : "bg-[var(--editorial-rule)]"
            }`}
            style={{ height: `${heightPercent}%` }}
          />
        );
      })}
    </div>
  );
};

const PromptBuilder: React.FC<PromptBuilderProps> = ({
  prompts,
  setPrompts,
  initialPrompt,
}) => {
  const [promptId, setPromptId] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<BuilderMode>("canvas");
  const [mobilePane, setMobilePane] = useState<MobilePane>("canvas");

  // Prompt Size / Capacity Controller (up to 2000 characters)
  const [maxChars, setMaxChars] = useState<number>(1000);

  // Canvas Tokens State
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [inputValue, setInputValue] = useState("");

  // Molecular Fusion State
  const [compoundA, setCompoundA] = useState("Cyberpunk Ronin in neon rain, wet asphalt, volumetric rim lighting");
  const [compoundB, setCompoundB] = useState("Bioluminescent deep sea flora, crystalline glass textures, macro f/2.8");
  const [fusionRatio, setFusionRatio] = useState(50);
  const [isFusing, setIsFusing] = useState(false);
  const [fusionResult, setFusionResult] = useState("");

  // Quantum Mutation State
  const [entropyLevel, setEntropyLevel] = useState(45);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationResult, setMutationResult] = useState("");

  // Formula Matrix State
  const [formulaSlots, setFormulaSlots] = useState<FormulaSlots>({
    subject: "",
    environment: "",
    lighting: "",
    camera: "",
    style: "",
    renderEngine: "",
  });

  // Reverse Dissector State
  const [dissectInput, setDissectInput] = useState("");
  const [isDissecting, setIsDissecting] = useState(false);
  const [dissectedResult, setDissectedResult] = useState<DissectedPrompt | null>(null);

  // Wildcard Matrix State
  const [wildcardTemplate, setWildcardTemplate] = useState<string>(WILDCARD_TEMPLATES[0].template);
  const [wildcardGenerated, setWildcardGenerated] = useState<string>("");

  // Target Platform & Parameters
  const [platform, setPlatform] = useState<Platform>(Platform.Natural);
  const [dimension, setDimension] = useState("16:9");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [stylizeValue, setStylizeValue] = useState(250);
  const [chaosValue, setChaosValue] = useState(0);
  const [weirdValue, setWeirdValue] = useState(0);
  const [styleRaw, setStyleRaw] = useState(false);
  const [tileMode, setTileMode] = useState(false);
  const [videoMotion, setVideoMotion] = useState<string>("");

  const [activeLeftTab, setActiveLeftTab] = useState<"params" | "negative" | "iq">("params");
  const [copied, setCopied] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isHistoryAction = useRef(false);

  // AI Co-Pilot State
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isJsonConverting, setIsJsonConverting] = useState(false);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [isGeneratingSmartNeg, setIsGeneratingSmartNeg] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string>("cinematographer");
  const [creativity, setCreativity] = useState(50);
  const [showAiPopover, setShowAiPopover] = useState(false);

  // Variations & Comparison Modal
  const [variationsModalOpen, setVariationsModalOpen] = useState(false);
  const [variationsList, setVariationsList] = useState<Array<{ title: string; prompt: string; description: string; persona: string }>>([]);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [enhancedResultText, setEnhancedResultText] = useState<string | null>(null);
  const [originalPromptSnapshot, setOriginalPromptSnapshot] = useState<string>("");
  const [enhancedCopied, setEnhancedCopied] = useState(false);

  // Quality Linter State
  const [qualityReport, setQualityReport] = useState<PromptQualityReport | null>(null);
  const [isValidatingQuality, setIsValidatingQuality] = useState(false);

  // Structured JSON Viewer State
  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [structuredData, setStructuredData] = useState<any | null>(null);
  const [rawJsonString, setRawJsonString] = useState<string>("");
  const [jsonCopied, setJsonCopied] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);

  const { isListening, isSupported, startListening } = useSpeechToText(
    (text) => {
      const parts = text.split(" ");
      parts.forEach((p) => {
        if (p.trim()) addToken(p.trim());
      });
    },
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  // Handle Initial Prompt Hydration
  useEffect(() => {
    if (initialPrompt) {
      setPromptId(initialPrompt.id.startsWith("temp-") ? null : initialPrompt.id);

      let text = initialPrompt.text;

      const arMatch = text.match(/--ar\s+([^\s]+)/i);
      if (arMatch) {
        setDimension(arMatch[1]);
        text = text.replace(/--ar\s+[^\s]+/i, "");
      }

      const sMatch = text.match(/--s(?:tylize)?\s+(\d+)/i);
      if (sMatch) {
        setStylizeValue(parseInt(sMatch[1], 10));
        text = text.replace(/--s(?:tylize)?\s+\d+/i, "");
      }

      const cMatch = text.match(/--c(?:haos)?\s+(\d+)/i);
      if (cMatch) {
        setChaosValue(parseInt(cMatch[1], 10));
        text = text.replace(/--c(?:haos)?\s+\d+/i, "");
      }

      const wMatch = text.match(/--w(?:eird)?\s+(\d+)/i);
      if (wMatch) {
        setWeirdValue(parseInt(wMatch[1], 10));
        text = text.replace(/--w(?:eird)?\s+\d+/i, "");
      }

      if (/--style\s+raw/i.test(text)) {
        setStyleRaw(true);
        text = text.replace(/--style\s+raw/i, "");
      }

      if (/--tile/i.test(text)) {
        setTileMode(true);
        text = text.replace(/--tile/i, "");
      }

      const noMatch = text.match(/--no\s+([^--]+)/i);
      if (noMatch) {
        setNegativePrompt(noMatch[1].trim());
        text = text.replace(/--no\s+[^--]+/i, "");
      }

      text = text.replace(/--v\s+[^\s]+/i, "").trim();

      const parts = text.split(/,\s*/).filter(Boolean);
      const newTokens: TokenItem[] = parts.map((p, idx) => ({
        id: `tok_${idx}_${Date.now()}`,
        text: p.trim(),
        weight: 1.0,
      }));
      setTokens(newTokens);
      setPlatform(initialPrompt.platform || Platform.Natural);
    } else {
      handleClear();
    }
  }, [initialPrompt]);

  // Derived Prompt Text from Tokens
  const tokenString = useMemo(() => {
    if (builderMode === "formula") {
      const activeSlots = [
        formulaSlots.subject,
        formulaSlots.environment,
        formulaSlots.lighting,
        formulaSlots.camera,
        formulaSlots.style,
        formulaSlots.renderEngine,
      ].filter(Boolean);
      return activeSlots.join(", ");
    }

    return tokens
      .map((tok) => {
        const weight = tok.weight ?? 1.0;
        if (weight === 1.0) return tok.text;

        if (platform === Platform.Midjourney) {
          return `${tok.text}::${weight.toFixed(1)}`;
        }
        if (platform === Platform.SDXL) {
          return `(${tok.text}:${weight.toFixed(1)})`;
        }
        return weight > 1.0 ? `(emphasis: ${tok.text})` : tok.text;
      })
      .join(", ");
  }, [tokens, builderMode, formulaSlots, platform]);

  // Final Compiled Output
  const finalPrompt = useMemo(() => {
    if (!tokenString.trim()) return "";

    let compiled = tokenString.trim();

    if (platform === Platform.Midjourney) {
      let params = "";
      if (dimension) params += ` --ar ${dimension}`;
      if (stylizeValue !== 250) params += ` --s ${stylizeValue}`;
      if (chaosValue > 0) params += ` --c ${chaosValue}`;
      if (weirdValue > 0) params += ` --w ${weirdValue}`;
      if (styleRaw) params += ` --style raw`;
      if (tileMode) params += ` --tile`;
      params += ` --v 6.1`;
      if (negativePrompt.trim()) params += ` --no ${negativePrompt.trim()}`;
      return `${compiled}${params}`;
    }

    if (platform === Platform.SDXL) {
      if (dimension) compiled += ` [Ratio: ${dimension}]`;
      if (negativePrompt.trim()) compiled += ` | Negative: ${negativePrompt.trim()}`;
      return compiled;
    }

    if (platform === Platform.Flux) {
      if (dimension) compiled += ` [Format: ${dimension}]`;
      return compiled;
    }

    if (platform === Platform.DallE3) {
      if (dimension) compiled += ` [Aspect: ${dimension}]`;
      return compiled;
    }

    if (platform === Platform.Video) {
      let motionPart = videoMotion ? ` [Camera Motion: ${videoMotion}]` : "";
      if (dimension) motionPart += ` [Aspect: ${dimension}]`;
      return `${compiled}${motionPart}`;
    }

    return compiled;
  }, [tokenString, platform, dimension, stylizeValue, chaosValue, weirdValue, styleRaw, tileMode, negativePrompt, videoMotion]);

  const charCount = finalPrompt.length;
  const isOverLimit = charCount > maxChars;

  // Telemetry Metrics
  const latentTension = useMemo(() => {
    const totalValence = tokens.reduce((acc, t) => acc + (t.weight ?? 1.0), 0);
    return (totalValence / Math.max(1, tokens.length)).toFixed(2);
  }, [tokens]);

  // History sync
  useEffect(() => {
    if (isHistoryAction.current) {
      isHistoryAction.current = false;
      return;
    }
    if (!tokenString) return;

    setHistory((prev) => {
      if (prev[prev.length - 1] === tokenString) return prev;
      const next = [...prev.slice(0, historyIndex + 1), tokenString];
      return next.slice(-20);
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 19));
  }, [tokenString]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      isHistoryAction.current = true;
      const prevText = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      const parts = prevText.split(/,\s*/).filter(Boolean);
      setTokens(parts.map((p, idx) => ({ id: `tok_${idx}_${Date.now()}`, text: p, weight: 1.0 })));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isHistoryAction.current = true;
      const nextText = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      const parts = nextText.split(/,\s*/).filter(Boolean);
      setTokens(parts.map((p, idx) => ({ id: `tok_${idx}_${Date.now()}`, text: p, weight: 1.0 })));
    }
  };

  // Live Prompt Quality Analysis (Debounced)
  useEffect(() => {
    if (!tokenString || tokenString.length < 5) {
      setQualityReport(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsValidatingQuality(true);
        const report = await aiAnalyzePromptQuality(tokenString, platform);
        if (isMounted.current) {
          setQualityReport(report as any);
        }
      } catch (err) {
        // silent
      } finally {
        if (isMounted.current) setIsValidatingQuality(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [tokenString, platform]);

  const addToken = (text: string, category?: TokenItem["category"]) => {
    const clean = text.trim();
    if (!clean) return;

    if (tokens.some((t) => t.text.toLowerCase() === clean.toLowerCase())) return;

    if (finalPrompt.length + clean.length + 2 > maxChars) {
      setError(`Cannot add token: Exceeds ${maxChars} character budget.`);
      return;
    }

    setTokens((prev) => [
      ...prev,
      { id: `tok_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, text: clean, weight: 1.0, category },
    ]);
    setInputValue("");
    setError(null);
  };

  const removeToken = (index: number) => {
    setTokens((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleWeightChange = (index: number, delta: number) => {
    setTokens((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const current = t.weight ?? 1.0;
        const next = Math.max(0.2, Math.min(2.5, Math.round((current + delta) * 10) / 10));
        return { ...t, weight: next };
      })
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addToken(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tokens.length > 0) {
      removeToken(tokens.length - 1);
    }
  };

  const handleWordClick = useCallback((word: string) => {
    if (builderMode === "formula") {
      setFormulaSlots((prev) => ({
        ...prev,
        style: prev.style ? `${prev.style}, ${word}` : word,
      }));
    } else {
      addToken(word);
    }
  }, [builderMode, maxChars, finalPrompt.length]);

  const handleFormulaSlotChange = (slot: keyof FormulaSlots, value: string) => {
    setFormulaSlots((prev) => ({ ...prev, [slot]: value }));
  };

  const handleSave = () => {
    if (!finalPrompt.trim()) {
      setError("Please add prompt text before saving.");
      return;
    }
    if (isOverLimit) {
      setError(`Prompt must be under ${maxChars} characters to save.`);
      return;
    }

    const promptToSave: Prompt = {
      id: promptId || `prompt_${Date.now()}`,
      text: finalPrompt,
      platform: platform,
      sourceFeature: "prompt-builder",
      tags: promptId ? (initialPrompt?.tags ?? ["builder"]) : ["builder", "laboratory-spliced"],
      createdAt: new Date().toISOString(),
      originalInput: { tokens, formulaSlots, dimension, platform, negativePrompt, stylizeValue, styleRaw, maxChars },
      version: 2,
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
    setTokens([]);
    setFormulaSlots({
      subject: "",
      environment: "",
      lighting: "",
      camera: "",
      style: "",
      renderEngine: "",
    });
    setInputValue("");
    setDimension("16:9");
    setNegativePrompt("");
    setStylizeValue(250);
    setChaosValue(0);
    setWeirdValue(0);
    setStyleRaw(false);
    setTileMode(false);
    setVideoMotion("");
    setPromptId(null);
    setPlatform(Platform.Natural);
    setQualityReport(null);
    setError(null);
  };

  const handleCopyPrompt = () => {
    if (!finalPrompt) return;
    navigator.clipboard.writeText(finalPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Scientific Laboratory: Molecular Synthesis Action
  const handleRunMolecularFusion = async () => {
    if (isFusing || !compoundA.trim() || !compoundB.trim()) return;
    setIsFusing(true);
    setError(null);

    try {
      const fused = await aiMolecularRecombination(compoundA, compoundB, fusionRatio, maxChars);
      if (isMounted.current && fused) {
        setFusionResult(fused);
      }
    } catch (err: any) {
      if (isMounted.current) setError("Molecular synthesis failed.");
    } finally {
      if (isMounted.current) setIsFusing(false);
    }
  };

  const handleApplyFusionToCanvas = () => {
    if (!fusionResult) return;
    const parts = fusionResult.split(/,\s*/).filter(Boolean);
    setTokens(parts.map((p, idx) => ({ id: `tok_${idx}_${Date.now()}`, text: p, weight: 1.0 })));
    setBuilderMode("canvas");
  };

  // Scientific Laboratory: Quantum Entropy & Genetic Mutation
  const handleRunQuantumMutation = async () => {
    const target = tokenString.trim() || finalPrompt.trim();
    if (isMutating || !target) {
      setError("Please input base tokens to mutate.");
      return;
    }
    setIsMutating(true);
    setError(null);

    try {
      const mutated = await aiQuantumEntropyMutate(target, entropyLevel, maxChars);
      if (isMounted.current && mutated) {
        setMutationResult(mutated);
      }
    } catch (err: any) {
      if (isMounted.current) setError("Quantum mutation failed.");
    } finally {
      if (isMounted.current) setIsMutating(false);
    }
  };

  const handleApplyMutationToCanvas = () => {
    if (!mutationResult) return;
    const parts = mutationResult.split(/,\s*/).filter(Boolean);
    setTokens(parts.map((p, idx) => ({ id: `tok_${idx}_${Date.now()}`, text: p, weight: 1.0 })));
    setBuilderMode("canvas");
  };

  // AI Co-Pilot Actions
  const handleEnhanceWithPersona = async () => {
    if (isEnhancing || !tokenString.trim()) {
      if (!tokenString.trim()) setError("Please enter keywords or a concept to enhance.");
      return;
    }

    setIsEnhancing(true);
    setError(null);
    setShowAiPopover(false);
    setOriginalPromptSnapshot(finalPrompt);

    abortControllerRef.current = new AbortController();

    try {
      const enhanced = await aiElaboratePromptWithPersona(
        tokenString,
        selectedPersona,
        creativity,
        platform,
        maxChars
      );

      if (isMounted.current && enhanced) {
        setEnhancedResultText(enhanced);
        setComparisonModalOpen(true);
      }
    } catch (err: any) {
      if (isMounted.current && err.name !== "AbortError") {
        setError(err.message || "AI enhancement failed.");
      }
    } finally {
      if (isMounted.current) setIsEnhancing(false);
    }
  };

  const handleCompressPrompt = async () => {
    if (isCompressing || !tokenString.trim()) return;
    setIsCompressing(true);
    setError(null);
    setShowAiPopover(false);

    try {
      const compressed = await aiCompressPrompt(tokenString, Math.min(600, maxChars));
      if (isMounted.current && compressed) {
        const parts = compressed.split(/,\s*/).filter(Boolean);
        setTokens(parts.map((p, idx) => ({ id: `tok_${idx}_${Date.now()}`, text: p, weight: 1.0 })));
      }
    } catch (err: any) {
      if (isMounted.current) setError("Prompt compression failed.");
    } finally {
      if (isMounted.current) setIsCompressing(false);
    }
  };

  const handleGenerateVariations = async () => {
    if (isGeneratingVariations || !tokenString.trim()) {
      if (!tokenString.trim()) setError("Please enter prompt keywords to generate variations.");
      return;
    }

    setIsGeneratingVariations(true);
    setError(null);
    setShowAiPopover(false);

    try {
      const vars = await aiGeneratePromptVariations(tokenString, 3, maxChars);
      if (isMounted.current && vars.length > 0) {
        setVariationsList(vars);
        setVariationsModalOpen(true);
      }
    } catch (err: any) {
      if (isMounted.current) setError("Variation generation failed.");
    } finally {
      if (isMounted.current) setIsGeneratingVariations(false);
    }
  };

  const handleGenerateSmartNegative = async () => {
    if (isGeneratingSmartNeg || !tokenString.trim()) return;
    setIsGeneratingSmartNeg(true);

    try {
      const smartNeg = await aiGenerateSmartNegative(tokenString, platform);
      if (isMounted.current && smartNeg) {
        setNegativePrompt(smartNeg);
        setActiveLeftTab("negative");
      }
    } catch (err) {
      // fallback
    } finally {
      if (isMounted.current) setIsGeneratingSmartNeg(false);
    }
  };

  const handleRunDissect = async () => {
    if (isDissecting || !dissectInput.trim()) return;
    setIsDissecting(true);
    setError(null);

    try {
      const result = await aiDissectPrompt(dissectInput);
      if (isMounted.current) {
        setDissectedResult(result);
      }
    } catch (err: any) {
      if (isMounted.current) setError("Prompt dissection failed.");
    } finally {
      if (isMounted.current) setIsDissecting(false);
    }
  };

  const handleApplyDissectedToStudio = () => {
    if (!dissectedResult) return;
    setFormulaSlots({
      subject: dissectedResult.subject,
      environment: dissectedResult.environment,
      lighting: dissectedResult.lighting,
      camera: dissectedResult.camera,
      style: dissectedResult.style,
      renderEngine: dissectedResult.renderEngine,
    });

    const parts = [
      dissectedResult.subject,
      dissectedResult.environment,
      dissectedResult.lighting,
      dissectedResult.camera,
      dissectedResult.style,
      dissectedResult.renderEngine,
    ].filter(Boolean);

    setTokens(parts.map((p, idx) => ({ id: `tok_${idx}_${Date.now()}`, text: p, weight: 1.0 })));

    if (dissectedResult.negativePrompt) {
      setNegativePrompt(dissectedResult.negativePrompt);
    }
    if (dissectedResult.parameters.aspectRatio) {
      setDimension(dissectedResult.parameters.aspectRatio);
    }
    if (dissectedResult.parameters.stylize) {
      setStylizeValue(dissectedResult.parameters.stylize);
    }
    if (dissectedResult.parameters.chaos) {
      setChaosValue(dissectedResult.parameters.chaos);
    }
    if (dissectedResult.parameters.weird) {
      setWeirdValue(dissectedResult.parameters.weird);
    }
    if (dissectedResult.parameters.styleRaw) {
      setStyleRaw(true);
    }

    setBuilderMode("canvas");
    setDissectedResult(null);
    setDissectInput("");
  };

  const handleRollWildcard = () => {
    if (!wildcardTemplate) return;
    const rolled = wildcardTemplate.replace(/\{([^{}]+)\}/g, (_, group) => {
      const choices = group.split("|").map((c: string) => c.trim()).filter(Boolean);
      return choices[Math.floor(Math.random() * choices.length)] || "";
    });
    setWildcardGenerated(rolled);
  };

  const handleApplyWildcard = () => {
    if (!wildcardGenerated) return;
    const parts = wildcardGenerated.split(/,\s*/).filter(Boolean);
    setTokens(parts.map((p, idx) => ({ id: `tok_${idx}_${Date.now()}`, text: p, weight: 1.0 })));
    setBuilderMode("canvas");
  };

  const handleJsonConvert = async () => {
    if (isJsonConverting || !finalPrompt.trim()) return;
    setIsJsonConverting(true);
    setError(null);

    try {
      const result = await convertToStructuredPrompt(tokenString || finalPrompt);
      if (isMounted.current) {
        if (result.success && result.data) {
          setStructuredData(result.data);
          setRawJsonString(JSON.stringify(result.data, null, 2));
          setJsonModalOpen(true);
        } else {
          const fallbackObj = {
            subject: tokenString || finalPrompt,
            enhancedPrompt: result.enhancedPrompt,
            style: "Cinematic",
          };
          setStructuredData(fallbackObj);
          setRawJsonString(JSON.stringify(fallbackObj, null, 2));
          setJsonModalOpen(true);
        }
      }
    } catch (err: any) {
      if (isMounted.current) setError("JSON conversion failed.");
    } finally {
      if (isMounted.current) setIsJsonConverting(false);
    }
  };

  const handleApplyEnhancedResult = () => {
    if (enhancedResultText) {
      const parts = enhancedResultText.split(/,\s*/).filter(Boolean);
      setTokens(parts.map((p, idx) => ({ id: `tok_${idx}_${Date.now()}`, text: p, weight: 1.0 })));
      setComparisonModalOpen(false);
      setEnhancedResultText(null);
    }
  };

  const handleApplyMasterArchetype = (archetype: typeof MASTER_FORMULA_ARCHETYPES[0]) => {
    setFormulaSlots({ ...archetype.slots });
    const parts = Object.values(archetype.slots).filter(Boolean);
    setTokens(parts.map((p, idx) => ({ id: `tok_${idx}_${Date.now()}`, text: p, weight: 1.0 })));
    setPlatform(archetype.platform);
    setDimension(archetype.parameters.aspectRatio);
    setStylizeValue(archetype.parameters.stylize);
    if (archetype.parameters.styleRaw !== undefined) setStyleRaw(archetype.parameters.styleRaw);
    if (archetype.negative) setNegativePrompt(archetype.negative);
    setError(null);
  };

  return (
    <div className="w-full flex flex-col gap-3.5 animate-fade-in font-mono">
      {/* SCIENTIFIC LABORATORY HUD & TELEMETRY BAND */}
      <div className="bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            <span className="font-bold text-[var(--editorial-ink)]">LABORATORY APPARATUS // ONLINE</span>
          </div>
          <span className="text-[var(--editorial-rule)]">|</span>
          <span className="text-[var(--editorial-muted)]">
            VALENCE FLUX: <strong className="text-[var(--editorial-violet)]">{latentTension}Ψ</strong>
          </span>
          <span className="text-[var(--editorial-rule)]">|</span>
          <span className="text-[var(--editorial-muted)]">
            ENTROPY: <strong className="text-[var(--editorial-coral)]">{entropyLevel}%</strong>
          </span>
          <span className="text-[var(--editorial-rule)] hidden sm:inline">|</span>
          <span className="text-[var(--editorial-muted)] hidden sm:inline">
            CAPACITY: <strong className="text-[var(--editorial-ink)]">{maxChars}λ</strong>
          </span>
        </div>

        {/* Live Spectral Frequency Waveform & Dynamic Budget */}
        <div className="flex items-center gap-2">
          <SpectralWaveform
            tokenCount={tokens.length}
            charCount={charCount}
            maxChars={maxChars}
            active={!isOverLimit}
          />
          <span
            className={`px-1.5 py-0.5 border text-[9.5px] font-bold ${
              isOverLimit
                ? "bg-red-500/10 text-red-600 border-red-500"
                : charCount >= maxChars * 0.85
                ? "bg-amber-500/10 text-amber-600 border-amber-500"
                : "bg-[var(--editorial-paper)] text-[var(--editorial-ink)] border-[var(--editorial-rule)]"
            }`}
          >
            {charCount}/{maxChars}λ
          </span>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="flex xl:hidden justify-between items-center bg-[var(--editorial-surface)] p-1 border border-[var(--editorial-rule)]">
        <button
          type="button"
          onClick={() => setMobilePane("canvas")}
          className={`flex-1 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
            mobilePane === "canvas"
              ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
              : "text-[var(--editorial-muted)]"
          }`}
        >
          Workbench
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("params")}
          className={`flex-1 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
            mobilePane === "params"
              ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
              : "text-[var(--editorial-muted)]"
          }`}
        >
          Telemetry
        </button>
        <button
          type="button"
          onClick={() => setMobilePane("vault")}
          className={`flex-1 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
            mobilePane === "vault"
              ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
              : "text-[var(--editorial-muted)]"
          }`}
        >
          Specimen Vault
        </button>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="p-2.5 bg-red-500/10 border border-red-500/30 flex items-center justify-between text-red-600 dark:text-red-400 text-xs font-mono">
          <span className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            {error}
          </span>
          <button onClick={() => setError(null)} className="p-1 hover:text-red-500">
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3-COLUMN PANORAMIC WORKSTATION GRID */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5 lg:gap-4 items-start">

        {/* ==================================================================== */}
        {/* LEFT PANE: OPTICAL BENCH, TELEMETRY & DIRECTIVES (3.5 cols)          */}
        {/* ==================================================================== */}
        <div
          className={`xl:col-span-3 flex-col gap-3.5 ${
            mobilePane === "params" ? "flex" : "hidden xl:flex"
          }`}
        >
          {/* Target Platform Engine */}
          <div className="editorial-panel">
            <div className="editorial-panel__header py-1.5 px-3">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[var(--editorial-violet)]" />
                <span className="font-mono text-xs font-bold text-[var(--editorial-ink)]">Synthesizer Engine</span>
              </div>
              <span className="font-mono text-[9px] text-[var(--editorial-violet)] font-bold uppercase">
                {platform.split(" ")[0]}
              </span>
            </div>
            <div className="p-2 grid grid-cols-3 gap-1">
              {PLATFORMS.map((p) => {
                const isActive = platform === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    className={`p-1.5 flex flex-col items-center justify-center gap-0.5 border text-center transition-all ${
                      isActive
                        ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)] shadow-[1px_1px_0_var(--editorial-violet)]"
                        : "bg-[var(--editorial-surface)] text-[var(--editorial-ink)] border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)]"
                    }`}
                  >
                    <span className="text-xs leading-none">{p.icon}</span>
                    <span className="truncate w-full text-[9px] font-mono uppercase font-bold">
                      {p.label.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Left Tabbed Telemetry & Controls */}
          <div className="editorial-panel flex flex-col">
            <div className="editorial-panel__header py-1 px-2 bg-[var(--editorial-surface)] border-b border-[var(--editorial-rule)]">
              <div className="flex gap-1 w-full">
                <button
                  type="button"
                  onClick={() => setActiveLeftTab("params")}
                  className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase border transition-all ${
                    activeLeftTab === "params"
                      ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                      : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-transparent hover:text-[var(--editorial-ink)]"
                  }`}
                >
                  Optics
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLeftTab("negative")}
                  className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase border transition-all ${
                    activeLeftTab === "negative"
                      ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                      : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-transparent hover:text-[var(--editorial-ink)]"
                  }`}
                >
                  Negative {negativePrompt ? "•" : ""}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLeftTab("iq")}
                  className={`flex-1 py-1 text-[10px] font-mono font-bold uppercase border transition-all ${
                    activeLeftTab === "iq"
                      ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                      : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-transparent hover:text-[var(--editorial-ink)]"
                  }`}
                >
                  Spectral IQ
                </button>
              </div>
            </div>

            <div className="p-3 space-y-3 max-h-[490px] overflow-y-auto custom-scrollbar">
              {/* SUB-TAB 1: OPTICS, PHOTONIC PARAMETERS & CAPACITY CONTROLLER */}
              {activeLeftTab === "params" && (
                <div className="space-y-3">
                  {/* PROMPT SIZE / CAPACITY CONTROLLER (UP TO 2000 CHARACTERS) */}
                  <div className="p-2 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] space-y-1.5">
                    <div className="flex justify-between items-center text-[9.5px] font-mono">
                      <span className="font-bold text-[var(--editorial-ink)] uppercase flex items-center gap-1">
                        <Maximize2 className="w-3 h-3 text-[var(--editorial-violet)]" />
                        Prompt Size Budget
                      </span>
                      <span className="font-bold text-[var(--editorial-violet)]">{maxChars} Chars</span>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-4 gap-1">
                      {PROMPT_BUDGET_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setMaxChars(preset.value)}
                          className={`py-1 px-0.5 text-center border transition-all ${
                            maxChars === preset.value
                              ? "bg-[var(--editorial-violet)] text-white border-[var(--editorial-violet)] font-bold shadow-[1px_1px_0_var(--editorial-violet)]"
                              : "bg-[var(--editorial-surface)] text-[var(--editorial-ink)] border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)]"
                          }`}
                        >
                          <div className="text-[9.5px] leading-tight font-bold">{preset.label}</div>
                          <div className="text-[7.5px] text-[var(--editorial-muted)] opacity-80">{preset.desc}</div>
                        </button>
                      ))}
                    </div>

                    {/* Fine Stepper Slider (300 to 2000) */}
                    <div className="pt-0.5">
                      <input
                        type="range"
                        min="300"
                        max="2000"
                        step="50"
                        value={maxChars}
                        onChange={(e) => setMaxChars(parseInt(e.target.value, 10))}
                        className="editorial-range editorial-range--violet"
                        style={{ "--range-progress": `${((maxChars - 300) / 1700) * 100}%` } as React.CSSProperties}
                      />
                    </div>
                  </div>

                  {/* Aspect Ratio */}
                  <div>
                    <label className="font-mono text-[9.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block mb-1">
                      Sensor &amp; Frame Geometry
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {ASPECT_RATIOS.map((ar) => {
                        const isSelected = dimension === ar.ratio;
                        return (
                          <button
                            key={ar.ratio}
                            type="button"
                            onClick={() => setDimension(ar.ratio)}
                            className={`p-1 text-center border transition-all ${
                              isSelected
                                ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)] font-bold shadow-[1px_1px_0_var(--editorial-coral)]"
                                : "bg-[var(--editorial-surface)] text-[var(--editorial-ink)] border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)]"
                            }`}
                          >
                            <div className="font-mono text-[10.5px] leading-tight">{ar.ratio}</div>
                            <div className="text-[8px] text-[var(--editorial-muted)] font-mono">{ar.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Midjourney Specific Photonic Controls */}
                  {platform === Platform.Midjourney && (
                    <div className="space-y-2.5 pt-2 border-t border-[var(--editorial-rule)]">
                      {/* Stylize */}
                      <div>
                        <div className="flex justify-between items-center text-[9.5px] font-mono mb-0.5">
                          <span className="text-[var(--editorial-muted)] uppercase">Stylize Vector (--s)</span>
                          <span className="font-bold text-[var(--editorial-violet)]">{stylizeValue}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1000"
                          step="25"
                          value={stylizeValue}
                          onChange={(e) => setStylizeValue(parseInt(e.target.value, 10))}
                          className="editorial-range editorial-range--violet"
                          style={{ "--range-progress": `${(stylizeValue / 1000) * 100}%` } as React.CSSProperties}
                        />
                      </div>

                      {/* Chaos */}
                      <div>
                        <div className="flex justify-between items-center text-[9.5px] font-mono mb-0.5">
                          <span className="text-[var(--editorial-muted)] uppercase">Chaos Entropy (--c)</span>
                          <span className="font-bold text-[var(--editorial-violet)]">{chaosValue}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={chaosValue}
                          onChange={(e) => setChaosValue(parseInt(e.target.value, 10))}
                          className="editorial-range editorial-range--violet"
                          style={{ "--range-progress": `${chaosValue}%` } as React.CSSProperties}
                        />
                      </div>

                      {/* Weird */}
                      <div>
                        <div className="flex justify-between items-center text-[9.5px] font-mono mb-0.5">
                          <span className="text-[var(--editorial-muted)] uppercase">Weirdness Drift (--w)</span>
                          <span className="font-bold text-[var(--editorial-violet)]">{weirdValue}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="3000"
                          step="100"
                          value={weirdValue}
                          onChange={(e) => setWeirdValue(parseInt(e.target.value, 10))}
                          className="editorial-range editorial-range--violet"
                          style={{ "--range-progress": `${(weirdValue / 3000) * 100}%` } as React.CSSProperties}
                        />
                      </div>

                      {/* Toggles */}
                      <div className="grid grid-cols-2 gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => setStyleRaw(!styleRaw)}
                          className={`p-1.5 text-[9.5px] font-mono font-bold border transition-all text-center ${
                            styleRaw
                              ? "bg-[var(--editorial-violet)] text-white border-[var(--editorial-violet)]"
                              : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)]"
                          }`}
                        >
                          Style Raw: {styleRaw ? "ON" : "OFF"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTileMode(!tileMode)}
                          className={`p-1.5 text-[9.5px] font-mono font-bold border transition-all text-center ${
                            tileMode
                              ? "bg-[var(--editorial-violet)] text-white border-[var(--editorial-violet)]"
                              : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)]"
                          }`}
                        >
                          Tile Mesh: {tileMode ? "ON" : "OFF"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Video Motion Vector Selector */}
                  {platform === Platform.Video && (
                    <div className="space-y-1.5 pt-2 border-t border-[var(--editorial-rule)]">
                      <label className="font-mono text-[9.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">
                        Kinetic Motion Dynamics
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {VIDEO_MOTIONS.map((vm) => (
                          <button
                            key={vm}
                            type="button"
                            onClick={() => setVideoMotion(videoMotion === vm ? "" : vm)}
                            className={`px-1.5 py-0.5 text-[9.5px] font-mono border transition-all ${
                              videoMotion === vm
                                ? "bg-[var(--editorial-violet)] text-white border-[var(--editorial-violet)] font-bold"
                                : "bg-[var(--editorial-surface)] border-[var(--editorial-rule)] text-[var(--editorial-ink)]"
                            }`}
                          >
                            {videoMotion === vm ? `✓ ${vm}` : `+ ${vm}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 2: NEGATIVE CONTAINMENT CHAMBER */}
              {activeLeftTab === "negative" && (
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[9.5px] font-bold uppercase text-[var(--editorial-muted)]">
                      Exclusion Chamber Field
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateSmartNegative}
                      disabled={isGeneratingSmartNeg || !tokenString.trim()}
                      className="text-[9.5px] font-mono text-[var(--editorial-violet)] hover:underline flex items-center gap-1"
                    >
                      {isGeneratingSmartNeg ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <SparklesIcon className="w-2.5 h-2.5" />}
                      Auto-Contain
                    </button>
                  </div>

                  <input
                    type="text"
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="e.g. blurry, deformed, text, watermark..."
                    className="editorial-input w-full text-xs font-mono"
                  />

                  <div className="space-y-2 pt-1">
                    {Object.entries(NEGATIVE_PROMPT_CATEGORIES).map(([catKey, cat]) => (
                      <div key={catKey} className="space-y-1">
                        <span className="text-[9px] font-mono uppercase text-[var(--editorial-muted)] font-bold">
                          {cat.label}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {cat.items.slice(0, 6).map((neg) => {
                            const isAdded = negativePrompt.toLowerCase().includes(neg.toLowerCase());
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
                                        .filter((s) => s.toLowerCase() !== neg.toLowerCase())
                                        .join(", ")
                                    );
                                  } else {
                                    setNegativePrompt(
                                      negativePrompt
                                        .split(",")
                                        .map((s) => s.trim())
                                        .filter((s) => s.toLowerCase() !== neg.toLowerCase())
                                        .join(", ")
                                    );
                                  }
                                }}
                                className={`px-1.5 py-0.5 text-[9px] font-mono border transition-all ${
                                  isAdded
                                    ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 font-bold"
                                    : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:border-red-500/40"
                                }`}
                              >
                                {isAdded ? `✕ ${neg}` : `+ ${neg}`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: SPECTRAL IQ LINTER */}
              {activeLeftTab === "iq" && (
                <div className="space-y-3">
                  {qualityReport ? (
                    <>
                      <div className="flex items-center justify-between p-2 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                        <span className="font-mono text-xs font-bold text-[var(--editorial-ink)]">Quality Index</span>
                        <span
                          className={`px-2 py-0.5 text-xs font-mono font-bold border ${
                            qualityReport.grade === "S" || qualityReport.grade === "A"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          }`}
                        >
                          Grade {qualityReport.grade} ({qualityReport.overallScore}/100)
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {Object.entries(qualityReport.metrics).map(([k, v]) => (
                          <div key={k} className="space-y-0.5">
                            <div className="flex justify-between text-[9px] font-mono text-[var(--editorial-muted)] uppercase">
                              <span>{k.replace(/([A-Z])/g, " $1")}</span>
                              <span className="font-bold">{v}%</span>
                            </div>
                            <div className="h-1 w-full bg-[var(--editorial-rule)] overflow-hidden">
                              <div className="h-full bg-[var(--editorial-violet)]" style={{ width: `${v}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>

                      {qualityReport.suggestions.length > 0 && (
                        <div className="pt-2 border-t border-[var(--editorial-rule)] space-y-1.5">
                          <span className="text-[9.5px] font-mono uppercase text-[var(--editorial-muted)] font-bold block">
                            Quantum Refinement:
                          </span>
                          {qualityReport.suggestions.map((sug, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                if (sug.quickFixModifier) addToken(sug.quickFixModifier);
                              }}
                              className="w-full text-left p-1.5 text-[10px] font-mono border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] hover:border-[var(--editorial-violet)] text-[var(--editorial-ink)]"
                            >
                              + {sug.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-[10.5px] font-mono text-[var(--editorial-muted)] py-6">
                      Add tokens to generate live spectral quality analysis.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* CENTER PANE: CREATIVE LABORATORY BENCH & INSTRUMENTS (5.5 cols)     */}
        {/* ==================================================================== */}
        <div
          className={`xl:col-span-6 flex-col gap-3.5 ${
            mobilePane === "canvas" ? "flex" : "hidden xl:flex"
          }`}
        >
          {/* Main Laboratory Instrument Workspace Panel */}
          <div className="editorial-panel flex flex-col">
            {/* Mode Instruments Selector */}
            <div className="editorial-panel__header py-1.5 px-3 flex-wrap gap-2 justify-between items-center bg-[var(--editorial-surface)]">
              {/* Instrument Mode Pills */}
              <div className="flex items-center gap-0.5 bg-[var(--editorial-paper)] p-0.5 border border-[var(--editorial-rule)] overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setBuilderMode("canvas")}
                  className={`px-2 py-1 text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 ${
                    builderMode === "canvas"
                      ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
                      : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                  }`}
                >
                  <Atom className="w-3 h-3" />
                  Tokens
                </button>
                <button
                  type="button"
                  onClick={() => setBuilderMode("fusion")}
                  className={`px-2 py-1 text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 ${
                    builderMode === "fusion"
                      ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
                      : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                  }`}
                >
                  <FlaskConical className="w-3 h-3" />
                  Fusion Lab
                </button>
                <button
                  type="button"
                  onClick={() => setBuilderMode("mutation")}
                  className={`px-2 py-1 text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 ${
                    builderMode === "mutation"
                      ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
                      : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                  }`}
                >
                  <Dna className="w-3 h-3" />
                  Mutator
                </button>
                <button
                  type="button"
                  onClick={() => setBuilderMode("formula")}
                  className={`px-2 py-1 text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 ${
                    builderMode === "formula"
                      ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
                      : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  Matrix
                </button>
                <button
                  type="button"
                  onClick={() => setBuilderMode("dissect")}
                  className={`px-2 py-1 text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 ${
                    builderMode === "dissect"
                      ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
                      : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                  }`}
                >
                  <ScanText className="w-3 h-3" />
                  Dissect
                </button>
                <button
                  type="button"
                  onClick={() => setBuilderMode("wildcard")}
                  className={`px-2 py-1 text-[10px] font-mono font-bold uppercase transition-all flex items-center gap-1 ${
                    builderMode === "wildcard"
                      ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] shadow-sm"
                      : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                  }`}
                >
                  <Dices className="w-3 h-3" />
                  Wildcard
                </button>
              </div>

              {/* Status Badge */}
              <span className="text-[9.5px] font-mono text-[var(--editorial-muted)] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--editorial-violet)]" />
                BUDGET: {maxChars}λ
              </span>
            </div>

            {/* INSTRUMENT 1: QUANTUM TOKEN WORKBENCH */}
            {builderMode === "canvas" && (
              <div
                className="p-3.5 overflow-y-auto cursor-text bg-[var(--editorial-surface)] min-h-[175px] max-h-[280px] border-b border-[var(--editorial-rule)] relative custom-scrollbar"
                onClick={() => inputRef.current?.focus()}
              >
                {(isEnhancing || isJsonConverting || isCompressing || isGeneratingVariations) && (
                  <div className="mb-2.5">
                    <ProcessingAnimation
                      variant="compact"
                      theme="violet"
                      title={
                        isJsonConverting
                          ? "Calibrating Structured JSON Coordinates"
                          : isCompressing
                          ? "Quantum Token Densification in Progress"
                          : isGeneratingVariations
                          ? "Synthesizing 3 Parallel Quantum States"
                          : "Neural Semantic Synthesis"
                      }
                      status={`Calibrating tensor dimensions (max: ${maxChars} chars)...`}
                      stages={[
                        "Scanning token valence & subject nucleus...",
                        "Calculating volumetric photon distribution...",
                        "Harmonizing focal lens & material shaders...",
                        "Synthesizing precision platform flags...",
                      ]}
                      stageIntervalMs={1500}
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 items-start content-start">
                  {tokens.length === 0 && !inputValue && !isEnhancing && !isJsonConverting && (
                    <div className="w-full text-center text-[var(--editorial-muted)] pt-7 pointer-events-none text-xs font-mono uppercase tracking-wider select-none">
                      [Select elements from the Specimen Vault or type tokens &amp; press Enter]
                    </div>
                  )}

                  {tokens.map((tok, index) => (
                    <QuantumTokenChip
                      key={tok.id || index}
                      token={tok}
                      onRemove={() => removeToken(index)}
                      onWeightChange={(delta) => handleWeightChange(index, delta)}
                    />
                  ))}

                  <input
                    aria-label="Prompt Input"
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-grow bg-transparent border-none outline-none text-[var(--editorial-ink)] min-w-[120px] py-1 text-xs font-mono placeholder-[var(--editorial-muted)]"
                    maxLength={maxChars - charCount}
                    placeholder={tokens.length === 0 ? "Inject token and press Enter..." : "Add token..."}
                  />
                </div>
              </div>
            )}

            {/* INSTRUMENT 2: MOLECULAR FUSION LAB */}
            {builderMode === "fusion" && (
              <div className="p-3.5 bg-[var(--editorial-surface)] border-b border-[var(--editorial-rule)] space-y-2.5 max-h-[280px] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-[var(--editorial-muted)] block mb-0.5">
                      Compound Alpha (Subject / Motif)
                    </label>
                    <input
                      type="text"
                      value={compoundA}
                      onChange={(e) => setCompoundA(e.target.value)}
                      placeholder="e.g. Cyberpunk samurai in neon rain..."
                      className="editorial-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-[var(--editorial-muted)] block mb-0.5">
                      Compound Beta (Aesthetic / Texture)
                    </label>
                    <input
                      type="text"
                      value={compoundB}
                      onChange={(e) => setCompoundB(e.target.value)}
                      placeholder="e.g. Bioluminescent deep-sea flora..."
                      className="editorial-input w-full text-xs"
                    />
                  </div>
                </div>

                {/* Splicing Ratio Slider */}
                <div>
                  <div className="flex justify-between items-center text-[9.5px] font-mono mb-1">
                    <span className="text-[var(--editorial-muted)] uppercase">
                      Fusion Ratio: <strong className="text-[var(--editorial-ink)]">{100 - fusionRatio}% Alpha</strong> / <strong className="text-[var(--editorial-violet)]">{fusionRatio}% Beta</strong>
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="5"
                    value={fusionRatio}
                    onChange={(e) => setFusionRatio(parseInt(e.target.value, 10))}
                    className="editorial-range editorial-range--violet"
                    style={{ "--range-progress": `${fusionRatio}%` } as React.CSSProperties}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleRunMolecularFusion}
                  disabled={isFusing || !compoundA.trim() || !compoundB.trim()}
                  className="editorial-button editorial-button--sm editorial-button--primary editorial-button--violet w-full justify-center"
                >
                  {isFusing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <FlaskConical className="w-3 h-3 mr-1" />}
                  Synthesize Molecular Hybrid
                </button>

                {fusionResult && (
                  <div className="p-2 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] space-y-1.5 text-xs font-mono animate-slide-up-fade">
                    <span className="font-bold text-[var(--editorial-violet)] text-[10px]">Synthesized Hybrid Molecule:</span>
                    <p className="text-[11px] text-[var(--editorial-ink)] m-0 leading-snug">{fusionResult}</p>
                    <button
                      type="button"
                      onClick={handleApplyFusionToCanvas}
                      className="editorial-button editorial-button--sm editorial-button--secondary mt-1"
                    >
                      Load into Quantum Canvas
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* INSTRUMENT 3: QUANTUM ENTROPY & MUTATION LAB */}
            {builderMode === "mutation" && (
              <div className="p-3.5 bg-[var(--editorial-surface)] border-b border-[var(--editorial-rule)] space-y-2.5 max-h-[280px] overflow-y-auto custom-scrollbar">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[9.5px] font-mono">
                    <span className="text-[var(--editorial-muted)] uppercase">Entropy Perturbation Level</span>
                    <span className="font-bold text-[var(--editorial-coral)]">{entropyLevel}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="95"
                    step="5"
                    value={entropyLevel}
                    onChange={(e) => setEntropyLevel(parseInt(e.target.value, 10))}
                    className="editorial-range editorial-range--coral"
                    style={{ "--range-progress": `${entropyLevel}%` } as React.CSSProperties}
                  />
                  <span className="text-[8.5px] text-[var(--editorial-muted)] block">
                    {entropyLevel < 30 ? "Mode: Subtle harmonic drift" : entropyLevel < 65 ? "Mode: Controlled stylistic mutation" : "Mode: Radical avant-garde divergence"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleRunQuantumMutation}
                  disabled={isMutating || (!tokenString.trim() && !finalPrompt.trim())}
                  className="editorial-button editorial-button--sm editorial-button--primary editorial-button--coral w-full justify-center"
                >
                  {isMutating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Dna className="w-3 h-3 mr-1" />}
                  Inject Quantum Mutation
                </button>

                {mutationResult && (
                  <div className="p-2 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] space-y-1.5 text-xs font-mono animate-slide-up-fade">
                    <span className="font-bold text-[var(--editorial-coral)] text-[10px]">Mutated Specimen Result:</span>
                    <p className="text-[11px] text-[var(--editorial-ink)] m-0 leading-snug">{mutationResult}</p>
                    <button
                      type="button"
                      onClick={handleApplyMutationToCanvas}
                      className="editorial-button editorial-button--sm editorial-button--secondary mt-1"
                    >
                      Use in Token Workbench
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* INSTRUMENT 4: MODULAR FORMULA MATRIX */}
            {builderMode === "formula" && (
              <div className="p-3.5 bg-[var(--editorial-surface)] border-b border-[var(--editorial-rule)] space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-[var(--editorial-muted)] block mb-0.5">
                      01 Subject Nucleus
                    </label>
                    <input
                      type="text"
                      value={formulaSlots.subject}
                      onChange={(e) => handleFormulaSlotChange("subject", e.target.value)}
                      placeholder="e.g. Cybernetic samurai..."
                      className="editorial-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-[var(--editorial-muted)] block mb-0.5">
                      02 Spatial Setting
                    </label>
                    <input
                      type="text"
                      value={formulaSlots.environment}
                      onChange={(e) => handleFormulaSlotChange("environment", e.target.value)}
                      placeholder="e.g. Neon Tokyo alley..."
                      className="editorial-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-[var(--editorial-muted)] block mb-0.5">
                      03 Photonic Spectrum
                    </label>
                    <input
                      type="text"
                      value={formulaSlots.lighting}
                      onChange={(e) => handleFormulaSlotChange("lighting", e.target.value)}
                      placeholder="e.g. Volumetric god rays..."
                      className="editorial-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-[var(--editorial-muted)] block mb-0.5">
                      04 Optical Physics
                    </label>
                    <input
                      type="text"
                      value={formulaSlots.camera}
                      onChange={(e) => handleFormulaSlotChange("camera", e.target.value)}
                      placeholder="e.g. ARRI Alexa, 85mm anamorphic..."
                      className="editorial-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-[var(--editorial-muted)] block mb-0.5">
                      05 Aesthetic Vector
                    </label>
                    <input
                      type="text"
                      value={formulaSlots.style}
                      onChange={(e) => handleFormulaSlotChange("style", e.target.value)}
                      placeholder="e.g. Blade Runner 2049 aesthetic..."
                      className="editorial-input w-full text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-[var(--editorial-muted)] block mb-0.5">
                      06 Shader &amp; Material
                    </label>
                    <input
                      type="text"
                      value={formulaSlots.renderEngine}
                      onChange={(e) => handleFormulaSlotChange("renderEngine", e.target.value)}
                      placeholder="e.g. CineStill 800T, Unreal 5.4..."
                      className="editorial-input w-full text-xs"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const parts = Object.values(formulaSlots).filter(Boolean);
                    setTokens(parts.map((p, idx) => ({ id: `tok_${idx}_${Date.now()}`, text: p, weight: 1.0 })));
                    setBuilderMode("canvas");
                  }}
                  className="editorial-button editorial-button--sm editorial-button--secondary w-full justify-center"
                >
                  <ArrowRightLeft className="w-3 h-3 mr-1" />
                  Sync Matrix into Quantum Workbench
                </button>
              </div>
            )}

            {/* INSTRUMENT 5: REVERSE SPECTROGRAPH (DISSECTOR) */}
            {builderMode === "dissect" && (
              <div className="p-3.5 bg-[var(--editorial-surface)] border-b border-[var(--editorial-rule)] space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar">
                <textarea
                  value={dissectInput}
                  onChange={(e) => setDissectInput(e.target.value)}
                  placeholder="Paste unformatted prompt here (e.g. Cinematic portrait of a cybernetic warrior, volumetric god rays, 85mm lens, Kodachrome --ar 16:9 --s 750 --v 6.1 --no blurry)..."
                  className="editorial-textarea min-h-[65px] text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleRunDissect}
                  disabled={!dissectInput.trim() || isDissecting}
                  className="editorial-button editorial-button--sm editorial-button--primary editorial-button--violet w-full justify-center"
                >
                  {isDissecting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ScanText className="w-3 h-3 mr-1" />}
                  Deconstruct Spectrograph
                </button>

                {dissectedResult && (
                  <div className="p-2 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] space-y-1 text-xs font-mono animate-slide-up-fade">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[var(--editorial-violet)] text-[10px]">Parsed Layers:</span>
                      <button
                        type="button"
                        onClick={handleApplyDissectedToStudio}
                        className="editorial-button editorial-button--sm editorial-button--primary"
                      >
                        Load to Studio
                      </button>
                    </div>
                    <div className="text-[10.5px] text-[var(--editorial-ink)] leading-snug">
                      <strong>Subject:</strong> {dissectedResult.subject}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INSTRUMENT 6: COMBINATORIAL WILDCARD MATRIX */}
            {builderMode === "wildcard" && (
              <div className="p-3.5 bg-[var(--editorial-surface)] border-b border-[var(--editorial-rule)] space-y-2 max-h-[280px] overflow-y-auto custom-scrollbar">
                <textarea
                  value={wildcardTemplate}
                  onChange={(e) => setWildcardTemplate(e.target.value)}
                  className="editorial-textarea min-h-[55px] text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleRollWildcard}
                  className="editorial-button editorial-button--sm editorial-button--primary editorial-button--violet w-full justify-center"
                >
                  <Dices className="w-3 h-3 mr-1" />
                  Roll Combinatorial State
                </button>
                {wildcardGenerated && (
                  <div className="p-2 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] text-xs font-mono space-y-1 animate-slide-up-fade">
                    <p className="m-0 text-[10.5px] text-[var(--editorial-ink)] leading-snug">{wildcardGenerated}</p>
                    <button
                      type="button"
                      onClick={handleApplyWildcard}
                      className="editorial-button editorial-button--sm editorial-button--secondary mt-1"
                    >
                      Use in Workbench
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Action & AI Co-Pilot Laboratory Toolbar */}
            <div className="p-2 bg-[var(--editorial-paper)] flex flex-wrap justify-between items-center gap-1.5">
              <div className="flex items-center gap-1.5">
                {isSupported && (
                  <button
                    type="button"
                    onClick={startListening}
                    className={`editorial-button editorial-button--sm ${
                      isListening ? "bg-red-500 text-white animate-pulse" : "editorial-button--secondary"
                    }`}
                    title={isListening ? "Stop Voice" : "Voice Input"}
                  >
                    {isListening ? <MicOffIcon className="w-3 h-3" /> : <MicIcon className="w-3 h-3" />}
                    <span className="hidden sm:inline">{isListening ? "Recording" : "Dictate"}</span>
                  </button>
                )}

                {/* Undo / Redo */}
                <div className="flex items-center border border-[var(--editorial-rule)] bg-[var(--editorial-surface)]">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="p-1 hover:bg-[var(--editorial-paper)] disabled:opacity-30 text-[var(--editorial-ink)]"
                    title="Undo"
                  >
                    <Undo2 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="p-1 hover:bg-[var(--editorial-paper)] disabled:opacity-30 text-[var(--editorial-ink)] border-l border-[var(--editorial-rule)]"
                    title="Redo"
                  >
                    <Redo2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* AI Transformations Dropdown */}
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAiPopover(!showAiPopover)}
                    disabled={!tokenString.trim() || isEnhancing || isCompressing || isGeneratingVariations}
                    className={`editorial-button editorial-button--sm ${
                      showAiPopover ? "editorial-button--violet" : "editorial-button--primary"
                    }`}
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    <span>Neural Co-Pilot</span>
                    <ChevronDownIcon className="w-2.5 h-2.5 ml-0.5" />
                  </button>

                  {showAiPopover && (
                    <div className="fixed inset-x-0 bottom-0 p-3 bg-[var(--editorial-paper)] border-t border-[var(--editorial-rule)] shadow-2xl z-50 animate-slide-up-fade lg:absolute lg:bottom-full lg:mb-1.5 lg:right-0 lg:left-auto lg:p-3 lg:border lg:w-[290px]">
                      <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-[var(--editorial-rule)]">
                        <span className="font-mono text-[10px] font-bold text-[var(--editorial-ink)] uppercase">
                          Scientific Persona Discipline
                        </span>
                        <button onClick={() => setShowAiPopover(false)} className="text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]">
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-1 mb-2.5">
                        {Object.entries(PROMPT_ENGINEERING_PERSONAS).map(([key, p]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedPersona(key)}
                            className={`p-1 text-left border text-[9.5px] font-mono flex items-center gap-1 transition-all ${
                              selectedPersona === key
                                ? "bg-[var(--editorial-violet)] text-white border-[var(--editorial-violet)] font-bold"
                                : "bg-[var(--editorial-surface)] text-[var(--editorial-ink)] border-[var(--editorial-rule)]"
                            }`}
                          >
                            <span>{p.icon}</span>
                            <span className="truncate">{p.name.split(" ")[0]}</span>
                          </button>
                        ))}
                      </div>

                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={handleEnhanceWithPersona}
                          className="editorial-button editorial-button--primary editorial-button--violet w-full justify-center text-xs"
                        >
                          <SparklesIcon className="w-3 h-3 mr-1" />
                          <span>Elaborate Prompt ({maxChars}λ)</span>
                        </button>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={handleCompressPrompt}
                            className="editorial-button editorial-button--secondary editorial-button--sm justify-center"
                          >
                            <Minimize2 className="w-2.5 h-2.5 mr-1" />
                            <span>Densify</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleGenerateVariations}
                            className="editorial-button editorial-button--secondary editorial-button--sm justify-center"
                          >
                            <Atom className="w-2.5 h-2.5 mr-1" />
                            <span>3 Takes</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Tooltip content="Surprise Me (Deterministic Random Seed)">
                  <button
                    type="button"
                    onClick={() => {
                      const subject = RANDOM_SUBJECTS[Math.floor(Math.random() * RANDOM_SUBJECTS.length)];
                      const setting = RANDOM_SETTINGS[Math.floor(Math.random() * RANDOM_SETTINGS.length)];
                      const mood = RANDOM_MOODS[Math.floor(Math.random() * RANDOM_MOODS.length)];
                      const style = RANDOM_STYLES[Math.floor(Math.random() * RANDOM_STYLES.length)];
                      const randomPrompt = `${subject} ${setting}, ${mood}, ${style}, intricate cinematic composition, dramatic lighting, detailed environment`;
                      const parts = randomPrompt.split(/,\s*/).filter(Boolean);
                      setTokens(parts.map((p, idx) => ({ id: `tok_${idx}_${Date.now()}`, text: p, weight: 1.0 })));
                      setError(null);
                    }}
                    className="editorial-button editorial-button--sm editorial-button--secondary"
                  >
                    <Atom className="w-3 h-3" />
                  </button>
                </Tooltip>

                <Tooltip content="Structured JSON Schema">
                  <button
                    type="button"
                    onClick={handleJsonConvert}
                    disabled={!finalPrompt.trim() || isJsonConverting}
                    className="editorial-button editorial-button--sm editorial-button--secondary"
                  >
                    <Binary className="w-3 h-3" />
                  </button>
                </Tooltip>

                <Tooltip content="Clear Apparatus">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="editorial-button editorial-button--sm editorial-button--quiet"
                  >
                    Clear
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Compiled Live Production Output Specimen Box */}
          {finalPrompt && (
            <div className="editorial-panel animate-slide-up-fade">
              <div className="editorial-panel__header py-1.5 px-3 bg-[var(--editorial-surface)]">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[var(--editorial-coral)]" />
                  <span className="font-mono text-xs font-bold text-[var(--editorial-ink)]">Synthesized Specimen String</span>
                </div>
                <span className="font-mono text-[9.5px] text-[var(--editorial-muted)] uppercase">
                  {platform}
                </span>
              </div>
              <div className="p-3 bg-[var(--editorial-paper)] space-y-2.5">
                <p className="m-0 font-mono text-xs sm:text-[12px] text-[var(--editorial-ink)] leading-relaxed break-words bg-[var(--editorial-surface)] p-2.5 border border-[var(--editorial-rule)] select-all shadow-inner">
                  {finalPrompt}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!finalPrompt.trim() || isOverLimit}
                    className="editorial-button editorial-button--secondary w-full justify-center min-h-[34px]"
                  >
                    {saveFeedback ? (
                      <>
                        <CheckIcon className="w-3.5 h-3.5 text-green-500 mr-1" />
                        <span>Preserved in Vault!</span>
                      </>
                    ) : (
                      <span>{promptId ? "Update Specimen" : "Preserve in Vault"}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    disabled={!finalPrompt.trim() || isOverLimit}
                    className="editorial-button editorial-button--primary w-full justify-center min-h-[34px]"
                  >
                    {copied ? (
                      <>
                        <CheckIcon className="w-3.5 h-3.5 mr-1" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon className="w-3.5 h-3.5 mr-1" />
                        <span>Copy Specimen</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* RIGHT PANE: SPECIMEN ARCHIVES & SMART KNOWLEDGE VAULT (3 cols)      */}
        {/* ==================================================================== */}
        <div
          className={`xl:col-span-3 flex-col gap-3.5 ${
            mobilePane === "vault" ? "flex" : "hidden xl:flex"
          }`}
        >
          <div className="editorial-panel flex flex-col h-full">
            <RightExplorerPanel
              selectedWords={tokens.map((t) => t.text)}
              onWordClick={(word) => handleWordClick(word)}
              onApplyArchetype={(archetype) => handleApplyMasterArchetype(archetype)}
            />
          </div>
        </div>
      </div>

      {/* 3-VARIATIONS GENERATOR MODAL */}
      {variationsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-mono">
          <div className="editorial-panel p-4 sm:p-5 max-w-2xl w-full shadow-2xl animate-pop max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-[var(--editorial-rule)]">
              <div className="flex items-center gap-2">
                <span className="editorial-badge editorial-badge--violet">AI Matrix</span>
                <h3 className="editorial-panel__title m-0 text-sm sm:text-base">3 Parallel Quantum States</h3>
              </div>
              <button
                type="button"
                onClick={() => setVariationsModalOpen(false)}
                className="p-1 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 mb-3">
              {variationsList.map((v, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)] transition-all space-y-1.5"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs font-bold text-[var(--editorial-violet)]">
                      {v.persona} • {v.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const parts = v.prompt.split(/,\s*/).filter(Boolean);
                        setTokens(parts.map((p, i) => ({ id: `tok_${i}_${Date.now()}`, text: p, weight: 1.0 })));
                        setVariationsModalOpen(false);
                      }}
                      className="editorial-button editorial-button--sm editorial-button--primary"
                    >
                      Use State
                    </button>
                  </div>
                  <p className="font-mono text-xs text-[var(--editorial-ink)] m-0 leading-relaxed">{v.prompt}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* COMPARISON MODAL */}
      {comparisonModalOpen && enhancedResultText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-mono">
          <div className="editorial-panel p-4 sm:p-5 max-w-2xl w-full shadow-2xl animate-pop max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-[var(--editorial-rule)]">
              <div className="flex items-center gap-2">
                <span className="editorial-badge editorial-badge--violet">AI Elaborate</span>
                <h3 className="editorial-panel__title m-0 text-sm sm:text-base">Compare Quantum States</h3>
              </div>
              <button onClick={() => setComparisonModalOpen(false)} className="p-1 text-[var(--editorial-muted)]">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                <span className="font-mono text-[9.5px] font-bold text-[var(--editorial-muted)] uppercase block mb-1.5">Original Specimen</span>
                <p className="font-mono text-xs text-[var(--editorial-ink)] m-0">{originalPromptSnapshot}</p>
              </div>
              <div className="p-3 bg-[var(--editorial-violet-soft)] border border-[var(--editorial-violet)]">
                <span className="font-mono text-[9.5px] font-bold text-[var(--editorial-violet)] uppercase block mb-1.5">Elaborated State</span>
                <p className="font-mono text-xs text-[var(--editorial-ink)] font-medium m-0">{enhancedResultText}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-[var(--editorial-rule)]">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(enhancedResultText);
                  setEnhancedCopied(true);
                  setTimeout(() => setEnhancedCopied(false), 1500);
                }}
                className="editorial-button editorial-button--secondary editorial-button--sm"
              >
                {enhancedCopied ? <CheckIcon className="w-3.5 h-3.5 text-green-500 mr-1" /> : <CopyIcon className="w-3.5 h-3.5 mr-1" />}
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
                  Use Elaborated
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STRUCTURED JSON SCHEMA MODAL */}
      {jsonModalOpen && structuredData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-mono">
          <div className="editorial-panel p-4 sm:p-5 max-w-2xl w-full shadow-2xl animate-pop flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-[var(--editorial-rule)]">
              <div className="flex items-center gap-2">
                <span className="editorial-badge editorial-badge--teal">JSON SCHEMA</span>
                <h3 className="editorial-panel__title m-0 text-sm sm:text-base">Structured Tensor Coordinates</h3>
              </div>
              <button onClick={() => setJsonModalOpen(false)} className="p-1 text-[var(--editorial-muted)]">
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto bg-black text-gray-200 font-mono text-xs my-2 p-3 border border-[var(--editorial-rule)] custom-scrollbar">
              <pre>{rawJsonString}</pre>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-[var(--editorial-rule)]">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(rawJsonString);
                  setJsonCopied(true);
                  setTimeout(() => setJsonCopied(false), 1500);
                }}
                className="editorial-button editorial-button--secondary editorial-button--sm"
              >
                {jsonCopied ? <CheckIcon className="w-3.5 h-3.5 text-green-500 mr-1" /> : <CopyIcon className="w-3.5 h-3.5 mr-1" />}
                <span>Copy JSON</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (structuredData?.enhancedPrompt) {
                    const parts = structuredData.enhancedPrompt.split(/,\s*/).filter(Boolean);
                    setTokens(parts.map((p: string, idx: number) => ({ id: `tok_${idx}_${Date.now()}`, text: p, weight: 1.0 })));
                  }
                  setJsonModalOpen(false);
                }}
                className="editorial-button editorial-button--primary editorial-button--sm"
              >
                Apply to Workbench
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// RIGHT EXPLORER: SPECIMEN KEYWORDS & MASTER ARCHETYPES
// ============================================================================

const RightExplorerPanel: React.FC<{
  selectedWords: string[];
  onWordClick: (word: string) => void;
  onApplyArchetype: (archetype: typeof MASTER_FORMULA_ARCHETYPES[0]) => void;
}> = ({ selectedWords, onWordClick, onApplyArchetype }) => {
  const [activeTab, setActiveTab] = useState<"keywords" | "archetypes">("keywords");

  return (
    <>
      <div className="editorial-panel__header py-1.5 px-3 bg-[var(--editorial-surface)]">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("keywords")}
            className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider border transition-all ${
              activeTab === "keywords"
                ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-transparent hover:text-[var(--editorial-ink)]"
            }`}
          >
            Specimens
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("archetypes")}
            className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider border transition-all ${
              activeTab === "archetypes"
                ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-transparent hover:text-[var(--editorial-ink)]"
            }`}
          >
            Blueprints
          </button>
        </div>
      </div>

      <div className="p-3 overflow-y-auto max-h-[520px] custom-scrollbar flex-grow font-mono">
        {activeTab === "keywords" && (
          <SmartWordLibrary selectedWords={selectedWords} onWordClick={onWordClick} />
        )}
        {activeTab === "archetypes" && (
          <MasterArchetypeLibrary onSelectArchetype={onApplyArchetype} />
        )}
      </div>
    </>
  );
};

const MasterArchetypeLibrary: React.FC<{
  onSelectArchetype: (archetype: typeof MASTER_FORMULA_ARCHETYPES[0]) => void;
}> = ({ onSelectArchetype }) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return MASTER_FORMULA_ARCHETYPES;
    const q = search.toLowerCase();
    return MASTER_FORMULA_ARCHETYPES.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="flex flex-col gap-2.5 font-mono">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter blueprints..."
          className="editorial-input w-full pl-7 text-xs font-mono py-1"
        />
        <SearchIcon className="w-3 h-3 text-[var(--editorial-muted)] absolute left-2 top-1/2 -translate-y-1/2" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--editorial-muted)]">
            <XIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filtered.map((arch) => (
          <div
            key={arch.id}
            className="p-2 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)] transition-all space-y-1"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{arch.icon}</span>
                <span className="font-mono text-xs font-bold text-[var(--editorial-ink)] truncate max-w-[160px]">
                  {arch.name}
                </span>
              </div>
              <span className="text-[8.5px] font-mono text-[var(--editorial-muted)] border border-[var(--editorial-rule)] px-1">
                {arch.parameters.aspectRatio}
              </span>
            </div>

            <p className="font-mono text-[10px] text-[var(--editorial-muted)] m-0 line-clamp-2">
              {arch.description}
            </p>

            <button
              type="button"
              onClick={() => onSelectArchetype(arch)}
              className="editorial-button editorial-button--sm editorial-button--secondary w-full justify-center text-[10px] mt-1"
            >
              <span>Load Blueprint</span>
            </button>
          </div>
        ))}
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
  const [activeCategory, setActiveCategory] = useState<string>(categories[0] || "Art Styles & Movements");

  const subcategorySections = useMemo(() => {
    const rawCategoryData =
      (SMART_WORD_LIBRARY as Record<string, Record<string, string[]>>)[activeCategory] || {};
    const q = search.trim().toLowerCase();

    if (!q) {
      return Object.entries(rawCategoryData).map(([subCatName, words]) => ({
        subCatName,
        words,
      }));
    }

    const matchingSections: { subCatName: string; words: string[] }[] = [];
    for (const [subCatName, words] of Object.entries(rawCategoryData)) {
      const matched = words.filter((w) => w.toLowerCase().includes(q));
      if (matched.length > 0) {
        matchingSections.push({ subCatName, words: matched });
      }
    }

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
    <div className="flex flex-col gap-2.5 font-mono">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter specimens..."
          className="editorial-input w-full pl-7 text-xs font-mono py-1"
        />
        <SearchIcon className="w-3 h-3 text-[var(--editorial-muted)] absolute left-2 top-1/2 -translate-y-1/2" />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
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
            className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider border transition-all ${
              activeCategory === cat && !search
                ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-ink)]"
            }`}
          >
            {cat.split(" ")[0]}
          </button>
        ))}
      </div>

      {/* Subcategory Sections with Words */}
      <div className="space-y-3 pt-1">
        {subcategorySections.length === 0 ? (
          <div className="text-center text-xs font-mono text-[var(--editorial-muted)] py-4">
            No specimens matched.
          </div>
        ) : (
          subcategorySections.map(({ subCatName, words }) => (
            <div key={subCatName} className="space-y-1">
              <div className="text-[8.5px] font-mono font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                {subCatName}
              </div>
              <div className="flex flex-wrap gap-1">
                {words.map((word) => {
                  const isSelected = selectedWords.includes(word);
                  return (
                    <button
                      key={word}
                      type="button"
                      onClick={() => onWordClick(word)}
                      disabled={isSelected}
                      className={`px-1.5 py-0.5 text-[10px] font-mono transition-all border ${
                        isSelected
                          ? "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] opacity-40 cursor-not-allowed"
                          : "bg-[var(--editorial-surface)] hover:bg-[var(--editorial-violet-soft)] text-[var(--editorial-ink)] hover:text-[var(--editorial-violet)] border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)]"
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
