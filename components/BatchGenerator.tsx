import React, { useState, useRef, useCallback, useMemo } from "react";
import { generateBatchPrompts, BatchGenerationOptions } from "../services/geminiService";
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
} from "./icons";

interface BatchGeneratorProps {
  onSendToBuilder: (prompt: string) => void;
  onJumpToImage: (prompt: string) => void;
  onSaveToLibrary: (prompt: string) => void;
}

interface ResultCardProps {
  prompt: string;
  index: number;
  copiedIndex: number | null;
  savedIndex: number | null;
  onResultChange: (index: number, newValue: string) => void;
  onCopy: (text: string, index: number) => void;
  onSave: (text: string, index: number) => void;
  onFocus: (index: number) => void;
  onSendToBuilder: (prompt: string) => void;
  onJumpToImage: (prompt: string) => void;
  resultRefs: React.MutableRefObject<(HTMLTextAreaElement | null)[]>;
  animationDelay: number;
}

// Memoized ResultCard with stagger animation
const ResultCard = React.memo(
  ({
    prompt,
    index,
    copiedIndex,
    savedIndex,
    onResultChange,
    onCopy,
    onSave,
    onFocus,
    onSendToBuilder,
    onJumpToImage,
    resultRefs,
    animationDelay,
  }: ResultCardProps) => {
    return (
      <div
        className="batch-result-card group relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-3xl p-1 shadow-sm hover:shadow-xl hover:border-indigo-500/30 transition-all duration-300 flex flex-col animate-stagger"
        style={{ animationDelay: `${animationDelay}ms` }}
      >
        <div className="relative flex-grow">
          <textarea
            ref={(el) => { resultRefs.current[index] = el; }}
            value={prompt}
            onChange={(e) => onResultChange(index, e.target.value)}
            className="w-full h-full min-h-[140px] p-5 bg-transparent rounded-t-3xl text-gray-800 dark:text-gray-200 leading-relaxed resize-none focus:outline-none focus:bg-indigo-50/50 dark:focus:bg-indigo-900/10 transition-colors text-sm md:text-base font-medium"
          />
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="px-2 py-1 bg-black/50 text-white text-[10px] font-bold rounded-full backdrop-blur-sm">
              #{index + 1}
            </span>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-3 bg-gray-50/50 dark:bg-black/20 rounded-b-3xl border-t border-gray-100 dark:border-white/5 flex items-center justify-between gap-2">
          <div className="flex gap-1">
            <button
              onClick={() => onCopy(prompt, index)}
              className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
              title="Copy"
            >
              {copiedIndex === index ? (
                <CheckIcon className="w-4 h-4 text-green-500" />
              ) : (
                <CopyIcon className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => onFocus(index)}
              className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
              title="Edit"
            >
              <PenCircuitIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onSave(prompt, index)}
              className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
              title="Save to Library"
            >
              {savedIndex === index ? (
                <CheckIcon className="w-4 h-4 text-green-500" />
              ) : (
                <FolderIcon className="w-4 h-4" />
              )}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onSendToBuilder(prompt)}
              className="px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              Refine
            </button>
            <button
              onClick={() => onJumpToImage(prompt)}
              className="px-4 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <MagicWandIcon className="w-3.5 h-3.5" /> Generate
            </button>
          </div>
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.prompt === nextProps.prompt &&
      prevProps.copiedIndex === nextProps.copiedIndex &&
      prevProps.savedIndex === nextProps.savedIndex &&
      prevProps.index === nextProps.index
    );
  }
);

const BatchGenerator: React.FC<BatchGeneratorProps> = ({
  onSendToBuilder,
  onJumpToImage,
  onSaveToLibrary,
}) => {
  // --- State ---
  const [basePrompt, setBasePrompt] = useState("");
  const [focusKeywords, setFocusKeywords] = useState<string[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState("");

  // Basic variation options
  const [detailLevel, setDetailLevel] = useState<"minimal" | "balanced" | "elaborate">("balanced");
  const [tone, setTone] = useState<"professional" | "creative" | "dramatic" | "whimsical">("creative");
  const [complexity, setComplexity] = useState<"simple" | "moderate" | "complex">("moderate");
  const [perspective, setPerspective] = useState<"neutral" | "artistic" | "technical" | "cinematic">("artistic");
  const [count, setCount] = useState(3);

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

  const [results, setResults] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);

  const resultRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Memoized constants
  const ART_STYLE_PRESETS = useMemo(() => [
    'Cyberpunk', 'Baroque', 'Synthwave', 'Watercolor', 'Oil Painting',
    'Anime', 'Photorealistic', 'Impressionist', 'Art Nouveau', 'Minimalist',
    'Surrealist', 'Pop Art', 'Gothic', 'Steampunk', 'Fantasy'
  ], []);

  const ASPECT_RATIOS = useMemo(() => ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '2.39:1'], []);

  const PLATFORMS = useMemo(() => [
    { id: 'general', label: 'General' },
    { id: 'midjourney', label: 'Midjourney' },
    { id: 'dalle', label: 'DALL-E 3' },
    { id: 'sdxl', label: 'SDXL' },
    { id: 'flux', label: 'Flux' },
  ], []);

  const PERSONAS = useMemo(() => [
    { id: 'balanced', label: 'Balanced', icon: '⚖️' },
    { id: 'cinematographer', label: 'Cinematographer', icon: '🎬' },
    { id: 'art_director', label: 'Art Director', icon: '🎨' },
    { id: 'storyteller', label: 'Storyteller', icon: '📖' },
  ], []);

  // --- Handlers ---
  const handleAddKeyword = useCallback(() => {
    if (currentKeyword.trim() && !focusKeywords.includes(currentKeyword.trim())) {
      setFocusKeywords(prev => [...prev, currentKeyword.trim()]);
      setCurrentKeyword("");
    }
  }, [currentKeyword, focusKeywords]);

  const handleKeywordKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddKeyword();
    }
  }, [handleAddKeyword]);

  const removeKeyword = useCallback((keywordToRemove: string) => {
    setFocusKeywords(prev => prev.filter((k) => k !== keywordToRemove));
  }, []);

  const toggleLighting = useCallback((lightingType: string) => {
    setLighting(prev =>
      prev.includes(lightingType)
        ? prev.filter(l => l !== lightingType)
        : [...prev, lightingType]
    );
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

  const handleGenerate = useCallback(async () => {
    if (!basePrompt.trim()) return;

    setIsGenerating(true);
    setResults([]);

    try {
      const generated = await generateBatchPrompts({
        basePrompt,
        focusKeywords,
        count,
        detailLevel,
        tone,
        complexity,
        perspective,
        lighting: lighting.length > 0 ? lighting : undefined,
        cameraAngle: cameraAngle || undefined,
        aspectRatio: aspectRatio || undefined,
        artStyle: artStyle || undefined,
        negativePrompt: negativePrompt || undefined,
        promptLength,
        includeHooks,
        targetPlatform,
        // Creative Brain v2 options
        creativeMode,
        narrativeArc,
        visualDensity,
        originalityLevel,
        persona,
      });
      setResults(generated);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  }, [basePrompt, focusKeywords, count, detailLevel, tone, complexity, perspective, lighting, cameraAngle, aspectRatio, artStyle, negativePrompt, promptLength, includeHooks, targetPlatform, creativeMode, narrativeArc, visualDensity, originalityLevel, persona]);

  const handleResultChange = useCallback((index: number, newValue: string) => {
    setResults((prev) => {
      const newResults = [...prev];
      newResults[index] = newValue;
      return newResults;
    });
  }, []);

  const copyToClipboard = useCallback((text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const savePrompt = useCallback(
    (text: string, index: number) => {
      onSaveToLibrary(text);
      setSavedIndex(index);
      setTimeout(() => setSavedIndex(null), 2000);
    },
    [onSaveToLibrary],
  );

  const focusResult = useCallback((index: number) => {
    resultRefs.current[index]?.focus();
  }, []);

  const exportBatch = useCallback(() => {
    if (results.length === 0) return;
    const exportData = {
      timestamp: new Date().toISOString(),
      basePrompt,
      settings: { tone, detailLevel, complexity, perspective, creativeMode, originalityLevel, visualDensity, persona, narrativeArc },
      prompts: results,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-prompts-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, basePrompt, tone, detailLevel, complexity, perspective, creativeMode, originalityLevel, visualDensity, persona, narrativeArc]);

  return (
    <div className="batch-generator-panel w-full lg:h-[calc(100vh-6rem)] h-auto max-w-[1920px] mx-auto flex flex-col lg:flex-row gap-4 sm:gap-6 p-3 sm:p-4 md:p-6 lg:overflow-hidden animate-fade-in">
      {/* --- Left Panel: Advanced Controls --- */}
      <div className="w-full lg:w-80 xl:w-96 2xl:w-[450px] flex-shrink-0 flex flex-col gap-4 sm:gap-5 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl lg:overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
          <BrainCircuitIcon className="w-8 h-8" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pro Studio
          </h2>
        </div>

        {/* Base Concept */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Base Concept
          </label>
          <textarea
            value={basePrompt}
            onChange={(e) => setBasePrompt(e.target.value)}
            placeholder="Describe your core idea in detail..."
            className="w-full h-28 px-4 py-3 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all text-sm"
          />
        </div>

        {/* Quick Presets */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-2">
            <SparklesIcon className="w-4 h-4" /> Quick Presets
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {BATCH_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                className={`preset-card flex-shrink-0 min-w-[100px] flex flex-col items-center gap-1 ${activePreset === preset.id ? 'active' : ''}`}
              >
                <span className="text-lg">{preset.icon}</span>
                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Creative Brain v2 Section */}
        <button
          onClick={() => setShowCreativeBrain(!showCreativeBrain)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-pink-500/10 to-violet-500/10 dark:from-pink-500/20 dark:to-violet-500/20 border border-pink-200 dark:border-pink-500/30 rounded-xl hover:from-pink-500/20 hover:to-violet-500/20 transition-all"
        >
          <span className="text-xs font-bold text-pink-700 dark:text-pink-300 uppercase tracking-wide flex items-center gap-2">
            🧠 Creative Brain v2
          </span>
          {showCreativeBrain ? (
            <ChevronUpIcon className="w-4 h-4 text-pink-500" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-pink-500" />
          )}
        </button>

        {showCreativeBrain && (
          <div className="space-y-4 p-4 bg-gradient-to-br from-pink-50/50 to-violet-50/50 dark:from-pink-900/10 dark:to-violet-900/10 border border-pink-200 dark:border-pink-500/20 rounded-xl animate-fade-in">

            {/* Creative Mode Toggle */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Creative Mode</span>
              <div
                className="creative-mode-switch cursor-pointer"
                data-mode={creativeMode}
                onClick={() => setCreativeMode(creativeMode === 'structured' ? 'experimental' : 'structured')}
              >
                <div className="flex items-center justify-between h-full px-3 relative z-10">
                  <span className={`text-[10px] font-bold transition-colors ${creativeMode === 'structured' ? 'text-white' : 'text-gray-500'}`}>Structured</span>
                  <span className={`text-[10px] font-bold transition-colors ${creativeMode === 'experimental' ? 'text-white' : 'text-gray-500'}`}>Experimental</span>
                </div>
              </div>
            </div>

            {/* Persona Selector */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Creative Persona</span>
              <div className="grid grid-cols-2 gap-2">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPersona(p.id as typeof persona)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200 flex items-center gap-2
                      ${persona === p.id
                        ? "bg-gradient-to-r from-pink-500 to-violet-500 text-white border-transparent shadow-md"
                        : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-pink-400 text-gray-700 dark:text-gray-300"
                      }`}
                  >
                    <span>{p.icon}</span>
                    <span className="truncate">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Narrative Arc */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Narrative Arc</span>
              <div className="narrative-arc-selector">
                {(['establishing', 'tension', 'resolution', 'mixed'] as const).map((arc) => (
                  <button
                    key={arc}
                    onClick={() => setNarrativeArc(arc)}
                    className={`narrative-arc-option capitalize ${narrativeArc === arc ? 'active' : ''}`}
                  >
                    {arc === 'establishing' ? '🌅' : arc === 'tension' ? '⚡' : arc === 'resolution' ? '🌙' : '🎭'} {arc}
                  </button>
                ))}
              </div>
            </div>

            {/* Originality Dial */}
            <div className="space-y-3 originality-dial">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Originality</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${originalityLevel <= 30 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                  originalityLevel <= 60 ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                    originalityLevel <= 85 ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}>
                  {originalityLevel <= 30 ? 'Conservative' : originalityLevel <= 60 ? 'Balanced' : originalityLevel <= 85 ? 'Creative' : 'Avant-Garde'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={originalityLevel}
                onChange={(e) => setOriginalityLevel(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[9px] text-gray-400 font-medium">
                <span>Safe</span>
                <span>Balanced</span>
                <span>Wild</span>
              </div>
            </div>

            {/* Visual Density */}
            <div className="space-y-3 visual-density-slider">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Visual Density</span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{visualDensity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={visualDensity}
                onChange={(e) => setVisualDensity(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[9px] text-gray-400 font-medium">
                <span>Sparse</span>
                <span>Rich</span>
                <span>Dense</span>
              </div>
            </div>
          </div>
        )}

        {/* Variation Focus (Tags) */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Variation Focus
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {focusKeywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium border border-indigo-200 dark:border-indigo-500/30 animate-scale-in"
              >
                {keyword}
                <button
                  onClick={() => removeKeyword(keyword)}
                  className="hover:text-indigo-900 dark:hover:text-white transition-colors"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="relative">
            <input
              type="text"
              value={currentKeyword}
              onChange={(e) => setCurrentKeyword(e.target.value)}
              onKeyDown={handleKeywordKeyDown}
              placeholder="Add style or keyword (e.g. Cinematic)"
              className="w-full px-4 py-3 pr-10 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            <button
              onClick={handleAddKeyword}
              disabled={!currentKeyword.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors disabled:opacity-30"
            >
              <PlusCircleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Compact Variation Options */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide flex items-center gap-2">
            <SlidersIcon className="w-4 h-4" /> Variation Options
          </label>

          <div className="grid grid-cols-2 gap-3">
            {/* Detail Level */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Detail</span>
              <select
                value={detailLevel}
                onChange={(e) => setDetailLevel(e.target.value as typeof detailLevel)}
                className="w-full px-3 py-2 bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="minimal">Minimal</option>
                <option value="balanced">Balanced</option>
                <option value="elaborate">Elaborate</option>
              </select>
            </div>

            {/* Tone */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Tone</span>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as typeof tone)}
                className="w-full px-3 py-2 bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="professional">Professional</option>
                <option value="creative">Creative</option>
                <option value="dramatic">Dramatic</option>
                <option value="whimsical">Whimsical</option>
              </select>
            </div>

            {/* Complexity */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Complexity</span>
              <select
                value={complexity}
                onChange={(e) => setComplexity(e.target.value as typeof complexity)}
                className="w-full px-3 py-2 bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="simple">Simple</option>
                <option value="moderate">Moderate</option>
                <option value="complex">Complex</option>
              </select>
            </div>

            {/* Perspective */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Perspective</span>
              <select
                value={perspective}
                onChange={(e) => setPerspective(e.target.value as typeof perspective)}
                className="w-full px-3 py-2 bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="neutral">Neutral</option>
                <option value="artistic">Artistic</option>
                <option value="technical">Technical</option>
                <option value="cinematic">Cinematic</option>
              </select>
            </div>
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 border border-purple-200 dark:border-purple-500/30 rounded-xl hover:from-purple-500/20 hover:to-pink-500/20 transition-all"
        >
          <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wide flex items-center gap-2">
            <SparklesIcon className="w-4 h-4" /> Advanced Settings
          </span>
          {showAdvanced ? (
            <ChevronUpIcon className="w-4 h-4 text-purple-500" />
          ) : (
            <ChevronDownIcon className="w-4 h-4 text-purple-500" />
          )}
        </button>

        {/* Advanced Settings Panel */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-500/20 rounded-xl animate-fade-in">

            {/* Lighting Styles */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Lighting Style</span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(LIGHTING_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleLighting(key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all duration-200
                      ${lighting.includes(key)
                        ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-transparent shadow-md"
                        : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-yellow-400 text-gray-700 dark:text-gray-300"
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Camera Angle */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Camera Angle</span>
              <select
                value={cameraAngle}
                onChange={(e) => setCameraAngle(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="">Any angle</option>
                {Object.entries(CAMERA_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            {/* Art Style Preset */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Art Style</span>
              <select
                value={artStyle}
                onChange={(e) => setArtStyle(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="">No specific style</option>
                {ART_STYLE_PRESETS.map((style) => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </div>

            {/* Aspect Ratio */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Target Aspect Ratio</span>
              <div className="flex flex-wrap gap-1.5">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(aspectRatio === ratio ? "" : ratio)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all duration-200
                      ${aspectRatio === ratio
                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-transparent shadow-md"
                        : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-cyan-400 text-gray-700 dark:text-gray-300"
                      }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Platform */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Target Platform</span>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setTargetPlatform(p.id as typeof targetPlatform)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all duration-200
                      ${targetPlatform === p.id
                        ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-transparent shadow-md"
                        : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-indigo-400 text-gray-700 dark:text-gray-300"
                      }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Length */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Prompt Length</span>
              <div className="flex gap-2">
                {(["short", "medium", "long"] as const).map((len) => (
                  <button
                    key={len}
                    onClick={() => setPromptLength(len)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all duration-200 capitalize
                      ${promptLength === len
                        ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-transparent shadow-md"
                        : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-green-400 text-gray-700 dark:text-gray-300"
                      }`}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>

            {/* Negative Prompt */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Avoid / Exclude</span>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="e.g. blur, watermark, low quality, text..."
                className="w-full h-16 px-3 py-2 bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
              />
            </div>

            {/* Emotional Hooks Toggle */}
            <div className="flex items-center justify-between py-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Include Emotional Hooks</span>
              <button
                onClick={() => setIncludeHooks(!includeHooks)}
                className={`relative w-11 h-6 rounded-full transition-colors ${includeHooks ? "bg-purple-500" : "bg-gray-300 dark:bg-gray-600"
                  }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${includeHooks ? "translate-x-5" : "translate-x-0"
                    }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Count Slider */}
        <div className="space-y-4 pt-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <SlidersIcon className="w-4 h-4" /> Variations
            </label>
            <span className="px-3 py-1 bg-gray-100 dark:bg-white/10 rounded-full text-xs font-bold text-gray-700 dark:text-white">
              {count}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-600 dark:accent-indigo-400"
          />
          <div className="flex justify-between text-[10px] text-gray-400 uppercase font-bold tracking-wider">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>


        {/* Generate Action */}
        <div className="pt-4 mt-auto">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !basePrompt.trim()}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transform hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <BrainCircuitIcon className="w-5 h-5" /> Generate Variations
              </>
            )}
          </button>
        </div>
      </div>

      {/* --- Right Panel: Enhanced Results --- */}
      <div className="flex-1 flex flex-col md:min-h-0 min-h-[500px] bg-gray-50/50 dark:bg-black/20 rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-white/5 p-3 sm:p-4 md:p-6 lg:overflow-y-auto custom-scrollbar relative">
        {results.length === 0 && !isGenerating ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 opacity-60">
            <div className="w-24 h-24 bg-gray-200 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 animate-float">
              <MagicWandIcon className="w-10 h-10 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Ready to Ideate
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm">
              Configure your settings on the left and hit generate to create
              professional prompt variations.
            </p>
          </div>
        ) : (
          <>
            {/* Export Button */}
            {results.length > 0 && !isGenerating && (
              <div className="flex justify-end mb-4">
                <button
                  onClick={exportBatch}
                  className="btn-export px-4 py-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 transition-all flex items-center gap-2"
                >
                  📥 Export JSON
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 pb-20">
              {/* Loading Skeletons */}
              {isGenerating &&
                Array.from({ length: count }).map((_, i) => (
                  <div
                    key={`skel-${i}`}
                    className="skeleton-batch bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-white/5 shadow-sm h-48"
                    style={{ animationDelay: `${i * 100}ms` }}
                  >
                    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-full mb-3"></div>
                    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-5/6 mb-6"></div>
                    <div className="mt-auto flex gap-2">
                      <div className="w-8 h-8 bg-gray-200 dark:bg-white/10 rounded-lg"></div>
                      <div className="w-8 h-8 bg-gray-200 dark:bg-white/10 rounded-lg"></div>
                    </div>
                  </div>
                ))}

              {/* Result Cards */}
              {results.map((prompt, index) => (
                <ResultCard
                  key={index}
                  index={index}
                  prompt={prompt}
                  copiedIndex={copiedIndex}
                  savedIndex={savedIndex}
                  onResultChange={handleResultChange}
                  onCopy={copyToClipboard}
                  onSave={savePrompt}
                  onFocus={focusResult}
                  onSendToBuilder={onSendToBuilder}
                  onJumpToImage={onJumpToImage}
                  resultRefs={resultRefs}
                  animationDelay={index * 80}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BatchGenerator;
