import React, { useEffect, useMemo, useRef, useState } from "react";
import { ProcessingAnimation } from "./ProcessingAnimation";
import {
  describeImageToText,
  rewritePrompt,
  extractPromptFromImage,
} from "../services/geminiService";
import useLocalStorage from "../hooks/useLocalStorage";
import { Platform } from "../types";
import {
  RANDOM_SUBJECTS,
  RANDOM_SETTINGS,
  RANDOM_MOODS,
  RANDOM_STYLES,
  NEGATIVE_PROMPT_SUGGESTIONS,
} from "../constants";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CameraIcon,
  BrushIcon,
  LayersIcon,
  PaletteIcon,
  MagicWandIcon,
  CopyIcon,
  CheckIcon,
  FolderIcon,
  ImagePlusIcon,
  SlidersIcon,
  ListIcon,
  RefreshIcon,
  MicIcon,
  MicOffIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from "./icons";
import { Loader2, Dices, Star, Download, Search, Plus } from "lucide-react";
import useSpeechToText from "../hooks/useSpeechToText";
import QuickImageGenerators from "./QuickImageGenerators";
import ModelSelector from "./ModelSelector";

interface StudioWorkspaceProps {
  onSendToBuilder: (prompt: string) => void;
  onSaveToLibrary: (prompt: string, platform?: Platform, imageUrl?: string, tags?: string[]) => void;
}

type PersonaId =
  | "photographer" | "painter" | "cgi" | "illustrator" | "anime"
  | "concept" | "cinematic" | "fashion" | "product" | "portrait" | "architect";
type AspectRatio = "1:1" | "16:9" | "9:16" | "4:5" | "3:2" | "21:9";
type PlatformId = "natural" | "midjourney" | "flux" | "sdxl" | "dalle" | "video";
type ImageAction = "reference" | "extract";

interface StudioImage {
  preview: string;
  base64: string;
  mimeType: string;
  name: string;
}

interface ResultItem {
  prompt: string;
  status: "pending" | "done" | "error";
  error?: string;
  meta?: string;
}

interface StudioHistoryItem {
  id: string;
  timestamp: string;
  input: string;
  persona: string;
  lighting: string;
  lens?: string;
  angle: string;
  shot?: string;
  mood?: string;
  palette: string;
  customPalette?: string;
  negative?: string;
  modifiers?: string[];
  platform?: PlatformId;
  aspectRatio?: AspectRatio;
  promptAdherence: number;
  promptLength: number;
  stylization?: number;
  variety?: number;
  favorite?: boolean;
  results: Array<{ prompt: string }>;
}
interface StudioPreset {
  id: string;
  name: string;
  createdAt: string;
  settings: {
    persona: string;
    customPersona: string;
    lighting: string;
    lens: string;
    angle: string;
    shot: string;
    mood: string;
    palette: string;
    customPalette: string;
    aspectRatio: AspectRatio;
    platform: PlatformId;
    promptAdherence: number;
    promptLength: number;
    stylization: number;
    variety: number;
    count: number;
    negative: string;
    modifiers: string[];
  };
}

const PERSONAS: Array<{ id: PersonaId; label: string; Icon: React.FC<{ className?: string }>; hint: string }> = [
  { id: "photographer", label: "Photographer", Icon: CameraIcon, hint: "Lens, f-stop, light setups" },
  { id: "cinematic", label: "Cinematographer", Icon: CameraIcon, hint: "Shot size, move, grade" },
  { id: "fashion", label: "Fashion Editorial", Icon: SparklesIcon, hint: "Garment, pose, cover" },
  { id: "product", label: "Product Commercial", Icon: ImagePlusIcon, hint: "Softbox, texture, hero" },
  { id: "portrait", label: "Portraitist", Icon: CameraIcon, hint: "Catchlight, skin, bokeh" },
  { id: "painter", label: "Painter", Icon: BrushIcon, hint: "Brushwork, pigment, canvas" },
  { id: "cgi", label: "CGI Master", Icon: LayersIcon, hint: "PBR, raytrace, volume" },
  { id: "architect", label: "Archviz", Icon: LayersIcon, hint: "Massing, daylight, 16mm" },
  { id: "illustrator", label: "Illustrator", Icon: PaletteIcon, hint: "Linework, flat, space" },
  { id: "anime", label: "Anime Director", Icon: MagicWandIcon, hint: "Cel shade, storyboard" },
  { id: "concept", label: "Concept Artist", Icon: BrushIcon, hint: "Scale, story, matte" },
];

const LIGHTINGS = ["Cinematic", "Golden Hour", "Soft Diffused", "Neon / Cyberpunk", "Studio Spotlight", "Rembrandt Portrait", "Blue Hour", "Harsh Noon", "Volumetric Fog", "Bioluminescent", "Candlelit Warm", "Overcast Softbox"];
const LENSES = ["24mm Wide", "35mm Street", "50mm Prime f/1.4", "85mm Portrait f/1.8", "100mm Macro", "16mm Tilt-Shift", "Anamorphic 40mm", "200mm Telephoto"];
const ANGLES = ["Eye Level", "Low Angle", "High Overhead", "Dutch Tilt", "Macro Close-Up", "Aerial Drone", "Over-the-Shoulder", "Top-Down Flatlay", "Worm's Eye"];
const SHOTS = ["Extreme Close-Up", "Close-Up", "Medium Shot", "Full Body", "Wide Establishing", "Epic Vista", "Detail Insert", "Split Diptych"];
const MOODS = ["Ethereal Dreamy", "Dark Gritty", "Joyful Vibrant", "Melancholic", "Epic Monumental", "Intimate Tender", "Futuristic Sleek", "Vintage Analog", "Noir Mystery", "Whimsical Playful", "Serene Minimal", "Electric Neon"];
const PALETTES = ["Vibrant / Rich", "Muted Pastel", "Monochrome High-Contrast", "Warm Analog", "Cool Sci-Fi", "Earthy Terracotta", "Jewel Tones", "Candy Pop", "Desaturated Fog", "Infrared Duotone"];
const ASPECTS: AspectRatio[] = ["1:1", "16:9", "9:16", "4:5", "3:2", "21:9"];
const PLATFORMS: Array<{ id: PlatformId; label: string }> = [
  { id: "natural", label: "Natural / Universal" },
  { id: "midjourney", label: "Midjourney v6.1" },
  { id: "flux", label: "Flux Pro" },
  { id: "sdxl", label: "SDXL" },
  { id: "dalle", label: "DALL-E 3" },
  { id: "video", label: "Video (Runway/Kling)" },
];

const platformToEnum = (p: PlatformId): Platform => {
  switch (p) {
    case "midjourney": return Platform.Midjourney;
    case "flux": return Platform.Flux;
    case "sdxl": return Platform.SDXL;
    case "dalle": return Platform.DallE3;
    case "video": return Platform.Video;
    default: return Platform.Natural;
  }
};

const platformSuffix = (p: PlatformId, ar: AspectRatio): string => {
  switch (p) {
    case "midjourney": return ` --ar ${ar.replace(":", ":")} --style raw --v 6.1`;
    case "flux": return ", photorealistic light physics, 8k detail";
    case "sdxl": return ", masterpiece, best quality, sharp focus";
    case "dalle": return ". Cinematic prose still, no text overlay, no watermark";
    case "video": return ", slow push-in camera move, 24fps, subtle parallax motion";
    default: return "";
  }
};

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const StudioWorkspace: React.FC<StudioWorkspaceProps> = ({
  onSendToBuilder,
  onSaveToLibrary,
}) => {
  const [leftOpen, setLeftOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 1024 : false));
  const [rightOpen, setRightOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth >= 1024 : false));
  const [leftTab, setLeftTab] = useState<"history" | "presets" | "batch">("history");

  const [input, setInput] = useState("");
  const [images, setImages] = useState<StudioImage[]>([]);

  // Creative settings
  const [persona, setPersona] = useState<PersonaId>("photographer");
  const [customPersona, setCustomPersona] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [lighting, setLighting] = useState(LIGHTINGS[0]);
  const [lens, setLens] = useState(LENSES[2]);
  const [angle, setAngle] = useState(ANGLES[0]);
  const [shot, setShot] = useState(SHOTS[3]);
  const [mood, setMood] = useState(MOODS[0]);
  const [palette, setPalette] = useState(PALETTES[0]);
  const [customPalette, setCustomPalette] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [platform, setPlatform] = useState<PlatformId>("natural");
  const [promptAdherence, setPromptAdherence] = useState(0.5);
  const [promptLength, setPromptLength] = useState(0.5);
  const [stylization, setStylization] = useState(0.5);
  const [variety, setVariety] = useState(0.5);
  const [count, setCount] = useState(2);
  const [negative, setNegative] = useState("");
  const [modifiers, setModifiers] = useState<string[]>([]);
  const [modInput, setModInput] = useState("");
  const [imageAction, setImageAction] = useState<ImageAction>("reference");

  // Output state
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [inputStatus, setInputStatus] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);

  // Persistence
  const [history, setHistory] = useLocalStorage<StudioHistoryItem[]>("studio-history", []);
  const [presets, setPresets] = useLocalStorage<StudioPreset[]>("studio-presets", []);
  const [density, setDensity] = useLocalStorage<"comfortable" | "compact">("studio-density", "comfortable");
  const [showMeta, setShowMeta] = useLocalStorage<boolean>("studio-show-meta", true);
  const [presetName, setPresetName] = useState("");
  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);

  const [highlightBatch, setHighlightBatch] = useState(false);
  const bottomInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isListening, isSupported, startListening } = useSpeechToText(
    (text) => {
      setInput((prev) => prev + (prev ? " " : "") + text);
    },
  );

  const hasVariable = useMemo(() => /\{[^}]+\}/.test(input), [input]);

  useEffect(() => {
    if (hasVariable) {
      setLeftOpen(true);
      setLeftTab("batch");
      setHighlightBatch(true);
      const timer = setTimeout(() => setHighlightBatch(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [hasVariable]);

  const fileToBase64 = (file: File) =>
    new Promise<StudioImage>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        resolve({ preview: dataUrl, base64, mimeType: file.type, name: file.name });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFiles = async (files?: FileList | File[]) => {
    if (!files) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 3 - images.length);
    if (list.length === 0) return;
    const converted = await Promise.all(list.map(fileToBase64));
    setImages((prev) => [...prev, ...converted].slice(0, 3));
    setImageAction("reference");
    setInputStatus("");
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) await handleFiles(e.dataTransfer.files);
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setInputStatus("");
  };

  const triggerExtractPrompt = async () => {
    if (images.length === 0 || isExtracting) return;
    try {
      setIsExtracting(true);
      setInputStatus("Scanning visual elements...");
      const first = images[0];
      const description = await extractPromptFromImage(first.base64, first.mimeType);
      if (description) {
        setInput(description);
        setTimeout(() => setInputStatus(""), 1500);
      } else {
        setInputStatus("Could not extract details.");
      }
    } catch (error: unknown) {
      setInputStatus(error instanceof Error ? error.message : "Vision extraction failed.");
    } finally {
      setIsExtracting(false);
    }
  };

  const surpriseMe = () => {
    const s = `${pick(RANDOM_SUBJECTS)} ${pick(RANDOM_SETTINGS)}, ${pick(RANDOM_MOODS)} mood, ${pick(RANDOM_STYLES)}`;
    setInput(s);
    setPersona(pick(PERSONAS).id);
    setLighting(pick(LIGHTINGS));
    setMood(pick(MOODS));
    setPalette(pick(PALETTES));
    bottomInputRef.current?.focus();
  };

  const addModifier = () => {
    const v = modInput.trim().replace(/,+$/, "");
    if (!v) return;
    if (modifiers.includes(v)) {
      setModInput("");
      return;
    }
    setModifiers((prev) => [...prev, v].slice(0, 12));
    setModInput("");
  };

  const paletteText = customPalette.trim() || palette;
  const stylizationLabel = stylization <= 0.35 ? "Subtle" : stylization >= 0.65 ? "Bold" : "Balanced";

  const adornPrompt = (base: string, idx: number): { text: string; meta: string } => {
    const varied = variety >= 0.6;
    const li = LIGHTINGS.indexOf(lighting);
    const mi = MOODS.indexOf(mood);
    const ai = ANGLES.indexOf(angle);
    const useLighting = varied ? LIGHTINGS[(li + idx) % LIGHTINGS.length] : lighting;
    const useMood = varied ? MOODS[(mi + idx) % MOODS.length] : mood;
    const useAngle = varied ? ANGLES[(ai + idx) % ANGLES.length] : angle;
    const styleBits: string[] = [];
    if (stylization >= 0.65) styleBits.push("highly stylized");
    else if (stylization <= 0.35) styleBits.push("naturalistic, restrained style");
    const parts = [
      base,
      `${useLighting} lighting`,
      `${useAngle} angle`,
      `${shot} framing`,
      lens,
      `${useMood} mood`,
      `${paletteText} color grading`,
      ...styleBits,
      ...modifiers,
      `aspect ${aspectRatio}`,
    ];
    let text = parts.join(", ");
    if (negative.trim()) {
      text += platform === "midjourney" ? ` --no ${negative.trim()}` : ` (avoid: ${negative.trim()})`;
    }
    text += platformSuffix(platform, aspectRatio);
    const meta = `${useLighting} · ${useMood} · ${lens}`;
    return { text, meta };
  };

  const runGeneration = async (quick = false) => {
    if (isExtracting || isGenerating) return;
    if (!input.trim() && images.length === 0) return;
    const finalCount = quick ? 1 : count;

    setIsGenerating(true);
    setStatusMessage("Consulting AI Persona...");
    setResults([]);

    try {
      let thinkerInput = input.trim();
      if (images.length > 0 && imageAction === "reference") {
        setStatusMessage(`Analyzing ${images.length} visual reference${images.length > 1 ? "s" : ""}...`);
        const descs: string[] = [];
        for (const img of images) {
          const d = await describeImageToText(img.base64, img.mimeType);
          if (d) descs.push(d);
        }
        const joined = descs.join("\n---\n");
        thinkerInput = thinkerInput ? `${joined}\nUser note: ${thinkerInput}` : joined;
      }
      if (customPersona.trim()) {
        thinkerInput += `\nExtra direction: ${customPersona.trim()}`;
      }

      if (!thinkerInput) {
        thinkerInput = "Cinematic visual masterpiece.";
      }

      setStatusMessage("Synthesizing prompt blueprint...");
      const thinkerPrompts = await rewritePrompt(thinkerInput, persona, promptLength);

      const queue: ResultItem[] = Array.from({ length: finalCount }).map((_, idx) => {
        const base = thinkerPrompts[idx % thinkerPrompts.length] || thinkerPrompts[0];
        const { text, meta } = adornPrompt(base, idx);
        return { prompt: text, status: "pending" as const, meta };
      });

      const updated: ResultItem[] = queue.map((item) => ({ ...item, status: "done" as const }));
      setResults(updated);

      const newHistoryItem: StudioHistoryItem = {
        id: `studio_${Date.now()}`,
        timestamp: new Date().toISOString(),
        input: thinkerInput,
        persona,
        lighting,
        lens,
        angle,
        shot,
        mood,
        palette,
        customPalette: customPalette.trim(),
        negative: negative.trim(),
        modifiers,
        platform,
        aspectRatio,
        promptAdherence,
        promptLength,
        stylization,
        variety,
        favorite: false,
        results: updated.map((u) => ({ prompt: u.prompt })),
      };

      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 30)]);
    } catch (error) {
      console.error("Studio generation failed:", error);
    } finally {
      setIsGenerating(false);
      setStatusMessage("");
    }
  };

  const snapshotSettings = (): StudioPreset["settings"] => ({
    persona, customPersona, lighting, lens, angle, shot, mood, palette,
    customPalette, aspectRatio, platform, promptAdherence, promptLength,
    stylization, variety, count, negative, modifiers,
  });

  const applySettings = (s: StudioPreset["settings"]) => {
    setPersona(s.persona as PersonaId);
    setCustomPersona(s.customPersona || "");
    setLighting(s.lighting);
    setLens(s.lens);
    setAngle(s.angle);
    setShot(s.shot);
    setMood(s.mood);
    setPalette(s.palette);
    setCustomPalette(s.customPalette || "");
    setAspectRatio(s.aspectRatio);
    setPlatform(s.platform);
    setPromptAdherence(s.promptAdherence);
    setPromptLength(s.promptLength);
    setStylization(s.stylization ?? 0.5);
    setVariety(s.variety ?? 0.5);
    setCount(s.count);
    setNegative(s.negative || "");
    setModifiers(s.modifiers || []);
    if (s.customPersona) setShowAdvanced(true);
  };

  const savePreset = () => {
    const name = presetName.trim() || `Preset ${presets.length + 1}`;
    const preset: StudioPreset = {
      id: `preset_${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      settings: snapshotSettings(),
    };
    setPresets((prev) => [preset, ...prev.slice(0, 24)]);
    setPresetName("");
  };

  const handleRestoreHistoryItem = (item: StudioHistoryItem) => {
    setInput(item.input);
    setPersona((item.persona as PersonaId) || "photographer");
    setLighting(item.lighting || LIGHTINGS[0]);
    setLens(item.lens || LENSES[2]);
    setAngle(item.angle || ANGLES[0]);
    setShot(item.shot || SHOTS[3]);
    setMood(item.mood || MOODS[0]);
    setPalette(item.palette || PALETTES[0]);
    setCustomPalette(item.customPalette || "");
    setNegative(item.negative || "");
    setModifiers(item.modifiers || []);
    setPlatform(item.platform || "natural");
    setAspectRatio(item.aspectRatio || "1:1");
    setPromptAdherence(item.promptAdherence ?? 0.5);
    setPromptLength(item.promptLength ?? 0.5);
    setStylization(item.stylization ?? 0.5);
    setVariety(item.variety ?? 0.5);
    if (item.negative || item.customPalette || (item.modifiers && item.modifiers.length > 0)) {
      setShowAdvanced(true);
    }
    if (item.results && item.results.length > 0) {
      setResults(item.results.map((r) => ({ prompt: r.prompt, status: "done" as const })));
    }
  };

  const toggleFavorite = (id: string) => {
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, favorite: !h.favorite } : h)));
  };

  const deleteHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleSave = (text: string, index?: number) => {
    onSaveToLibrary(text, platformToEnum(platform), undefined, ["studio", persona, platform]);
    if (index !== undefined) {
      setSavedIndex(index);
      setTimeout(() => setSavedIndex(null), 1500);
    }
  };

  const copyAll = () => {
    if (results.length === 0) return;
    navigator.clipboard.writeText(results.map((r) => r.prompt).join("\n\n---\n\n"));
    setCopiedIndex(-1);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const exportJSON = () => {
    if (results.length === 0) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      input,
      settings: snapshotSettings(),
      results: results.map((r) => r.prompt),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `studio-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredHistory = history.filter((h) => {
    if (favOnly && !h.favorite) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return h.input.toLowerCase().includes(q) || h.persona.toLowerCase().includes(q);
  });

  const selectClass = "editorial-select w-full text-xs font-mono";
  const labelClass = "font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block";

  return (
    <div
      className="feature-theme-studio relative h-[calc(100vh-8rem)] sm:h-[calc(100vh-7rem)] min-h-[480px] sm:min-h-[640px] w-full overflow-hidden editorial-panel shadow-sm"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="absolute top-3 left-3 z-20 flex gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setLeftOpen((p) => !p)}
          className="editorial-button editorial-button--sm editorial-button--secondary p-2 shadow-sm"
          aria-label="Toggle Studio Archive"
        >
          <ListIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setRightOpen((p) => !p)}
          className="editorial-button editorial-button--sm editorial-button--secondary p-2 shadow-sm"
          aria-label="Toggle Controls"
        >
          <SlidersIcon className="w-4 h-4" />
        </button>
      </div>

      {leftOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden" onClick={() => setLeftOpen(false)} />
      )}
      {rightOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden" onClick={() => setRightOpen(false)} />
      )}

      <div className="absolute inset-0 flex">
        {/* Left Panel */}
        <div
          className={`transition-transform lg:transition-all duration-300 bg-[var(--editorial-surface)] border-r border-[var(--editorial-rule)] h-full flex flex-col fixed inset-y-0 left-0 z-40 w-[85vw] max-w-[320px] shadow-2xl lg:shadow-none lg:static lg:z-10 ${
            leftOpen ? "translate-x-0 lg:w-[300px]" : "-translate-x-full lg:translate-x-0 lg:w-0"
          } overflow-hidden`}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--editorial-surface-strong)] border-b border-[var(--editorial-rule)]">
            <div className="flex items-center gap-2">
              <ListIcon className="w-3.5 h-3.5 text-[var(--editorial-coral)]" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-ink)]">
                Studio Archive
              </span>
            </div>
            <button type="button" onClick={() => setLeftOpen(false)} className="p-1 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]">
              <ArrowLeftIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex border-b border-[var(--editorial-rule)] font-mono text-[11px] font-bold uppercase tracking-wider">
            {(["history", "presets", "batch"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setLeftTab(t)}
                className={`flex-1 py-2.5 transition-all text-center capitalize ${
                  leftTab === t
                    ? "text-[var(--editorial-coral)] border-b-2 border-[var(--editorial-coral)] bg-[var(--editorial-surface-strong)]"
                    : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                } ${t === "batch" && highlightBatch ? "animate-pulse" : ""}`}
              >
                {t === "history" ? `Archive (${history.length})` : t === "presets" ? `Presets (${presets.length})` : "Output"}
              </button>
            ))}
          </div>

          <div className="p-3.5 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
            {leftTab === "history" && (
              <>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--editorial-muted)]" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search sessions..."
                      className="editorial-input w-full !pl-7 !text-xs font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFavOnly((v) => !v)}
                    title="Favorites only"
                    className={`p-2 border transition-all ${favOnly ? "bg-amber-400/20 border-amber-400 text-amber-500" : "bg-[var(--editorial-surface)] border-[var(--editorial-rule)] text-[var(--editorial-muted)]"}`}
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                </div>
                {filteredHistory.length === 0 ? (
                  <div className="font-mono text-xs text-[var(--editorial-muted)] text-center py-10">
                    {history.length === 0 ? "No previous sessions in archive." : "No sessions match your filter."}
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">Recent Sessions</span>
                      <button type="button" onClick={() => setHistory([])} className="font-mono text-[10px] text-red-500 hover:underline uppercase">
                        Clear
                      </button>
                    </div>
                    {filteredHistory.map((h) => (
                      <div
                        key={h.id}
                        onClick={() => handleRestoreHistoryItem(h)}
                        className="p-3 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)] cursor-pointer transition-all hover:shadow-[2px_2px_0_var(--editorial-coral)] space-y-1.5"
                      >
                        <div className="flex justify-between items-center">
                          <span className="editorial-badge editorial-badge--violet">{h.persona}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(h.id); }}
                              className={`p-1 ${h.favorite ? "text-amber-500" : "text-[var(--editorial-muted)] hover:text-amber-500"}`}
                              title="Favorite"
                            >
                              <Star className={`w-3.5 h-3.5 ${h.favorite ? "fill-amber-400" : ""}`} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); deleteHistoryItem(h.id); }}
                              className="p-1 text-[var(--editorial-muted)] hover:text-red-500"
                              title="Delete"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-mono text-[10px] text-[var(--editorial-muted)]">
                              {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                        <p className="font-serif text-xs text-[var(--editorial-ink)] line-clamp-2 m-0">{h.input}</p>
                        <p className="font-mono text-[10px] text-[var(--editorial-muted)] m-0">
                          {h.results.length} variant{h.results.length !== 1 ? "s" : ""} · {h.aspectRatio || "1:1"} · {h.platform || "natural"}
                        </p>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}

            {leftTab === "presets" && (
              <div className="space-y-3">
                <div className="p-3.5 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)] space-y-2">
                  <span className={labelClass}>Save current setup</span>
                  <div className="flex gap-1.5">
                    <input
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="e.g. Neon portrait rig"
                      className="editorial-input flex-1 !text-xs font-mono"
                    />
                    <button type="button" onClick={savePreset} className="editorial-button editorial-button--sm editorial-button--primary">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-[var(--editorial-muted)] m-0">Captures persona, optics, mood, sliders, negative + modifiers.</p>
                </div>
                {presets.length === 0 ? (
                  <div className="font-mono text-xs text-[var(--editorial-muted)] text-center py-8">No presets yet. Dial in a look, then save it.</div>
                ) : (
                  presets.map((p) => (
                    <div key={p.id} className="p-3 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-xs font-bold text-[var(--editorial-ink)] truncate">{p.name}</span>
                        <button type="button" onClick={() => setPresets((prev) => prev.filter((x) => x.id !== p.id))} className="p-1 text-[var(--editorial-muted)] hover:text-red-500">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="font-mono text-[10px] text-[var(--editorial-muted)] m-0">
                        {p.settings.persona} · {p.settings.lighting} · {p.settings.mood} · {p.settings.aspectRatio}
                      </p>
                      <button type="button" onClick={() => applySettings(p.settings)} className="editorial-button editorial-button--sm editorial-button--secondary w-full justify-center">
                        Apply preset
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {leftTab === "batch" && (
              <div className="space-y-4">
                <div className="p-3.5 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)] space-y-2">
                  <span className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">Aspect Ratio</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {ASPECTS.map((ar) => (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => setAspectRatio(ar)}
                        className={`py-1.5 text-xs font-mono font-bold uppercase border transition-all ${
                          aspectRatio === ar
                            ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)] shadow-[2px_2px_0_var(--editorial-coral)]"
                            : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)] hover:text-[var(--editorial-ink)]"
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-3.5 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)] space-y-2">
                  <span className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">Variants</span>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCount(n)}
                        className={`flex-1 py-1.5 text-xs font-mono font-bold border transition-all ${count === n ? "bg-[var(--editorial-coral)] text-white border-[var(--editorial-coral)]" : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)]"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="font-mono text-[10px] text-[var(--editorial-muted)] m-0">High Variety rotates lighting / mood / angle per variant.</p>
                </div>
                <div className="p-3.5 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)] space-y-1">
                  <p className="font-mono text-[10.5px] font-bold text-[var(--editorial-ink)] uppercase tracking-wider m-0">Dynamic Variables</p>
                  <p className="font-mono text-[11px] text-[var(--editorial-muted)] m-0">
                    Use <code className="text-[var(--editorial-coral)] font-mono">{"{brackets}"}</code> in your prompt to spawn batch variants automatically.
                  </p>
                </div>
                <div className="p-3.5 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)] space-y-2">
                  <span className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">Canvas</span>
                  <div className="flex gap-1.5">
                    {(["comfortable", "compact"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDensity(d)}
                        className={`flex-1 py-1.5 text-xs font-mono font-bold capitalize border transition-all ${density === d ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]" : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)]"}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 font-mono text-[11px] text-[var(--editorial-muted)] cursor-pointer">
                    <input type="checkbox" checked={showMeta} onChange={(e) => setShowMeta(e.target.checked)} className="accent-[var(--editorial-coral)]" />
                    Show recipe badges on cards
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Central Visual Canvas */}
        <div className="flex-1 relative overflow-hidden flex flex-col bg-[var(--editorial-surface)]">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar">
            {images.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 border border-[var(--editorial-rule)] overflow-hidden bg-[var(--editorial-surface-strong)]">
                    <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 text-white hover:bg-red-500" aria-label="Remove reference">
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <div className="flex border border-[var(--editorial-rule)] font-mono text-[10px] font-bold uppercase">
                    {(["reference", "extract"] as ImageAction[]).map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => { setImageAction(a); if (a === "extract") triggerExtractPrompt(); }}
                        className={`px-2 py-1.5 transition-all ${imageAction === a ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)]" : "text-[var(--editorial-muted)]"}`}
                      >
                        {a === "reference" ? "Ref" : "Scan"}
                      </button>
                    ))}
                  </div>
                  {inputStatus && <span className="font-mono text-[10px] text-[var(--editorial-muted)]">{inputStatus}</span>}
                </div>
              </div>
            )}

            {isGenerating && (
              <div className="mb-6">
                <ProcessingAnimation
                  variant="panel"
                  theme="violet"
                  badge="Studio Synthesis"
                  title="Studio Workspace Generation"
                  status={statusMessage || undefined}
                  stages={[
                    "Ingesting creative canvas tokens...",
                    "Synthesizing compositional parameters...",
                    "Resolving style keywords & bracket permutations...",
                    "Emitting master studio prompt directives...",
                  ]}
                  stageIntervalMs={2100}
                  subtext="Real-time studio intelligence engine actively computing outputs."
                />
              </div>
            )}

            {results.length > 0 && !isGenerating && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--editorial-muted)]">
                  {results.length} variant{results.length !== 1 ? "s" : ""} · {persona} · {platform}
                </span>
                <div className="flex-1" />
                <button type="button" onClick={copyAll} className="editorial-button editorial-button--sm editorial-button--secondary">
                  {copiedIndex === -1 ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
                  <span>{copiedIndex === -1 ? "Copied all" : "Copy all"}</span>
                </button>
                <button type="button" onClick={exportJSON} className="editorial-button editorial-button--sm editorial-button--secondary">
                  <Download className="w-3.5 h-3.5" />
                  <span>JSON</span>
                </button>
              </div>
            )}

            <div className={`grid grid-cols-1 md:grid-cols-2 ${density === "compact" ? "gap-2" : "gap-4"} pb-28`}>
              {results.length === 0 && !isGenerating ? (
                <div className="col-span-full h-[320px] border border-dashed border-[var(--editorial-rule-strong)] bg-[var(--editorial-surface-strong)] flex flex-col items-center justify-center text-center p-6 text-[var(--editorial-muted)]">
                  <SparklesIcon className="w-8 h-8 mb-2 text-[var(--editorial-coral)] opacity-60" />
                  <h3 className="font-serif text-base text-[var(--editorial-ink)] mb-1">
                    Studio Canvas Ready
                  </h3>
                  <p className="font-mono text-xs max-w-md m-0">
                    Describe a scene below — or hit the dice for a surprise brief. Tune persona, optics, mood and platform on the right, save the rig as a preset, then synthesize.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={surpriseMe} className="editorial-button editorial-button--sm editorial-button--secondary">
                      <Dices className="w-3.5 h-3.5" />
                      <span>Surprise me</span>
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="editorial-button editorial-button--sm editorial-button--secondary">
                      <ImagePlusIcon className="w-3.5 h-3.5" />
                      <span>Add reference</span>
                    </button>
                  </div>
                </div>
              ) : (
                results.map((item, idx) => (
                  <div key={idx} className="editorial-panel overflow-hidden flex flex-col justify-between animate-fade-in">
                    <div className={`${density === "compact" ? "p-3 space-y-2" : "p-4 space-y-3"} flex-grow flex flex-col justify-between`}>
                      {showMeta && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="editorial-badge editorial-badge--violet">{persona}</span>
                          {item.meta && <span className="font-mono text-[10px] text-[var(--editorial-muted)] self-center">{item.meta}</span>}
                        </div>
                      )}
                      <p className="font-mono text-xs text-[var(--editorial-ink)] leading-relaxed m-0">
                        {item.prompt}
                      </p>
                      <p className="font-mono text-[10px] text-[var(--editorial-muted)] m-0">
                        {item.prompt.length} chars · {item.prompt.split(/\s+/).length} words
                      </p>
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--editorial-rule)]">
                        <button type="button" onClick={() => handleCopy(item.prompt, idx)} className="editorial-button editorial-button--sm editorial-button--secondary flex-1 justify-center">
                          {copiedIndex === idx ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
                          <span>{copiedIndex === idx ? "Copied" : "Copy"}</span>
                        </button>
                        <button type="button" onClick={() => handleSave(item.prompt, idx)} className="editorial-button editorial-button--sm editorial-button--secondary flex-1 justify-center">
                          {savedIndex === idx ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <FolderIcon className="w-3.5 h-3.5" />}
                          <span>{savedIndex === idx ? "Saved" : "Save"}</span>
                        </button>
                        <QuickImageGenerators prompt={item.prompt} variant="dropdown" />
                        <button type="button" onClick={() => onSendToBuilder(item.prompt)} className="editorial-button editorial-button--sm editorial-button--primary">
                          <span>To Builder ➔</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom Command Bar */}
          <div className="absolute bottom-4 left-4 right-4 z-20">
            <div className="editorial-panel p-2 shadow-lg flex items-center gap-2 max-w-4xl mx-auto bg-[var(--editorial-paper)] border-[var(--editorial-rule-strong)]">
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files || undefined); e.target.value = ""; }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 border bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-coral)] transition-all" title={`Reference images (${images.length}/3)`}>
                <ImagePlusIcon className="w-4 h-4" />
              </button>
              {isSupported && (
                <button
                  type="button"
                  onClick={startListening}
                  className={`p-2 border transition-all ${isListening ? "bg-red-500 text-white border-red-500 animate-pulse" : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-coral)]"}`}
                  title="Voice Input"
                >
                  {isListening ? <MicOffIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />}
                </button>
              )}
              <button type="button" onClick={surpriseMe} className="p-2 border bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-coral)] transition-all" title="Surprise brief">
                <Dices className="w-4 h-4" />
              </button>

              <input
                ref={bottomInputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !isGenerating) { runGeneration(); } }}
                placeholder="Describe what you want to synthesize... ({var} for batch)"
                className="flex-grow bg-transparent border-none outline-none font-mono text-xs text-[var(--editorial-ink)] placeholder-[var(--editorial-muted)] px-2"
              />

              <div className="hidden md:flex items-center">
                <ModelSelector variant="inline" />
              </div>

              <button type="button" onClick={() => runGeneration(true)} disabled={isGenerating || (!input.trim() && images.length === 0)} className="editorial-button editorial-button--sm editorial-button--secondary hidden sm:inline-flex" title="Quick single variant">
                <RefreshIcon className="w-3.5 h-3.5" />
                <span>Quick</span>
              </button>
              <button
                type="button"
                onClick={() => runGeneration()}
                disabled={isGenerating || (!input.trim() && images.length === 0)}
                className="editorial-button editorial-button--sm editorial-button--primary editorial-button--coral"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 shrink-0" /> : <SparklesIcon className="w-3.5 h-3.5" />}
                <span>{isGenerating ? "Synthesizing..." : `Synthesize ×${count}`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div
          className={`transition-transform lg:transition-all duration-300 bg-[var(--editorial-surface)] border-l border-[var(--editorial-rule)] h-full flex flex-col fixed inset-y-0 right-0 z-40 w-[85vw] max-w-[320px] shadow-2xl lg:shadow-none lg:static lg:z-10 ${
            rightOpen ? "translate-x-0 lg:w-[300px]" : "translate-x-full lg:translate-x-0 lg:w-0"
          } overflow-hidden`}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--editorial-surface-strong)] border-b border-[var(--editorial-rule)]">
            <div className="flex items-center gap-2">
              <SlidersIcon className="w-3.5 h-3.5 text-[var(--editorial-coral)]" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-ink)]">
                Persona & Controls
              </span>
            </div>
            <button type="button" onClick={() => setRightOpen(false)} className="p-1 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]">
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3.5 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
            <div className="space-y-1.5">
              <span className={labelClass}>AI Persona Lens ({PERSONAS.length})</span>
              <div className="grid grid-cols-1 gap-1 max-h-56 overflow-y-auto custom-scrollbar pr-0.5">
                {PERSONAS.map((p) => {
                  const Icon = p.Icon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPersona(p.id)}
                      title={p.hint}
                      className={`p-2 border text-xs font-mono flex items-center gap-2 transition-all text-left ${
                        persona === p.id
                          ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)] font-bold shadow-[2px_2px_0_var(--editorial-coral)]"
                          : "bg-[var(--editorial-paper)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)] hover:text-[var(--editorial-ink)]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="flex-1">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5 p-3 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)]">
              <div className="flex justify-between items-center font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase">
                <span>Adherence</span>
                <span className="text-[var(--editorial-coral)]">
                  {promptAdherence <= 0.35 ? "Creative Expansion" : promptAdherence >= 0.65 ? "Strict Wording" : "Balanced"}
                </span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={promptAdherence} onChange={(e) => setPromptAdherence(parseFloat(e.target.value))} className="w-full h-1 bg-[var(--editorial-rule)] rounded-none appearance-none cursor-pointer accent-[var(--editorial-coral)]" />
            </div>

            <div className="space-y-1.5 p-3 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)]">
              <div className="flex justify-between items-center font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase">
                <span>Prompt Length</span>
                <span className="text-[var(--editorial-coral)]">{promptLength <= 0.33 ? "Concise" : promptLength >= 0.67 ? "Exhaustive" : "Balanced"}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={promptLength} onChange={(e) => setPromptLength(parseFloat(e.target.value))} className="w-full h-1 bg-[var(--editorial-rule)] rounded-none appearance-none cursor-pointer accent-[var(--editorial-coral)]" />
            </div>

            <div className="space-y-1.5 p-3 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)]">
              <div className="flex justify-between items-center font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase">
                <span>Stylization</span>
                <span className="text-[var(--editorial-coral)]">{stylizationLabel}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={stylization} onChange={(e) => setStylization(parseFloat(e.target.value))} className="w-full h-1 bg-[var(--editorial-rule)] rounded-none appearance-none cursor-pointer accent-[var(--editorial-coral)]" />
              <div className="flex justify-between items-center font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase pt-1">
                <span>Variety</span>
                <span className="text-[var(--editorial-coral)]">{variety <= 0.35 ? "Cohesive" : variety >= 0.65 ? "Wild" : "Mixed"}</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={variety} onChange={(e) => setVariety(parseFloat(e.target.value))} className="w-full h-1 bg-[var(--editorial-rule)] rounded-none appearance-none cursor-pointer accent-[var(--editorial-coral)]" />
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="space-y-1">
                <span className={labelClass}>AI Model (Cloud / Offline)</span>
                <ModelSelector variant="inline" className="w-full [&>div]:w-full [&_select]:max-w-full" />
              </div>
              <div className="space-y-1">
                <span className={labelClass}>Lighting Style</span>
                <select value={lighting} onChange={(e) => setLighting(e.target.value)} className={selectClass}>
                  {LIGHTINGS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className={labelClass}>Lens</span>
                  <select value={lens} onChange={(e) => setLens(e.target.value)} className={selectClass}>
                    {LENSES.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className={labelClass}>Shot</span>
                  <select value={shot} onChange={(e) => setShot(e.target.value)} className={selectClass}>
                    {SHOTS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <span className={labelClass}>Camera Angle</span>
                <select value={angle} onChange={(e) => setAngle(e.target.value)} className={selectClass}>
                  {ANGLES.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                </select>
              </div>
              <div className="space-y-1">
                <span className={labelClass}>Mood</span>
                <select value={mood} onChange={(e) => setMood(e.target.value)} className={selectClass}>
                  {MOODS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                </select>
              </div>
              <div className="space-y-1">
                <span className={labelClass}>Color Palette</span>
                <select value={palette} onChange={(e) => setPalette(e.target.value)} className={selectClass}>
                  {PALETTES.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                </select>
                <input value={customPalette} onChange={(e) => setCustomPalette(e.target.value)} placeholder="Custom: #ff6b35 + teal fog..." className="editorial-input w-full !text-xs font-mono mt-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className={labelClass}>Target</span>
                  <select value={platform} onChange={(e) => setPlatform(e.target.value as PlatformId)} className={selectClass}>
                    {PLATFORMS.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
                  </select>
                </div>
                <div className="space-y-1">
                  <span className={labelClass}>Count</span>
                  <select value={String(count)} onChange={(e) => setCount(parseInt(e.target.value, 10))} className={selectClass}>
                    {[1, 2, 3, 4].map((n) => (<option key={n} value={n}>{n} variant{n !== 1 ? "s" : ""}</option>))}
                  </select>
                </div>
              </div>
            </div>

            <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="editorial-button editorial-button--sm editorial-button--secondary w-full justify-center">
              <SlidersIcon className="w-3.5 h-3.5" />
              <span>{showAdvanced ? "Hide advanced" : "Advanced: voice, negative, tags"}</span>
            </button>

            {showAdvanced && (
              <div className="space-y-3 p-3 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)]">
                <div className="space-y-1">
                  <span className={labelClass}>Custom direction (appended to persona)</span>
                  <textarea value={customPersona} onChange={(e) => setCustomPersona(e.target.value)} rows={2} placeholder="e.g. shoot on expired 35mm film, light leaks, candid energy..." className="editorial-input w-full !text-xs font-mono resize-y" />
                </div>
                <div className="space-y-1">
                  <span className={labelClass}>Negative prompt</span>
                  <input value={negative} onChange={(e) => setNegative(e.target.value)} placeholder="blurry, watermark, extra limbs..." className="editorial-input w-full !text-xs font-mono" />
                  <div className="flex flex-wrap gap-1 pt-1">
                    {NEGATIVE_PROMPT_SUGGESTIONS.slice(0, 8).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNegative((prev) => (prev.includes(s) ? prev : prev ? `${prev}, ${s}` : s))}
                        className="font-mono text-[10px] px-1.5 py-0.5 border border-[var(--editorial-rule)] text-[var(--editorial-muted)] hover:border-red-400 hover:text-red-500 transition-all"
                      >
                        +{s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className={labelClass}>Custom modifier tags ({modifiers.length}/12)</span>
                  <div className="flex gap-1.5">
                    <input value={modInput} onChange={(e) => setModInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addModifier(); } }} placeholder="ultra-detailed skin pores..." className="editorial-input flex-1 !text-xs font-mono" />
                    <button type="button" onClick={addModifier} className="editorial-button editorial-button--sm editorial-button--secondary">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {modifiers.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {modifiers.map((m) => (
                        <button key={m} type="button" onClick={() => setModifiers((prev) => prev.filter((x) => x !== m))} className="font-mono text-[10px] px-1.5 py-0.5 bg-[var(--editorial-ink)] text-[var(--editorial-paper)] hover:bg-red-500 transition-all" title="Remove">
                          {m} ×
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudioWorkspace;
