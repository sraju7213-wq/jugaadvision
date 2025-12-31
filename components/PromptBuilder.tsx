import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { Platform, Prompt } from "../types";
import { SMART_WORD_LIBRARY, RANDOM_SUBJECTS, RANDOM_SETTINGS, RANDOM_MOODS, RANDOM_STYLES } from "../constants";
import { enhancePromptWithCreativity } from "../services/geminiService";
import { convertToStructuredPrompt } from "../services/cinematicPromptService";

import {
  CopyIcon,
  CheckIcon,
  ChevronDownIcon,
  SlidersIcon,
  TrashIcon,
  XIcon,
  FolderIcon,
  SearchIcon,
  ImagePlusIcon,
  MicIcon,
  MicOffIcon,
  HistoryIcon,
  TemplateIcon,
  MagicWandIcon,
  SparklesIcon,
  BrainCircuitIcon,
} from "./icons";
import useSpeechToText from "../hooks/useSpeechToText";
import Tooltip from "./Tooltip";

interface PromptBuilderProps {
  prompts: Prompt[];
  setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>;
  initialPrompt: Prompt | null;
  onJumpToImage: (prompt: string) => void;
}

const MAX_CHARS = 1000;

const Chip: React.FC<{ text: string; onRemove?: () => void }> = ({
  text,
  onRemove,
}) => (
  <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-medium bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 animate-pop hover:shadow-md transition-all cursor-default backdrop-blur-sm">
    {text}
    {onRemove && (
      <button
        onClick={onRemove}
        aria-label={`Remove ${text}`}
        className="ml-2 p-0.5 rounded-full hover:bg-red-500/20 hover:text-red-500 focus:outline-none transition-colors"
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
  onJumpToImage,
}) => {
  const [promptId, setPromptId] = useState<string | null>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [platform, setPlatform] = useState<Platform>(Platform.Natural);
  const [dimension, setDimension] = useState("");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creativity, setCreativity] = useState(50);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isJsonConverting, setIsJsonConverting] = useState(false);
  const [showEnhancePanel, setShowEnhancePanel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Mounted ref for cleanup - prevents state updates on unmounted component
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
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
      const textWithoutParams = initialPrompt.text
        .replace(/--ar \S+/, "")
        .trim();
      const parts = textWithoutParams.split(/,\s*/).filter(Boolean);
      setChips(parts);
      setPlatform(initialPrompt.platform);
      const arMatch = initialPrompt.text.match(/--ar (\S+)/);
      setDimension(arMatch ? arMatch[1] : "");
    } else {
      handleClear();
    }
  }, [initialPrompt]);

  const promptText = useMemo(() => chips.join(", "), [chips]);
  const finalPrompt = useMemo(
    () =>
      platform === Platform.Midjourney && dimension
        ? `${promptText} --ar ${dimension}`
        : promptText,
    [promptText, platform, dimension],
  );
  const charCount = finalPrompt.length;

  const addChip = (text: string) => {
    if (
      !text.trim() ||
      chips.includes(text.trim()) ||
      promptText.length + text.length + 2 > MAX_CHARS
    )
      return;
    setChips([...chips, text.trim()]);
    setInputValue("");
  };

  const removeChip = (index: number) =>
    setChips(chips.filter((_, i) => i !== index));

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
  const handleTemplateSelect = (template: string) =>
    setChips(template.split(/,\s*/).filter(Boolean));

  const handleSave = () => {
    if (!finalPrompt) return;
    const promptToSave: Prompt = {
      id: promptId || `prompt_${Date.now()}`,
      text: finalPrompt,
      platform: platform,
      tags: promptId ? (initialPrompt?.tags ?? []) : [],
      createdAt: new Date().toISOString(),
    };
    if (promptId)
      setPrompts(prompts.map((p) => (p.id === promptId ? promptToSave : p)));
    else {
      setPrompts([promptToSave, ...prompts]);
      setPromptId(promptToSave.id);
    }
  };

  const handleClear = () => {
    setChips([]);
    setInputValue("");
    setDimension("");
    setPromptId(null);
    setPlatform(Platform.Natural);
  };

  const handleCopyPrompt = () => {
    if (!finalPrompt) return;
    navigator.clipboard.writeText(finalPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleEnhance = async () => {
    // Prevent double clicks
    if (isEnhancing) return;
    if (!finalPrompt) return;

    setIsEnhancing(true);
    setError(null);

    try {
      const enhanced = await enhancePromptWithCreativity(finalPrompt, creativity);

      if (isMounted.current) {
        const parts = enhanced.split(/,\s*/).filter(Boolean);
        setChips(parts);
      }
    } catch (err) {
      console.error('Enhancement failed:', err);
      if (isMounted.current) {
        setError("AI is busy. Please try again.");
      }
    } finally {
      // THIS IS CRITICAL - It must run no matter what
      if (isMounted.current) {
        setIsEnhancing(false);
        setShowEnhancePanel(false);
      }
    }
  };

  const handleJsonConvert = async () => {
    if (isJsonConverting || !finalPrompt) return;
    setIsJsonConverting(true);
    setError(null);

    try {
      const result = await convertToStructuredPrompt(finalPrompt);
      if (isMounted.current) {
        if (result.success) {
          const parts = result.enhancedPrompt.split(/,\s*/).filter(Boolean);
          setChips(parts);
        } else {
          setError("JSON conversion failed. Please try again.");
        }
      }
    } catch (err) {
      console.error('JSON conversion failed:', err);
      if (isMounted.current) {
        setError("AI is busy. Please try again.");
      }
    } finally {
      if (isMounted.current) {
        setIsJsonConverting(false);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-6 min-h-[calc(100vh-6rem)] animate-slide-up-fade">
      <div className="col-span-1 lg:col-span-8 flex flex-col gap-4">
        {/* Prompt Input Box */}
        <div className="flex-grow flex flex-col bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden relative group hover:shadow-indigo-500/5 transition-all duration-300">
          <div className="p-4 border-b border-gray-200 dark:border-white/5 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="w-1.5 h-5 bg-indigo-500 rounded-full shadow-sm"></div>{" "}
              Prompt Builder
            </h2>
            <span
              className={`text-xs font-mono px-3 py-1 rounded-full border ${charCount >= MAX_CHARS ? "text-red-400 border-red-500/30" : "text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10"}`}
            >
              {charCount}/{MAX_CHARS} chars
            </span>
          </div>

          <div
            className="flex-grow p-6 overflow-y-auto cursor-text bg-white/50 dark:bg-black/20 relative min-h-[200px] max-h-[400px]"
            onClick={() => inputRef.current?.focus()}
          >
            <div className="flex flex-wrap gap-2 items-start content-start">
              {chips.length === 0 && !inputValue && (
                <div className="w-full text-center text-gray-400 pt-8 pointer-events-none">
                  Start typing or select words...
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
                className="flex-grow bg-transparent border-none outline-none text-gray-900 dark:text-white min-w-[100px] py-1.5 text-sm font-medium placeholder-gray-400"
                maxLength={MAX_CHARS - charCount}
              />
            </div>
          </div>

          <div className="p-2 sm:p-3 border-t border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center gap-2">
              {isSupported && (
                <Tooltip
                  content={isListening ? "Stop Listening" : "Voice Input"}
                >
                  <button
                    onClick={startListening}
                    aria-label={
                      isListening ? "Stop listening" : "Start voice input"
                    }
                    className={`px-2 sm:px-4 py-2 rounded-2xl transition-all shadow-md hover:scale-105 active:scale-95 flex items-center justify-center gap-1 sm:gap-2 font-bold text-xs ${isListening ? "bg-red-500 animate-pulse text-white" : "bg-gradient-cta text-white"}`}
                  >
                    {isListening ? (
                      <MicOffIcon className="w-5 h-5" />
                    ) : (
                      <MicIcon className="w-5 h-5" />
                    )}
                    {isListening ? "" : <span className="hidden sm:inline">Speak</span>}
                  </button>
                </Tooltip>
              )}
              <button
                onClick={() => setIsLibraryOpen(!isLibraryOpen)}
                aria-label="Toggle Library"
                className="lg:hidden p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"
              >
                <FolderIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {/* Enhance Button with Panel */}
              <div className="relative">
                <Tooltip content="AI Enhance Prompt">
                  <button
                    onClick={() => setShowEnhancePanel(!showEnhancePanel)}
                    disabled={!finalPrompt || isEnhancing}
                    className={`px-2 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1 sm:gap-1.5 ${showEnhancePanel ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg' : 'bg-gradient-to-r from-amber-400 to-orange-400 text-white hover:shadow-lg'} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <SparklesIcon className="w-4 h-4" />
                    {isEnhancing ? 'Enhancing...' : 'Enhance'}
                  </button>
                </Tooltip>
                {showEnhancePanel && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 p-3 sm:p-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[280px] max-w-[320px] z-50 animate-slide-up-fade">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Creativity Level</span>
                      <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full text-xs font-bold">{creativity}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={creativity}
                      onChange={(e) => setCreativity(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1 mb-3">
                      <span>Conservative</span>
                      <span>Balanced</span>
                      <span>Creative</span>
                    </div>
                    <button
                      onClick={handleEnhance}
                      disabled={isEnhancing}
                      className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      {isEnhancing ? 'Enhancing...' : '✨ Apply Enhancement'}
                    </button>
                  </div>
                )}
              </div>
              {/* JSON Convert Button */}
              <Tooltip content="Convert to JSON-enhanced prompt (max 1000 chars)">
                <button
                  onClick={handleJsonConvert}
                  disabled={!finalPrompt || isJsonConverting}
                  className={`px-2 sm:px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1 sm:gap-1.5 ${isJsonConverting
                      ? 'bg-cyan-500/20 text-cyan-500 animate-pulse'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-lg hover:shadow-cyan-500/30'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <BrainCircuitIcon className="w-4 h-4" />
                  {isJsonConverting ? 'Converting...' : 'JSON'}
                </button>
              </Tooltip>
              <Tooltip content="Surprise Me! (Random Prompt)">
                <button
                  onClick={() => {
                    const subject = RANDOM_SUBJECTS[Math.floor(Math.random() * RANDOM_SUBJECTS.length)];
                    const setting = RANDOM_SETTINGS[Math.floor(Math.random() * RANDOM_SETTINGS.length)];
                    const mood = RANDOM_MOODS[Math.floor(Math.random() * RANDOM_MOODS.length)];
                    const style = RANDOM_STYLES[Math.floor(Math.random() * RANDOM_STYLES.length)];
                    const randomPrompt = `${subject} ${setting}, ${mood}, ${style}`;
                    setChips(randomPrompt.split(/,\s*/).filter(Boolean));
                  }}
                  aria-label="Generate Random Prompt"
                  className="px-2 sm:px-4 py-2 text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg rounded-xl transition-all flex items-center gap-1 sm:gap-1.5"
                >
                  <MagicWandIcon className="w-4 h-4" />
                  Surprise Me
                </button>
              </Tooltip>
              <Tooltip content="Clear All">
                <button
                  onClick={handleClear}
                  aria-label="Clear Prompt"
                  className="px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                >
                  Clear
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleSave}
            className="w-full py-3 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white rounded-2xl font-bold text-sm transition-all shadow-sm border border-transparent dark:border-white/5"
          >
            {promptId ? "Update" : "Save"}
          </button>
          <button
            onClick={handleCopyPrompt}
            disabled={!finalPrompt}
            className="w-full py-3 bg-white/50 dark:bg-white/10 hover:bg-white/70 dark:hover:bg-white/20 text-gray-900 dark:text-white rounded-2xl font-bold text-sm transition-all shadow-sm border border-gray-200 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copied ? "Copied" : "Copy Prompt"}
          </button>
          <button
            onClick={() => onJumpToImage(finalPrompt)}
            disabled={!finalPrompt}
            className="w-full py-3 bg-gradient-cta text-white hover:shadow-lg rounded-2xl font-bold text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Generate Image
          </button>
        </div>
      </div>

      {/* Right Panel (Library) */}
      <div
        className={`col-span-1 lg:col-span-4 h-auto lg:h-auto bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col transition-all duration-500 overflow-hidden ${isLibraryOpen ? "max-h-[600px] opacity-100" : "max-h-0 lg:max-h-none lg:opacity-100 opacity-0"} lg:block`}
      >
        <RightPanel
          onWordClick={handleWordClick}
          onTemplateSelect={handleTemplateSelect}
          selectedWords={chips}
          onClose={() => setIsLibraryOpen(false)}
        />
      </div>
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
      <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl">
          <button
            onClick={() => setActiveTab("library")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "library" ? "bg-white dark:bg-white/10 shadow text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
          >
            Library
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === "templates" ? "bg-white dark:bg-white/10 shadow text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}`}
          >
            Templates
          </button>
        </div>
        <button
          onClick={onClose}
          aria-label="Close Library"
          className="lg:hidden text-gray-500 dark:text-gray-400"
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
    "Wes Anderson": "Wes Anderson style, symmetrical composition, pastel colors, quirky, whimsical",
    "Christopher Nolan": "Christopher Nolan style, IMAX quality, dark tones, realistic, epic scope",
    "Tarantino": "Quentin Tarantino style, intense close-ups, dramatic colors, dynamic composition",
    "Horror": "horror movie scene, eerie atmosphere, dim lighting, suspenseful, fear-inducing",
  },
  "🎨 Art Styles": {
    "Oil Painting": "oil painting, visible brushstrokes, rich colors, classical technique, canvas texture",
    "Watercolor": "watercolor painting, soft edges, translucent layers, delicate, flowing colors",
    "Digital Art": "digital art, vibrant colors, sharp details, modern illustration, trending on ArtStation",
    "Anime": "anime style, vibrant colors, cel shading, dynamic pose, Studio Ghibli inspired",
    "Pop Art": "pop art style, bold colors, comic dots, Andy Warhol inspiration, graphic design",
    "Impressionist": "impressionist painting, Claude Monet style, light play, soft brushwork, dreamy",
    "Art Nouveau": "art nouveau style, flowing organic forms, decorative elements, elegant curves",
  },
  "🔮 Fantasy & Sci-Fi": {
    "Dark Fantasy": "dark fantasy, ominous atmosphere, gothic architecture, mystical, dramatic lighting",
    "Ethereal": "ethereal, glowing particles, soft light, dreamlike, magical atmosphere",
    "Steampunk": "steampunk style, brass gears, Victorian aesthetic, industrial fantasy, sepia tones",
    "Cyberpunk": "cyberpunk aesthetic, neon lights, rain-slicked streets, futuristic city, tech noir",
    "Fairy Tale": "fairy tale illustration, enchanted forest, magical creatures, whimsical, storybook style",
    "Space Opera": "space opera, vast galaxies, starships, alien worlds, epic cosmic scale",
    "Post-Apocalyptic": "post-apocalyptic landscape, ruins, survival theme, atmospheric, gritty realism",
  },
  "👤 Portraits & People": {
    "Character Design": "character design, detailed features, unique costume, expressive pose, concept art",
    "Fantasy Portrait": "fantasy portrait, magical aura, ornate jewelry, mystical background, regal",
    "Cyberpunk Character": "cyberpunk character, neon augmentations, urban backdrop, tech implants, edgy",
    "Historical Figure": "historical portrait, period clothing, classical composition, dignified, authentic",
    "Superhero": "superhero portrait, dynamic pose, powerful stance, dramatic lighting, comic book style",
  },
  "🌿 Nature & Environment": {
    "Mystical Forest": "enchanted forest, mystical atmosphere, god rays, ancient trees, fairy lights",
    "Ocean Scene": "ocean seascape, dramatic waves, coastal cliffs, sunset, powerful nature",
    "Mountain Vista": "mountain landscape, snow-capped peaks, alpine meadows, majestic, panoramic view",
    "Desert Oasis": "desert landscape, golden dunes, oasis, warm tones, serene atmosphere",
    "Underwater": "underwater scene, coral reef, marine life, sunlight rays, vibrant colors",
  },
  "🏛️ Architecture & Interior": {
    "Futuristic City": "futuristic cityscape, towering skyscrapers, flying vehicles, neon glow, utopian",
    "Gothic Cathedral": "gothic cathedral interior, stained glass windows, dramatic arches, atmospheric",
    "Modern Interior": "modern interior design, minimalist, natural light, contemporary furniture, elegant",
    "Ancient Ruins": "ancient ruins, archaeological site, weathered stone, mysterious atmosphere, historical",
    "Cozy Cottage": "cozy cottage interior, warm lighting, rustic decor, comfortable atmosphere, hygge",
  },
  "✨ Abstract & Conceptual": {
    "Clean Minimal": "minimalist design, clean lines, negative space, simple composition, elegant",
    "Abstract": "abstract art, geometric shapes, bold colors, modern, artistic composition",
    "Monochrome": "monochrome, black and white, high contrast, dramatic, artistic",
    "Surreal": "surrealist art, impossible architecture, dreamscape, Salvador Dali inspired, mind-bending",
    "Geometric": "geometric composition, sacred geometry, mathematical patterns, symmetry, precise",
  },
};

const PromptTemplates: React.FC<{ onSelect: (template: string) => void }> = ({
  onSelect,
}) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    () => Object.keys(TEMPLATE_CATEGORIES).reduce((acc, cat) => ({ ...acc, [cat]: false }), {})
  );

  const toggleCategory = (category: string) => {
    setOpenCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const handleSelect = (key: string, value: string) => {
    onSelect(value);
    setSelectedKey(key);
    setTimeout(() => {
      setSelectedKey(null);
    }, 800);
  };

  return (
    <div className="space-y-3">
      {Object.entries(TEMPLATE_CATEGORIES).map(([category, templates]) => {
        const isOpen = openCategories[category];
        return (
          <div key={category} className="border border-white/10 rounded-2xl overflow-hidden">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 hover:from-indigo-500/20 hover:to-purple-500/20 transition-all"
            >
              <span className="text-sm font-bold text-gray-800 dark:text-white">{category}</span>
              <ChevronDownIcon className={`w-4 h-4 text-indigo-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
              <div className="p-3 space-y-2 bg-white/30 dark:bg-black/20">
                {Object.entries(templates).map(([name, prompt]) => (
                  <button
                    key={name}
                    onClick={() => handleSelect(name, prompt)}
                    className={`w-full text-left p-3 rounded-xl border transition-all text-xs font-medium text-gray-900 dark:text-white flex justify-between items-center hover-lift
                      ${selectedKey === name
                        ? "bg-green-500/20 border-green-500/30 ring-2 ring-green-500/50"
                        : "bg-white/50 dark:bg-white/5 hover:bg-indigo-500/10 border-gray-200 dark:border-white/5"
                      }`}
                  >
                    <div className="flex-1">
                      <span className="font-bold block">{name}</span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">{prompt}</span>
                    </div>
                    {selectedKey === name && (
                      <div className="animate-pop-in ml-2">
                        <CheckIcon className="w-4 h-4 text-green-500" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const SmartWordLibrary: React.FC<{
  selectedWords: string[];
  onWordClick: (word: string) => void;
}> = ({ selectedWords, onWordClick }) => {
  const categoryEntries = Object.entries(SMART_WORD_LIBRARY);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    () =>
      categoryEntries.reduce(
        (acc, [cat]) => ({ ...acc, [cat]: false }),
        {},
      ),
  );

  const toggleCategory = (category: string) =>
    setOpenCategories((prev) => ({ ...prev, [category]: !prev[category] }));

  return (
    <div className="space-y-4">
      {categoryEntries.map(([cat, sub]) => {
        const isOpen = openCategories[cat];
        return (
          <div key={cat} className="border border-white/5 rounded-2xl">
            <button
              onClick={() => toggleCategory(cat)}
              className="w-full flex items-center justify-between px-3 py-2 text-left"
            >
              <span className="text-xs font-bold text-indigo-500 uppercase">
                {cat}
              </span>
              <ChevronDownIcon
                className={`w-4 h-4 text-indigo-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && (
              <div className="px-3 pb-3 flex flex-wrap gap-2">
                {Object.values(sub)
                  .flat()
                  .map((word) => (
                    <button
                      key={word}
                      onClick={() => onWordClick(word)}
                      disabled={selectedWords.includes(word)}
                      className={`px-2 py-1 text-[10px] rounded-lg border ${selectedWords.includes(word) ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 opacity-50 border-indigo-200 dark:border-indigo-800" : "bg-white/40 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border-gray-200 dark:border-white/5 text-gray-700 dark:text-gray-300"}`}
                    >
                      {word}
                    </button>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default PromptBuilder;
