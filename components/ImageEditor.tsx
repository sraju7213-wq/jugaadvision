import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { editImage, enhancePrompt } from "../services/geminiService";
import { STYLE_TRANSFER_CATEGORIES, EDIT_MODES, EditModeId } from "../constants";
import {
  ImageIcon,
  MagicWandIcon,
  RefreshIcon,
  MicIcon,
  MicOffIcon,
  CameraIcon,
  XIcon,
  CopyIcon,
  CheckIcon,
  FolderIcon,
  BrushIcon,
  EraserIcon,
  UndoIcon,
  TemplateIcon,
  BrainCircuitIcon,
} from "./icons";
import useSpeechToText from "../hooks/useSpeechToText";
import Tooltip from "./Tooltip";

interface ImageEditorProps {
  onSaveToLibrary: (prompt: string, platform?: any, imageUrl?: string) => void;
}



const ImageEditor: React.FC<ImageEditorProps> = ({ onSaveToLibrary }) => {
  const navigate = useNavigate();

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "camera-capture.png", {
              type: "image/png",
            });
            const dt = new DataTransfer();
            dt.items.add(file);
            handleImageUpload(dt.files);
            stopCamera();
          }
        }, "image/png");
      }
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);
  const [searchParams] = useSearchParams();
  const initialImageUrl = searchParams.get("image");

  const [prompt, setPrompt] = useState("");
  const [uploadedImage, setUploadedImage] = useState<{
    file: File | null;
    url: string;
  } | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeStyleCategory, setActiveStyleCategory] = useState<string>(Object.keys(STYLE_TRANSFER_CATEGORIES)[0]);
  const [editMode, setEditMode] = useState<EditModeId>("style");
  const [smartPrompting, setSmartPrompting] = useState(false);

  // Get current mode config
  const currentMode = useMemo(() => EDIT_MODES.find(m => m.id === editMode) || EDIT_MODES[0], [editMode]);

  // Canvas Drawing State
  const [tool, setTool] = useState<"brush" | "eraser">("brush");
  const [brushSize, setBrushSize] = useState(40);
  const [maskHistory, setMaskHistory] = useState<string[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Canvas Refs
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  const { isListening, isSupported, startListening } = useSpeechToText(
    (text) => {
      setPrompt((prev) => prev + (prev ? " " : "") + text);
    },
  );

  useEffect(() => {
    if (initialImageUrl) {
      try {
        const decodedUrl = decodeURIComponent(initialImageUrl);
        setUploadedImage({ file: null, url: decodedUrl });
        setGeneratedImage(null);
      } catch (e) {
        setError("Invalid image URL.");
      }
    }
  }, [initialImageUrl]);

  useEffect(() => {
    const imageCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const ctx = imageCanvas?.getContext("2d");
    const maskCtx = maskCanvas?.getContext("2d");
    const container = containerRef.current;

    if (
      !imageCanvas ||
      !maskCanvas ||
      !ctx ||
      !maskCtx ||
      !uploadedImage?.url ||
      !container
    )
      return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = uploadedImage.url;
    img.alt = "Source Image for Editing";

    img.onload = () => {
      originalImageRef.current = img;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imgAspectRatio = img.width / img.height;
      const containerAspectRatio = containerWidth / containerHeight;

      let canvasWidth, canvasHeight;
      if (imgAspectRatio > containerAspectRatio) {
        canvasWidth = containerWidth;
        canvasHeight = containerWidth / imgAspectRatio;
      } else {
        canvasHeight = containerHeight;
        canvasWidth = containerHeight * imgAspectRatio;
      }

      imageCanvas.width = canvasWidth;
      imageCanvas.height = canvasHeight;
      maskCanvas.width = canvasWidth;
      maskCanvas.height = canvasHeight;

      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      setMaskHistory([]);
    };
  }, [uploadedImage?.url]);

  const handleImageUpload = (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0];
      if (file.size > 10 * 1024 * 1024) {
        setError("File size exceeds 10MB limit.");
        return;
      }
      setUploadedImage({ file, url: URL.createObjectURL(file) });
      setGeneratedImage(null);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Canvas Logic
  const getCanvasPos = (
    e: React.MouseEvent | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (
    e: React.MouseEvent | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    e.preventDefault();
    setIsDrawing(true);
    lastPointRef.current = getCanvasPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = maskCanvasRef.current?.getContext("2d");
    if (!ctx || !lastPointRef.current) return;

    const currentPos = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation =
      tool === "brush" ? "source-over" : "destination-out";
    ctx.strokeStyle =
      tool === "brush" ? "rgba(255, 255, 255, 0.7)" : "rgba(0,0,0,1)";
    ctx.stroke();
    lastPointRef.current = currentPos;
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (maskCanvasRef.current)
      setMaskHistory((prev) => [...prev, maskCanvasRef.current!.toDataURL()]);
  };

  const handleUndo = () => {
    if (maskHistory.length <= 1) {
      handleClearMask();
      return;
    }
    const newHistory = maskHistory.slice(0, -1);
    setMaskHistory(newHistory);
    const ctx = maskCanvasRef.current?.getContext("2d");
    const img = new Image();
    img.src = newHistory[newHistory.length - 1];
    img.onload = () => {
      ctx?.clearRect(
        0,
        0,
        maskCanvasRef.current!.width,
        maskCanvasRef.current!.height,
      );
      ctx?.drawImage(img, 0, 0);
    };
  };

  const handleClearMask = () => {
    const ctx = maskCanvasRef.current?.getContext("2d");
    ctx?.clearRect(
      0,
      0,
      maskCanvasRef.current!.width,
      maskCanvasRef.current!.height,
    );
    setMaskHistory([]);
  };

  const handleEdit = async () => {
    if (!uploadedImage || (!prompt.trim() && editMode !== "erase")) return;
    setIsLoading(true);
    setError("");
    try {
      let base64 = "";
      let mimeType = "image/png";
      if (uploadedImage.file) {
        base64 = await blobToBase64(uploadedImage.file);
        mimeType = uploadedImage.file.type;
      } else if (uploadedImage.url) {
        const res = await fetch(uploadedImage.url);
        base64 = await blobToBase64(await res.blob());
      }

      let maskBase64 = undefined;
      if (
        maskHistory.length > 0 &&
        originalImageRef.current &&
        maskCanvasRef.current
      ) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = originalImageRef.current.naturalWidth;
        tempCanvas.height = originalImageRef.current.naturalHeight;
        const ctx = tempCanvas.getContext("2d");
        ctx?.drawImage(
          maskCanvasRef.current,
          0,
          0,
          tempCanvas.width,
          tempCanvas.height,
        );
        maskBase64 = tempCanvas.toDataURL("image/png").split(",")[1];
      }

      // Smart Prompting: Enhance the prompt if enabled
      let finalPrompt = prompt;
      if (smartPrompting && prompt.trim() && editMode !== "erase") {
        try {
          finalPrompt = await enhancePrompt(prompt, "Cinematic", "Medium");
          setPrompt(finalPrompt);
        } catch (enhanceError) {
          console.warn("Smart prompting failed, using original prompt", enhanceError);
        }
      }

      const imageUrl = await editImage(base64, mimeType, finalPrompt, maskBase64);
      setGeneratedImage(imageUrl);
    } catch (e) {
      setError("Failed to edit image.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = generatedImage || uploadedImage?.url || "";
    link.download = `edited-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="max-w-6xl mx-auto py-4 sm:py-6 px-2 sm:px-0 animate-slide-in flex flex-col lg:flex-row gap-4 sm:gap-8 min-h-[calc(100vh-9rem)]">
      {/* Controls */}
      <div className="w-full lg:w-1/3 flex flex-col gap-6">
        <div className="bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-white/10 p-4 sm:p-6 shadow-xl flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/20 rounded-xl text-indigo-500 dark:text-indigo-400 shadow-sm">
                <ImageIcon className="w-6 h-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Editor
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Fix, remix, and reimagine.
                </p>
              </div>
            </div>
            {/* Smart Prompting Toggle */}
            <Tooltip content="Auto-enhance prompts with AI">
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
          </div>

          <div className="flex-grow space-y-6">
            {/* Edit Mode Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl overflow-x-auto" role="tablist" aria-label="Edit modes">
              {EDIT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={editMode === mode.id}
                  aria-label={mode.label}
                  onClick={() => {
                    setEditMode(mode.id);
                    if (mode.autoPrompt) {
                      setPrompt(mode.autoPrompt);
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${editMode === mode.id
                    ? "bg-white dark:bg-white/10 shadow text-gray-900 dark:text-white"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
                >
                  <span aria-hidden="true">{mode.icon}</span>
                  <span className="hidden sm:inline">{mode.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide pl-1">
                Source Image
              </label>
              <div
                className="relative aspect-video bg-gray-100 dark:bg-black/20 rounded-3xl border-2 border-dashed border-gray-300 dark:border-white/10 overflow-hidden group"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleImageUpload(e.dataTransfer.files);
                }}
              >
                <div
                  ref={containerRef}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <canvas
                    ref={imageCanvasRef}
                    className="max-w-full max-h-full object-contain"
                    aria-label="Editor Canvas"
                  />
                  <canvas
                    ref={maskCanvasRef}
                    className="absolute max-w-full max-h-full object-contain cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    aria-label="Mask Canvas"
                  />
                </div>
                {!uploadedImage &&
                  (isCameraOpen ? (
                    <div className="absolute inset-0 z-20 bg-black flex flex-col items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-4 flex gap-4">
                        <button
                          type="button"
                          onClick={stopCamera}
                          aria-label="Close camera"
                          className="p-3 rounded-full bg-white/20 text-white backdrop-blur-md hover:bg-white/30"
                        >
                          <XIcon className="w-6 h-6" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={capturePhoto}
                          aria-label="Capture photo"
                          className="p-4 rounded-full bg-white text-black hover:scale-105 transition-transform"
                        >
                          <div className="w-4 h-4 rounded-full border-2 border-black" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col md:flex-row">
                      {/* Zone A: Upload */}
                      <label className="flex-1 flex flex-col items-center justify-center p-6 cursor-pointer bg-white/5 hover:bg-white/10 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] transition-all group/upload border-b md:border-b-0 md:border-r border-gray-200 dark:border-white/10 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/0 group-hover/upload:from-purple-500/5 group-hover/upload:to-transparent transition-all" />
                        <div className="w-16 h-16 rounded-full bg-white/50 dark:bg-white/5 mb-4 flex items-center justify-center text-purple-500 shadow-sm group-hover/upload:scale-110 transition-transform duration-300 border border-gray-200 dark:border-white/10">
                          <FolderIcon className="w-8 h-8" />
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                          Browse Gallery
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          or Drag & Drop
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e.target.files)}
                        />
                      </label>

                      {/* Divider */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm text-[10px] font-bold text-gray-400 uppercase">
                        OR
                      </div>

                      {/* Zone B: Camera */}
                      <button
                        onClick={startCamera}
                        className="flex-1 flex flex-col items-center justify-center p-6 cursor-pointer bg-white/5 hover:bg-white/10 hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] transition-all group/camera relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-cyan-500/0 group-hover/camera:from-cyan-500/5 group-hover/camera:to-transparent transition-all" />
                        <div className="w-16 h-16 rounded-full bg-white/50 dark:bg-white/5 mb-4 flex items-center justify-center text-cyan-500 shadow-sm group-hover/camera:scale-110 transition-transform duration-300 border border-gray-200 dark:border-white/10">
                          <CameraIcon className="w-8 h-8" />
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                          Open Camera
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Take a photo
                        </span>
                        {/* Mobile Fallback */}
                        <input
                          type="file"
                          capture="environment"
                          accept="image/*"
                          className="md:hidden absolute inset-0 opacity-0 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleImageUpload(e.target.files)}
                        />
                      </button>
                    </div>
                  ))}
              </div>
              {uploadedImage && (
                <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl shadow-sm mt-2 overflow-x-auto custom-scrollbar">
                  <Tooltip content="Paint Mask">
                    <button
                      onClick={() => setTool("brush")}
                      aria-label="Brush Tool"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${tool === "brush" ? "bg-indigo-500 text-white shadow-md" : "hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"}`}
                    >
                      <BrushIcon className="w-4 h-4" />
                      <span className="text-xs font-bold">Paint</span>
                    </button>
                  </Tooltip>
                  <Tooltip content="Erase Mask">
                    <button
                      onClick={() => setTool("eraser")}
                      aria-label="Eraser Tool"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${tool === "eraser" ? "bg-indigo-500 text-white shadow-md" : "hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400"}`}
                    >
                      <EraserIcon className="w-4 h-4" />
                      <span className="text-xs font-bold">Erase</span>
                    </button>
                  </Tooltip>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    aria-label="Brush Size"
                    className="w-20 h-1 accent-indigo-500 cursor-pointer flex-shrink-0"
                  />
                  <div className="flex-grow"></div>
                  <Tooltip content="Undo Stroke">
                    <button
                      onClick={handleUndo}
                      disabled={maskHistory.length === 0}
                      aria-label="Undo"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 disabled:opacity-30 whitespace-nowrap"
                    >
                      <UndoIcon className="w-4 h-4" />
                      <span className="text-xs font-bold">Undo</span>
                    </button>
                  </Tooltip>
                  <Tooltip content="Clear Mask">
                    <button
                      onClick={handleClearMask}
                      disabled={maskHistory.length === 0}
                      aria-label="Clear Mask"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 disabled:opacity-30 whitespace-nowrap"
                    >
                      <XIcon className="w-4 h-4" />
                      <span className="text-xs font-bold">Clear</span>
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>

            {/* Prompt Section - Hidden in Erase mode */}
            {editMode !== "erase" && (
              <div className="space-y-2">
                <label
                  htmlFor="edit-instruction"
                  className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide pl-1"
                >
                  {currentMode.promptLabel}
                </label>
                <div className="relative">
                  <textarea
                    id="edit-instruction"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={currentMode.promptPlaceholder || "What should change?"}
                    className="w-full h-24 px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none text-gray-900 dark:text-white"
                  />
                  {isSupported && (
                    <button
                      onClick={startListening}
                      aria-label={
                        isListening ? "Stop Listening" : "Start Voice Input"
                      }
                      className={`absolute bottom-2 right-2 p-3 rounded-2xl transition-all shadow-md hover:scale-105 active:scale-95 flex items-center gap-2 ${isListening ? "bg-red-500 animate-pulse text-white" : "bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-gray-300"}`}
                    >
                      {isListening ? (
                        <MicOffIcon className="w-4 h-4" />
                      ) : (
                        <MicIcon className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Erase mode message */}
            {editMode === "erase" && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                  🧹 Paint over the object you want to remove. It will be erased and filled automatically.
                </p>
              </div>
            )}


            {/* Style Transfer Templates - Only in Style mode */}
            {editMode === "style" && (
              <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide pl-1 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></span>
                  Style Transfer
                </label>

                {/* Category Tabs */}
                <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl overflow-x-auto custom-scrollbar">
                  {Object.keys(STYLE_TRANSFER_CATEGORIES).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveStyleCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${activeStyleCategory === cat
                        ? "bg-white dark:bg-white/10 shadow text-gray-900 dark:text-white"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Style Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {STYLE_TRANSFER_CATEGORIES[activeStyleCategory]?.map((style) => (
                    <Tooltip key={style.id} content={style.title}>
                      <button
                        onClick={() => setPrompt(style.prompt)}
                        className="flex flex-col items-center p-2 rounded-xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-purple-500/50 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all group"
                      >
                        <span className="text-xl mb-0.5 group-hover:scale-110 transition-transform">{style.icon}</span>
                        <span className="text-[9px] font-medium text-gray-600 dark:text-gray-300 text-center leading-tight truncate w-full">
                          {style.title}
                        </span>
                      </button>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 text-xs text-red-500 text-center">{error}</div>
          )}

          <button
            onClick={handleEdit}
            disabled={isLoading || !uploadedImage || (!prompt.trim() && editMode !== "erase")}
            className="w-full py-4 rounded-2xl font-bold text-white bg-gradient-cta hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-6"
          >
            {isLoading ? (
              "Processing..."
            ) : (
              <>
                <MagicWandIcon className="w-5 h-5" /> {currentMode.buttonLabel}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="w-full lg:w-2/3 h-full">
        <div className="bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-white/10 p-4 sm:p-6 shadow-xl h-full min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] flex flex-col items-center justify-center relative overflow-hidden group">
          {generatedImage || uploadedImage?.url ? (
            <>
              <img
                src={generatedImage || uploadedImage?.url}
                alt="Preview of edited image"
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              />
              {generatedImage && (
                <div className="absolute bottom-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0">
                  <Tooltip content="Download">
                    <button
                      onClick={handleDownload}
                      aria-label="Download Image"
                      className="px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl font-bold shadow-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-all"
                    >
                      Download
                    </button>
                  </Tooltip>
                  <Tooltip content="Save to Library">
                    <button
                      onClick={() => {
                        onSaveToLibrary(
                          prompt,
                          undefined,
                          generatedImage || undefined,
                        );
                        setSaved(true);
                        setTimeout(() => setSaved(false), 2000);
                      }}
                      aria-label="Save to Library"
                      className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-black/50 backdrop-blur-md rounded-xl hover:bg-gray-100 dark:hover:bg-black/70 transition-all text-gray-900 dark:text-white font-bold"
                    >
                      <FolderIcon className="w-5 h-5" />
                      <span>Save</span>
                    </button>
                  </Tooltip>
                </div>
              )}
            </>
          ) : (
            <div className="text-center opacity-40">
              <div className="w-24 h-24 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-200 dark:border-white/5">
                <ImageIcon className="w-10 h-10 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                No Image
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Upload an image to start editing.
              </p>
            </div>
          )}
          {isLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-indigo-500 font-bold animate-pulse">
                Applying magic...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;
