import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { generateImage, enhancePrompt } from "../services/geminiService";
import {
  BrainCircuitIcon,
  PaletteIcon,
  MagicWandIcon,
  RefreshIcon,
  MicIcon,
  MicOffIcon,
  CopyIcon,
  CheckIcon,
  FolderIcon,
  ImageIcon,
} from "./icons";
import useSpeechToText from "../hooks/useSpeechToText";
import Tooltip from "./Tooltip";

interface ImageGeneratorProps {
  onSaveToLibrary: (prompt: string, platform?: any, imageUrl?: string) => void;
}

const creativeTemplates = [
  {
    title: "Cyberpunk",
    prompt:
      "Cyberpunk street at night, neon lights reflecting on wet pavement, cinematic, hyper-detailed, 8k",
  },
  {
    title: "Logo Design",
    prompt:
      "Minimalist vector logo of a fox, orange and white, flat design, white background",
  },
  {
    title: "3D Isometric",
    prompt:
      "Futuristic 3D isometric room, pastel colors, cozy vibe, glowing screens, detailed miniature",
  },
  {
    title: "Oil Painting",
    prompt:
      "Oil painting of a cozy cottage in a lush forest, sunset, detailed brushstrokes, warm colors",
  },
];

const ImageGenerator: React.FC<ImageGeneratorProps> = ({ onSaveToLibrary }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPrompt = searchParams.get("prompt");

  const [modelType, setModelType] = useState<"fast" | "premium">("fast");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const [promptLength, setPromptLength] = useState<"Short" | "Medium" | "Long">(
    "Long",
  );
  const [selectedStyle, setSelectedStyle] = useState("Cinematic");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);

  const [isLoading, setIsLoading] = useState(false);

  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [smartPrompting, setSmartPrompting] = useState(false);

  const { isListening, isSupported, startListening } = useSpeechToText(
    (text) => {
      setPrompt((prev) => prev + (prev ? " " : "") + text);
    },
  );

  useEffect(() => {
    if (initialPrompt) {
      setPrompt(decodeURIComponent(initialPrompt));
    }
  }, [initialPrompt]);

  // Mounted ref for cleanup - prevents state updates on unmounted component
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const handleEnhance = async () => {
    // Prevent double clicks
    if (isThinking) return;
    if (!prompt.trim()) return;

    setIsThinking(true);
    setError("");

    try {
      const enhanced = await enhancePrompt(prompt, selectedStyle, promptLength);
      if (isMounted.current) {
        setPrompt(enhanced);
      }
    } catch (e) {
      console.error("Enhancement failed:", e);
      if (isMounted.current) {
        setError("AI is busy. Please try again.");
      }
    } finally {
      // THIS IS CRITICAL - It must run no matter what
      if (isMounted.current) {
        setIsThinking(false);
      }
    }
  };

  // Cycling loading messages
  useEffect(() => {
    let interval: any;
    if (isLoading) {
      setLoadingStage(0);
      interval = setInterval(() => {
        setLoadingStage((prev) => (prev + 1) % 4);
      }, 2000);
    } else {
      setLoadingStage(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const LOADING_MESSAGES = [
    "Analyzing Concept...",
    "Diffusing Noise...",
    "Refining Details...",
    "Finalizing Masterpiece...",
  ];

  const handleGenerate = async () => {
    // Prevent double clicks
    if (isLoading) return;

    if (!prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }

    setIsLoading(true);
    setError("");
    setGeneratedImage(null);

    try {
      // If Smart Prompting is enabled, enhance the prompt first
      let finalPrompt = prompt;
      if (smartPrompting) {
        try {
          finalPrompt = await enhancePrompt(prompt, selectedStyle, promptLength);
          if (isMounted.current) {
            setPrompt(finalPrompt);
          }
        } catch (enhanceError) {
          console.warn("Smart prompting failed, using original prompt", enhanceError);
        }
      }
      const imageUrl = await generateImage(finalPrompt, modelType, aspectRatio);
      if (isMounted.current) {
        setGeneratedImage(imageUrl);
      }
    } catch (e) {
      console.error("Generation failed:", e);
      if (isMounted.current) {
        setError(e instanceof Error ? e.message : "AI is busy. Please try again.");
      }
    } finally {
      // THIS IS CRITICAL - It must run no matter what
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const handleDownload = () => {
    if (generatedImage) {
      const link = document.createElement("a");
      link.href = generatedImage;
      link.download = `generated-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleCopy = () => {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (!prompt) return;
    onSaveToLibrary(prompt, undefined, generatedImage || undefined);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleEditImage = (imageUrl: string) => {
    navigate(`/edit?image=${encodeURIComponent(imageUrl)}`);
  };

  const aspectRatios = ["1:1", "16:9", "9:16", "4:3", "3:4"];

  const handleReset = () => {
    setGeneratedImage(null);
    setError("");
    setIsLoading(false);
  };

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-8 px-2 sm:px-0 animate-slide-up-fade flex flex-col lg:flex-row gap-4 sm:gap-8 min-h-[calc(100vh-9rem)]">
      {/* Left Panel (Controls) */}
      <div className="w-full lg:w-1/3 flex flex-col gap-6">
        <div className="bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl backdrop-blur-md flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-500 dark:text-blue-400 shadow-sm">
                <PaletteIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Generate
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Turn text into visuals.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {/* Smart Prompting Toggle */}
              <Tooltip content="Auto-enhance prompts before generating">
                <button
                  type="button"
                  onClick={() => setSmartPrompting(!smartPrompting)}
                  aria-label={smartPrompting ? "Disable Smart Prompting" : "Enable Smart Prompting"}
                  aria-pressed={smartPrompting}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 ${smartPrompting
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                    : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20"
                    }`}
                >
                  <BrainCircuitIcon className="w-4 h-4" aria-hidden="true" />
                  <span className="text-xs font-semibold">Smart</span>
                  <div
                    className={`w-8 h-4 rounded-full transition-all duration-300 relative ${smartPrompting ? "bg-white/30" : "bg-gray-300 dark:bg-white/20"
                      }`}
                  >
                    <div
                      className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300 ${smartPrompting
                        ? "right-0.5 bg-white"
                        : "left-0.5 bg-gray-500 dark:bg-gray-400"
                        }`}
                    />
                  </div>
                </button>
              </Tooltip>
              <Tooltip content="Reset All">
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label="Reset all settings"
                  className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
                >
                  <RefreshIcon className="w-5 h-5" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>
          </div>

          <div className="flex-grow space-y-6">
            {/* Prompt Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-end px-1">
                <label
                  htmlFor="prompt-input"
                  className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                >
                  Prompt
                </label>
                <div className="flex gap-1">
                  <Tooltip content="Deep Thinker: Rewrite & Enhance">
                    <button
                      type="button"
                      onClick={handleEnhance}
                      disabled={isThinking || !prompt.trim()}
                      aria-label="Enhance prompt with AI"
                      className={`p-1.5 rounded-lg transition-colors ${isThinking ? "bg-indigo-500 text-white animate-pulse" : "hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400"}`}
                    >
                      <BrainCircuitIcon className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Copy Prompt">
                    <button
                      onClick={handleCopy}
                      aria-label="Copy Prompt"
                      className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
                    >
                      {copied ? (
                        <CheckIcon className="w-3.5 h-3.5" />
                      ) : (
                        <CopyIcon className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </Tooltip>
                  <Tooltip content="Save to Library">
                    <button
                      onClick={handleSave}
                      aria-label="Save Prompt"
                      className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
                    >
                      {saved ? (
                        <CheckIcon className="w-3.5 h-3.5" />
                      ) : (
                        <FolderIcon className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </Tooltip>
                </div>
              </div>
              <div className="relative">
                <textarea
                  id="prompt-input"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what you want to see..."
                  className="w-full h-40 px-4 py-3 bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/10 rounded-2xl text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm placeholder-gray-400 dark:placeholder-white/20"
                />
                {isSupported && (
                  <button
                    type="button"
                    onClick={startListening}
                    aria-label={isListening ? "Stop voice input" : "Start voice input"}
                    className={`absolute bottom-3 right-3 p-2.5 rounded-xl transition-all shadow-md hover:scale-105 active:scale-95 flex items-center gap-2 ${isListening ? "bg-red-500 animate-pulse text-white" : "bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-white hover:bg-gray-300 dark:hover:bg-white/20"}`}
                  >
                    {isListening ? (
                      <MicOffIcon className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <MicIcon className="w-4 h-4" aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Settings Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
                  Model
                </label>
                <select
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value as any)}
                  className="w-full px-3 py-3 rounded-xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-900 dark:text-white outline-none focus:border-indigo-500/50 appearance-none"
                >
                  <option value="fast">Free</option>
                  <option value="premium">Premium (HD)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
                  Ratio
                </label>
                <Tooltip content={modelType !== "premium" ? "Only available with Premium" : "Select aspect ratio"}>
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    disabled={modelType === "fast"}
                    className="w-full px-3 py-3 rounded-xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-900 dark:text-white outline-none focus:border-indigo-500/50 disabled:opacity-50 appearance-none"
                  >
                    {aspectRatios.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Tooltip>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
                  Style
                </label>
                <select
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-900 dark:text-white outline-none focus:border-indigo-500/50 appearance-none"
                >
                  {[
                    "Cinematic",
                    "Photorealistic",
                    "Anime",
                    "Digital Art",
                    "Oil Painting",
                    "3D Render",
                    "Minimalist",
                    "Cyberpunk",
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
                  Length
                </label>
                <select
                  value={promptLength}
                  onChange={(e) =>
                    setPromptLength(
                      e.target.value as "Short" | "Medium" | "Long",
                    )
                  }
                  className="w-full px-3 py-3 rounded-xl bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-900 dark:text-white outline-none focus:border-indigo-500/50 appearance-none"
                >
                  <option value="Short">Short</option>
                  <option value="Medium">Medium</option>
                  <option value="Long">Long</option>
                </select>
              </div>
            </div>

            {/* Templates */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-1">
                Templates
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {creativeTemplates.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(t.prompt)}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-lg text-xs whitespace-nowrap text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20 transition-all"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Negative Prompt */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Negative Prompt
                </label>
                <div className="flex gap-1">
                  {["blurry", "low quality", "watermark", "text"].map((term) => (
                    <button
                      key={term}
                      onClick={() => setNegativePrompt((prev) =>
                        prev.includes(term) ? prev : (prev ? prev + ", " + term : term)
                      )}
                      className="px-2 py-0.5 text-[10px] bg-red-500/10 text-red-500 dark:text-red-400 rounded-md hover:bg-red-500/20 transition-colors"
                    >
                      + {term}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="e.g., blurry, low quality, watermark..."
                className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/10 rounded-2xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-sm placeholder-gray-400 dark:placeholder-white/20"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs font-medium text-center">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className={`w-full py-4 rounded-2xl font-bold text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-6 overflow-hidden relative group ${isLoading ? "bg-indigo-600 animate-breathing" : "bg-gradient-cta hover:scale-[1.02]"}`}
          >
            {isLoading ? (
              "Generating..."
            ) : (
              <>
                <MagicWandIcon className="w-5 h-5" /> Generate Image
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Panel (Preview) */}
      <div className="w-full lg:w-2/3 h-full">
        <div className="bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl backdrop-blur-md h-full min-h-[300px] sm:min-h-[400px] lg:min-h-[600px] flex flex-col items-center justify-center relative overflow-hidden group">
          {generatedImage ? (
            <>
              <img
                src={generatedImage}
                alt={`Generated image for prompt: ${prompt}`}
                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-slide-up-fade"
              />
              <div className="absolute bottom-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0">
                <Tooltip content="Generate Again">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    aria-label="Generate image again"
                    className="p-3 bg-white dark:bg-black/50 backdrop-blur-md rounded-xl hover:bg-gray-100 dark:hover:bg-black/70 transition-all text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 shadow-lg"
                  >
                    <RefreshIcon className="w-5 h-5" aria-hidden="true" />
                  </button>
                </Tooltip>
                <Tooltip content="Download Image">
                  <button
                    onClick={handleDownload}
                    className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-bold shadow-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-all"
                  >
                    Download
                  </button>
                </Tooltip>
                <Tooltip content="Edit in Image Editor">
                  <button
                    type="button"
                    onClick={() => handleEditImage(generatedImage)}
                    aria-label="Edit image in Image Editor"
                    className="p-3 bg-white dark:bg-black/50 backdrop-blur-md rounded-xl hover:bg-gray-100 dark:hover:bg-black/70 transition-all text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 shadow-lg"
                  >
                    <ImageIcon className="w-5 h-5" aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-200 dark:border-white/5">
                <PaletteIcon className="w-10 h-10 text-gray-400 dark:text-gray-500 opacity-50" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Ready to Create
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enter a prompt to visualize your idea.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-white/60 dark:bg-black/80 backdrop-blur-md z-20 flex flex-col items-center justify-center animate-fade-in transition-all duration-500">
              {/* Central Abstract Ring Loader */}
              <div className="relative w-48 h-48 flex items-center justify-center">
                {/* Outer spinning gradient ring */}
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 border-r-purple-500 border-b-pink-500 opacity-80 animate-spin-slow blur-sm"></div>
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-indigo-400 border-r-purple-400 border-b-pink-400 animate-spin"></div>

                {/* Inner pulsing circle */}
                <div className="w-32 h-32 bg-white/10 dark:bg-white/5 rounded-full backdrop-blur-xl border border-white/20 flex items-center justify-center animate-pulse-ring relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20"></div>
                </div>

                {/* Central Icon */}
                <MagicWandIcon className="w-10 h-10 text-indigo-600 dark:text-indigo-400 absolute animate-bounce" />
              </div>

              {/* Progress Text with Gradient */}
              <div className="mt-8 space-y-2 text-center relative z-10 p-4 rounded-2xl bg-white/80 dark:bg-black/40 backdrop-blur-xl border border-white/20 shadow-xl max-w-xs">
                <p className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 font-bold text-lg animate-gradient-x">
                  {LOADING_MESSAGES[loadingStage]}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Designing pixels...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageGenerator;
