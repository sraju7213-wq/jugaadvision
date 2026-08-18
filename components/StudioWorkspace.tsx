import React, { useEffect, useMemo, useRef, useState } from "react";
import { ProcessingAnimation } from "./ProcessingAnimation";
import {
  describeImageToText,
  rewritePrompt,
  extractPromptFromImage,
} from "../services/geminiService";
import useLocalStorage from "../hooks/useLocalStorage";
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
import { Loader2 } from "lucide-react";
import useSpeechToText from "../hooks/useSpeechToText";

interface StudioWorkspaceProps {
  onSendToBuilder: (prompt: string) => void;
  onSaveToLibrary: (prompt: string, platform?: any, imageUrl?: string, tags?: string[]) => void;
}

type PersonaId = "photographer" | "painter" | "cgi" | "illustrator" | "anime";
type AspectRatio = "1:1" | "16:9" | "9:16";
type ImageAction = "reference" | "extract";

interface ResultItem {
  prompt: string;
  status: "pending" | "done" | "error";
  error?: string;
}

interface StudioHistoryItem {
  id: string;
  timestamp: string;
  input: string;
  persona: PersonaId;
  lighting: string;
  angle: string;
  palette: string;
  promptAdherence: number;
  promptLength: number;
  results: Array<{ prompt: string }>;
}

const personas = [
  { id: "photographer" as PersonaId, label: "Photographer", Icon: CameraIcon },
  { id: "painter" as PersonaId, label: "Painter", Icon: BrushIcon },
  { id: "cgi" as PersonaId, label: "CGI Master", Icon: LayersIcon },
  { id: "illustrator" as PersonaId, label: "Illustrator", Icon: PaletteIcon },
  { id: "anime" as PersonaId, label: "Anime Director", Icon: MagicWandIcon },
];

const lightingOptions = ["Cinematic", "Golden Hour", "Soft Diffused", "Neon / Cyberpunk", "Studio Spotlight"];
const cameraAngles = ["Eye Level", "Low Angle", "High Overhead", "Dutch Tilt", "Macro Close-Up"];
const colorPalettes = ["Vibrant / Rich", "Muted Pastel", "Monochrome High-Contrast", "Warm Analog", "Cool Sci-Fi"];

const StudioWorkspace: React.FC<StudioWorkspaceProps> = ({
  onSendToBuilder,
  onSaveToLibrary,
}) => {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<"history" | "batch">("history");

  const [input, setInput] = useState("");
  const [uploadedImage, setUploadedImage] = useState<{
    preview: string;
    base64: string;
    mimeType: string;
    name: string;
  } | null>(null);

  // Settings
  const [persona, setPersona] = useState<PersonaId>("photographer");
  const [promptAdherence, setPromptAdherence] = useState(0.5);
  const [promptLength, setPromptLength] = useState(0.5);
  const [lighting, setLighting] = useState(lightingOptions[0]);
  const [angle, setAngle] = useState(cameraAngles[0]);
  const [palette, setPalette] = useState(colorPalettes[0]);
  const [imageAction, setImageAction] = useState<ImageAction>("reference");

  // Output state
  const [count, setCount] = useState(2);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [inputStatus, setInputStatus] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savedIndex, setSavedIndex] = useState<number | null>(null);

  // Persistent History
  const [history, setHistory] = useLocalStorage<StudioHistoryItem[]>("studio-history", []);

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
    new Promise<{
      preview: string;
      base64: string;
      mimeType: string;
      name: string;
    }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        resolve({
          preview: dataUrl,
          base64,
          mimeType: file.type,
          name: file.name,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const data = await fileToBase64(file);
    setUploadedImage(data);
    setImageAction("reference");
    setInputStatus("");
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) await handleFile(e.dataTransfer.files[0]);
  };

  const clearUploadedImage = () => {
    setUploadedImage(null);
    setImageAction("reference");
    setInputStatus("");
  };

  const triggerExtractPrompt = async () => {
    if (!uploadedImage || isExtracting) return;
    try {
      setIsExtracting(true);
      setInputStatus("Scanning visual elements...");
      const description = await extractPromptFromImage(
        uploadedImage.base64,
        uploadedImage.mimeType,
      );
      if (description) {
        setInput(description);
        setTimeout(() => setInputStatus(""), 1500);
      } else {
        setInputStatus("Could not extract details.");
      }
    } catch (error: any) {
      setInputStatus(error?.message || "Vision extraction failed.");
    } finally {
      setIsExtracting(false);
    }
  };

  const adornPrompt = (p: string) =>
    `${p}, ${lighting} lighting, ${angle} angle, ${palette} color grading`;

  const runGeneration = async (quick = false) => {
    if (isExtracting || isGenerating) return;
    if (!input.trim() && !uploadedImage) return;
    const finalCount = quick ? 1 : count;

    setIsGenerating(true);
    setStatusMessage("Consulting AI Persona...");
    setResults([]);

    try {
      let thinkerInput = input.trim();
      if (uploadedImage && imageAction === "reference") {
        setStatusMessage("Analyzing visual reference...");
        const desc = await describeImageToText(
          uploadedImage.base64,
          uploadedImage.mimeType,
        );
        thinkerInput = thinkerInput ? `${desc}\nUser note: ${thinkerInput}` : desc;
      }

      if (!thinkerInput) {
        thinkerInput = "Cinematic visual masterpiece.";
      }

      setStatusMessage("Synthesizing prompt blueprint...");
      const thinkerPrompts = await rewritePrompt(
        thinkerInput,
        persona,
        promptLength,
      );

      const queue: ResultItem[] = Array.from({ length: finalCount }).map(
        (_, idx) => ({
          prompt: adornPrompt(
            thinkerPrompts[idx % thinkerPrompts.length] || thinkerPrompts[0],
          ),
          status: "pending",
        }),
      );

      // Apply all prompts (no image rendering)
      const updated: ResultItem[] = queue.map((item) => ({ ...item, status: "done" as const }));
      setResults(updated);

      // Save to Session History
      const newHistoryItem: StudioHistoryItem = {
        id: `studio_${Date.now()}`,
        timestamp: new Date().toISOString(),
        input: thinkerInput,
        persona,
        lighting,
        angle,
        palette,
        promptAdherence,
        promptLength,
        results: updated.map((u) => ({ prompt: u.prompt })),
      };

      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 20)]);
    } catch (error) {
      console.error("Studio generation failed:", error);
    } finally {
      setIsGenerating(false);
      setStatusMessage("");
    }
  };

  const handleRestoreHistoryItem = (item: StudioHistoryItem) => {
    setInput(item.input);
    setPersona(item.persona);
    setLighting(item.lighting);
    setAngle(item.angle);
    setPalette(item.palette);
    setPromptAdherence(item.promptAdherence);
    setPromptLength(item.promptLength);
    if (item.results && item.results.length > 0) {
      setResults(
        item.results.map((r) => ({
          prompt: r.prompt,
          status: "done",
        }))
      );
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleSave = (text: string, index?: number) => {
    onSaveToLibrary(text, undefined, undefined, ["studio", persona]);
    if (index !== undefined) {
      setSavedIndex(index);
      setTimeout(() => setSavedIndex(null), 1500);
    }
  };

  const mobileToggleLeft = () => setLeftOpen((p) => !p);
  const mobileToggleRight = () => setRightOpen((p) => !p);

  return (
    <div
      className="feature-theme-studio relative h-[calc(100vh-7rem)] min-h-[640px] w-full overflow-hidden editorial-panel shadow-sm"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Mobile Sidebar Toggles */}
      <div className="absolute top-3 left-3 z-20 flex gap-2 lg:hidden">
        <button
          type="button"
          onClick={mobileToggleLeft}
          className="editorial-button editorial-button--sm editorial-button--secondary p-2 shadow-sm"
        >
          <ListIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={mobileToggleRight}
          className="editorial-button editorial-button--sm editorial-button--secondary p-2 shadow-sm"
        >
          <SlidersIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute inset-0 flex">
        {/* Left Panel: Real History & Batch Logic */}
        <div
          className={`transition-all duration-300 bg-[var(--editorial-surface)] border-r border-[var(--editorial-rule)] h-full flex flex-col ${
            leftOpen ? "w-[300px]" : "w-0"
          } overflow-hidden z-10`}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--editorial-surface-strong)] border-b border-[var(--editorial-rule)]">
            <div className="flex items-center gap-2">
              <ListIcon className="w-3.5 h-3.5 text-[var(--editorial-coral)]" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-ink)]">
                Studio Archive
              </span>
            </div>
            <button
              type="button"
              onClick={() => setLeftOpen(false)}
              className="p-1 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex border-b border-[var(--editorial-rule)] font-mono text-[11px] font-bold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setLeftTab("history")}
              className={`flex-1 py-2.5 transition-all text-center ${
                leftTab === "history"
                  ? "text-[var(--editorial-coral)] border-b-2 border-[var(--editorial-coral)] bg-[var(--editorial-surface-strong)]"
                  : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
              }`}
            >
              Archive ({history.length})
            </button>
            <button
              type="button"
              onClick={() => setLeftTab("batch")}
              className={`flex-1 py-2.5 transition-all text-center ${
                leftTab === "batch"
                  ? "text-[var(--editorial-coral)] border-b-2 border-[var(--editorial-coral)] bg-[var(--editorial-surface-strong)]"
                  : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
              }`}
            >
              Settings
            </button>
          </div>

          <div className="p-3.5 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
            {leftTab === "history" ? (
              history.length === 0 ? (
                <div className="font-mono text-xs text-[var(--editorial-muted)] text-center py-10">
                  No previous sessions in archive.
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">Recent Sessions</span>
                    <button
                      type="button"
                      onClick={handleClearHistory}
                      className="font-mono text-[10px] text-red-500 hover:underline uppercase"
                    >
                      Clear
                    </button>
                  </div>
                  {history.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => handleRestoreHistoryItem(h)}
                      className="p-3 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)] cursor-pointer transition-all hover:shadow-[2px_2px_0_var(--editorial-coral)] space-y-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="editorial-badge editorial-badge--violet">
                          {h.persona}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--editorial-muted)]">
                          {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="font-serif text-xs text-[var(--editorial-ink)] line-clamp-2 m-0">
                        {h.input}
                      </p>
                    </div>
                  ))}
                </>
              )
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)] space-y-2">
                  <span className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">Aspect Ratio</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["1:1", "16:9", "9:16"] as AspectRatio[]).map((ar) => (
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

                <div className="p-3.5 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)] space-y-1">
                  <p className="font-mono text-[10.5px] font-bold text-[var(--editorial-ink)] uppercase tracking-wider m-0">Dynamic Variables</p>
                  <p className="font-mono text-[11px] text-[var(--editorial-muted)] m-0">
                    Use <code className="text-[var(--editorial-coral)] font-mono">{"{brackets}"}</code> in your prompt to spawn batch variants automatically.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Central Visual Canvas */}
        <div className="flex-1 relative overflow-hidden flex flex-col bg-[var(--editorial-surface)]">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-28">
              {results.length === 0 && !isGenerating ? (
                <div className="col-span-full h-[320px] border border-dashed border-[var(--editorial-rule-strong)] bg-[var(--editorial-surface-strong)] flex flex-col items-center justify-center text-center p-6 text-[var(--editorial-muted)]">
                  <SparklesIcon className="w-8 h-8 mb-2 text-[var(--editorial-coral)] opacity-60" />
                  <h3 className="font-serif text-base text-[var(--editorial-ink)] mb-1">
                    Studio Canvas Ready
                  </h3>
                  <p className="font-mono text-xs max-w-sm m-0">
                    Enter your scene concept below or select creative parameters on the right to synthesize master prompts.
                  </p>
                </div>
              ) : (
                results.map((item, idx) => (
                  <div
                    key={idx}
                    className="editorial-panel overflow-hidden flex flex-col justify-between animate-fade-in"
                  >
                    <div className="p-4 space-y-3 flex-grow flex flex-col justify-between">
                      <p className="font-mono text-xs text-[var(--editorial-ink)] leading-relaxed m-0">
                        {item.prompt}
                      </p>

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--editorial-rule)]">
                        <button
                          type="button"
                          onClick={() => handleCopy(item.prompt, idx)}
                          className="editorial-button editorial-button--sm editorial-button--secondary flex-1 justify-center"
                        >
                          {copiedIndex === idx ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
                          <span>{copiedIndex === idx ? "Copied" : "Copy"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSave(item.prompt, idx)}
                          className="editorial-button editorial-button--sm editorial-button--secondary flex-1 justify-center"
                        >
                          {savedIndex === idx ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <FolderIcon className="w-3.5 h-3.5" />}
                          <span>{savedIndex === idx ? "Saved" : "Save"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSendToBuilder(item.prompt)}
                          className="editorial-button editorial-button--sm editorial-button--primary"
                        >
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
              {isSupported && (
                <button
                  type="button"
                  onClick={startListening}
                  className={`p-2 border transition-all ${
                    isListening ? "bg-red-500 text-white border-red-500 animate-pulse" : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-coral)]"
                  }`}
                  title="Voice Input"
                >
                  {isListening ? <MicOffIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />}
                </button>
              )}

              <input
                ref={bottomInputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isGenerating) {
                    runGeneration();
                  }
                }}
                placeholder="Describe what you want to synthesize..."
                className="flex-grow bg-transparent border-none outline-none font-mono text-xs text-[var(--editorial-ink)] placeholder-[var(--editorial-muted)] px-2"
              />

              <button
                type="button"
                onClick={() => runGeneration()}
                disabled={isGenerating || !input.trim()}
                className="editorial-button editorial-button--sm editorial-button--primary editorial-button--coral"
              >
                {isGenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 shrink-0" />
                ) : (
                  <SparklesIcon className="w-3.5 h-3.5" />
                )}
                <span>{isGenerating ? "Synthesizing..." : "Synthesize"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Persona & Semantic Sliders */}
        <div
          className={`transition-all duration-300 bg-[var(--editorial-surface)] border-l border-[var(--editorial-rule)] h-full flex flex-col ${
            rightOpen ? "w-[300px]" : "w-0"
          } overflow-hidden z-10`}
        >
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--editorial-surface-strong)] border-b border-[var(--editorial-rule)]">
            <div className="flex items-center gap-2">
              <SlidersIcon className="w-3.5 h-3.5 text-[var(--editorial-coral)]" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-ink)]">
                Persona & Controls
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRightOpen(false)}
              className="p-1 text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
            >
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-3.5 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
            {/* Persona Selector */}
            <div className="space-y-1.5">
              <span className="font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">AI Persona Lens</span>
              <div className="grid grid-cols-1 gap-1">
                {personas.map((p) => {
                  const Icon = p.Icon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPersona(p.id)}
                      className={`p-2 border text-xs font-mono flex items-center gap-2 transition-all ${
                        persona === p.id
                          ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)] font-bold shadow-[2px_2px_0_var(--editorial-coral)]"
                          : "bg-[var(--editorial-paper)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)] hover:text-[var(--editorial-ink)]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Semantic Slider: Adherence */}
            <div className="space-y-1.5 p-3 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)]">
              <div className="flex justify-between items-center font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase">
                <span>Adherence</span>
                <span className="text-[var(--editorial-coral)]">
                  {promptAdherence <= 0.35 ? "Creative Expansion" : promptAdherence >= 0.65 ? "Strict Wording" : "Balanced"}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={promptAdherence}
                onChange={(e) => setPromptAdherence(parseFloat(e.target.value))}
                className="w-full h-1 bg-[var(--editorial-rule)] rounded-none appearance-none cursor-pointer accent-[var(--editorial-coral)]"
              />
              <div className="flex justify-between font-mono text-[9px] text-[var(--editorial-muted)]">
                <span>Exploration</span>
                <span>Strict</span>
              </div>
            </div>

            {/* Semantic Slider: Length */}
            <div className="space-y-1.5 p-3 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)]">
              <div className="flex justify-between items-center font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase">
                <span>Prompt Length</span>
                <span className="text-[var(--editorial-coral)]">
                  {promptLength <= 0.33 ? "Concise" : promptLength >= 0.67 ? "Exhaustive" : "Balanced"}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={promptLength}
                onChange={(e) => setPromptLength(parseFloat(e.target.value))}
                className="w-full h-1 bg-[var(--editorial-rule)] rounded-none appearance-none cursor-pointer accent-[var(--editorial-coral)]"
              />
              <div className="flex justify-between font-mono text-[9px] text-[var(--editorial-muted)]">
                <span>Punchy</span>
                <span>Detailed</span>
              </div>
            </div>

            {/* Aesthetic Selectors */}
            <div className="space-y-2.5 pt-1">
              <div className="space-y-1">
                <span className="font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">Lighting Style</span>
                <select
                  value={lighting}
                  onChange={(e) => setLighting(e.target.value)}
                  className="editorial-select w-full text-xs font-mono"
                >
                  {lightingOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span className="font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">Camera Angle</span>
                <select
                  value={angle}
                  onChange={(e) => setAngle(e.target.value)}
                  className="editorial-select w-full text-xs font-mono"
                >
                  {cameraAngles.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <span className="font-mono text-[10px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">Color Palette</span>
                <select
                  value={palette}
                  onChange={(e) => setPalette(e.target.value)}
                  className="editorial-select w-full text-xs font-mono"
                >
                  {colorPalettes.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudioWorkspace;
