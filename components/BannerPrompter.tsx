import React, { useState, useCallback, memo, useRef, useEffect, useMemo, Suspense, lazy } from "react";
import {
    generateBannerPrompt,
    generateBannerFromImages,
    BannerBackendResult
} from "../services/neuralBackendService";
import {
    BannerPrompt,
    ENVIRONMENT_LABELS,
    BACKGROUND_LABELS,
    LIGHTING_LABELS,
    MEDIUM_LABELS,
    MOOD_LABELS,
    NEGATIVE_SPACE_LABELS,
    ASPECT_RATIO_INFO,
    getBannerPromptSummary
} from "../lib/schemas/bannerPrompt";
import {
    CopyIcon,
    CheckIcon,
    FolderIcon,
    ImagePlusIcon,
    XIcon,
    SparklesIcon,
    ChevronDownIcon,
    ChevronUpIcon,
} from "./icons";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface BannerPrompterProps {
    onSendToBuilder: (prompt: string) => void;
    onJumpToImage: (prompt: string) => void;
    onSaveToLibrary: (prompt: string) => void;
}

interface DropdownOption {
    key: string;
    label: string;
}

interface DropdownSelectorProps {
    label: string;
    options: DropdownOption[];
    selected: string;
    customValue: string;
    onSelect: (key: string) => void;
    onCustomChange: (value: string) => void;
    placeholder?: string;
    customPlaceholder?: string;
}

interface CollapsibleSectionProps {
    title: string;
    badge?: string;
    badgeGradient?: string;
    subBadge?: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

// ============================================================================
// IMAGE UPLOAD BOX COMPONENT
// ============================================================================

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
                        className={`flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 overflow-hidden relative will-change-transform
                            ${image
                                ? "border-transparent"
                                : "bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 hover:border-emerald-500/50"
                            }`}
                    >
                        {image ? (
                            <>
                                <img
                                    src={image.url}
                                    alt={label}
                                    decoding="async"
                                    loading="lazy"
                                    className="h-full w-full object-cover rounded-xl"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-2xl" />
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center p-2">
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 mb-2 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:text-emerald-500 transition-colors">
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
    }
);

// ============================================================================
// PROFESSIONAL OPTIONS DATA
// ============================================================================

const INDUSTRY_OPTIONS: DropdownOption[] = [
    { key: "", label: "None" },
    { key: "technology", label: "🖥️ Technology" },
    { key: "fashion", label: "👗 Fashion" },
    { key: "food_beverage", label: "🍔 Food & Beverage" },
    { key: "healthcare", label: "🏥 Healthcare" },
    { key: "automotive", label: "🚗 Automotive" },
    { key: "beauty", label: "💄 Beauty & Cosmetics" },
    { key: "real_estate", label: "🏠 Real Estate" },
    { key: "finance", label: "💰 Finance" },
    { key: "sports", label: "⚽ Sports & Fitness" },
    { key: "entertainment", label: "🎬 Entertainment" },
];

const PRODUCT_TYPE_OPTIONS: DropdownOption[] = [
    { key: "", label: "None" },
    { key: "physical", label: "📦 Physical Product" },
    { key: "digital", label: "💻 Digital Product" },
    { key: "service", label: "🛎️ Service" },
    { key: "campaign", label: "📢 Marketing Campaign" },
    { key: "event", label: "🎉 Event" },
    { key: "app", label: "📱 Mobile App" },
    { key: "subscription", label: "🔄 Subscription" },
    { key: "brand", label: "🏷️ Brand Identity" },
];

const MATERIAL_OPTIONS: DropdownOption[] = [
    { key: "", label: "None" },
    { key: "metallic", label: "🔩 Metallic" },
    { key: "glass", label: "🔮 Glass/Crystal" },
    { key: "plastic", label: "🧪 Plastic" },
    { key: "fabric", label: "🧵 Fabric/Textile" },
    { key: "wood", label: "🪵 Wood" },
    { key: "leather", label: "👜 Leather" },
    { key: "ceramic", label: "🏺 Ceramic" },
    { key: "paper", label: "📄 Paper/Cardboard" },
    { key: "liquid", label: "💧 Liquid/Fluid" },
    { key: "organic", label: "🌿 Organic/Natural" },
];

const BRAND_STYLE_OPTIONS: DropdownOption[] = [
    { key: "", label: "None" },
    { key: "minimalist", label: "➖ Minimalist" },
    { key: "bold", label: "💪 Bold & Dynamic" },
    { key: "luxury", label: "👑 Luxury Premium" },
    { key: "playful", label: "🎨 Playful & Fun" },
    { key: "corporate", label: "🏢 Corporate" },
    { key: "vintage", label: "📻 Vintage/Retro" },
    { key: "futuristic", label: "🚀 Futuristic" },
    { key: "eco", label: "🌱 Eco-Friendly" },
];

const TARGET_AUDIENCE_OPTIONS: DropdownOption[] = [
    { key: "", label: "None" },
    { key: "professional", label: "👔 Professional/B2B" },
    { key: "young_adults", label: "🧑 Young Adults (18-35)" },
    { key: "families", label: "👨‍👩‍👧 Families" },
    { key: "premium", label: "💎 Premium/Affluent" },
    { key: "gen_z", label: "🎯 Gen Z" },
    { key: "seniors", label: "👵 Seniors" },
    { key: "tech_savvy", label: "🤖 Tech-Savvy" },
    { key: "health_conscious", label: "🧘 Health-Conscious" },
];

const COLOR_PALETTE_OPTIONS: DropdownOption[] = [
    { key: "", label: "None" },
    { key: "warm", label: "🔥 Warm Tones" },
    { key: "cool", label: "❄️ Cool Tones" },
    { key: "monochrome", label: "⬛ Monochrome" },
    { key: "vibrant", label: "🌈 Vibrant Colors" },
    { key: "pastel", label: "🎀 Pastel Soft" },
    { key: "earthy", label: "🏜️ Earthy Natural" },
    { key: "neon", label: "💡 Neon/Electric" },
    { key: "muted", label: "🌫️ Muted Elegant" },
];

// Convert label objects to dropdown options
const getEnvironmentOptions = (): DropdownOption[] => [
    { key: "", label: "None" },
    ...Object.entries(ENVIRONMENT_LABELS).map(([key, label]) => ({ key, label }))
];

const getLightingOptions = (): DropdownOption[] => [
    { key: "", label: "None" },
    ...Object.entries(LIGHTING_LABELS).map(([key, label]) => ({ key, label }))
];

const getMediumOptions = (): DropdownOption[] => [
    { key: "", label: "None" },
    ...Object.entries(MEDIUM_LABELS).map(([key, label]) => ({ key, label }))
];

const getMoodOptions = (): DropdownOption[] => [
    { key: "", label: "None" },
    ...Object.entries(MOOD_LABELS).map(([key, label]) => ({ key, label }))
];

const getNegativeSpaceOptions = (): DropdownOption[] => [
    { key: "", label: "None" },
    ...Object.entries(NEGATIVE_SPACE_LABELS).slice(0, 4).map(([key, label]) => ({ key, label }))
];

const PLATFORM_OPTIONS: DropdownOption[] = [
    { key: "general", label: "🌐 General" },
    { key: "midjourney", label: "🎨 Midjourney" },
    { key: "dalle", label: "🤖 DALL-E" },
    { key: "flux", label: "⚡ Flux" },
    { key: "sdxl", label: "🖼️ SDXL" },
];

// ============================================================================
// DROPDOWN SELECTOR COMPONENT (Replaces button-based selector)
// ============================================================================

const DropdownSelector = memo(({
    label,
    options,
    selected,
    customValue,
    onSelect,
    onCustomChange,
    placeholder = "Select an option",
    customPlaceholder = "Or enter custom..."
}: DropdownSelectorProps) => (
    <div className="space-y-2">
        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
        </label>
        <select
            value={customValue ? "__custom__" : selected}
            onChange={(e) => {
                if (e.target.value === "__custom__") return;
                onSelect(e.target.value);
                if (customValue) onCustomChange("");
            }}
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-white/20 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 text-sm text-gray-900 dark:text-white appearance-none cursor-pointer transition-all min-h-[44px]"
            style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.75rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem'
            }}
        >
            {options.map(({ key, label: optLabel }) => (
                <option key={key} value={key} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    {optLabel}
                </option>
            ))}
        </select>
        <input
            type="text"
            value={customValue}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder={customPlaceholder}
            className={`w-full px-4 py-3 bg-white dark:bg-white/5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 transition-all min-h-[44px]
                ${customValue ? `border-emerald-500 ring-1 ring-emerald-500/30` : "border-gray-300 dark:border-white/10"}`}
        />
    </div>
));

// ============================================================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================================================

const CollapsibleSection = memo(({
    title,
    badge,
    badgeGradient = "from-amber-500 to-orange-500",
    subBadge,
    isOpen,
    onToggle,
    children
}: CollapsibleSectionProps) => (
    <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-white/10">
        <button
            onClick={onToggle}
            className="flex items-center justify-between w-full"
        >
            <div className="flex items-center gap-2">
                {badge && (
                    <span className={`px-2 py-1 bg-gradient-to-r ${badgeGradient} text-white text-xs font-bold rounded-full`}>
                        {badge}
                    </span>
                )}
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                    {title}
                </h3>
                {subBadge && (
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full">
                        {subBadge}
                    </span>
                )}
            </div>
            {isOpen ? (
                <ChevronUpIcon className="w-5 h-5 text-gray-500" />
            ) : (
                <ChevronDownIcon className="w-5 h-5 text-gray-500" />
            )}
        </button>

        {/* Use CSS for content-visibility optimization */}
        <div
            className={`transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}
            style={{ contentVisibility: isOpen ? 'visible' : 'hidden' }}
        >
            {isOpen && (
                <div className="space-y-6 animate-fade-in">
                    {children}
                </div>
            )}
        </div>
    </div>
));

// ============================================================================
// SIMPLE DROPDOWN FOR P2/P3/P4 SECTIONS
// ============================================================================

const SimpleDropdown = memo(({
    label,
    options,
    selected,
    onSelect
}: {
    label: string;
    options: DropdownOption[];
    selected: string;
    onSelect: (key: string) => void;
}) => (
    <div className="space-y-2">
        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
        </label>
        <select
            value={selected}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-white/20 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 text-sm text-gray-900 dark:text-white appearance-none cursor-pointer transition-all min-h-[44px]"
            style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.75rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.5em 1.5em',
                paddingRight: '2.5rem'
            }}
        >
            {options.map(({ key, label: optLabel }) => (
                <option key={key} value={key} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    {optLabel}
                </option>
            ))}
        </select>
    </div>
));

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const BannerPrompter: React.FC<BannerPrompterProps> = ({
    onSendToBuilder,
    onJumpToImage,
    onSaveToLibrary,
}) => {
    // P1: Subject/Product State
    const [productDescription, setProductDescription] = useState("");
    const [refImages, setRefImages] = useState<({ file: File; url: string } | null)[]>([null, null]);

    // Professional Options State - default to empty (None)
    const [selectedIndustry, setSelectedIndustry] = useState<string>("");
    const [customIndustry, setCustomIndustry] = useState("");
    const [selectedProductType, setSelectedProductType] = useState<string>("");
    const [customProductType, setCustomProductType] = useState("");
    const [selectedMaterial, setSelectedMaterial] = useState<string>("");
    const [customMaterial, setCustomMaterial] = useState("");
    const [selectedBrandStyle, setSelectedBrandStyle] = useState<string>("");
    const [customBrandStyle, setCustomBrandStyle] = useState("");
    const [selectedAudience, setSelectedAudience] = useState<string>("");
    const [customAudience, setCustomAudience] = useState("");
    const [selectedColorPalette, setSelectedColorPalette] = useState<string>("");
    const [customColorPalette, setCustomColorPalette] = useState("");

    // P2: Context/Setting State - default to empty (None)
    const [selectedEnvironment, setSelectedEnvironment] = useState<string>("");
    const [selectedBackground, setSelectedBackground] = useState<string>("");
    const [selectedLighting, setSelectedLighting] = useState<string>("");

    // P3: Style/Aesthetic State - default to empty (None)
    const [selectedMedium, setSelectedMedium] = useState<string>("");
    const [selectedMood, setSelectedMood] = useState<string>("");

    // P4: Technical Constraints State
    const [selectedAspectRatio, setSelectedAspectRatio] = useState<'1:1' | '4:5' | '16:9' | '9:16'>('4:5');
    const [selectedNegativeSpace, setSelectedNegativeSpace] = useState<string>("");
    const [selectedPlatform, setSelectedPlatform] = useState<'midjourney' | 'dalle' | 'flux' | 'sdxl' | 'general'>('general');

    // Generation State
    const [generatedResult, setGeneratedResult] = useState("");
    const [bannerData, setBannerData] = useState<BannerPrompt | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState("");

    // Expanded sections - ALL COLLAPSED BY DEFAULT
    const [showBreakdown, setShowBreakdown] = useState(false);
    const [showProOptions, setShowProOptions] = useState(false);
    const [showTextContent, setShowTextContent] = useState(false);
    const [showContextSection, setShowContextSection] = useState(false);
    const [showStyleSection, setShowStyleSection] = useState(false);
    const [showTechnicalSection, setShowTechnicalSection] = useState(false);

    // Design Text Content State
    const [designHeadline, setDesignHeadline] = useState("");
    const [designSubheading, setDesignSubheading] = useState("");
    const [designProductDetails, setDesignProductDetails] = useState("");
    const [designCTA, setDesignCTA] = useState("");
    const [designBrandName, setDesignBrandName] = useState("");
    const [designPrice, setDesignPrice] = useState("");
    const [designDisclaimer, setDesignDisclaimer] = useState("");

    // Mounted ref
    const isMounted = useRef(true);

    // Memoized option arrays to prevent re-renders
    const environmentOptions = useMemo(() => getEnvironmentOptions(), []);
    const lightingOptions = useMemo(() => getLightingOptions(), []);
    const mediumOptions = useMemo(() => getMediumOptions(), []);
    const moodOptions = useMemo(() => getMoodOptions(), []);
    const negativeSpaceOptions = useMemo(() => getNegativeSpaceOptions(), []);

    // Build enhanced product description with professional options
    const getEnhancedDescription = useCallback(() => {
        const parts: string[] = [];

        // Base description
        if (productDescription.trim()) {
            parts.push(productDescription.trim());
        }

        // Industry
        const industry = customIndustry || (selectedIndustry ? INDUSTRY_OPTIONS.find(o => o.key === selectedIndustry)?.label.replace(/^[^\s]+\s/, '') : '');
        if (industry) parts.push(`Industry: ${industry}`);

        // Product Type
        const productType = customProductType || (selectedProductType ? PRODUCT_TYPE_OPTIONS.find(o => o.key === selectedProductType)?.label.replace(/^[^\s]+\s/, '') : '');
        if (productType) parts.push(`Type: ${productType}`);

        // Material
        const material = customMaterial || (selectedMaterial ? MATERIAL_OPTIONS.find(o => o.key === selectedMaterial)?.label.replace(/^[^\s]+\s/, '') : '');
        if (material) parts.push(`Material: ${material}`);

        // Brand Style
        const brandStyle = customBrandStyle || (selectedBrandStyle ? BRAND_STYLE_OPTIONS.find(o => o.key === selectedBrandStyle)?.label.replace(/^[^\s]+\s/, '') : '');
        if (brandStyle) parts.push(`Brand Style: ${brandStyle}`);

        // Target Audience
        const audience = customAudience || (selectedAudience ? TARGET_AUDIENCE_OPTIONS.find(o => o.key === selectedAudience)?.label.replace(/^[^\s]+\s/, '') : '');
        if (audience) parts.push(`Target Audience: ${audience}`);

        // Color Palette
        const colorPalette = customColorPalette || (selectedColorPalette ? COLOR_PALETTE_OPTIONS.find(o => o.key === selectedColorPalette)?.label.replace(/^[^\s]+\s/, '') : '');
        if (colorPalette) parts.push(`Color Palette: ${colorPalette}`);

        // Design Text Content
        if (designHeadline) parts.push(`Headline Text: "${designHeadline}"`);
        if (designSubheading) parts.push(`Subheading: "${designSubheading}"`);
        if (designProductDetails) parts.push(`Product Details Text: "${designProductDetails}"`);
        if (designCTA) parts.push(`Call-to-Action: "${designCTA}"`);
        if (designBrandName) parts.push(`Brand Name: "${designBrandName}"`);
        if (designPrice) parts.push(`Price/Offer: "${designPrice}"`);
        if (designDisclaimer) parts.push(`Disclaimer: "${designDisclaimer}"`);

        return parts.join('. ');
    }, [productDescription, selectedIndustry, customIndustry, selectedProductType, customProductType, selectedMaterial, customMaterial, selectedBrandStyle, customBrandStyle, selectedAudience, customAudience, selectedColorPalette, customColorPalette, designHeadline, designSubheading, designProductDetails, designCTA, designBrandName, designPrice, designDisclaimer]);

    useEffect(() => {
        return () => {
            isMounted.current = false;
            refImages.forEach(img => {
                if (img?.url) {
                    URL.revokeObjectURL(img.url);
                }
            });
        };
    }, []);

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
        if (isGenerating) return;

        const hasImages = refImages.some((img) => img !== null);
        const enhancedDescription = getEnhancedDescription();
        if (!enhancedDescription.trim() && !hasImages) return;

        setIsGenerating(true);
        setStatusMessage("Initializing...");
        setError(null);
        setBannerData(null);

        try {
            const imagePayloads = await Promise.all(
                refImages.map(async (img) => {
                    if (!img) return null;
                    return {
                        base64: await blobToBase64(img.file),
                        mimeType: img.file.type,
                    };
                })
            );

            const validImages = imagePayloads.filter((img): img is { base64: string; mimeType: string } => img !== null);

            let result: BannerBackendResult;

            // Use defaults if none selected
            const envToUse = selectedEnvironment || "studio";
            const moodToUse = selectedMood || "professional";
            const negSpaceToUse = selectedNegativeSpace || "right";

            if (validImages.length > 0) {
                result = await generateBannerFromImages(
                    enhancedDescription,
                    validImages,
                    envToUse,
                    moodToUse,
                    selectedAspectRatio,
                    negSpaceToUse,
                    selectedPlatform,
                    (status) => {
                        if (isMounted.current) setStatusMessage(status);
                    }
                );
            } else {
                result = await generateBannerPrompt(
                    enhancedDescription,
                    envToUse,
                    moodToUse,
                    selectedAspectRatio,
                    negSpaceToUse,
                    selectedPlatform,
                    (status) => {
                        if (isMounted.current) setStatusMessage(status);
                    }
                );
            }

            if (isMounted.current) {
                if (result.success && result.data && result.constructedPrompt) {
                    setBannerData(result.data);
                    setGeneratedResult(result.constructedPrompt);
                } else {
                    setError(`Banner generation failed: ${result.error}`);
                }
            }
        } catch (e: any) {
            console.error("Generation failed:", e);
            if (isMounted.current) {
                setError(`Generation failed: ${e?.message || "Unknown error"}`);
            }
        } finally {
            if (isMounted.current) {
                setIsGenerating(false);
                setStatusMessage("");
            }
        }
    };

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(generatedResult);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [generatedResult]);

    const handleSave = useCallback(() => {
        onSaveToLibrary(generatedResult);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }, [generatedResult, onSaveToLibrary]);

    return (
        <div className="max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-0 animate-fade-in space-y-6 sm:space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl text-white shadow-lg">
                    <SparklesIcon className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                        Pro Prompter
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">
                        Professional Prompt Architecture Engine
                    </p>
                </div>
            </div>

            {/* Main Form */}
            <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-white/10 p-4 sm:p-6 shadow-xl space-y-6">

                {/* P1: Subject/Product Section - Always visible */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full">P1</span>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                            Subject / Product
                        </h3>
                    </div>

                    {/* Product Image Upload */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <ImageUploadBox
                            label="Product Photo"
                            image={refImages[0]}
                            index={0}
                            onUpload={handleImageUpload}
                            onRemove={handleImageRemove}
                        />
                        <ImageUploadBox
                            label="Style Reference (Optional)"
                            image={refImages[1]}
                            index={1}
                            onUpload={handleImageUpload}
                            onRemove={handleImageRemove}
                        />
                    </div>

                    {/* Product Description */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Product Description
                        </label>
                        <textarea
                            value={productDescription}
                            onChange={(e) => setProductDescription(e.target.value)}
                            placeholder="Describe your product with materials, textures, and key features..."
                            className="w-full h-24 px-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30"
                        />
                    </div>
                </div>

                {/* PRO: Professional Options Section - COLLAPSIBLE */}
                <CollapsibleSection
                    title="Professional Options"
                    badge="PRO"
                    badgeGradient="from-amber-500 to-orange-500"
                    subBadge="INDUSTRY-GRADE"
                    isOpen={showProOptions}
                    onToggle={() => setShowProOptions(!showProOptions)}
                >
                    {/* Row 1: Industry & Product Type */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <DropdownSelector
                            label="Industry Type"
                            options={INDUSTRY_OPTIONS}
                            selected={selectedIndustry}
                            customValue={customIndustry}
                            onSelect={setSelectedIndustry}
                            onCustomChange={setCustomIndustry}
                            customPlaceholder="Custom industry (e.g., Aerospace, Hospitality...)"
                        />
                        <DropdownSelector
                            label="Product Type"
                            options={PRODUCT_TYPE_OPTIONS}
                            selected={selectedProductType}
                            customValue={customProductType}
                            onSelect={setSelectedProductType}
                            onCustomChange={setCustomProductType}
                            customPlaceholder="Custom type (e.g., SaaS, Hardware...)"
                        />
                    </div>

                    {/* Row 2: Material & Brand Style */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <DropdownSelector
                            label="Product Material"
                            options={MATERIAL_OPTIONS}
                            selected={selectedMaterial}
                            customValue={customMaterial}
                            onSelect={setSelectedMaterial}
                            onCustomChange={setCustomMaterial}
                            customPlaceholder="Custom material (e.g., Carbon Fiber, Titanium...)"
                        />
                        <DropdownSelector
                            label="Brand Style"
                            options={BRAND_STYLE_OPTIONS}
                            selected={selectedBrandStyle}
                            customValue={customBrandStyle}
                            onSelect={setSelectedBrandStyle}
                            onCustomChange={setCustomBrandStyle}
                            customPlaceholder="Custom style (e.g., Industrial, Artisan...)"
                        />
                    </div>

                    {/* Row 3: Target Audience & Color Palette */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <DropdownSelector
                            label="Target Audience"
                            options={TARGET_AUDIENCE_OPTIONS}
                            selected={selectedAudience}
                            customValue={customAudience}
                            onSelect={setSelectedAudience}
                            onCustomChange={setCustomAudience}
                            customPlaceholder="Custom audience (e.g., Millennials, Parents...)"
                        />
                        <DropdownSelector
                            label="Color Palette"
                            options={COLOR_PALETTE_OPTIONS}
                            selected={selectedColorPalette}
                            customValue={customColorPalette}
                            onSelect={setSelectedColorPalette}
                            onCustomChange={setCustomColorPalette}
                            customPlaceholder="Custom palette (e.g., Black & Gold, Navy Blue...)"
                        />
                    </div>
                </CollapsibleSection>

                {/* TEXT: Design Text Content Section - COLLAPSIBLE */}
                <CollapsibleSection
                    title="Design Text Content"
                    badge="📝"
                    badgeGradient="from-cyan-500 to-blue-500"
                    subBadge="CUSTOMIZABLE"
                    isOpen={showTextContent}
                    onToggle={() => setShowTextContent(!showTextContent)}
                >
                    {/* Headline */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Headline / Title
                        </label>
                        <input
                            type="text"
                            value={designHeadline}
                            onChange={(e) => setDesignHeadline(e.target.value)}
                            placeholder="Enter your main headline (e.g., Summer Sale 2024, Premium Quality)"
                            className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30"
                        />
                    </div>

                    {/* Subheading */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Subheading / Tagline
                        </label>
                        <input
                            type="text"
                            value={designSubheading}
                            onChange={(e) => setDesignSubheading(e.target.value)}
                            placeholder="Enter your subheading or tagline (e.g., Up to 50% Off, Crafted for Excellence)"
                            className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500 text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30"
                        />
                    </div>

                    {/* Row: Product Details & CTA */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                Product Details
                            </label>
                            <input
                                type="text"
                                value={designProductDetails}
                                onChange={(e) => setDesignProductDetails(e.target.value)}
                                placeholder="Key features (e.g., Wireless • 24hr Battery)"
                                className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                Call-to-Action (CTA)
                            </label>
                            <input
                                type="text"
                                value={designCTA}
                                onChange={(e) => setDesignCTA(e.target.value)}
                                placeholder="Button text (e.g., Shop Now, Learn More)"
                                className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30"
                            />
                        </div>
                    </div>

                    {/* Row: Brand Name & Price */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                Brand Name / Logo Text
                            </label>
                            <input
                                type="text"
                                value={designBrandName}
                                onChange={(e) => setDesignBrandName(e.target.value)}
                                placeholder="Your brand name (e.g., ACME Corp)"
                                className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                Price / Offer
                            </label>
                            <input
                                type="text"
                                value={designPrice}
                                onChange={(e) => setDesignPrice(e.target.value)}
                                placeholder="Pricing info (e.g., Starting at $99, Free Shipping)"
                                className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30"
                            />
                        </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Disclaimer / Fine Print
                        </label>
                        <input
                            type="text"
                            value={designDisclaimer}
                            onChange={(e) => setDesignDisclaimer(e.target.value)}
                            placeholder="Legal text or conditions (e.g., Terms apply, Limited time offer)"
                            className="w-full px-4 py-3 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-xl focus:outline-none focus:ring-1 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30"
                        />
                    </div>
                </CollapsibleSection>

                {/* P2: Context/Setting Section - COLLAPSIBLE */}
                <CollapsibleSection
                    title="Context / Setting"
                    badge="P2"
                    badgeGradient="from-blue-500 to-cyan-500"
                    isOpen={showContextSection}
                    onToggle={() => setShowContextSection(!showContextSection)}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SimpleDropdown
                            label="Environment"
                            options={environmentOptions}
                            selected={selectedEnvironment}
                            onSelect={setSelectedEnvironment}
                        />
                        <SimpleDropdown
                            label="Lighting"
                            options={lightingOptions}
                            selected={selectedLighting}
                            onSelect={setSelectedLighting}
                        />
                    </div>
                </CollapsibleSection>

                {/* P3: Style/Aesthetic Section - COLLAPSIBLE */}
                <CollapsibleSection
                    title="Style / Aesthetic"
                    badge="P3"
                    badgeGradient="from-violet-500 to-purple-500"
                    isOpen={showStyleSection}
                    onToggle={() => setShowStyleSection(!showStyleSection)}
                >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SimpleDropdown
                            label="Medium"
                            options={mediumOptions}
                            selected={selectedMedium}
                            onSelect={setSelectedMedium}
                        />
                        <SimpleDropdown
                            label="Mood"
                            options={moodOptions}
                            selected={selectedMood}
                            onSelect={setSelectedMood}
                        />
                    </div>
                </CollapsibleSection>

                {/* P4: Technical Constraints Section - COLLAPSIBLE */}
                <CollapsibleSection
                    title="Technical Constraints"
                    badge="P4"
                    badgeGradient="from-rose-500 to-pink-500"
                    subBadge="AUTO-INJECTED"
                    isOpen={showTechnicalSection}
                    onToggle={() => setShowTechnicalSection(!showTechnicalSection)}
                >
                    {/* Aspect Ratio with Commercial Use Cases */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Aspect Ratio</label>
                        <select
                            value={selectedAspectRatio}
                            onChange={(e) => setSelectedAspectRatio(e.target.value as '1:1' | '4:5' | '16:9' | '9:16')}
                            className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-white/20 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 text-sm text-gray-900 dark:text-white appearance-none cursor-pointer transition-all min-h-[44px]"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                backgroundPosition: 'right 0.75rem center',
                                backgroundRepeat: 'no-repeat',
                                backgroundSize: '1.5em 1.5em',
                                paddingRight: '2.5rem'
                            }}
                        >
                            {(['1:1', '4:5', '16:9', '9:16'] as const).map((ratio) => {
                                const info = ASPECT_RATIO_INFO[ratio];
                                return (
                                    <option key={ratio} value={ratio} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                                        {ratio} - {info.label}
                                    </option>
                                );
                            })}
                        </select>
                        {selectedAspectRatio && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                                📱 {ASPECT_RATIO_INFO[selectedAspectRatio].useCase}
                            </p>
                        )}
                    </div>

                    {/* Negative Space Position */}
                    <SimpleDropdown
                        label="CTA Space Position"
                        options={negativeSpaceOptions}
                        selected={selectedNegativeSpace}
                        onSelect={setSelectedNegativeSpace}
                    />

                    {/* Platform */}
                    <SimpleDropdown
                        label="Target Platform"
                        options={PLATFORM_OPTIONS}
                        selected={selectedPlatform}
                        onSelect={(val) => setSelectedPlatform(val as any)}
                    />
                </CollapsibleSection>

                {/* Error Display */}
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-2xl">
                        <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
                    </div>
                )}

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-full shadow-lg shadow-emerald-500/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:transform-none"
                >
                    {isGenerating ? (
                        statusMessage || "Generating Pro Prompt..."
                    ) : (
                        <>
                            <SparklesIcon className="w-5 h-5" />
                            Generate Pro Prompt
                        </>
                    )}
                </button>
            </div>

            {/* Output Section */}
            {(generatedResult || bannerData) && (
                <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-white/10 p-4 sm:p-6 shadow-xl animate-slide-up-fade space-y-4">

                    {/* PPA Breakdown */}
                    {bannerData && (
                        <div className="space-y-4 pb-4 border-b border-gray-200 dark:border-white/10">
                            <button
                                onClick={() => setShowBreakdown(!showBreakdown)}
                                className="flex items-center justify-between w-full"
                            >
                                <div className="flex items-center gap-2">
                                    <SparklesIcon className="w-5 h-5 text-emerald-500" />
                                    <span className="font-bold text-gray-900 dark:text-white">PPA Breakdown</span>
                                </div>
                                {showBreakdown ? (
                                    <ChevronUpIcon className="w-5 h-5 text-gray-500" />
                                ) : (
                                    <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                                )}
                            </button>

                            {showBreakdown && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {/* P1 Summary */}
                                    <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                                        <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">P1 Subject</p>
                                        <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
                                            {bannerData.subject?.product_name || 'N/A'}
                                        </p>
                                    </div>
                                    {/* P2 Summary */}
                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">P2 Context</p>
                                        <p className="text-xs text-gray-700 dark:text-gray-300">
                                            {ENVIRONMENT_LABELS[bannerData.context?.environment] || bannerData.context?.environment}
                                        </p>
                                    </div>
                                    {/* P3 Summary */}
                                    <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
                                        <p className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase mb-1">P3 Style</p>
                                        <p className="text-xs text-gray-700 dark:text-gray-300">
                                            {MOOD_LABELS[bannerData.style?.mood] || bannerData.style?.mood}
                                        </p>
                                    </div>
                                    {/* P4 Summary */}
                                    <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-xl">
                                        <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase mb-1">P4 Technical</p>
                                        <p className="text-xs text-gray-700 dark:text-gray-300">
                                            {bannerData.technical?.aspect_ratio} • {NEGATIVE_SPACE_LABELS[bannerData.technical?.negative_space_position]?.replace(/^[^\s]+\s/, '')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Generated Prompt */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Generated Prompt
                        </label>
                        <div className="relative">
                            <pre className="w-full min-h-[120px] p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words font-mono">
                                {generatedResult}
                            </pre>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleCopy}
                            className="flex-1 min-w-[120px] h-12 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            {copied ? <CheckIcon className="w-4 h-4" /> : <CopyIcon className="w-4 h-4" />}
                            {copied ? "Copied!" : "Copy"}
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 min-w-[120px] h-12 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            {saved ? <CheckIcon className="w-4 h-4" /> : <FolderIcon className="w-4 h-4" />}
                            {saved ? "Saved!" : "Save"}
                        </button>
                        <button
                            onClick={() => onSendToBuilder(generatedResult)}
                            className="flex-1 min-w-[120px] h-12 bg-gradient-to-r from-violet-500 to-purple-500 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
                        >
                            Send to Builder
                        </button>
                        <button
                            onClick={() => onJumpToImage(generatedResult)}
                            className="flex-1 min-w-[120px] h-12 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
                        >
                            Generate Image
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BannerPrompter;
