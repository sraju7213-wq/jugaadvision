import React, { useState, useCallback, memo, useRef, useEffect } from "react";
import { ProcessingAnimation } from "./ProcessingAnimation";
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
import { detectCreativeConflicts } from "../server/ai/qualityGates";
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
import { Loader2 } from "lucide-react";
import useSpeechToText from "../hooks/useSpeechToText";
import AdvancedSettingsPanel from "./creative-mixer/AdvancedSettingsPanel";


interface CreativeMixerProps {
  onSendToBuilder: (prompt: string) => void;
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
      <div className="space-y-1.5">
        <p className="m-0 font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
          {label}
        </p>
        <div className="relative aspect-video group">
          <label
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center w-full h-full border border-dashed cursor-pointer transition-colors duration-200 overflow-hidden relative ${
              image
                ? "border-[var(--editorial-rule)] bg-black/5 dark:bg-black/30"
                : "border-[var(--editorial-rule-strong)] bg-[var(--editorial-surface)] hover:border-[var(--editorial-pink)] hover:bg-[var(--editorial-pink-soft)]"
            }`}
          >
            {image ? (
              <>
                <img
                  src={image.url}
                  alt={label}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="px-2.5 py-1 bg-[var(--editorial-paper)] text-[var(--editorial-ink)] font-mono text-[10px] font-bold border border-[var(--editorial-rule)]">
                    Replace
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-2">
                <div className="w-7 h-7 flex items-center justify-center text-[var(--editorial-pink)] mb-1">
                  <ImagePlusIcon className="w-4 h-4" />
                </div>
                <p className="m-0 font-mono text-[10px] text-[var(--editorial-muted)] group-hover:text-[var(--editorial-ink)] uppercase tracking-wider">
                  Drop / Browse
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
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onRemove(index);
              }}
              className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white shadow-sm hover:bg-red-600 transition-opacity"
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
}: CategoryDropdownProps) => {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-[var(--editorial-pink)]" /> {label}
        </label>
        {value && (
          <span className="editorial-badge editorial-badge--pink">
            {value}
          </span>
        )}
      </div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="editorial-select w-full text-xs font-mono"
        >
          <option value="">{placeholder}</option>
          {Object.entries(categories).map(([category, items]) => (
            <optgroup key={category} label={category} className="font-bold text-xs uppercase tracking-wider">
              {items.map((item) => (
                <option key={item} value={item} className="normal-case">
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
    isMounted.current = true;
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
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Editorial Fusion Board Controls */}
      <div className="editorial-panel">
        <div className="editorial-panel__header">
          <div className="flex items-center gap-2">
            <span className="editorial-badge editorial-badge--pink">01 / Fusion Board</span>
            <h2 className="editorial-panel__title m-0 text-base">Aesthetic & Direction Matrix</h2>
          </div>
          {isGenerating && (
            <span className="editorial-badge editorial-badge--gold animate-pulse">
              Mixing Directions...
            </span>
          )}
        </div>

        <div className="editorial-panel__body space-y-6">
          {/* Visual References Section - Collapsible */}
          <div className="p-4 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
            <button
              type="button"
              onClick={() => setShowReferences(!showReferences)}
              className="flex items-center justify-between w-full group transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 flex items-center justify-center border transition-colors ${showReferences ? 'bg-[var(--editorial-pink)] text-white border-[var(--editorial-pink)]' : 'bg-[var(--editorial-paper)] text-[var(--editorial-pink)] border-[var(--editorial-rule)]'}`}>
                  <ImagePlusIcon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-ink)]">
                    Visual References & Boards
                  </span>
                  <span className="hidden sm:inline-block ml-2 font-mono text-[10px] text-[var(--editorial-muted)]">
                    (Layout, Art Style, Color Palette)
                  </span>
                </div>
                {refImages.filter(img => img !== null).length > 0 && (
                  <span className="editorial-badge editorial-badge--teal ml-1">
                    {refImages.filter(img => img !== null).length} Loaded
                  </span>
                )}
              </div>
              {showReferences ? (
                <ChevronUpIcon className="w-4 h-4 text-[var(--editorial-pink)]" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-[var(--editorial-muted)]" />
              )}
            </button>

            {showReferences && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 mt-3 border-t border-[var(--editorial-rule)] animate-fade-in">
                <ImageUploadBox
                  label="01 / Layout & Pose"
                  image={refImages[0]}
                  index={0}
                  onUpload={handleImageUpload}
                  onRemove={handleImageRemove}
                />
                <ImageUploadBox
                  label="02 / Art Style"
                  image={refImages[1]}
                  index={1}
                  onUpload={handleImageUpload}
                  onRemove={handleImageRemove}
                />
                <ImageUploadBox
                  label="03 / Color Palette"
                  image={refImages[2]}
                  index={2}
                  onUpload={handleImageUpload}
                  onRemove={handleImageRemove}
                />
              </div>
            )}
          </div>

          {/* Base Concept Canvas */}
          <div className="space-y-1.5 relative">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                Base Creative Brief
              </label>
              <span className="font-mono text-[10px] text-[var(--editorial-muted)]">
                Optional if reference boards are provided
              </span>
            </div>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your core scene, hybrid intent, or visual concept..."
                className="editorial-textarea min-h-[100px] text-xs font-mono"
              />
              {isSupported && (
                <button
                  type="button"
                  onClick={startListening}
                  className={`absolute bottom-3 right-3 p-1.5 border transition-all ${
                    isListening
                      ? "bg-red-500 text-white border-red-500 animate-pulse"
                      : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-pink)] hover:border-[var(--editorial-pink)]"
                  }`}
                  title={isListening ? "Stop listening" : "Voice input"}
                >
                  {isListening ? (
                    <MicOffIcon className="w-3.5 h-3.5" />
                  ) : (
                    <MicIcon className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Style & Mood Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CategoryDropdown
              label="Visual Style Language"
              icon={PaletteIcon}
              value={selectedStyle}
              onChange={setSelectedStyle}
              categories={styleCategories}
              placeholder="Choose aesthetic style..."
              colorClass="violet"
            />
            <CategoryDropdown
              label="Emotional Register / Mood"
              icon={MagicWandIcon}
              value={selectedMood}
              onChange={setSelectedMood}
              categories={moodCategories}
              placeholder="Choose emotional mood..."
              colorClass="fuchsia"
            />
          </div>

          {/* Creative Conflict Detection Alert */}
          {selectedStyle && selectedMood && (
            (() => {
              const conflicts = detectCreativeConflicts([selectedStyle], [selectedMood]);
              if (conflicts.length === 0) return null;
              return (
                <div className="p-3 bg-[var(--editorial-gold-soft)] border border-[var(--editorial-gold)] flex items-center gap-2.5 text-xs font-mono text-[var(--editorial-gold)]">
                  <span>💡</span>
                  <span>
                    <strong>Direction Note:</strong> {conflicts.map(c => c.message).join(' ')} (AI will blend adaptively).
                  </span>
                </div>
              );
            })()
          )}

          {/* Modes Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Neural Mode Toggle */}
            <div className={`p-4 border transition-all flex items-center justify-between ${
              neuralMode
                ? "bg-[var(--editorial-surface-strong)] border-[var(--editorial-teal)] shadow-[2px_2px_0_var(--editorial-teal)]"
                : "bg-[var(--editorial-surface)] border-[var(--editorial-rule)]"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 flex items-center justify-center border ${
                  neuralMode
                    ? "bg-[var(--editorial-teal)] text-white border-[var(--editorial-teal)]"
                    : "bg-[var(--editorial-paper)] text-[var(--editorial-teal)] border-[var(--editorial-rule)]"
                }`}>
                  <BrainCircuitIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="m-0 font-serif text-sm text-[var(--editorial-ink)]">Neural Backend</p>
                  <p className="m-0 font-mono text-[10px] text-[var(--editorial-muted)] uppercase tracking-wider">4-Layer Cinematic JSON</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNeuralMode(!neuralMode);
                  if (!neuralMode) setProfessionalMode(false);
                }}
                disabled={professionalMode}
                className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border transition-all ${
                  neuralMode
                    ? "bg-[var(--editorial-teal)] text-white border-[var(--editorial-teal)]"
                    : "bg-[var(--editorial-paper)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-ink)]"
                } ${professionalMode ? "opacity-30 cursor-not-allowed" : ""}`}
              >
                {neuralMode ? "Active" : "Enable"}
              </button>
            </div>

            {/* Professional Mode Toggle */}
            <div className={`p-4 border transition-all flex items-center justify-between ${
              professionalMode
                ? "bg-[var(--editorial-surface-strong)] border-[var(--editorial-gold)] shadow-[2px_2px_0_var(--editorial-gold)]"
                : "bg-[var(--editorial-surface)] border-[var(--editorial-rule)]"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 flex items-center justify-center border ${
                  professionalMode
                    ? "bg-[var(--editorial-gold)] text-white border-[var(--editorial-gold)]"
                    : "bg-[var(--editorial-paper)] text-[var(--editorial-gold)] border-[var(--editorial-rule)]"
                }`}>
                  <StarIcon className="w-4 h-4" />
                </div>
                <div>
                  <p className="m-0 font-serif text-sm text-[var(--editorial-ink)]">Professional Mode</p>
                  <p className="m-0 font-mono text-[10px] text-[var(--editorial-muted)] uppercase tracking-wider">15-Layer Commercial Spec</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProfessionalMode(!professionalMode);
                  if (!professionalMode) setNeuralMode(false);
                }}
                className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider border transition-all ${
                  professionalMode
                    ? "bg-[var(--editorial-gold)] text-white border-[var(--editorial-gold)]"
                    : "bg-[var(--editorial-paper)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-ink)]"
                }`}
              >
                {professionalMode ? "Active" : "Enable"}
              </button>
            </div>
          </div>

          {/* Professional Mode Advanced Settings */}
          {professionalMode && (
            <div className="animate-fade-in pt-2">
              <AdvancedSettingsPanel
                settings={advancedSettings}
                onChange={setAdvancedSettings}
              />
            </div>
          )}

          {/* Platform Selector (Professional Mode Only) */}
          {professionalMode && (
            <div className="space-y-2 pt-2">
              <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                Target Rendering Platform
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(['general', 'midjourney', 'dalle', 'flux', 'sdxl'] as const).map((plt) => (
                  <button
                    key={plt}
                    type="button"
                    onClick={() => setSelectedPlatform(plt)}
                    className={`py-2 px-3 text-xs font-mono font-bold uppercase tracking-wider border transition-all flex items-center justify-center ${
                      selectedPlatform === plt
                        ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)] shadow-[2px_2px_0_var(--editorial-gold)]"
                        : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:border-[var(--editorial-gold)] hover:text-[var(--editorial-ink)]"
                    }`}
                  >
                    {plt === 'general' ? '🌐 General' :
                      plt === 'midjourney' ? '🎨 Midjourney' :
                        plt === 'dalle' ? '🤖 DALL-E 3' :
                          plt === 'flux' ? '⚡ Flux' : '🖼️ SDXL'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Generate Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || (!prompt.trim() && !refImages.some(img => img !== null))}
              className="editorial-button editorial-button--primary editorial-button--coral w-full justify-center text-xs"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 shrink-0 text-white" />
                  <span>{statusMessage || "Synthesizing Directives..."}</span>
                </>
              ) : (
                <>
                  {professionalMode ? <StarIcon className="w-3.5 h-3.5" /> : <BrainCircuitIcon className="w-3.5 h-3.5" />}
                  <span>{professionalMode ? "Generate 15-Layer Professional Spec" : neuralMode ? "Generate Neural Cinematic Mix" : "Synthesize Creative Mix"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Output Panel */}
      {(generatedResult || isGenerating || structuredResult || professionalResult) && (
        <div className="editorial-panel animate-fade-in space-y-6">
          <div className="editorial-panel__header">
            <div className="flex items-center gap-2">
              <span className="editorial-badge editorial-badge--pink">02 / Output</span>
              <h3 className="editorial-panel__title m-0 text-base">
                {professionalMode ? 'Professional Multi-Layer Specification' : neuralMode ? 'Neural Cinematic Direction' : 'Synthesized Hybrid Prompt'}
              </h3>
            </div>

            {generatedResult && (
              <div className="flex items-center gap-2">
                <span className="editorial-badge editorial-badge--teal">Ready</span>
              </div>
            )}
          </div>

          <div className="editorial-panel__body space-y-6">
            {isGenerating ? (
              <ProcessingAnimation
                variant="panel"
                theme="pink"
                badge="Neural Fusion Matrix"
                title={professionalMode ? "Synthesizing 15-Layer Professional Spec" : neuralMode ? "Generating Neural Cinematic Mix" : "Synthesizing Creative Hybrid Mix"}
                stages={[
                  "Synthesizing aesthetic vectors & references...",
                  "Calculating lighting contrast and optical depth...",
                  "Balancing camera dynamics, lenses & scene geometry...",
                  "Compiling master prompt syntax...",
                ]}
                stageIntervalMs={2200}
                subtext="Fusing multiple creative directions into an optimized prompt specification."
              />
            ) : (
              <>
            {/* Structured Breakdown (Neural Mode) */}
            {structuredResult && neuralMode && (
              <div className="space-y-4 pb-4 border-b border-[var(--editorial-rule)]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-teal)] flex items-center gap-1.5">
                    <BrainCircuitIcon className="w-3.5 h-3.5" /> 4-Layer Cinematic Breakdown
                  </span>
                  <span className="editorial-badge editorial-badge--teal">AI Structured</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                    <p className="m-0 font-mono text-[10px] text-[var(--editorial-muted)] uppercase tracking-wider">Subject Layer</p>
                    <p className="m-0 font-bold text-xs text-[var(--editorial-ink)] mt-1">{structuredResult.subject.core}</p>
                    <p className="m-0 text-xs text-[var(--editorial-muted)] mt-0.5">{structuredResult.subject.action}</p>
                  </div>
                  <div className="p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                    <p className="m-0 font-mono text-[10px] text-[var(--editorial-muted)] uppercase tracking-wider">Cinematography</p>
                    <p className="m-0 text-xs text-[var(--editorial-ink)] mt-1">
                      {structuredResult.cinematography.lens} &bull; {CAMERA_LABELS[structuredResult.cinematography.camera_angle] || structuredResult.cinematography.camera_angle}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {structuredResult.cinematography.lighting.map((light, i) => (
                        <span key={i} className="editorial-badge editorial-badge--gold">
                          💡 {LIGHTING_LABELS[light] || light}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Professional Mode Breakdown - 15 Layers */}
            {professionalResult && professionalMode && (
              <div className="space-y-4 pb-4 border-b border-[var(--editorial-rule)]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-gold)] flex items-center gap-1.5">
                    <StarIcon className="w-3.5 h-3.5" /> 15-Layer Commercial Breakdown
                  </span>
                  <span className="editorial-badge editorial-badge--gold">Commercial Spec</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                    <span className="font-mono text-[9.5px] text-[var(--editorial-muted)] uppercase block">Purpose</span>
                    <span className="font-mono text-xs font-bold text-[var(--editorial-ink)]">
                      {PURPOSE_LABELS[professionalResult.image_purpose] || professionalResult.image_purpose}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                    <span className="font-mono text-[9.5px] text-[var(--editorial-muted)] uppercase block">Environment</span>
                    <span className="font-mono text-xs font-bold text-[var(--editorial-ink)]">
                      {ENVIRONMENT_LABELS[professionalResult.scene?.environment] || professionalResult.scene?.environment}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                    <span className="font-mono text-[9.5px] text-[var(--editorial-muted)] uppercase block">Optics</span>
                    <span className="font-mono text-xs font-bold text-[var(--editorial-ink)]">
                      {professionalResult.camera?.focal_length_mm}mm f/{professionalResult.camera?.aperture_f}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                    <span className="font-mono text-[9.5px] text-[var(--editorial-muted)] uppercase block">Aspect Ratio</span>
                    <span className="font-mono text-xs font-bold text-[var(--editorial-ink)]">
                      {OUTPUT_RATIO_LABELS[professionalResult.post_processing?.output_ratio] || professionalResult.post_processing?.output_ratio}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Generated Prompt Canvas */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                  Assembled Prompt Direction
                </label>
                {generatedResult && (
                  <span className="font-mono text-[10px] text-[var(--editorial-muted)]">
                    {generatedResult.length} characters
                  </span>
                )}
              </div>
              <textarea
                value={generatedResult}
                onChange={(e) => setGeneratedResult(e.target.value)}
                placeholder={isGenerating ? "Synthesizing visual direction..." : "Your synthesized prompt will appear here."}
                className="editorial-textarea min-h-[130px] font-mono text-xs leading-relaxed"
              />
            </div>

            {/* Actions Bar */}
            {!isGenerating && generatedResult && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="editorial-button editorial-button--sm editorial-button--secondary"
                  >
                    {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="editorial-button editorial-button--sm editorial-button--secondary"
                  >
                    {saved ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <FolderIcon className="w-3.5 h-3.5" />}
                    <span>{saved ? "Saved" : "Save to Vault"}</span>
                  </button>
                  {generatedResult && !neuralMode && !professionalMode && (
                    <button
                      type="button"
                      onClick={handleConvertToJson}
                      className="editorial-button editorial-button--sm editorial-button--secondary"
                    >
                      <CodeIcon className="w-3.5 h-3.5" />
                      <span>View JSON</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onSendToBuilder(generatedResult)}
                  className="editorial-button editorial-button--sm editorial-button--primary"
                >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  <span>Send to Builder</span>
                </button>
              </div>
            )}

            {/* JSON Code Viewer Drawer */}
            {showJsonOutput && jsonPromptData && !isGenerating && (
              <div className="p-4 bg-[var(--editorial-surface-strong)] border border-[var(--editorial-rule)] space-y-3 animate-fade-in">
                <div className="flex items-center justify-between border-b border-[var(--editorial-rule)] pb-2">
                  <div className="flex items-center gap-2">
                    <CodeIcon className="w-4 h-4 text-[var(--editorial-pink)]" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-ink)]">
                      JSON Prompt Structure (8 Layers)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowJsonOutput(false)}
                    className="text-xs font-mono text-[var(--editorial-muted)] hover:text-[var(--editorial-coral)]"
                  >
                    Close
                  </button>
                </div>

                <pre className="p-3 bg-black/80 text-emerald-400 font-mono text-xs overflow-x-auto max-h-60 custom-scrollbar border border-white/10">
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

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="editorial-button editorial-button--sm editorial-button--secondary"
                  >
                    {jsonCopied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <CopyIcon className="w-3.5 h-3.5" />}
                    <span>{jsonCopied ? "JSON Copied!" : "Copy JSON"}</span>
                  </button>
                </div>
              </div>
            )}
            </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreativeMixer;
