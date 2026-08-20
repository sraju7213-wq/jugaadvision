import React, { useState, useCallback, useRef, useEffect } from "react";
import { ProcessingAnimation } from "./ProcessingAnimation";
import {
  generatePromptFromImage,
  generateStructuredVisionPrompt,
  StructuredVisionPrompt,
} from "../services/geminiService";
import { convertToStructuredPrompt } from "../services/cinematicPromptService";
import { aiFetchModels } from "../services/aiGatewayClient";
import { DESCRIPTION_TYPES } from "../constants";
import {
  compressImage,
  generateThumbnail,
  generateImageHash,
  getCachedPrompt,
  getCachedPromptAsync,
  setCachedPrompt,
  setCachedVisionPrompt,
  FAST_VISION_PRESET,
  safeRevokeObjectURL,
} from "../utils/imageOptimizer";
import {
  ImageIcon,
  MagicWandIcon,
  ImagePlusIcon,
  CopyIcon,
  CheckIcon,
  FolderIcon,
  BrainCircuitIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from "./icons";
import { Loader2 } from "lucide-react";

interface ImageToPromptProps {
  onSendToBuilder: (prompt: string) => void;
  onSaveToLibrary: (prompt: string, platform?: any, imageUrl?: string, tags?: string[]) => void;
}

const ImageToPrompt: React.FC<ImageToPromptProps> = ({
  onSendToBuilder,
  onSaveToLibrary,
}) => {
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number; sizeKb: number } | null>(null);
  
  // Results
  const [prompt, setPrompt] = useState("");
  const [structuredVision, setStructuredVision] = useState<StructuredVisionPrompt | null>(null);
  const [activeTab, setActiveTab] = useState<"assembled" | "breakdown" | "json">("assembled");

  // Lifecycle
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState("");
  // Aesthetics are optional guidance. Start neutral so the first analysis
  // describes the image as it is rather than imposing a preset style.
  const [activeStyles, setActiveStyles] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [visionModels, setVisionModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [isUpdatingModels, setIsUpdatingModels] = useState(false);
  const [modelsUpdatedAt, setModelsUpdatedAt] = useState<Date | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [lastModel, setLastModel] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const imageUrlRef = useRef<string | null>(null);

  // Validate image file and verify decode
  const validateAndDecodeImage = async (file: File): Promise<{ width: number; height: number }> => {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("File size exceeds 10MB limit. Please upload a smaller image.");
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Unsupported format. Please upload JPG, PNG, or WebP.");
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const dimensions = { width: img.naturalWidth, height: img.naturalHeight };
        URL.revokeObjectURL(objectUrl);
        if (dimensions.width === 0 || dimensions.height === 0) {
          reject(new Error("Image file appears to be corrupted or empty."));
        } else {
          resolve(dimensions);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to decode image. File may be corrupted."));
      };
      img.src = objectUrl;
    });
  };

  const refreshModelCatalog = useCallback(async () => {
    setIsUpdatingModels(true);
    try {
      const models = await aiFetchModels({ freeOnly: true, taskType: "advanced_image_analysis" });
      const visionCapable = models.filter((model: any) => {
        const isEligible = (model?.verifiedFree === true && model?.eligibilityStatus === "free") || model?.eligibilityStatus === "eligible_unknown";
        const supportsVision = model?.capabilityMap?.vision === "supported" ||
          model?.capabilities?.includes?.("vision") ||
          model?.modalities?.includes?.("vision");
        return isEligible && supportsVision;
      });
      setVisionModels(visionCapable);
      setModelsUpdatedAt(new Date());
    } catch (err) {
      console.warn("AI model catalog refresh failed:", err);
    } finally {
      setIsUpdatingModels(false);
    }
  }, []);

  useEffect(() => {
    refreshModelCatalog();
  }, [refreshModelCatalog]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
    setLoadingStage("");
    setLoadingProgress(0);
  }, []);

  const generatePrompt = useCallback(async (file: File, styles: string[], preferredModel = "", preferFree = true) => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    setIsLoading(true);
    setError("");
    setIsCached(false);
    setLastDurationMs(null);
    setLastModel(null);
    setLoadingProgress(5);
    const tStart = performance.now();

    try {
      // Stage 1: Check Cache (IndexedDB + sessionStorage)
      setLoadingStage("Checking instant cache...");
      setLoadingProgress(10);
      const cacheContext = preferredModel ? [...styles, `model:${preferredModel}`, `free:${preferFree}`] : [...styles, `free:${preferFree}`];
      const hash = await generateImageHash(file, cacheContext);
      if (signal.aborted) throw new Error('Request was cancelled by user.');
      // Try async cache first (IndexedDB), fallback to sync
      const asyncCached = await getCachedPromptAsync(hash);
      const cachedResult = asyncCached?.prompt || getCachedPrompt(hash);
      if (cachedResult) {
        const cachedVision = (asyncCached as any)?.structuredVision || null;
        setPrompt(cachedResult);
        if (cachedVision) setStructuredVision(cachedVision);
        setIsCached(true);
        setLoadingProgress(100);
        setIsLoading(false);
        setLoadingStage("");
        return;
      }

      // Stage 2: Compress — fast preset (1280) for perceived speed
      setLoadingStage("Optimizing visual fidelity...");
      setLoadingProgress(25);
      if (signal.aborted) throw new Error('Request was cancelled by user.');
      const compressed = await compressImage(file, {
        ...FAST_VISION_PRESET,
        signal,
      });
      setLoadingProgress(45);

      // Stage 3: Structured AI Vision Analysis (with abort signal propagation)
      setLoadingStage("Deconstructing lighting, camera & composition...");
      setLoadingProgress(60);
      if (signal.aborted) throw new Error('Request was cancelled by user.');
      // Note: generateStructuredVisionPrompt currently uses aiGatewayClient which supports signal
      // via internal postJsonWithRetry; we rely on controller abort to cancel fetch
      const visionData = await generateStructuredVisionPrompt(
        compressed.base64,
        compressed.mimeType,
        styles,
        preferredModel,
        preferFree,
        { signal },
      );
      if (signal.aborted) throw new Error('Request was cancelled by user.');

      setStructuredVision(visionData);
      setPrompt(visionData.assembledPrompt);
      setLoadingProgress(100);
      const duration = (visionData as any).durationMs || Math.round(performance.now() - tStart);
      setLastDurationMs(duration);
      if ((visionData as any).model) setLastModel((visionData as any).model);
      else if (preferredModel) setLastModel(preferredModel);
      // Cache full vision result (async, includes structured data)
      setCachedVisionPrompt(hash, visionData.assembledPrompt, cacheContext, visionData).catch(() => {});
      // Fallback sync cache for compat
      try { setCachedPrompt(hash, visionData.assembledPrompt, cacheContext); } catch {}
    } catch (e: any) {
      if (e?.message?.toLowerCase().includes('cancelled') || signal.aborted) {
        setError("");
        return;
      }
      setError(e.message || "An unknown error occurred during vision analysis.");
    } finally {
      if (!signal.aborted) {
        setIsLoading(false);
        setLoadingStage("");
      }
    }
  }, []);

  const handleFileChange = async (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0];
      setError("");

      try {
        const dimensions = await validateAndDecodeImage(file);
        setImageMeta({
          width: dimensions.width,
          height: dimensions.height,
          sizeKb: Math.round(file.size / 1024),
        });

        setImage(file);
        setPrompt("");
        setStructuredVision(null);
        setIsCached(false);

        // Generate thumbnail for instant preview
        try {
          const thumbnail = await generateThumbnail(file, 400);
          setThumbnailUrl(thumbnail);
        } catch (e) {
          console.error("Thumbnail generation failed:", e);
        }

        const objectUrl = URL.createObjectURL(file);
        safeRevokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = objectUrl;
        setImageUrl(objectUrl);

        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          generatePrompt(file, activeStyles, selectedModel);
        }, 300);
      } catch (err: any) {
        setError(err.message || "Invalid image file.");
      }
    }
  };

  const handleRemoveImage = () => {
    abortControllerRef.current?.abort();
    safeRevokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = null;
    setImage(null);
    setImageUrl(null);
    setThumbnailUrl(null);
    setImageMeta(null);
    setPrompt("");
    setStructuredVision(null);
    setError("");
    setIsLoading(false);
    setLoadingStage("");
    setLoadingProgress(0);
  };

  // Cleanup debounce timer + object URLs + abort on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      abortControllerRef.current?.abort();
      safeRevokeObjectURL(imageUrlRef.current);
    };
  }, []);

  const handleStyleToggle = (style: string) => {
    if (isLoading) return;

    const isSelected = activeStyles.includes(style);
    let newStyles = [...activeStyles];

    if (isSelected) {
      newStyles = newStyles.filter((s) => s !== style);
    } else {
      if (newStyles.length >= 3) return; // Enforce max 3
      newStyles.push(style);
    }

    setActiveStyles(newStyles);

    if (image) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        generatePrompt(image, newStyles, selectedModel);
      }, 400);
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
    onSaveToLibrary(prompt, undefined, thumbnailUrl || imageUrl || undefined, ["image-to-prompt", ...activeStyles]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSendToBuilder = () => {
    if (!prompt) return;
    onSendToBuilder(prompt);
  };

  const onDragOver = (e: React.DragEvent<HTMLLabelElement>) => e.preventDefault();
  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    handleFileChange(e.dataTransfer.files);
  };

  const modelGroups = [
    { tier: "quality", label: "QUALITY / DEEP ANALYSIS" },
    { tier: "balanced", label: "BALANCED / GENERAL" },
    { tier: "fast", label: "FAST / EFFICIENT" },
  ]
    .map((group) => ({
      ...group,
      models: visionModels.filter((model) => (model.tier || "balanced") === group.tier),
    }))
    .filter((group) => group.models.length > 0);

  const formatModelLabel = (model: any) =>
    `${model.name || model.providerModelId || model.id} · ${(model.provider || "AI").toUpperCase()}`;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto animate-fade-in">
      {/* Editorial Meta Notice */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] text-xs font-mono text-[var(--editorial-muted)]">
        <span className="flex items-center gap-1.5 text-[var(--editorial-ink)]">
          <span>🔒</span> <strong>In-Memory Processing:</strong> Visual assets are analyzed strictly in-memory and never stored.
        </span>
        <span>Max size: 10MB • JPG, PNG, WebP</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Image Upload & Controls */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="editorial-panel flex flex-col">
            <div className="editorial-panel__header">
              <div className="flex items-center gap-2">
                <span className="editorial-badge editorial-badge--coral">01 / Input</span>
                <h2 className="editorial-panel__title m-0 text-base">Source Visual</h2>
              </div>
              {imageMeta && (
                <span className="font-mono text-[11px] text-[var(--editorial-muted)]">
                  {imageMeta.width}×{imageMeta.height} &bull; {imageMeta.sizeKb} KB
                </span>
              )}
            </div>

            <div className="editorial-panel__body flex flex-col gap-4">
              {/* Upload Dropzone */}
              <div className="relative">
                <label
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  className={`relative flex flex-col items-center justify-center w-full min-h-[180px] sm:min-h-[240px] border border-dashed transition-all cursor-pointer overflow-hidden ${
                    image
                      ? "border-[var(--editorial-coral)] bg-[var(--editorial-surface)]"
                      : "border-[var(--editorial-rule-strong)] hover:border-[var(--editorial-coral)] bg-[var(--editorial-surface)]"
                  }`}
                >
                  {thumbnailUrl || imageUrl ? (
                    <div className="relative w-full h-full min-h-[180px] sm:min-h-[240px] flex items-center justify-center group p-2">
                      <img
                        src={thumbnailUrl || imageUrl!}
                        alt="Uploaded preview"
                        className="max-h-[280px] w-full object-contain transition-transform group-hover:scale-[1.01]"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <span className="px-3 py-1.5 bg-[var(--editorial-paper)] text-[var(--editorial-ink)] text-xs font-mono font-bold border border-[var(--editorial-rule)]">
                          Replace Image
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center">
                      <div className="w-12 h-12 flex items-center justify-center border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-[var(--editorial-coral)] mb-3">
                        <ImagePlusIcon className="w-6 h-6" />
                      </div>
                      <p className="font-mono font-bold text-xs uppercase tracking-wider text-[var(--editorial-ink)] mb-1">
                        Drag & drop visual here
                      </p>
                      <p className="font-mono text-[11px] text-[var(--editorial-muted)]">
                        or click to browse local files
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

                {image && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemoveImage();
                    }}
                    className="editorial-button editorial-button--sm absolute top-3 right-3 text-red-500 border-red-500 hover:bg-red-500/10"
                    title="Remove image"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Target Aesthetics */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                    Target Aesthetics
                  </label>
                  <span className="font-mono text-[10.5px] font-bold text-[var(--editorial-coral)]">
                    {activeStyles.length} / 3 selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DESCRIPTION_TYPES.map((style) => {
                    const isSelected = activeStyles.includes(style);
                    const isMax = activeStyles.length >= 3 && !isSelected;
                    return (
                      <button
                        key={style}
                        type="button"
                        onClick={() => handleStyleToggle(style)}
                        disabled={isMax || isLoading}
                        className={`px-2.5 py-1 text-xs font-mono font-medium border transition-all ${
                          isSelected
                            ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)] shadow-[1px_1px_0_var(--editorial-coral)]"
                            : isMax
                            ? "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] opacity-40 cursor-not-allowed"
                            : "bg-[var(--editorial-surface)] text-[var(--editorial-ink)] border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)]"
                        }`}
                      >
                        {style}
                      </button>
                    );
                  })}
                </div>
              </div>

              {image && (
                <button
                  type="button"
                  onClick={() => generatePrompt(image, activeStyles, selectedModel)}
                  disabled={isLoading}
                  className="editorial-button editorial-button--primary editorial-button--sm w-full justify-center"
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 shrink-0" />
                  ) : (
                    <SparklesIcon className="w-3.5 h-3.5" />
                  )}
                  <span>{isLoading ? "Analyzing..." : "Re-Analyze Image"}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Deconstructed Prompt Output */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="editorial-panel flex flex-col min-h-[420px]">
            
            {/* Header with View Tabs */}
            <div className="editorial-panel__header flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="editorial-badge editorial-badge--coral">02 / Synthesis</span>
                <h3 className="editorial-panel__title m-0 text-base">
                  Reverse-Engineered Prompt
                </h3>
              </div>

              {/* Enhanced AI Model Controls Area */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="flex flex-wrap items-center gap-1.5 p-1 border border-[var(--editorial-rule)] bg-[var(--editorial-surface)]" aria-label="AI model controls">
                  {/* Task Indicator */}
                  <span className="hidden sm:inline px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] text-[var(--editorial-muted)]">
                    VISION / IMAGE ANALYSIS
                  </span>

                  {/* Free-only Verified Pill */}
                  <span className="hidden md:inline px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    FREE ONLY (VERIFIED)
                  </span>

                  {/* Model Selector */}
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={isLoading || isUpdatingModels}
                    aria-label="Select vision AI model"
                    className="h-6 max-w-[190px] border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] px-1.5 font-mono text-[9px] font-bold uppercase tracking-wide text-[var(--editorial-ink)] outline-none focus:border-[var(--editorial-coral)] cursor-pointer"
                  >
                    <option value="">AUTO · BEST VISION MODEL</option>
                    {modelGroups.length > 0 ? (
                      modelGroups.map((group) => (
                        <optgroup key={group.tier} label={group.label}>
                          {group.models.map((model) => (
                            <option key={model.id} value={model.id}>
                              {formatModelLabel(model)}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    ) : (
                      <option disabled value="none">NO FREE VISION MODELS FOUND</option>
                    )}
                  </select>

                  {/* Refresh / Update Button */}
                  <button
                    type="button"
                    onClick={refreshModelCatalog}
                    disabled={isUpdatingModels}
                    aria-label="Refresh AI models"
                    title={modelsUpdatedAt ? `Catalog refreshed at ${modelsUpdatedAt.toLocaleTimeString()}` : "Refresh AI models"}
                    className="editorial-button editorial-button--sm editorial-button--secondary !min-h-6 !px-2 !text-[9px] flex items-center gap-1"
                  >
                    <span className={isUpdatingModels ? "inline-block animate-spin" : ""}>↻</span>
                    <span className="hidden sm:inline">{isUpdatingModels ? "REFRESHING" : "REFRESH"}</span>
                  </button>
                </div>

                {structuredVision && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("assembled")}
                    className={`px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider border transition-all ${
                      activeTab === "assembled"
                        ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                        : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-ink)]"
                    }`}
                  >
                    Assembled
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("breakdown")}
                    className={`px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider border transition-all ${
                      activeTab === "breakdown"
                        ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                        : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-ink)]"
                    }`}
                  >
                    Deconstruction
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("json")}
                    className={`px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider border transition-all ${
                      activeTab === "json"
                        ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                        : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-ink)]"
                    }`}
                  >
                    JSON
                  </button>
                </div>
              )}
              </div>
            </div>

            {/* Main Output Body */}
            <div className="editorial-panel__body flex-grow flex flex-col justify-center">
              {isLoading ? (
                <div className="flex flex-col gap-3">
                  <ProcessingAnimation
                    variant="panel"
                    theme="coral"
                    badge="Vision Engine"
                    title="Multimodal Vision Processing"
                    status={loadingStage || undefined}
                    stages={[
                      "Deconstructing visual layers & composition...",
                      "Analyzing optical lighting, color & medium...",
                      "Extracting subject hierarchy and narrative elements...",
                      "Assembling high-fidelity prompt directives...",
                    ]}
                    stageIntervalMs={2000}
                    subtext="Analyzing in-memory visual tensors with non-destructive feature extraction."
                  />
                  <div className="px-2">
                    <div className="h-1.5 w-full bg-[var(--editorial-rule)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--editorial-coral)] transition-all duration-500 ease-out"
                        style={{ width: `${loadingProgress}%` }}
                        role="progressbar"
                        aria-valuenow={loadingProgress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-[var(--editorial-muted)]">{loadingProgress}% · {loadingStage}</span>
                      <button
                        type="button"
                        onClick={handleCancel}
                        className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-1 border border-[var(--editorial-rule)] hover:border-red-500 hover:text-red-500 transition-colors"
                        aria-label="Cancel vision analysis"
                      >
                        <XIcon className="w-3 h-3 inline mr-1" /> Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : error ? (
                <div className="p-6 bg-red-500/10 border border-red-500/30 text-center">
                  <p className="font-mono font-bold text-xs uppercase text-red-500 mb-1">Analysis Failed</p>
                  <p className="font-mono text-xs text-red-400 mb-3">{error}</p>
                  {image && error.includes("No verified free AI models") && (
                    <button
                      type="button"
                      onClick={() => generatePrompt(image, activeStyles, selectedModel, false)}
                      className="px-3 py-1.5 bg-[var(--editorial-coral)] text-white font-mono text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
                    >
                      Retry with Paid Models
                    </button>
                  )}
                </div>
              ) : prompt ? (
                <>
                  {activeTab === "assembled" && (
                    <div className="flex flex-col h-full">
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="editorial-textarea w-full flex-grow min-h-[220px] font-mono text-xs leading-relaxed resize-none"
                      />
                      <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                        {isCached ? (
                          <span className="text-[10px] text-green-600 dark:text-green-400 font-mono">⚡ Instant cache · 0ms</span>
                        ) : lastDurationMs ? (
                          <span className="text-[10px] text-[var(--editorial-muted)] font-mono">{lastDurationMs}ms{lastModel ? ` · ${lastModel}` : ''}</span>
                        ) : <span />}
                        <span className="text-[10px] text-[var(--editorial-muted)] font-mono">{prompt.length} chars</span>
                      </div>
                    </div>
                  )}

                  {activeTab === "breakdown" && structuredVision && (
                    <div className="space-y-3 overflow-y-auto max-h-[320px] pr-1 custom-scrollbar text-xs">
                      <div className="p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                        <span className="font-mono font-bold text-[var(--editorial-coral)] uppercase tracking-wider text-[10px] block mb-1">Primary Subject</span>
                        <p className="m-0 text-[var(--editorial-ink)] font-serif text-sm">{structuredVision.subject}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                          <span className="font-mono font-bold text-[var(--editorial-coral)] uppercase tracking-wider text-[10px] block mb-1">Camera & Shot</span>
                          <p className="m-0 text-[var(--editorial-ink)] font-mono text-xs">{structuredVision.camera}</p>
                        </div>
                        <div className="p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                          <span className="font-mono font-bold text-[var(--editorial-coral)] uppercase tracking-wider text-[10px] block mb-1">Lighting Setup</span>
                          <p className="m-0 text-[var(--editorial-ink)] font-mono text-xs">{structuredVision.lighting}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                          <span className="font-mono font-bold text-[var(--editorial-coral)] uppercase tracking-wider text-[10px] block mb-1">Color Palette</span>
                          <p className="m-0 text-[var(--editorial-ink)] font-mono text-xs">{structuredVision.colorPalette}</p>
                        </div>
                        <div className="p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                          <span className="font-mono font-bold text-[var(--editorial-coral)] uppercase tracking-wider text-[10px] block mb-1">Materials & Textures</span>
                          <p className="m-0 text-[var(--editorial-ink)] font-mono text-xs">{structuredVision.materials}</p>
                        </div>
                      </div>
                      {structuredVision.textInImage && (
                        <div className="p-3 bg-[var(--editorial-gold-soft)] border border-[var(--editorial-gold)]">
                          <span className="font-mono font-bold text-[var(--editorial-gold)] uppercase tracking-wider text-[10px] block mb-1">Exact Inscription / Text</span>
                          <p className="m-0 text-[var(--editorial-ink)] font-mono text-xs">{structuredVision.textInImage}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "json" && structuredVision && (
                    <pre className="p-4 bg-black text-gray-200 font-mono text-xs leading-relaxed border border-[var(--editorial-rule)] overflow-y-auto max-h-[300px] custom-scrollbar">
                      {JSON.stringify(structuredVision, null, 2)}
                    </pre>
                  )}
                </>
              ) : (
                <div className="editorial-empty-state border-0 bg-transparent p-8">
                  <div className="editorial-empty-state__icon mx-auto mb-3">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <h4 className="editorial-empty-state__title text-base">Awaiting Source Visual</h4>
                  <p className="editorial-empty-state__description text-xs max-w-xs mx-auto">
                    Upload an image on the left to extract its lighting, geometry, and stylistic prompt.
                  </p>
                </div>
              )}
            </div>

            {/* Action Bar */}
            {prompt && (
              <div className="editorial-panel__footer flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="editorial-button editorial-button--secondary editorial-button--sm"
                  >
                    {copied ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="editorial-button editorial-button--secondary editorial-button--sm"
                  >
                    {saved ? <CheckIcon className="w-3.5 h-3.5 text-green-500" /> : <FolderIcon className="w-3.5 h-3.5" />}
                    <span>{saved ? "Saved" : "Save to Vault"}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSendToBuilder}
                  className="editorial-button editorial-button--primary editorial-button--sm"
                >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  <span>Transfer to Builder ➔</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageToPrompt;
