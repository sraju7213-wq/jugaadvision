import React, { useState, useCallback, memo, useRef, useEffect } from "react";
import { generateCreativeMix } from "../services/geminiService";
import { promptToJson, JsonPrompt } from "../lib/promptToJson";
import {
  generateCinematicPrompt,
  generateCinematicFromImages,
  NeuralBackendResult,
  generateProfessionalPrompt,
  generateProfessionalFromImages,
  ProfessionalBackendResult
} from "../services/neuralBackendService";
import {
  CinematicPrompt,
  CinematicPromptSchema,
  constructPrompt,
  LIGHTING_LABELS,
  CAMERA_LABELS,
  ASPECT_RATIO_LABELS
} from "../lib/schemas/cinematicPrompt";
import {
  ProfessionalPrompt,
  PURPOSE_LABELS,
  ENVIRONMENT_LABELS,
  LIGHTING_TYPE_LABELS,
  OUTPUT_RATIO_LABELS,
  ARRANGEMENT_LABELS
} from "../lib/schemas/professionalPrompt";
import {
  BrainCircuitIcon,
  CopyIcon,
  CheckIcon,
  FolderIcon,
  ImagePlusIcon,
  MicIcon,
  MicOffIcon,
  PaletteIcon,
  MagicWandIcon,
  LayersIcon,
  XIcon,
  SparklesIcon,
  StarIcon,
  CodeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "./icons";
import useSpeechToText from "../hooks/useSpeechToText";
import AdvancedSettingsPanel from "./creative-mixer/AdvancedSettingsPanel";


interface CreativeMixerProps {
  onSendToBuilder: (prompt: string) => void;
  onJumpToImage: (prompt: string) => void;
  onSaveToLibrary: (prompt: string) => void;
}

const styleCategories: Record<string, string[]> = {
  "🎬 Cinematic": ["Cinematic", "Film Noir", "Blockbuster", "Documentary", "Indie Film", "IMAX"],
  "🎨 Art Styles": ["Oil Painting", "Watercolor", "Digital Art", "Impressionist", "Pop Art", "Sketch"],
  "✨ Fantasy & Sci-Fi": ["Fantasy", "Cyberpunk", "Steampunk", "Ethereal", "Dystopian", "Space Opera"],
  "📷 Photography": ["Photorealistic", "Portrait", "Macro", "Aerial", "Street Photo", "Fashion"],
  "🎌 Animation": ["Anime", "Pixar", "Studio Ghibli", "Cartoon", "Stop Motion", "3D Render"],
  "🎭 Artistic": ["Surreal", "Minimalist", "Abstract", "Expressionist", "Renaissance", "Baroque"],
};

const moodCategories: Record<string, string[]> = {
  "🌙 Dark & Moody": ["Dark & Gritty", "Melancholic", "Ominous", "Mysterious", "Gothic", "Noir"],
  "☀️ Bright & Positive": ["Joyful", "Energetic", "Vibrant", "Optimistic", "Playful", "Whimsical"],
  "🌿 Calm & Serene": ["Peaceful", "Dreamy", "Ethereal", "Tranquil", "Meditative", "Zen"],
  "🔥 Intense & Dynamic": ["Epic", "Dramatic", "Powerful", "Explosive", "Action-packed", "Thrilling"],
  "💜 Emotional & Deep": ["Nostalgic", "Romantic", "Bittersweet", "Poetic", "Introspective", "Soulful"],
  "🌈 Stylized": ["Retro", "Futuristic", "Vintage", "Neon", "Pastel", "Monochrome"],
};


const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

interface ImageUploadBoxProps {
  label: string;
  image: { file: File; url: string } | null;
  index: number;
  onUpload: (file: File, index: number) => void;
  onRemove: (index: number) => void;
}

const ImageUploadBox = memo(
  ({ label, image, index, onUpload, onRemove }: ImageUploadBoxProps) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        onUpload(e.target.files[0], index);
      }
    };

    const onDragOver = (e: React.DragEvent<HTMLLabelElement>) =>
      e.preventDefault();
    const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        onUpload(e.dataTransfer.files[0], index);
      }
    };

    return (
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide pl-1">
          {label}
        </p>
        <div className="relative aspect-video group">
          <label
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-xl cursor-pointer transition-colors duration-300 overflow-hidden relative
                  ${image
                ? "border-transparent"
                : "bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 hover:border-violet-500/50"
              }`}
          >
            {image ? (
              <>
                <img
                  src={image.url}
                  alt={label}
                  decoding="async"
                  className="h-full w-full object-cover rounded-xl"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-2xl" />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 mb-2 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-violet-500 transition-colors">
                  <ImagePlusIcon className="w-4 h-4" />
                </div>
                <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                  Click or Drop
                </p>
              </div>
            )}
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
            />
          </label>
          {image && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onRemove(index);
              }}
              className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-transform hover:scale-110 opacity-0 group-hover:opacity-100"
              title="Remove image"
            >
              <XIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  },
);

interface CategoryDropdownProps {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (val: string) => void;
  categories: Record<string, string[]>;
  placeholder: string;
  colorClass?: "violet" | "fuchsia";
}

const CategoryDropdown = memo(({
  label,
  icon: Icon,
  value,
  onChange,
  categories,
  placeholder,
  colorClass = "violet"
}: CategoryDropdownProps) => {
  const isViolet = colorClass === "violet";
  const ringColor = isViolet ? "focus:ring-violet-500/50" : "focus:ring-fuchsia-500/50";
  const iconColor = isViolet ? "text-violet-500" : "text-fuchsia-500";
  const badgeBg = isViolet ? "bg-violet-100 dark:bg-violet-900/30" : "bg-fuchsia-100 dark:bg-fuchsia-900/30";
  const badgeText = isViolet ? "text-violet-600 dark:text-violet-400" : "text-fuchsia-600 dark:text-fuchsia-400";

  return (
    <div className="space-y-3">
      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} /> {label}
        {value && (
          <span className={`ml-2 px-2 py-0.5 ${badgeBg} ${badgeText} rounded-full text-[10px] font-bold animate-in fade-in zoom-in duration-300`}>
            {value}
          </span>
        )}
      </label>
      <div className="relative group">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full h-12 pl-4 pr-10 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 ${ringColor} text-sm text-gray-900 dark:text-white appearance-none transition-colors border-colors cursor-pointer hover:border-gray-400 dark:hover:border-white/20`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundPosition: 'right 1rem center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '1.2em 1.2em'
          }}
        >
          <option value="" className="dark:bg-gray-900">{placeholder}</option>
          {Object.entries(categories).map(([category, items]) => (
            <optgroup key={category} label={category} className="bg-white dark:bg-gray-900 font-bold text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {items.map((item) => (
                <option key={item} value={item} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-normal normal-case py-2">
                  {item}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
});

const CreativeMixer: React.FC<CreativeMixerProps> = ({
  onSendToBuilder,
  onJumpToImage,
  onSaveToLibrary,
}) => {
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [selectedMood, setSelectedMood] = useState("");
  const [refImages, setRefImages] = useState<
    ({ file: File; url: string } | null)[]
  >([null, null, null]);
  const [generatedResult, setGeneratedResult] = useState("");
  const [structuredResult, setStructuredResult] = useState<CinematicPrompt | null>(null);
  const [professionalResult, setProfessionalResult] = useState<ProfessionalPrompt | null>(null);
  const [neuralMode, setNeuralMode] = useState(false); // Neural Backend mode - off by default
  const [professionalMode, setProfessionalMode] = useState(false); // Professional 15-layer mode
  const [selectedPlatform, setSelectedPlatform] = useState<'midjourney' | 'dalle' | 'flux' | 'sdxl' | 'general'>('general');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [showReferences, setShowReferences] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<Partial<ProfessionalPrompt>>({});

  // JSON Prompt Conversion state
  const [jsonPromptData, setJsonPromptData] = useState<JsonPrompt | null>(null);
  const [showJsonOutput, setShowJsonOutput] = useState(false);
  const [jsonCopied, setJsonCopied] = useState(false);

  // Mounted ref for cleanup - prevents state updates on unmounted component
  const isMounted = useRef(true);
  // Request ID to track stale responses
  const requestIdRef = useRef(0);

  // Cleanup effect - improved for memory leak prevention
  useEffect(() => {
    // Cleanup function
    return () => {
      isMounted.current = false;
      // Revoke all image URLs on unmount
      refImages.forEach(img => {
        if (img?.url) {
          URL.revokeObjectURL(img.url);
        }
      });
    };
  }, []);

  const { isListening, isSupported, startListening } = useSpeechToText(
    (text) => {
      setPrompt((prev) => prev + (prev ? " " : "") + text);
    },
  );

  const handleImageUpload = useCallback((file: File, index: number) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Invalid file type. Please use JPG, PNG, or WebP.");
      return;
    }

    setRefImages((prev) => {
      const newImages = [...prev];
      if (newImages[index]?.url) {
        URL.revokeObjectURL(newImages[index]!.url);
      }
      newImages[index] = { file, url: URL.createObjectURL(file) };
      return newImages;
    });
  }, []);

  const handleImageRemove = useCallback((index: number) => {
    setRefImages((prev) => {
      const newImages = [...prev];
      if (newImages[index]?.url) {
        URL.revokeObjectURL(newImages[index]!.url);
      }
      newImages[index] = null;
      return newImages;
    });
  }, []);

  const handleGenerate = async () => {
    // Prevent double clicks
    if (isGenerating) return;

    // Allow generation if prompt is present OR if at least one image is uploaded
    const hasImages = refImages.some((img) => img !== null);
    if (!prompt.trim() && !hasImages) return;

    setIsGenerating(true);
    setStatusMessage("Initializing...");
    setError(null);
    setStructuredResult(null);
    setProfessionalResult(null);

    try {
      // Prepare images
      const imagePayloads = await Promise.all(
        refImages.map(async (img) => {
          if (!img) return null;
          return {
            base64: await blobToBase64(img.file),
            mimeType: img.file.type,
          };
        }),
      );

      const validImages = imagePayloads.filter((img): img is { base64: string; mimeType: string } => img !== null);

      if (professionalMode) {
        // Professional Backend: Generate 15-layer structured JSON
        let result: ProfessionalBackendResult;

        if (validImages.length > 0) {
          result = await generateProfessionalFromImages(
            prompt,
            validImages,
            selectedStyle || 'product',
            selectedMood || 'Commercial',
            selectedPlatform,
            (status) => {
              if (isMounted.current) setStatusMessage(status);
            },
            advancedSettings
          );
        } else {
          result = await generateProfessionalPrompt(
            prompt,
            selectedStyle || 'product',
            selectedMood || 'Commercial',
            selectedPlatform,
            (status) => {
              if (isMounted.current) setStatusMessage(status);
            },
            advancedSettings
          );
        }

        if (isMounted.current) {
          if (result.success && result.data && result.constructedPrompt) {
            setProfessionalResult(result.data);
            setGeneratedResult(result.constructedPrompt);
          } else {
            setError(`Professional Backend failed: ${result.error}`);
          }
        }
      } else if (neuralMode) {
        // Neural Backend: Generate structured JSON
        let result: NeuralBackendResult;

        if (validImages.length > 0) {
          result = await generateCinematicFromImages(
            prompt,
            validImages,
            selectedStyle,
            selectedMood,
            (status) => {
              if (isMounted.current) setStatusMessage(status);
            }
          );
        } else {
          result = await generateCinematicPrompt(
            prompt,
            selectedStyle,
            selectedMood,
            undefined,
            (status) => {
              if (isMounted.current) setStatusMessage(status);
            }
          );
        }

        if (isMounted.current) {
          if (result.success && result.data) {
            setStructuredResult(result.data);
            setGeneratedResult(constructPrompt(result.data));
          } else {
            setError(`Neural Backend failed: ${result.error}`);
          }
        }
      } else {
        // Standard mode: Use client-side generateCreativeMix (no Neural/Professional backend)
        if (isMounted.current) setStatusMessage("Creating creative mix...");

        const result = await generateCreativeMix(
          prompt,
          selectedStyle,
          selectedMood,
          validImages
        );

        if (isMounted.current) {
          setGeneratedResult(result);
        }
      }
    } catch (e: any) {
      console.error("Generation failed:", e);
      if (isMounted.current) {
        const errorMessage = e?.message || "Unknown error";
        if (errorMessage.includes("timed out")) {
          setError("Request timed out. Please try again.");
        } else if (errorMessage.includes("rate") || errorMessage.includes("quota")) {
          setError("API rate limit reached. Please wait a moment and try again.");
        } else {
          setError(`Generation failed: ${errorMessage}. Please try again.`);
        }
      }
    } finally {
      // THIS LINE FIXES THE FREEZING BUG
      if (isMounted.current) {
        setIsGenerating(false);
        setStatusMessage("");
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSaveToLibrary(generatedResult);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // JSON Conversion Handler - local, no API calls
  const handleConvertToJson = useCallback(() => {
    if (!generatedResult.trim()) return;

    // Convert locally without API call
    const { json } = promptToJson(generatedResult);
    setJsonPromptData(json);
    setShowJsonOutput(true);
  }, [generatedResult]);

  // Copy JSON to clipboard
  const handleCopyJson = useCallback(() => {
    if (!jsonPromptData) return;
    const formatted = JSON.stringify({
      core: jsonPromptData.core,
      style: jsonPromptData.style,
      mood: jsonPromptData.mood,
      camera: jsonPromptData.camera,
      lighting: jsonPromptData.lighting,
      colors: jsonPromptData.colors,
      materials: jsonPromptData.materials,
      modifiers: jsonPromptData.modifiers,
    }, null, 2);
    navigator.clipboard.writeText(formatted);
    setJsonCopied(true);
    setTimeout(() => setJsonCopied(false), 2000);
  }, [jsonPromptData]);



  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-0 animate-fade-in space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl text-white shadow-lg">
          <LayersIcon className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Creative Mixer
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Professional Visual Alchemy
          </p>
        </div>
      </div>

      {/* Controls */}
      <div
        className="bg-white/60 dark:bg-white/5 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-white/10 p-4 sm:p-6 shadow-xl space-y-4 sm:space-y-6 transform-gpu"
        style={{ contain: 'content' }}
      >
        {/* Visual References - Collapsible */}
        <div className="space-y-4">
          <button
            onClick={() => setShowReferences(!showReferences)}
            className="flex items-center justify-between w-full group transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg transition-colors ${showReferences ? 'bg-violet-500 text-white' : 'bg-gray-100 dark:bg-white/10 text-violet-500'}`}>
                <ImagePlusIcon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                Visual References
              </h3>
              {refImages.filter(img => img !== null).length > 0 && (
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-bold">
                  {refImages.filter(img => img !== null).length} Loaded
                </span>
              )}
            </div>
            {showReferences ? (
              <ChevronUpIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-white transition-colors" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-white transition-colors" />
            )}
          </button>

          {showReferences && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <ImageUploadBox
                label="Layout / Pose"
                image={refImages[0]}
                index={0}
                onUpload={handleImageUpload}
                onRemove={handleImageRemove}
              />
              <ImageUploadBox
                label="Art Style"
                image={refImages[1]}
                index={1}
                onUpload={handleImageUpload}
                onRemove={handleImageRemove}
              />
              <ImageUploadBox
                label="Color Palette"
                image={refImages[2]}
                index={2}
                onUpload={handleImageUpload}
                onRemove={handleImageRemove}
              />
            </div>
          )}
        </div>

        {/* Prompt Input */}
        <div className="space-y-2 relative">
          <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Base Concept
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your core idea (Optional if images provided)..."
            className="w-full h-32 px-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#BF953F]/50 focus:border-[#BF953F] resize-none text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 min-h-[50px]"
          />
          {isSupported && (
            <button
              onClick={startListening}
              className={`absolute bottom-3 right-3 p-2 rounded-xl transition-all ${isListening ? "bg-red-500 text-white animate-pulse" : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/70 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/20"}`}
            >
              {isListening ? (
                <MicOffIcon className="w-4 h-4" />
              ) : (
                <MicIcon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Style & Mood Dropdowns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategoryDropdown
            label="Style"
            icon={PaletteIcon}
            value={selectedStyle}
            onChange={setSelectedStyle}
            categories={styleCategories}
            placeholder="Choose a style..."
            colorClass="violet"
          />
          <CategoryDropdown
            label="Mood"
            icon={MagicWandIcon}
            value={selectedMood}
            onChange={setSelectedMood}
            categories={moodCategories}
            placeholder="Choose a mood..."
            colorClass="fuchsia"
          />
        </div>

        {/* Neural Backend Toggle */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-2xl border border-cyan-200 dark:border-cyan-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl text-white">
              <BrainCircuitIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">Neural Backend</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">4-Layer Cinematic JSON</p>
            </div>
          </div>
          <button
            onClick={() => {
              setNeuralMode(!neuralMode);
              if (!neuralMode) setProfessionalMode(false);
            }}
            disabled={professionalMode}
            className={`relative w-8 h-14 rounded-full transition-all duration-300 border border-gray-300 dark:border-white/5 flex-shrink-0 ${neuralMode
              ? 'bg-gradient-to-b from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30'
              : 'bg-gray-200 dark:bg-white/10'
              } ${professionalMode ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`absolute left-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${neuralMode ? 'top-1' : 'top-[26px]'
                }`}
            />
          </button>
        </div>

        {/* Professional Mode Toggle - NEW */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border border-amber-200 dark:border-amber-800/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white">
              <StarIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">Professional Mode</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">15-Layer Commercial-Grade JSON</p>
            </div>
          </div>
          <button
            onClick={() => {
              setProfessionalMode(!professionalMode);
              if (!professionalMode) setNeuralMode(false);
            }}
            className={`relative w-8 h-14 rounded-full transition-all duration-300 border border-gray-300 dark:border-white/5 flex-shrink-0 ${professionalMode
              ? 'bg-gradient-to-b from-amber-500 to-orange-600 shadow-lg shadow-amber-500/30'
              : 'bg-gray-200 dark:bg-white/10'
              }`}
          >
            <span
              className={`absolute left-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${professionalMode ? 'top-1' : 'top-[26px]'
                }`}
            />
          </button>
        </div>

        {/* Professional Mode Advanced Settings - NEW */}
        {professionalMode && (
          <AdvancedSettingsPanel
            settings={advancedSettings}
            onChange={setAdvancedSettings}
          />
        )}



        {/* Platform Selector (Professional Mode Only) */}
        {professionalMode && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Target Platform
            </label>
            <div className="overflow-x-auto -mx-1 px-1 pb-1 scrollbar-hide md:overflow-visible">
              <div className="flex gap-2 min-w-max md:min-w-0 md:flex-wrap">
                {(['general', 'midjourney', 'dalle', 'flux', 'sdxl'] as const).map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setSelectedPlatform(platform)}
                    className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all min-h-[44px] flex items-center justify-center whitespace-nowrap flex-shrink-0 md:flex-shrink ${selectedPlatform === platform
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-md'
                      : 'bg-white dark:bg-white/5 border-gray-300 dark:border-white/10 text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10'
                      }`}
                  >
                    {platform === 'general' ? '🌐 General' :
                      platform === 'midjourney' ? '🎨 Midjourney' :
                        platform === 'dalle' ? '🤖 DALL-E 3' :
                          platform === 'flux' ? '⚡ Flux' : '🖼️ SDXL'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-2xl">
            <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || (!prompt.trim() && !refImages.some(img => img !== null))}
          className={`w-full md:min-w-[200px] h-14 bg-gradient-to-r from-[#BF953F] to-[#B38728] text-black font-bold rounded-full shadow-[0_4px_15px_rgba(212,175,55,0.3)] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:transform-none`}
        >
          {isGenerating ? (
            statusMessage || (professionalMode ? "Professional Backend Processing..." : neuralMode ? "Neural Backend Processing..." : "Analyzing & Mixing...")
          ) : (
            <>
              {professionalMode ? <StarIcon className="w-5 h-5" /> : <BrainCircuitIcon className="w-5 h-5" />}
              {professionalMode ? "Generate Professional Prompt" : neuralMode ? "Generate with Neural Backend" : "Generate Creative Mix"}
            </>
          )}
        </button>
      </div>

      {/* Output */}
      {(generatedResult || isGenerating || structuredResult || professionalResult) && (
        <div
          className="bg-white/60 dark:bg-white/5 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-white/10 p-4 sm:p-6 shadow-xl animate-slide-up-fade relative space-y-4"
          style={{ contain: 'content' }}
        >

          {/* Structured Breakdown (Neural Mode) */}
          {structuredResult && neuralMode && (
            <div className="space-y-4 pb-4 border-b border-gray-200 dark:border-white/10">
              {/* Header with Reflexion Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BrainCircuitIcon className="w-5 h-5 text-cyan-500" />
                  <span className="font-bold text-gray-900 dark:text-white">Structured Breakdown</span>
                </div>
                <span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-bold rounded-full">
                  AI SDK Streaming
                </span>
              </div>

              {/* Subject Layer */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Subject</p>
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 space-y-1">
                  <p className="text-gray-900 dark:text-white font-medium">{structuredResult.subject.core}</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{structuredResult.subject.action}</p>
                  {structuredResult.subject.attire && (
                    <p className="text-gray-500 dark:text-gray-500 text-sm italic">{structuredResult.subject.attire}</p>
                  )}
                </div>
              </div>

              {/* Cinematography Layer */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cinematography</p>
                <div className="flex flex-wrap gap-2">
                  {/* Lighting Badges */}
                  {structuredResult.cinematography.lighting.map((light, i) => (
                    <span key={i} className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-full flex items-center gap-1">
                      💡 {LIGHTING_LABELS[light] || light}
                    </span>
                  ))}
                  {/* Camera Badge */}
                  <span className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full flex items-center gap-1">
                    📷 {CAMERA_LABELS[structuredResult.cinematography.camera_angle] || structuredResult.cinematography.camera_angle}
                  </span>
                  {/* Film Stock Badge */}
                  <span className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-full flex items-center gap-1">
                    🎞️ {structuredResult.cinematography.film_stock}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Lens:</strong> {structuredResult.cinematography.lens}
                </p>
              </div>

              {/* Artistic Layer */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Artistic</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-bold rounded-full">
                    Style: {(structuredResult as any).artistic?.style || 'N/A'}
                  </span>
                  <span className="px-3 py-1.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-full">
                    Mood: {(structuredResult as any).artistic?.mood || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Technical Layer */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Technical</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold rounded-full">
                    {ASPECT_RATIO_LABELS[structuredResult.technical.aspect_ratio] || structuredResult.technical.aspect_ratio}
                  </span>
                  <span className="px-3 py-1.5 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 text-xs font-bold rounded-full">
                    Stylize: {structuredResult.technical.stylize}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Negative:</strong> {structuredResult.technical.negative_prompt}
                </p>
              </div>
            </div>
          )}

          {/* Professional Mode Breakdown - 15 Layers */}
          {professionalResult && professionalMode && (
            <div className="space-y-4 pb-4 border-b border-gray-200 dark:border-white/10">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StarIcon className="w-5 h-5 text-amber-500" />
                  <span className="font-bold text-gray-900 dark:text-white">15-Layer Professional Breakdown</span>
                </div>
                <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-full">
                  Commercial Grade
                </span>
              </div>

              {/* Layer 1: Purpose */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">📌 Purpose</p>
                  <span className="inline-block px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-full">
                    {PURPOSE_LABELS[professionalResult.image_purpose] || professionalResult.image_purpose}
                  </span>
                </div>

                {/* Layer 2: Environment */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">🏠 Environment</p>
                  <span className="inline-block px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full">
                    {ENVIRONMENT_LABELS[professionalResult.scene?.environment] || professionalResult.scene?.environment}
                  </span>
                </div>
              </div>

              {/* Layer 5: Composition */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wide">📐 Composition</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-full">
                    {ARRANGEMENT_LABELS[professionalResult.composition?.arrangement] || professionalResult.composition?.arrangement}
                  </span>
                  <span className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-full">
                    {professionalResult.composition?.framing}
                  </span>
                  <span className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-full">
                    {professionalResult.composition?.camera_height?.replace(/-/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Layer 6: Camera */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">📷 Camera</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-bold rounded-full">
                    {professionalResult.camera?.focal_length_mm}mm
                  </span>
                  <span className="px-3 py-1.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-bold rounded-full">
                    f/{professionalResult.camera?.aperture_f}
                  </span>
                  <span className="px-3 py-1.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-bold rounded-full">
                    {professionalResult.camera?.lens_type}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                  {professionalResult.camera?.focus_strategy}
                </p>
              </div>

              {/* Layer 7-9: Lighting */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">💡 Lighting</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-bold rounded-full">
                    {LIGHTING_TYPE_LABELS[professionalResult.lighting?.primary?.type] || professionalResult.lighting?.primary?.type}
                  </span>
                  <span className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-bold rounded-full">
                    {professionalResult.lighting?.primary?.direction?.replace(/-/g, ' ')}
                  </span>
                  <span className="px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-bold rounded-full">
                    {professionalResult.lighting?.primary?.quality}
                  </span>
                  <span className="px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-bold rounded-full">
                    🌡️ {professionalResult.lighting?.color_temperature?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Layer 10: Color Grading */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wide">🎨 Color Grading</p>
                <div className="flex flex-wrap gap-2">
                  {professionalResult.color_grading?.palette?.slice(0, 4).map((color, i) => (
                    <span key={i} className="px-3 py-1.5 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 text-xs font-bold rounded-full">
                      {color}
                    </span>
                  ))}
                  <span className="px-3 py-1.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-full">
                    {professionalResult.color_grading?.saturation}
                  </span>
                </div>
              </div>

              {/* Layer 11-12: Materials */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wide">🧱 Materials & Textures</p>
                <div className="flex flex-wrap gap-2">
                  {professionalResult.materials?.primary?.slice(0, 4).map((mat, i) => (
                    <span key={i} className="px-3 py-1.5 bg-stone-100 dark:bg-stone-900/30 text-stone-700 dark:text-stone-300 text-xs font-bold rounded-full">
                      {mat}
                    </span>
                  ))}
                </div>
                {professionalResult.materials?.imperfections?.include && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    ✨ Imperfections: {professionalResult.materials.imperfections.types?.slice(0, 3).join(', ')}
                  </p>
                )}
              </div>

              {/* Layer 13: Subject */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide">🎯 Subject</p>
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 space-y-1">
                  <p className="text-gray-900 dark:text-white font-medium">{professionalResult.subject?.category}</p>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{professionalResult.subject?.pose_or_orientation}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {professionalResult.subject?.features?.slice(0, 3).map((feat, i) => (
                      <span key={i} className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Layer 14: Mood */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">💭 Mood</p>
                <div className="flex flex-wrap gap-2">
                  {professionalResult.mood?.map((m, i) => (
                    <span key={i} className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              {/* Layer 15: Output */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide">📤 Output</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-bold rounded-full">
                    {OUTPUT_RATIO_LABELS[professionalResult.post_processing?.output_ratio] || professionalResult.post_processing?.output_ratio}
                  </span>
                  <span className="px-3 py-1.5 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs font-bold rounded-full">
                    Grain: {professionalResult.post_processing?.grain}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Final Prompt Output */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {professionalMode ? 'Professional Prompt' : neuralMode ? 'Constructed Prompt' : 'Generated Prompt'}
            </p>
            <textarea
              value={generatedResult}
              onChange={(e) => setGeneratedResult(e.target.value)}
              readOnly={false}
              placeholder={isGenerating ? "The Alchemist is working..." : ""}
              className="w-full h-32 bg-gray-50 dark:bg-black/20 rounded-xl p-3 border-none focus:ring-2 focus:ring-violet-500/50 resize-none text-gray-900 dark:text-white font-medium leading-relaxed text-sm"
            />
          </div>

          {!isGenerating && (
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between mt-6">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={handleCopy}
                  className="p-3 w-12 md:w-auto h-12 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white transition-colors flex items-center justify-center"
                  title="Copy"
                >
                  {copied ? (
                    <CheckIcon className="w-5 h-5 text-green-500" />
                  ) : (
                    <CopyIcon className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={handleSave}
                  className="p-3 w-12 md:w-auto h-12 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-900 dark:text-white transition-colors flex items-center justify-center"
                  title="Save"
                >
                  {saved ? (
                    <CheckIcon className="w-5 h-5 text-green-500" />
                  ) : (
                    <FolderIcon className="w-5 h-5" />
                  )}
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                {/* Convert to JSON Button - only shows when prompt is generated */}
                {generatedResult && !neuralMode && !professionalMode && (
                  <button
                    onClick={handleConvertToJson}
                    className="w-full md:w-auto h-12 px-6 rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-bold text-sm flex items-center justify-center gap-2 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                    title="Convert to JSON structure"
                  >
                    <CodeIcon className="w-4 h-4" /> JSON
                  </button>
                )}
                <button
                  onClick={() => onSendToBuilder(generatedResult)}
                  className="w-full md:w-auto h-12 px-6 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-bold text-sm flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                >
                  Refine
                </button>
                <button
                  onClick={() => onJumpToImage(generatedResult)}
                  className="w-full md:w-auto h-12 px-6 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                >
                  <ImagePlusIcon className="w-4 h-4" /> Generate Image
                </button>
              </div>
            </div>
          )}

          {/* JSON Prompt Output - Collapsible Panel */}
          {showJsonOutput && jsonPromptData && !isGenerating && (
            <div className="mt-4 border border-violet-200 dark:border-violet-800/30 rounded-2xl overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setShowJsonOutput(!showJsonOutput)}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-900/30 dark:hover:to-purple-900/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CodeIcon className="w-5 h-5 text-violet-500" />
                  <span className="font-bold text-gray-900 dark:text-white text-sm">JSON Prompt Structure</span>
                  <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300 rounded-full text-[10px] font-bold">
                    8 Layers
                  </span>
                </div>
                {showJsonOutput ? (
                  <ChevronUpIcon className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {/* JSON Content */}
              <div className="p-4 space-y-4 bg-white/50 dark:bg-black/20">
                {/* Layer Badges */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-lg">
                    🎯 {jsonPromptData.core.subject.slice(0, 30)}...
                  </span>
                  <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-bold rounded-lg">
                    🎨 {jsonPromptData.style.type}
                  </span>
                  <span className="px-2 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 text-xs font-bold rounded-lg">
                    💭 {jsonPromptData.mood.primary}
                  </span>
                  <span className="px-2 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 text-xs font-bold rounded-lg">
                    📷 {jsonPromptData.camera.angle}
                  </span>
                  <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-bold rounded-lg">
                    💡 {jsonPromptData.lighting.type}
                  </span>
                </div>

                {/* JSON Code Block */}
                <pre className="bg-gray-900 dark:bg-black rounded-xl p-4 text-xs text-green-400 font-mono overflow-x-auto max-h-64 overflow-y-auto">
                  {JSON.stringify({
                    core: jsonPromptData.core,
                    style: jsonPromptData.style,
                    mood: jsonPromptData.mood,
                    camera: jsonPromptData.camera,
                    lighting: jsonPromptData.lighting,
                    colors: jsonPromptData.colors,
                    materials: jsonPromptData.materials,
                    modifiers: jsonPromptData.modifiers,
                  }, null, 2)}
                </pre>

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCopyJson}
                    className="px-4 py-2 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-bold text-sm flex items-center gap-2 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                  >
                    {jsonCopied ? (
                      <>
                        <CheckIcon className="w-4 h-4" /> Copied!
                      </>
                    ) : (
                      <>
                        <CopyIcon className="w-4 h-4" /> Copy JSON
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowJsonOutput(false)}
                    className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 font-bold text-sm hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CreativeMixer;
