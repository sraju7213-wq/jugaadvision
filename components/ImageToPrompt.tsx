import React, { useState, useCallback, useRef, useEffect } from "react";
import { generatePromptFromImage } from "../services/geminiService";
import { convertToStructuredPrompt } from "../services/cinematicPromptService";
import { DESCRIPTION_TYPES } from "../constants";
import {
  compressImage,
  generateThumbnail,
  generateImageHash,
  getCachedPrompt,
  setCachedPrompt,
} from "../utils/imageOptimizer";
import {
  ImageIcon,
  MagicWandIcon,
  ImagePlusIcon,
  CopyIcon,
  CheckIcon,
  FolderIcon,
  BrainCircuitIcon,
} from "./icons";

interface ImageToPromptProps {
  onSendToBuilder: (prompt: string) => void;
  onJumpToImage: (prompt: string) => void;
  onSaveToLibrary: (prompt: string) => void;
}

const ImageToPrompt: React.FC<ImageToPromptProps> = ({
  onSendToBuilder,
  onJumpToImage,
  onSaveToLibrary,
}) => {
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState("");
  const [activeStyles, setActiveStyles] = useState<string[]>(["Artistic"]);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const generatePrompt = useCallback(async (file: File, styles: string[]) => {
    setIsLoading(true);
    setError("");
    setIsCached(false);

    try {
      // Stage 1: Check cache
      setLoadingStage("Checking cache...");
      const hash = await generateImageHash(file, styles);
      const cachedResult = getCachedPrompt(hash);

      if (cachedResult) {
        setPrompt(cachedResult);
        setIsCached(true);
        setIsLoading(false);
        return;
      }

      // Stage 2: Compress image
      setLoadingStage("Preparing image...");
      const compressed = await compressImage(file, {
        maxWidth: 2048,
        maxHeight: 2048,
        quality: 0.85,
      });

      // Stage 3: Generate prompt
      setLoadingStage("Analyzing visual elements...");
      const generatedPrompt = await generatePromptFromImage(
        compressed.base64,
        compressed.mimeType,
        styles,
      );

      setPrompt(generatedPrompt);

      // Cache the result
      setCachedPrompt(hash, generatedPrompt, styles);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
      setLoadingStage("");
    }
  }, []);

  const handleFileChange = async (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError("File size exceeds 10MB limit.");
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Invalid file type. Please use JPG, PNG, or WebP.");
        return;
      }

      setError("");
      setImage(file);
      setPrompt("");
      setIsCached(false);

      // Generate thumbnail for instant preview
      try {
        const thumbnail = await generateThumbnail(file, 400);
        setThumbnailUrl(thumbnail);
      } catch (e) {
        console.error('Thumbnail generation failed:', e);
      }

      // Load full image in background
      setImageUrl(URL.createObjectURL(file));

      // Debounced auto-generation
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        generatePrompt(file, activeStyles);
      }, 500);
    }
  };

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleStyleToggle = (style: string) => {
    if (isLoading) return;

    const isSelected = activeStyles.includes(style);
    let newStyles = [...activeStyles];

    if (isSelected) {
      newStyles = newStyles.filter((s) => s !== style);
    } else {
      if (newStyles.length >= 3) return; // Limit to 3
      newStyles.push(style);
    }

    if (newStyles.length === 0) newStyles = ["Concise"]; // Default fallback

    setActiveStyles(newStyles);
  };

  const handleRegenerate = () => {
    if (image) {
      generatePrompt(image, activeStyles);
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
    onSaveToLibrary(prompt);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleJsonConvert = async () => {
    if (!prompt || isConverting) return;
    setIsConverting(true);
    setError("");
    try {
      const result = await convertToStructuredPrompt(prompt);
      if (result.success) {
        setPrompt(result.enhancedPrompt);
      } else {
        setError("JSON conversion failed. Please try again.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed.");
    } finally {
      setIsConverting(false);
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLLabelElement>) =>
    e.preventDefault();
  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    handleFileChange(e.dataTransfer.files);
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4 sm:gap-6 px-2 sm:px-0 animate-slide-in">
      {/* Left Panel: Upload */}
      <div className="w-full lg:w-5/12 flex flex-col gap-6">
        <div className="bg-md-surface-container/40 backdrop-blur-xl rounded-2xl sm:rounded-4xl border border-md-outline/10 p-4 sm:p-6 flex-grow flex flex-col shadow-2xl">
          <h2 className="text-2xl font-bold text-md-on-surface mb-6 flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl text-white shadow-md">
              <ImageIcon className="w-6 h-6" />
            </div>
            Image Source
          </h2>
          <label
            onDragOver={onDragOver}
            onDrop={onDrop}
            className="flex-grow flex flex-col items-center justify-center w-full border-2 border-dashed border-md-outline/20 rounded-3xl cursor-pointer bg-md-surface-container-low/30 hover:bg-md-surface-container-high/40 hover:border-md-primary/40 transition-all group relative overflow-hidden min-h-[250px]"
          >
            {imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-contain p-4 z-10"
                />
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center text-white font-medium">
                  Replace Image
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6">
                <div className="w-20 h-20 rounded-full bg-md-surface-container-highest/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner border border-md-outline/10">
                  <ImageIcon className="w-8 h-8 text-md-on-surface-variant group-hover:text-md-primary" />
                </div>
                <p className="mb-2 text-base text-md-on-surface font-medium">
                  Click to upload or drag image
                </p>
                <p className="text-xs text-md-on-surface-variant">
                  JPG, PNG, WebP (Max 10MB)
                </p>
              </div>
            )}
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleFileChange(e.target.files)}
            />
          </label>
          {error && (
            <p className="mt-4 text-sm text-red-500 bg-red-100 dark:bg-red-900/20 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800/30 flex items-center gap-2">
              <span className="font-bold">!</span> {error}
            </p>
          )}
        </div>
      </div>

      {/* Right Panel: Output */}
      <div className="w-full lg:w-7/12 flex flex-col gap-6">
        <div className="bg-md-surface-container/40 backdrop-blur-xl rounded-2xl sm:rounded-4xl border border-md-outline/10 p-4 sm:p-6 flex-grow shadow-2xl flex flex-col">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
            <h2 className="text-xl font-bold text-md-on-surface">
              Refinement Styles
            </h2>
            <span className="self-start sm:self-auto text-xs font-mono text-md-on-surface-variant bg-md-surface-container-high/50 px-2 py-1 rounded-lg border border-md-outline/10">
              {activeStyles.length}/3 Selected
            </span>
          </div>

          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
              {DESCRIPTION_TYPES.map((style, index) => {
                const isSelected = activeStyles.includes(style);
                const isMaxReached = activeStyles.length >= 3;
                const gradients = [
                  'from-violet-500 to-purple-600',
                  'from-blue-500 to-cyan-500',
                  'from-emerald-500 to-teal-500',
                  'from-orange-500 to-amber-500',
                  'from-pink-500 to-rose-500',
                  'from-indigo-500 to-blue-600',
                  'from-fuchsia-500 to-pink-500',
                  'from-cyan-500 to-blue-500',
                  'from-amber-500 to-yellow-500',
                  'from-rose-500 to-red-500',
                  'from-teal-500 to-emerald-500',
                  'from-purple-500 to-indigo-500',
                ];
                const gradient = gradients[index % gradients.length];

                return (
                  <button
                    key={style}
                    onClick={() => handleStyleToggle(style)}
                    disabled={isLoading || (!isSelected && isMaxReached)}
                    className={`btn-style-pill group relative border-2 select-none transition-all duration-300 backdrop-blur-md overflow-hidden rounded-xl sm:rounded-2xl
                      ${isSelected
                        ? `bg-gradient-to-br ${gradient} text-white border-transparent shadow-xl ring-2 ring-white/30 scale-[1.02]`
                        : "bg-white/70 dark:bg-white/5 border-gray-200/50 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-purple-400/50 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5"
                      }
                      ${!isSelected && isMaxReached ? "opacity-40 cursor-not-allowed hover:scale-100 hover:translate-y-0" : "cursor-pointer"}
                    `}
                  >
                    {/* Animated background shimmer */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                    )}

                    {/* Selection indicator */}
                    {isSelected && (
                      <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}

                    <span className={`btn-text-multiline font-bold z-10 ${isSelected ? 'drop-shadow-sm' : ''}`}>
                      {style}
                    </span>

                    {/* Hover glow effect */}
                    {!isSelected && !isMaxReached && (
                      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-2xl`} />
                    )}
                  </button>
                );
              })}
            </div>

            {image && (
              <button
                onClick={handleRegenerate}
                disabled={isLoading}
                className="btn-primary-sm w-full sm:w-auto flex items-center justify-center gap-2 bg-md-primary/10 text-md-primary hover:bg-md-primary/20 transition-colors uppercase tracking-wide border border-md-primary/20"
              >
                <MagicWandIcon className="w-3 h-3" />
                <span className="btn-text-truncate">
                  {isLoading ? loadingStage || "Processing..." : "Update Prompt"}
                </span>
              </button>
            )}
            {isCached && (
              <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckIcon className="w-3 h-3" />
                <span>Loaded from cache</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
            <h3 className="text-sm font-bold text-md-on-surface-variant uppercase tracking-wider">
              Generated Result
            </h3>
            <div className="flex gap-2">
              {/* JSON Convert Button */}
              <button
                onClick={handleJsonConvert}
                disabled={!prompt || isConverting}
                className={`btn-icon-only transition-all flex items-center gap-1 ${isConverting
                  ? "bg-cyan-500/20 text-cyan-500 animate-pulse"
                  : "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-600 dark:text-cyan-400 hover:from-cyan-500/20 hover:to-blue-500/20 border border-cyan-500/20"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Convert to JSON-enhanced prompt"
              >
                <BrainCircuitIcon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase btn-text-truncate">{isConverting ? 'Converting...' : 'JSON'}</span>
              </button>
              <button
                onClick={handleCopy}
                disabled={!prompt}
                className={`btn-icon-only transition-colors ${copied ? "bg-green-500/10 text-green-500" : "bg-md-surface-container-high/50 text-md-on-surface-variant hover:text-md-primary"}`}
                title="Copy"
              >
                {copied ? (
                  <CheckIcon className="w-3.5 h-3.5" />
                ) : (
                  <CopyIcon className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={handleSave}
                disabled={!prompt}
                className={`btn-icon-only transition-colors ${saved ? "bg-green-500/10 text-green-500" : "bg-md-surface-container-high/50 text-md-on-surface-variant hover:text-md-primary"}`}
                title="Save"
              >
                {saved ? (
                  <CheckIcon className="w-3.5 h-3.5" />
                ) : (
                  <FolderIcon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="relative flex-grow bg-md-surface-container-lowest dark:bg-md-surface-container rounded-3xl p-1 border border-md-outline/10 shadow-inner min-h-[200px]">
            <textarea
              value={prompt}
              readOnly
              placeholder={
                isLoading
                  ? loadingStage || "Processing..."
                  : "Upload an image to generate a detailed prompt."
              }
              className="w-full h-full p-5 bg-transparent rounded-2xl focus:outline-none resize-none text-md-on-surface dark:text-green-400 font-mono text-sm leading-relaxed custom-scrollbar"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onSendToBuilder(prompt)}
            disabled={!prompt || isLoading}
            className="btn-primary-lg w-full sm:flex-1 text-white bg-gradient-to-r from-md-primary to-md-secondary hover:shadow-lg hover:shadow-md-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            <span className="btn-text-truncate">To Prompt Builder</span>
          </button>
          <button
            onClick={() => onJumpToImage(prompt)}
            disabled={!prompt || isLoading}
            className="btn-primary-lg w-full sm:w-auto sm:flex-1 text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:shadow-lg hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
          >
            <ImagePlusIcon className="w-5 h-5" />
            <span className="btn-text-truncate hidden sm:inline">Generate Image</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageToPrompt;
