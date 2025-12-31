import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  describeImageToText,
  generateImage,
  rewritePrompt,
  extractPromptFromImage,
} from "../services/geminiService";
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
} from "./icons";
import useSpeechToText from "../hooks/useSpeechToText";

interface StudioWorkspaceProps {
  onSendToBuilder: (prompt: string) => void;
  onJumpToImage: (prompt: string) => void;
  onSaveToLibrary: (prompt: string) => void;
}

type PersonaId = "photographer" | "painter" | "cgi" | "illustrator" | "anime";
type AspectRatio = "1:1" | "16:9" | "9:16";
type ImageAction = "reference" | "extract";

type ResultItem = {
  prompt: string;
  image?: string;
  status: "pending" | "done" | "error";
  error?: string;
};

const personas = [
  { id: "photographer", label: "Photographer", Icon: CameraIcon },
  { id: "painter", label: "Painter", Icon: BrushIcon },
  { id: "cgi", label: "CGI", Icon: LayersIcon },
  { id: "illustrator", label: "Illustrator", Icon: PaletteIcon },
  { id: "anime", label: "Anime", Icon: MagicWandIcon },
];

const lightingOptions = ["Cinematic", "Golden Hour", "Soft Diffused", "Neon"];
const cameraAngles = ["Eye Level", "Low Angle", "High Angle", "Dutch Tilt"];
const colorPalettes = ["Vibrant", "Muted Pastel", "Monochrome", "Warm"];

const StudioWorkspace: React.FC<StudioWorkspaceProps> = ({
  onSendToBuilder,
  onJumpToImage,
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

  const [persona, setPersona] = useState<PersonaId>("painter");
  const [promptAdherence, setPromptAdherence] = useState(0.45);
  const [promptLength, setPromptLength] = useState(0.35);
  const [lighting, setLighting] = useState(lightingOptions[0]);
  const [angle, setAngle] = useState(cameraAngles[0]);
  const [palette, setPalette] = useState(colorPalettes[0]);
  const [imageAction, setImageAction] = useState<ImageAction>("reference");

  const [count, setCount] = useState(3);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [inputStatus, setInputStatus] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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
      setInputStatus("Scanning image...");
      const description = await extractPromptFromImage(
        uploadedImage.base64,
        uploadedImage.mimeType,
      );
      if (description) {
        setInput(description);
        setTimeout(() => setInputStatus(""), 1500);
      } else {
        setInputStatus("Could not read image.");
      }
    } catch (error: any) {
      setInputStatus(error?.message || "Vision extraction failed.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleImageActionSelect = (mode: ImageAction) => {
    setImageAction(mode);
    if (mode === "extract" && uploadedImage) {
      triggerExtractPrompt();
    } else {
      setInputStatus("");
    }
  };

  const adornPrompt = (p: string) =>
    `${p}\n\nStyle cues: Lighting (${lighting}), Camera (${angle}), Palette (${palette}). Prompt adherence ${Math.round(promptAdherence * 100)}%.`;

  const runGeneration = async (quick = false) => {
    if (isExtracting) return;
    if (!input.trim() && !uploadedImage) return;
    const finalCount = quick ? 1 : count;

    setIsGenerating(true);
    setStatusMessage("");
    setResults([]);

    try {
      let thinkerInput = input.trim();
      if (uploadedImage && imageAction === "reference") {
        setStatusMessage("Reading image reference...");
        const desc = await describeImageToText(
          uploadedImage.base64,
          uploadedImage.mimeType,
        );
        thinkerInput = thinkerInput
          ? `${desc}\nUser note: ${thinkerInput}`
          : desc;
      }

      if (!thinkerInput) {
        thinkerInput = "High quality creative concept.";
      }

      setStatusMessage("Thinking + rewriting prompt...");
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

      setResults(queue);

      const updated: ResultItem[] = [];
      for (let i = 0; i < queue.length; i++) {
        const prompt = queue[i].prompt;
        try {
          setStatusMessage(`Rendering image ${i + 1}/${queue.length}...`);
          const img = await generateImage(prompt, "fast", aspectRatio);
          updated.push({ ...queue[i], image: img, status: "done" });
        } catch (err: any) {
          updated.push({
            ...queue[i],
            status: "error",
            error: err?.message || "Failed to render",
          });
        }
        setResults([...updated, ...queue.slice(i + 1)]);
      }
    } catch (error) {
      setStatusMessage("");
      setResults([]);
    } finally {
      setIsGenerating(false);
      setStatusMessage("");
    }
  };

  const handleQuickEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isExtracting) {
      e.preventDefault();
      runGeneration(true);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const mobileToggleLeft = () => setLeftOpen((p) => !p);
  const mobileToggleRight = () => setRightOpen((p) => !p);

  return (
    <div
      className="relative h-[calc(100vh-7rem)] min-h-[640px] w-full overflow-hidden rounded-3xl border border-gray-200 dark:border-white/10 bg-gradient-to-br from-slate-50 to-white dark:from-[#0d1015] dark:to-[#0f1724] shadow-2xl"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="absolute top-2 left-2 z-20 flex gap-2 lg:hidden">
        <button
          onClick={mobileToggleLeft}
          className="p-2 rounded-xl bg-white/70 dark:bg-white/10 border border-gray-200 dark:border-white/10 shadow"
        >
          <ListIcon className="w-4 h-4" />
        </button>
        <button
          onClick={mobileToggleRight}
          className="p-2 rounded-xl bg-white/70 dark:bg-white/10 border border-gray-200 dark:border-white/10 shadow"
        >
          <SlidersIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="absolute inset-0 flex">
        <div
          className={`transition-all duration-300 bg-white/80 dark:bg-white/5 backdrop-blur-xl border-r border-gray-200 dark:border-white/10 h-full flex flex-col ${
            leftOpen ? "w-[300px]" : "w-0"
          } overflow-hidden`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <ListIcon className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold uppercase text-gray-700 dark:text-gray-200">
                Logic & History
              </span>
            </div>
            <button
              onClick={() => setLeftOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
            >
              <ArrowLeftIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="flex border-b border-gray-200 dark:border-white/10 text-sm font-semibold">
            <button
              onClick={() => setLeftTab("history")}
              className={`flex-1 py-2 ${leftTab === "history" ? "text-emerald-600 border-b-2 border-emerald-500" : "text-gray-500"}`}
            >
              History
            </button>
            <button
              onClick={() => setLeftTab("batch")}
              className={`flex-1 py-2 ${leftTab === "batch" ? "text-emerald-600 border-b-2 border-emerald-500" : "text-gray-500"}`}
            >
              Batch
            </button>
          </div>

          <div className="p-4 flex-1 overflow-auto space-y-4">
            {leftTab === "history" ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                History feed coming soon. Generated prompts will appear here.
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  className={`p-4 rounded-2xl border ${
                    highlightBatch
                      ? "border-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]"
                      : "border-gray-200 dark:border-white/10"
                  } bg-white/70 dark:bg-white/5`}
                >
                  <div className="flex items-center justify-between text-sm font-semibold mb-2">
                    <span>Count: {count}</span>
                    <span className="text-xs text-gray-500">1 - 50</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Variables
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Use {"{curly braces}"} in the input for variables. Smart
                    detection auto-opens this tab.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 space-y-3">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Aspect Ratio
                  </p>
                  <div className="flex gap-2">
                    {(["1:1", "16:9", "9:16"] as AspectRatio[]).map((ar) => (
                      <button
                        key={ar}
                        onClick={() => setAspectRatio(ar)}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${
                          aspectRatio === ar
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200"
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>

                <button className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-emerald-500 shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
                  <RefreshIcon className="w-4 h-4" />
                  Zip Download
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 overflow-auto px-4 py-6">
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 pb-28">
              {results.length === 0 ? (
                <div className="col-span-full h-[320px] border-2 border-dashed border-gray-200 dark:border-white/10 rounded-3xl flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Generated images and prompts will appear here.
                </div>
              ) : (
                results.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white/80 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg overflow-hidden flex flex-col"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={`result-${idx}`}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-100 dark:bg-white/5 flex items-center justify-center text-xs text-gray-500">
                        {item.status === "pending"
                          ? "Rendering..."
                          : item.error || "No image"}
                      </div>
                    )}
                    <div className="p-4 space-y-3">
                      <p className="text-xs text-gray-600 dark:text-gray-300 font-mono leading-relaxed">
                        {item.prompt}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onSendToBuilder(item.prompt)}
                          className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-white/10 text-xs font-semibold"
                        >
                          Edit Prompt
                        </button>
                        <button
                          onClick={() => onJumpToImage(item.prompt)}
                          className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold"
                        >
                          Reuse
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCopy(item.prompt, idx)}
                          className="flex-1 py-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-semibold"
                        >
                          {copiedIndex === idx ? (
                            <span className="flex items-center justify-center gap-2">
                              <CheckIcon className="w-4 h-4" />
                              Copied
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <CopyIcon className="w-4 h-4" />
                              Copy
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => onSaveToLibrary(item.prompt)}
                          className="flex-1 py-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-semibold"
                        >
                          <span className="flex items-center justify-center gap-2">
                            <FolderIcon className="w-4 h-4" />
                            Save
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div
          className={`transition-all duration-300 bg-white/80 dark:bg-white/5 backdrop-blur-xl border-l border-gray-200 dark:border-white/10 h-full flex flex-col ${
            rightOpen ? "w-[320px]" : "w-0"
          } overflow-hidden`}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/10">
            <div className="flex items-center gap-2">
              <SlidersIcon className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-semibold uppercase text-gray-700 dark:text-gray-200">
                Thinker & Style
              </span>
            </div>
            <button
              onClick={() => setRightOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
            >
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-auto">
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Thinker Persona
              </p>
              <div className="grid grid-cols-2 gap-2">
                {personas.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setPersona(id as PersonaId)}
                    className={`p-3 rounded-2xl border flex items-center gap-2 ${persona === id ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200" : "border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5"}`}
                  >
                    <span
                      className={`p-2 rounded-xl ${
                        persona === id
                          ? "bg-emerald-500 text-white"
                          : "bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="text-sm font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-600 dark:text-gray-300">
                  <span>Prompt Adherence</span>
                  <span>{Math.round(promptAdherence * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={promptAdherence}
                  onChange={(e) =>
                    setPromptAdherence(parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-600 dark:text-gray-300">
                  <span>Prompt Length</span>
                  <span>
                    {promptLength <= 0.33
                      ? "Short"
                      : promptLength >= 0.67
                        ? "Verbose"
                        : "Balanced"}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={promptLength}
                  onChange={(e) => setPromptLength(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Lighting
                </p>
                <select
                  value={lighting}
                  onChange={(e) => setLighting(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111827] px-3 py-2 text-sm"
                >
                  {lightingOptions.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Camera Angle
                </p>
                <select
                  value={angle}
                  onChange={(e) => setAngle(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111827] px-3 py-2 text-sm"
                >
                  {cameraAngles.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Color Palette
                </p>
                <select
                  value={palette}
                  onChange={(e) => setPalette(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111827] px-3 py-2 text-sm"
                >
                  {colorPalettes.map((opt) => (
                    <option key={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-5 flex justify-center pointer-events-none">
        <div className="w-full max-w-4xl px-4 pointer-events-auto">
          <div className="relative bg-white/80 dark:bg-white/10 backdrop-blur-2xl border border-gray-200 dark:border-white/10 shadow-2xl rounded-full flex items-center gap-3 px-4 py-3">
            {uploadedImage && (
              <div className="absolute -top-16 left-4 bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl flex items-center gap-3 px-3 py-2">
                <img
                  src={uploadedImage.preview}
                  alt="attached reference"
                  className="w-10 h-10 rounded-xl object-cover"
                />
                <div className="text-xs text-gray-600 dark:text-gray-200">
                  <p className="font-semibold">Image attached</p>
                  <p className="w-32 truncate">{uploadedImage.name}</p>
                </div>
                <button
                  onClick={clearUploadedImage}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/10"
                >
                  X
                </button>
              </div>
            )}

            {uploadedImage && (
              <div className="absolute left-28 -top-5 flex items-center gap-2 bg-white/90 dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-full px-2 py-1 shadow-md text-[11px]">
                <button
                  onClick={() => handleImageActionSelect("reference")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full font-semibold ${
                    imageAction === "reference"
                      ? "bg-emerald-500 text-white"
                      : "text-gray-600 dark:text-gray-300"
                  }`}
                >
                  <span>{"\u{1F5BC}"}</span>
                  <span className="hidden sm:inline">Image Reference</span>
                </button>
                <button
                  onClick={() => handleImageActionSelect("extract")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full font-semibold ${
                    imageAction === "extract"
                      ? "bg-cyan-500 text-white"
                      : "text-gray-600 dark:text-gray-300"
                  }`}
                >
                  <span>{"\u{1F441}"}</span>
                  <span className="hidden sm:inline">Extract Prompt</span>
                </button>
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20"
              title="Upload image"
            >
              <ImagePlusIcon className="w-5 h-5 text-gray-600 dark:text-gray-200" />
            </button>
            {isSupported && (
              <button
                onClick={startListening}
                className={`p-2 rounded-full ${isListening ? "bg-gradient-to-r from-red-500 to-pink-500 text-white animate-pulse" : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-200"}`}
              >
                {isListening ? (
                  <MicOffIcon className="w-5 h-5" />
                ) : (
                  <MicIcon className="w-5 h-5" />
                )}
              </button>
            )}
            <input
              ref={bottomInputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleQuickEnter}
              readOnly={isExtracting}
              className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Describe your imagination..."
            />
            <button
              onClick={() => runGeneration(false)}
              disabled={isGenerating || isExtracting}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-semibold shadow-lg hover:shadow-xl disabled:opacity-60"
            >
              {isGenerating ? "Working..." : "Generate"}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            {isExtracting && (
              <div className="absolute inset-0 rounded-full bg-white/80 dark:bg-black/40 flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-200">
                <span className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
                Scanning image...
              </div>
            )}
            {!isExtracting && inputStatus && (
              <div className="absolute inset-x-6 -bottom-7 text-xs text-gray-500 dark:text-gray-300">
                {inputStatus}
              </div>
            )}
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="absolute right-4 bottom-28 bg-white/90 dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-700 dark:text-gray-200 shadow">
          {statusMessage}
        </div>
      )}
    </div>
  );
};

export default StudioWorkspace;
