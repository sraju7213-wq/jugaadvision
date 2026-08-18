import React, { useState, useCallback, memo, useRef, useEffect, useMemo, Suspense, lazy } from "react";
import { ProcessingAnimation } from "./ProcessingAnimation";
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
import { Loader2 } from "lucide-react";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface BannerPrompterProps {
    onSendToBuilder: (prompt: string) => void;
    onSaveToLibrary: (prompt: string, platform?: any, imageUrl?: string, tags?: string[]) => void;
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
                                : "border-[var(--editorial-rule-strong)] bg-[var(--editorial-surface)] hover:border-[var(--editorial-teal)] hover:bg-[var(--editorial-teal-soft)]"
                        }`}
                    >
                        {image ? (
                            <>
                                <img
                                    src={image.url}
                                    alt={label}
                                    decoding="async"
                                    loading="lazy"
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
                                <div className="w-7 h-7 flex items-center justify-center text-[var(--editorial-teal)] mb-1">
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
    { key: "real_estate", label: "🏠 Real Estate" },
    { key: "finance", label: "💰 Finance & Fintech" },
    { key: "beauty", label: "💄 Beauty & Cosmetics" },
    { key: "travel", label: "✈️ Travel & Hospitality" },
    { key: "fitness", label: "🏋️ Fitness & Wellness" },
    { key: "entertainment", label: "🎬 Entertainment & Media" },
    { key: "education", label: "🎓 Education & EdTech" },
    { key: "ecommerce", label: "🛒 E-Commerce & Retail" },
    { key: "luxury", label: "💎 Luxury Goods" },
    { key: "gaming", label: "🎮 Gaming & Esports" },
    { key: "sustainability", label: "🌱 Sustainability & Eco" },
    { key: "b2b_saas", label: "☁️ B2B SaaS" },
    { key: "crypto_web3", label: "🪙 Crypto & Web3" },
    { key: "pet_care", label: "🐾 Pet Care" },
    { key: "home_decor", label: "🛋️ Home & Interior" },
];

const PRODUCT_TYPE_OPTIONS: DropdownOption[] = [
    { key: "", label: "None" },
    { key: "physical_product", label: "📦 Physical Product" },
    { key: "software_app", label: "📱 Software / App" },
    { key: "saas_platform", label: "☁️ SaaS Platform" },
    { key: "service", label: "🤝 Professional Service" },
    { key: "course_content", label: "📚 Course / Content" },
    { key: "event_ticket", label: "🎟️ Event / Experience" },
    { key: "subscription", label: "🔄 Subscription Box" },
    { key: "hardware_device", label: "💻 Hardware Device" },
    { key: "consumable", label: "🍎 Consumable / Food" },
    { key: "apparel", label: "👕 Apparel & Wearable" },
    { key: "digital_download", label: "💾 Digital Download" },
    { key: "membership", label: "👑 Membership / Club" },
];

const MATERIAL_OPTIONS: DropdownOption[] = [
    { key: "", label: "None" },
    { key: "matte_metal", label: "🔩 Matte Brushed Metal" },
    { key: "glossy_plastic", label: "✨ Glossy Premium Plastic" },
    { key: "frosted_glass", label: "🧊 Frosted Glass" },
    { key: "natural_wood", label: "🪵 Natural Wood / Walnut" },
    { key: "premium_leather", label: "👜 Premium Leather" },
    { key: "anodized_aluminum", label: "📱 Anodized Aluminum" },
    { key: "ceramic", label: "🏺 Ceramic / Porcelain" },
    { key: "carbon_fiber", label: "🏁 Carbon Fiber" },
    { key: "organic_cotton", label: "🌿 Organic Cotton" },
    { key: "concrete_stone", label: "🏛️ Concrete & Stone" },
    { key: "translucent_resin", label: "💧 Translucent Resin" },
    { key: "gold_brass", label: "🌟 Gold & Brass Accents" },
];

const BRAND_STYLE_OPTIONS: DropdownOption[] = [
    { key: "", label: "None" },
    { key: "apple_minimal", label: "🍎 Apple-esque Ultra Minimal" },
    { key: "nike_bold", label: "⚡ Nike Dynamic & Athletic" },
    { key: "luxury_editorial", label: "👑 Vogue Editorial Luxury" },
    { key: "tech_futuristic", label: "🚀 Cyberpunk / Futuristic" },
    { key: "warm_artisanal", label: "☕ Warm Artisanal & Crafted" },
    { key: "swiss_clean", label: "📐 Swiss International Clean" },
    { key: "playful_genz", label: "🎨 Playful & Bold Neo-Pop" },
    { key: "dark_mode_pro", label: "🖤 Sleek Dark Mode Pro" },
    { key: "organic_earthy", label: "🍃 Earthy Botanical Organic" },
    { key: "corporate_clean", label: "🏢 Corporate Trustworthy" },
];

const TARGET_AUDIENCE_OPTIONS: DropdownOption[] = [
    { key: "", label: "None" },
    { key: "tech_enthusiasts", label: "💻 Tech Enthusiasts & Early Adopters" },
    { key: "gen_z", label: "⚡ Gen Z & Trendsetters" },
    { key: "millennials", label: "☕ Modern Millennials" },
    { key: "professionals_execs", label: "💼 B2B Executives & Founders" },
    { key: "creative_designers", label: "🎨 Creatives & Designers" },
    { key: "fitness_athletes", label: "🏃 Athletes & Fitness Enthusiasts" },
    { key: "parents_families", label: "👨‍👩‍👧 Parents & Families" },
    { key: "luxury_buyers", label: "💎 High Net Worth / Luxury Buyers" },
    { key: "gamers", label: "🎮 Gamers & Streamers" },
    { key: "students", label: "🎓 Students & Young Adults" },
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
        <label className="editorial-label">
            {label}
        </label>
        <select
            value={customValue ? "__custom__" : selected}
            onChange={(e) => {
                if (e.target.value === "__custom__") return;
                onSelect(e.target.value);
                if (customValue) onCustomChange("");
            }}
            className="editorial-select cursor-pointer"
        >
            {options.map(({ key, label: optLabel }) => (
                <option key={key} value={key}>
                    {optLabel}
                </option>
            ))}
        </select>
        <input
            type="text"
            value={customValue}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder={customPlaceholder}
            className="editorial-input"
        />
    </div>
));

// ============================================================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================================================

const CollapsibleSection = memo(({
    title,
    badge,
    subBadge,
    isOpen,
    onToggle,
    children
}: CollapsibleSectionProps) => (
    <div className="editorial-panel transition-all">
        <button
            type="button"
            onClick={onToggle}
            className={`w-full flex items-center justify-between p-3.5 sm:p-4 text-left transition-colors ${isOpen
                ? 'bg-[var(--ui-surface)]'
                : 'bg-[var(--ui-surface-muted)] hover:bg-[var(--ui-surface)]'
                }`}
        >
            <div className="flex items-center gap-2.5">
                {badge && (
                    <span className="px-2 py-0.5 bg-[var(--ui-teal)] text-white font-mono text-[10px] font-bold uppercase tracking-wider">
                        {badge}
                    </span>
                )}
                <h3 className="font-serif text-sm font-normal text-[var(--ui-ink)] m-0">
                    {title}
                </h3>
                {subBadge && (
                    <span className="px-2 py-0.5 bg-[var(--ui-teal-soft)] text-[var(--ui-teal)] border border-[var(--ui-teal)]/30 font-mono text-[10px] font-bold">
                        {subBadge}
                    </span>
                )}
            </div>
            {isOpen ? (
                <ChevronUpIcon className="w-4 h-4 text-[var(--ui-teal)]" />
            ) : (
                <ChevronDownIcon className="w-4 h-4 text-[var(--ui-muted)]" />
            )}
        </button>

        {isOpen && (
            <div className="p-4 sm:p-5 bg-[var(--ui-surface)] border-t border-[var(--ui-border)] space-y-5 motion-fade">
                {children}
            </div>
        )}
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
        <label className="editorial-label">
            {label}
        </label>
        <select
            value={selected}
            onChange={(e) => onSelect(e.target.value)}
            className="editorial-select cursor-pointer"
        >
            {options.map(({ key, label: optLabel }) => (
                <option key={key} value={key}>
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
        isMounted.current = true;
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
        const firstImg = refImages.find(img => img !== null)?.url;
        onSaveToLibrary(
            generatedResult,
            undefined,
            firstImg,
            ["pro-prompter", "banner", selectedPlatform]
        );
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }, [generatedResult, refImages, selectedPlatform, onSaveToLibrary]);

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in">
            {/* Main Editorial Form */}
            <div className="editorial-panel">
                <div className="editorial-panel__header">
                    <div className="flex items-center gap-2">
                        <span className="editorial-badge editorial-badge--teal">01 / Architecture</span>
                        <h2 className="editorial-panel__title m-0 text-base">Commercial Prompt Engineering Matrix</h2>
                    </div>
                    {isGenerating && (
                        <span className="editorial-badge editorial-badge--teal animate-pulse">
                            Assembling Directives...
                        </span>
                    )}
                </div>

                <div className="editorial-panel__body space-y-6">
                    {/* P1: Subject / Product Section - Primary Canvas */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--editorial-rule)]">
                            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-teal)] flex items-center gap-1.5">
                                <span className="editorial-badge editorial-badge--teal">P1</span> Subject & Product Specification
                            </span>
                            <span className="font-mono text-[10px] text-[var(--editorial-muted)] uppercase tracking-wider">
                                Core Target
                            </span>
                        </div>

                        {/* Product Image Uploads */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <ImageUploadBox
                                label="01 / Product Photo"
                                image={refImages[0]}
                                index={0}
                                onUpload={handleImageUpload}
                                onRemove={handleImageRemove}
                            />
                            <ImageUploadBox
                                label="02 / Style Reference (Optional)"
                                image={refImages[1]}
                                index={1}
                                onUpload={handleImageUpload}
                                onRemove={handleImageRemove}
                            />
                        </div>

                        {/* Product Description */}
                        <div className="space-y-1.5">
                            <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">
                                Product Description & Physical Attributes
                            </label>
                            <textarea
                                value={productDescription}
                                onChange={(e) => setProductDescription(e.target.value)}
                                placeholder="Describe your product with exact materials, surface finishes, textures, and hero design elements..."
                                className="editorial-textarea min-h-[90px] text-xs font-mono"
                            />
                        </div>
                    </div>

                    {/* PRO: Professional Options Section - COLLAPSIBLE */}
                    <CollapsibleSection
                        title="Commercial & Industry Parameters"
                        badge="PRO"
                        subBadge="Commercial Grade"
                        isOpen={showProOptions}
                        onToggle={() => setShowProOptions(!showProOptions)}
                    >
                        {/* Row 1: Industry & Product Type */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DropdownSelector
                                label="Industry Sector"
                                options={INDUSTRY_OPTIONS}
                                selected={selectedIndustry}
                                customValue={customIndustry}
                                onSelect={setSelectedIndustry}
                                onCustomChange={setCustomIndustry}
                                customPlaceholder="Custom industry (e.g., Aerospace, Hospitality...)"
                            />
                            <DropdownSelector
                                label="Product Category"
                                options={PRODUCT_TYPE_OPTIONS}
                                selected={selectedProductType}
                                customValue={customProductType}
                                onSelect={setSelectedProductType}
                                onCustomChange={setCustomProductType}
                                customPlaceholder="Custom type (e.g., SaaS, Hardware...)"
                            />
                        </div>

                        {/* Row 2: Material & Brand Style */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DropdownSelector
                                label="Primary Material Language"
                                options={MATERIAL_OPTIONS}
                                selected={selectedMaterial}
                                customValue={customMaterial}
                                onSelect={setSelectedMaterial}
                                onCustomChange={setCustomMaterial}
                                customPlaceholder="Custom material (e.g., Carbon Fiber, Titanium...)"
                            />
                            <DropdownSelector
                                label="Brand Visual Tone"
                                options={BRAND_STYLE_OPTIONS}
                                selected={selectedBrandStyle}
                                customValue={customBrandStyle}
                                onSelect={setSelectedBrandStyle}
                                onCustomChange={setCustomBrandStyle}
                                customPlaceholder="Custom style (e.g., Industrial, Artisan...)"
                            />
                        </div>

                        {/* Row 3: Target Audience & Color Palette */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DropdownSelector
                                label="Target Demographic"
                                options={TARGET_AUDIENCE_OPTIONS}
                                selected={selectedAudience}
                                customValue={customAudience}
                                onSelect={setSelectedAudience}
                                onCustomChange={setCustomAudience}
                                customPlaceholder="Custom audience (e.g., Founders, Gen Z...)"
                            />
                            <DropdownSelector
                                label="Color Harmony Palette"
                                options={COLOR_PALETTE_OPTIONS}
                                selected={selectedColorPalette}
                                customValue={customColorPalette}
                                onSelect={setSelectedColorPalette}
                                onCustomChange={setCustomColorPalette}
                                customPlaceholder="Custom palette (e.g., Terracotta & Ink...)"
                            />
                        </div>
                    </CollapsibleSection>

                    {/* TEXT: Design Text Content Section - COLLAPSIBLE */}
                    <CollapsibleSection
                        title="Design Typography & Text Placement"
                        badge="TXT"
                        subBadge="Layout Copy"
                        isOpen={showTextContent}
                        onToggle={() => setShowTextContent(!showTextContent)}
                    >
                        {/* Headline */}
                        <div className="space-y-1.5">
                            <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">
                                Primary Headline Copy
                            </label>
                            <input
                                type="text"
                                value={designHeadline}
                                onChange={(e) => setDesignHeadline(e.target.value)}
                                placeholder="Enter main campaign headline (e.g., Next-Generation Studio Audio)"
                                className="editorial-input text-xs font-mono"
                            />
                        </div>

                        {/* Subheading */}
                        <div className="space-y-1.5">
                            <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">
                                Subheading / Supporting Tagline
                            </label>
                            <input
                                type="text"
                                value={designSubheading}
                                onChange={(e) => setDesignSubheading(e.target.value)}
                                placeholder="Enter supporting copy (e.g., Precision acoustics engineered in Switzerland)"
                                className="editorial-input text-xs font-mono"
                            />
                        </div>

                        {/* Row: Product Details & CTA */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">
                                    Feature Badges / Specs
                                </label>
                                <input
                                    type="text"
                                    value={designProductDetails}
                                    onChange={(e) => setDesignProductDetails(e.target.value)}
                                    placeholder="e.g., 40h Battery • Lossless Wireless"
                                    className="editorial-input text-xs font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">
                                    Call to Action (CTA)
                                </label>
                                <input
                                    type="text"
                                    value={designCTA}
                                    onChange={(e) => setDesignCTA(e.target.value)}
                                    placeholder="e.g., Order Now • Limited Edition"
                                    className="editorial-input text-xs font-mono"
                                />
                            </div>
                        </div>

                        {/* Row: Brand Name & Price */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">
                                    Brand / Masthead
                                </label>
                                <input
                                    type="text"
                                    value={designBrandName}
                                    onChange={(e) => setDesignBrandName(e.target.value)}
                                    placeholder="e.g., JUGAAD VISIONS"
                                    className="editorial-input text-xs font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">
                                    Pricing / Offer Badge
                                </label>
                                <input
                                    type="text"
                                    value={designPrice}
                                    onChange={(e) => setDesignPrice(e.target.value)}
                                    placeholder="e.g., $299 • Complimentary Case"
                                    className="editorial-input text-xs font-mono"
                                />
                            </div>
                        </div>

                        {/* Disclaimer */}
                        <div className="space-y-1.5">
                            <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">
                                Legal / Footnote Copy
                            </label>
                            <input
                                type="text"
                                value={designDisclaimer}
                                onChange={(e) => setDesignDisclaimer(e.target.value)}
                                placeholder="e.g., Terms apply • While supplies last"
                                className="editorial-input text-xs font-mono"
                            />
                        </div>
                    </CollapsibleSection>

                    {/* P2: Context/Setting Section - COLLAPSIBLE */}
                    <CollapsibleSection
                        title="Context & Environment Lighting"
                        badge="P2"
                        isOpen={showContextSection}
                        onToggle={() => setShowContextSection(!showContextSection)}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SimpleDropdown
                                label="Set / Environment"
                                options={environmentOptions}
                                selected={selectedEnvironment}
                                onSelect={setSelectedEnvironment}
                            />
                            <SimpleDropdown
                                label="Lighting Setup"
                                options={lightingOptions}
                                selected={selectedLighting}
                                onSelect={setSelectedLighting}
                            />
                        </div>
                    </CollapsibleSection>

                    {/* P3: Style/Aesthetic Section - COLLAPSIBLE */}
                    <CollapsibleSection
                        title="Style Medium & Mood"
                        badge="P3"
                        isOpen={showStyleSection}
                        onToggle={() => setShowStyleSection(!showStyleSection)}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SimpleDropdown
                                label="Visual Medium"
                                options={mediumOptions}
                                selected={selectedMedium}
                                onSelect={setSelectedMedium}
                            />
                            <SimpleDropdown
                                label="Atmospheric Mood"
                                options={moodOptions}
                                selected={selectedMood}
                                onSelect={setSelectedMood}
                            />
                        </div>
                    </CollapsibleSection>

                    {/* P4: Technical Constraints Section - COLLAPSIBLE */}
                    <CollapsibleSection
                        title="Technical Canvas & Negative Space"
                        badge="P4"
                        subBadge="Auto-Formatted"
                        isOpen={showTechnicalSection}
                        onToggle={() => setShowTechnicalSection(!showTechnicalSection)}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Aspect Ratio */}
                            <div className="space-y-1.5">
                                <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider block">
                                    Aspect Ratio
                                </label>
                                <select
                                    value={selectedAspectRatio}
                                    onChange={(e) => setSelectedAspectRatio(e.target.value as '1:1' | '4:5' | '16:9' | '9:16')}
                                    className="editorial-select w-full text-xs font-mono"
                                >
                                    {(['1:1', '4:5', '16:9', '9:16'] as const).map((ratio) => {
                                        const info = ASPECT_RATIO_INFO[ratio];
                                        return (
                                            <option key={ratio} value={ratio}>
                                                {ratio} — {info.label}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* Negative Space Position */}
                            <SimpleDropdown
                                label="Negative Space for Copy"
                                options={negativeSpaceOptions}
                                selected={selectedNegativeSpace}
                                onSelect={setSelectedNegativeSpace}
                            />

                            {/* Platform */}
                            <SimpleDropdown
                                label="Engine Platform"
                                options={PLATFORM_OPTIONS}
                                selected={selectedPlatform}
                                onSelect={(val) => setSelectedPlatform(val as any)}
                            />
                        </div>
                    </CollapsibleSection>

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
                            disabled={isGenerating}
                            className="editorial-button editorial-button--primary editorial-button--coral w-full justify-center text-xs"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 shrink-0 text-white" />
                                    <span>{statusMessage || "Architecting Pro Prompt..."}</span>
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="w-3.5 h-3.5" />
                                    <span>Generate Commercial Pro Prompt</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Output Panel */}
            {(generatedResult || bannerData || isGenerating) && (
                <div className="editorial-panel motion-card-enter space-y-6">
                    <div className="editorial-panel__header">
                        <div className="flex items-center gap-2">
                            <span className="editorial-badge editorial-badge--teal">02 / Output</span>
                            <h3 className="editorial-panel__title m-0 text-base">
                                Synthesized Commercial Architecture
                            </h3>
                        </div>

                        {generatedResult && !isGenerating && (
                            <span className="editorial-badge editorial-badge--teal">Ready</span>
                        )}
                    </div>

                    <div className="editorial-panel__body space-y-5">
                        {isGenerating ? (
                            <ProcessingAnimation
                                variant="panel"
                                theme="teal"
                                badge="Pro Architect"
                                title="Architecting Commercial Specification"
                                status={statusMessage || undefined}
                                stages={[
                                    "Structuring primary subject & product constraints...",
                                    "Calculating focal depth & negative space distribution...",
                                    "Balancing typography safety zones & lighting key...",
                                    "Compiling commercial pro-prompt directives...",
                                ]}
                                stageIntervalMs={2000}
                                subtext="Engineered for high-conversion marketing visuals and billboard assets."
                            />
                        ) : (
                            <>
                        {/* PPA Breakdown */}
                        {bannerData && (
                            <div className="space-y-3 pb-4 border-b border-[var(--editorial-rule)]">
                                <button
                                    type="button"
                                    onClick={() => setShowBreakdown(!showBreakdown)}
                                    className="flex items-center justify-between w-full text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <SparklesIcon className="w-4 h-4 text-[var(--ui-teal)]" />
                                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--editorial-ink)]">
                                            PPA Layer Analysis
                                        </span>
                                    </div>
                                    {showBreakdown ? (
                                        <ChevronUpIcon className="w-4 h-4 text-[var(--ui-teal)]" />
                                    ) : (
                                        <ChevronDownIcon className="w-4 h-4 text-[var(--editorial-muted)]" />
                                    )}
                                </button>

                                {showBreakdown && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 motion-fade">
                                        <div className="p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                                            <p className="m-0 font-mono text-[9.5px] text-[var(--editorial-muted)] uppercase">P1 Subject</p>
                                            <p className="m-0 font-mono text-xs font-bold text-[var(--editorial-ink)] mt-1 truncate">
                                                {bannerData.subject?.product_name || 'N/A'}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                                            <p className="m-0 font-mono text-[9.5px] text-[var(--editorial-muted)] uppercase">P2 Context</p>
                                            <p className="m-0 font-mono text-xs font-bold text-[var(--editorial-ink)] mt-1 truncate">
                                                {ENVIRONMENT_LABELS[bannerData.context?.environment] || bannerData.context?.environment || 'Studio'}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                                            <p className="m-0 font-mono text-[9.5px] text-[var(--editorial-muted)] uppercase">P3 Style</p>
                                            <p className="m-0 font-mono text-xs font-bold text-[var(--editorial-ink)] mt-1 truncate">
                                                {MOOD_LABELS[bannerData.style?.mood] || bannerData.style?.mood || 'Editorial'}
                                            </p>
                                        </div>
                                        <div className="p-3 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)]">
                                            <p className="m-0 font-mono text-[9.5px] text-[var(--editorial-muted)] uppercase">P4 Technical</p>
                                            <p className="m-0 font-mono text-xs font-bold text-[var(--editorial-ink)] mt-1 truncate">
                                                {bannerData.technical?.aspect_ratio} • {NEGATIVE_SPACE_LABELS[bannerData.technical?.negative_space_position]?.replace(/^[^\s]+\s/, '') || 'Standard'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Generated Prompt */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="font-mono text-[10.5px] font-bold text-[var(--editorial-muted)] uppercase tracking-wider">
                                    Final Prompt Output
                                </label>
                                {generatedResult && (
                                    <span className="font-mono text-[10px] text-[var(--editorial-muted)]">
                                        {generatedResult.length} characters
                                    </span>
                                )}
                            </div>
                            <pre className="editorial-textarea min-h-[130px] font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
                                {generatedResult}
                            </pre>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="editorial-button editorial-button--sm editorial-button--secondary"
                                >
                                    {copied ? <CheckIcon className="w-3.5 h-3.5 text-[var(--ui-success)]" /> : <CopyIcon className="w-3.5 h-3.5" />}
                                    <span>{copied ? "Copied" : "Copy"}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    className="editorial-button editorial-button--sm editorial-button--secondary"
                                >
                                    {saved ? <CheckIcon className="w-3.5 h-3.5 text-[var(--ui-success)]" /> : <FolderIcon className="w-3.5 h-3.5" />}
                                    <span>{saved ? "Saved" : "Save to Vault"}</span>
                                </button>
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
                        </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BannerPrompter;
