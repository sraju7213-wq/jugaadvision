import React, { useState, useCallback } from "react";
import { ExternalLink, Sparkles, Check, ChevronDown, ChevronUp, Zap, Wand2, Compass, Layers, ShieldCheck, ArrowUpRight } from "lucide-react";

export interface ImagePlatform {
  id: string;
  name: string;
  shortName: string;
  tag: string;
  tagType: "primary" | "free" | "nologin" | "pro";
  category: "all" | "autofill" | "nologin" | "specialized";
  description: string;
  badge?: string;
  prefillsPrompt: boolean;
  requiresLogin: boolean;
  accentColor: string;
  icon: React.FC<{ className?: string }>;
  getUrl: (prompt: string) => string;
}

// Brand SVG Icons
export const GeminiIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 24C12 17.3726 6.62742 12 0 12C6.62742 12 12 6.62742 12 0C12 6.62742 17.3726 12 24 12C17.3726 12 12 17.3726 12 24Z"
      fill="currentColor"
    />
  </svg>
);

export const ChatGPTIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3a9 9 0 0 0-9 9c0 1.5.37 2.91 1.02 4.16L3 21l4.98-1.01A8.96 8.96 0 0 0 12 21a9 9 0 0 0 9-9 9 9 0 0 0-9-9Z" />
    <path d="M8.5 10a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
    <path d="M15.5 10a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
    <path d="M9.5 15.5c.8.5 1.6.8 2.5.8s1.7-.3 2.5-.8" />
  </svg>
);

export const AdobeFireflyIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
    <path d="M5 3v4" />
    <path d="M3 5h4" />
    <path d="M19 17v4" />
    <path d="M17 19h4" />
  </svg>
);

export const MetaAIIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 18c-2.8 0-4.5-2-4.5-5.5 0-4 2.5-6.5 5.5-6.5 2.2 0 4 1.5 5 4 1-2.5 2.8-4 5-4 3 0 5.5 2.5 5.5 6.5 0 3.5-1.7 5.5-4.5 5.5-2 0-3.6-1.2-4.5-3-.9 1.8-2.5 3-4.5 3Z" />
  </svg>
);

export const MicrosoftDesignerIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <rect width="8" height="8" x="3" y="3" rx="1.5" />
    <rect width="8" height="8" x="13" y="3" rx="1.5" />
    <rect width="8" height="8" x="3" y="13" rx="1.5" />
    <rect width="8" height="8" x="13" y="13" rx="1.5" />
  </svg>
);

export const PollinationsIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v4" />
    <path d="M12 18v4" />
    <path d="m4.93 4.93 2.83 2.83" />
    <path d="m16.24 16.24 2.83 2.83" />
    <path d="M2 12h4" />
    <path d="M18 12h4" />
    <path d="m4.93 19.07 2.83-2.83" />
    <path d="m16.24 7.76 2.83-2.83" />
  </svg>
);

export const PerchanceIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <rect width="18" height="18" x="3" y="3" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
    <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" />
    <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" />
  </svg>
);

export const FluxIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export const IdeogramIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 7V4h16v3" />
    <path d="M9 20h6" />
    <path d="M12 4v16" />
  </svg>
);

export const LeonardoIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Z" />
    <path d="M12 6a6 6 0 0 0-6 6c0 2 1 3.5 2.5 4.5" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

export const CraiyonIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="m14 4 6 6-12 12H2v-6L14 4Z" />
    <path d="m18 8-4-4" />
    <path d="m7 15 2 2" />
  </svg>
);

export const RecraftIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.29 7 12 12 20.71 7" />
    <line x1="12" x2="12" y1="22" y2="12" />
  </svg>
);

// All Registered AI Image Generation Targets
export const IMAGE_GENERATOR_PLATFORMS: ImagePlatform[] = [
  {
    id: "chatgpt",
    name: "ChatGPT (DALL·E 3)",
    shortName: "ChatGPT",
    tag: "Auto-Fill Prompt",
    tagType: "primary",
    category: "autofill",
    description: "Launches ChatGPT image creation with your prompt pre-filled in the prompt bar.",
    prefillsPrompt: true,
    requiresLogin: true,
    accentColor: "#10a37f",
    icon: ChatGPTIcon,
    getUrl: (prompt: string) =>
      prompt
        ? `https://chatgpt.com/?q=${encodeURIComponent("Create a high-quality image of: " + prompt)}`
        : "https://chatgpt.com/",
  },
  {
    id: "gemini",
    name: "Google Gemini (Imagen 3)",
    shortName: "Gemini",
    tag: "Free / Imagen 3",
    tagType: "free",
    category: "autofill",
    description: "Google Gemini with state-of-the-art Imagen 3 generation. Prompt copied for 1-click paste.",
    prefillsPrompt: false,
    requiresLogin: true,
    accentColor: "#4285f4",
    icon: GeminiIcon,
    getUrl: () => "https://gemini.google.com/app",
  },
  {
    id: "firefly",
    name: "Adobe Firefly",
    shortName: "Firefly",
    tag: "Auto-Fill / Free Tier",
    tagType: "primary",
    category: "autofill",
    description: "Adobe commercial-safe AI generator with your prompt pre-loaded in the canvas query.",
    prefillsPrompt: true,
    requiresLogin: true,
    accentColor: "#e3614f",
    icon: AdobeFireflyIcon,
    getUrl: (prompt: string) =>
      prompt
        ? `https://firefly.adobe.com/generate/images?prompt=${encodeURIComponent(prompt)}`
        : "https://firefly.adobe.com/generate/images",
  },
  {
    id: "metaai",
    name: "Meta AI (Imagine)",
    shortName: "Meta AI",
    tag: "100% Free",
    tagType: "free",
    category: "autofill",
    description: "Meta AI fast image generator. Pre-populates prompt and copies to clipboard.",
    prefillsPrompt: true,
    requiresLogin: false,
    accentColor: "#0081fb",
    icon: MetaAIIcon,
    getUrl: (prompt: string) =>
      prompt
        ? `https://www.meta.ai/?prompt=${encodeURIComponent("/imagine " + prompt)}`
        : "https://www.meta.ai/",
  },
  {
    id: "bing",
    name: "Microsoft Designer (DALL·E 3)",
    shortName: "Bing / Designer",
    tag: "Free DALL·E 3",
    tagType: "free",
    category: "autofill",
    description: "Bing Image Creator powered by OpenAI DALL·E 3. Pre-fills your prompt directly.",
    prefillsPrompt: true,
    requiresLogin: true,
    accentColor: "#00a4ef",
    icon: MicrosoftDesignerIcon,
    getUrl: (prompt: string) =>
      prompt
        ? `https://www.bing.com/images/create?q=${encodeURIComponent(prompt)}`
        : "https://www.bing.com/images/create",
  },
  {
    id: "pollinations",
    name: "Pollinations.ai",
    shortName: "Pollinations",
    tag: "Instant / No Login",
    tagType: "nologin",
    category: "nologin",
    description: "Zero wait, zero login, 100% free open-source image generation.",
    prefillsPrompt: true,
    requiresLogin: false,
    accentColor: "#9333ea",
    icon: PollinationsIcon,
    getUrl: (prompt: string) =>
      prompt
        ? `https://pollinations.ai/p/${encodeURIComponent(prompt)}`
        : "https://pollinations.ai/",
  },
  {
    id: "perchance",
    name: "Perchance AI",
    shortName: "Perchance",
    tag: "Free / No Login",
    tagType: "nologin",
    category: "nologin",
    description: "100% free unlimited text-to-image generator with instant generation.",
    prefillsPrompt: true,
    requiresLogin: false,
    accentColor: "#f59e0b",
    icon: PerchanceIcon,
    getUrl: (prompt: string) =>
      prompt
        ? `https://perchance.org/ai-text-to-image-generator#${encodeURIComponent(prompt)}`
        : "https://perchance.org/ai-text-to-image-generator",
  },
  {
    id: "flux",
    name: "FLUX.1 Schnell (Hugging Face)",
    shortName: "FLUX.1 SOTA",
    tag: "Open Weights SOTA",
    tagType: "free",
    category: "specialized",
    description: "Black Forest Labs FLUX.1 Schnell on Hugging Face Spaces. Next-gen image fidelity.",
    prefillsPrompt: false,
    requiresLogin: false,
    accentColor: "#ff9d00",
    icon: FluxIcon,
    getUrl: () => "https://huggingface.co/spaces/black-forest-labs/FLUX.1-schnell",
  },
  {
    id: "ideogram",
    name: "Ideogram AI",
    shortName: "Ideogram",
    tag: "Typography King",
    tagType: "free",
    category: "specialized",
    description: "World-class graphic design and text-in-image rendering with free daily credits.",
    prefillsPrompt: false,
    requiresLogin: true,
    accentColor: "#6366f1",
    icon: IdeogramIcon,
    getUrl: () => "https://ideogram.ai/",
  },
  {
    id: "leonardo",
    name: "Leonardo.ai",
    shortName: "Leonardo",
    tag: "150 Free / Day",
    tagType: "free",
    category: "specialized",
    description: "Artistic control, photorealism, and style tuning with daily free allocation.",
    prefillsPrompt: false,
    requiresLogin: true,
    accentColor: "#8b5cf6",
    icon: LeonardoIcon,
    getUrl: () => "https://app.leonardo.ai/",
  },
  {
    id: "craiyon",
    name: "Craiyon AI",
    shortName: "Craiyon",
    tag: "Free Unlimited",
    tagType: "nologin",
    category: "nologin",
    description: "Free unlimited generation with auto-filled prompt bar.",
    prefillsPrompt: true,
    requiresLogin: false,
    accentColor: "#eab308",
    icon: CraiyonIcon,
    getUrl: (prompt: string) =>
      prompt
        ? `https://www.craiyon.com/?prompt=${encodeURIComponent(prompt)}`
        : "https://www.craiyon.com/",
  },
  {
    id: "recraft",
    name: "Recraft.ai",
    shortName: "Recraft",
    tag: "Vector & 3D",
    tagType: "free",
    category: "specialized",
    description: "Generate vectors, SVGs, 3D icons, and brand graphics directly from prompts.",
    prefillsPrompt: false,
    requiresLogin: true,
    accentColor: "#f43f5e",
    icon: RecraftIcon,
    getUrl: () => "https://www.recraft.ai/",
  },
];

interface QuickImageGeneratorsProps {
  prompt: string;
  variant?: "banner" | "compact" | "dropdown" | "grid";
  title?: string;
  showCategoryFilter?: boolean;
  className?: string;
  onLaunch?: (platform: ImagePlatform) => void;
}

export const QuickImageGenerators: React.FC<QuickImageGeneratorsProps> = ({
  prompt,
  variant = "compact",
  title = "Direct Jump: Generate Image in 1-Click",
  showCategoryFilter = false,
  className = "",
  onLaunch,
}) => {
  const [activePlatformId, setActivePlatformId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "autofill" | "nologin" | "specialized">("all");
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);

  const cleanPrompt = (prompt || "").trim();

  const handleLaunch = useCallback(
    async (platform: ImagePlatform) => {
      if (!cleanPrompt) return;

      // 1. Copy the prompt to clipboard
      try {
        await navigator.clipboard.writeText(cleanPrompt);
      } catch (e) {
        console.warn("Clipboard copy failed, proceeding to launch URL", e);
      }

      // 2. Set visual feedback
      setActivePlatformId(platform.id);
      setTimeout(() => {
        setActivePlatformId(null);
      }, 2500);

      // 3. Open in new tab
      const targetUrl = platform.getUrl(cleanPrompt);
      window.open(targetUrl, "_blank", "noopener,noreferrer");

      if (onLaunch) {
        onLaunch(platform);
      }
    },
    [cleanPrompt, onLaunch]
  );

  const filteredPlatforms = IMAGE_GENERATOR_PLATFORMS.filter((p) => {
    if (activeFilter === "all") return true;
    return p.category === activeFilter;
  });

  const primaryPlatforms = IMAGE_GENERATOR_PLATFORMS.slice(0, 5);
  const additionalPlatforms = IMAGE_GENERATOR_PLATFORMS.slice(5);

  // -------------------------------------------------------------
  // DROPDOWN VARIANT (Minimal trigger for compact headers or cards)
  // -------------------------------------------------------------
  if (variant === "dropdown") {
    return (
      <div className={`relative inline-block text-left ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpenDropdown((prev) => !prev)}
          disabled={!cleanPrompt}
          className="editorial-button editorial-button--sm editorial-button--secondary flex items-center gap-1.5 min-h-[32px] px-2.5 shadow-sm hover:border-[var(--editorial-coral)] disabled:opacity-50 disabled:cursor-not-allowed"
          title="Jump directly to AI image generators with this prompt"
          aria-expanded={isOpenDropdown}
          aria-haspopup="true"
        >
          <Sparkles className="w-3.5 h-3.5 text-[var(--editorial-coral)] animate-pulse" />
          <span className="font-mono text-xs font-semibold">Generate Image</span>
          <ChevronDown className={`w-3 h-3 text-[var(--editorial-muted)] transition-transform duration-200 ${isOpenDropdown ? "rotate-180" : ""}`} />
        </button>

        {isOpenDropdown && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpenDropdown(false)}
            />
            <div className="absolute right-0 mt-1.5 w-72 z-50 rounded-none bg-[var(--editorial-surface-elevated)] border border-[var(--editorial-rule-strong)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] p-2 animate-scale-in">
              <div className="px-2 py-1.5 border-b border-[var(--editorial-rule)] mb-1 flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold tracking-wider uppercase text-[var(--editorial-muted)]">
                  Jump to AI Studio (Auto-Copies)
                </span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>

              <div className="max-h-72 overflow-y-auto space-y-1 py-1 custom-scrollbar">
                {IMAGE_GENERATOR_PLATFORMS.map((platform) => {
                  const Icon = platform.icon;
                  const isLaunching = activePlatformId === platform.id;
                  return (
                    <button
                      key={platform.id}
                      type="button"
                      onClick={() => {
                        handleLaunch(platform);
                        setIsOpenDropdown(false);
                      }}
                      className="w-full text-left p-2 flex items-center justify-between gap-2.5 transition-all hover:bg-[var(--editorial-surface-muted)] group border border-transparent hover:border-[var(--editorial-rule)]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-6 h-6 flex items-center justify-center rounded-none flex-shrink-0 text-white shadow-xs"
                          style={{ backgroundColor: platform.accentColor }}
                        >
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="m-0 font-mono text-xs font-bold text-[var(--editorial-ink)] truncate group-hover:text-[var(--editorial-coral)]">
                            {platform.name}
                          </p>
                          <p className="m-0 font-mono text-[9px] text-[var(--editorial-muted)] truncate">
                            {platform.tag}
                          </p>
                        </div>
                      </div>
                      {isLaunching ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-[var(--editorial-muted)] group-hover:text-[var(--editorial-ink)] flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // COMPACT VARIANT (Horizontal sleek ribbon for output panels)
  // -------------------------------------------------------------
  if (variant === "compact") {
    return (
      <div className={`space-y-2 pt-2 border-t border-[var(--editorial-rule-subtle)] ${className}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-[var(--editorial-coral)]" />
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-[var(--editorial-ink)]">
              Jump to Image Creator
            </span>
            <span className="hidden sm:inline-block font-mono text-[9px] text-[var(--editorial-muted)]">
              (Copies prompt & opens in 1-click)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="font-mono text-[10px] text-[var(--editorial-muted)] hover:text-[var(--editorial-coral)] flex items-center gap-1 transition-colors"
          >
            <span>{isExpanded ? "Show Less" : `+${additionalPlatforms.length} Free Options`}</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Primary Row */}
        <div className="flex flex-wrap items-center gap-1.5">
          {primaryPlatforms.map((platform) => {
            const Icon = platform.icon;
            const isLaunching = activePlatformId === platform.id;
            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => handleLaunch(platform)}
                disabled={!cleanPrompt}
                className={`group relative flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono border transition-all duration-150 select-none ${
                  isLaunching
                    ? "bg-emerald-500 text-white border-emerald-600 shadow-sm"
                    : "bg-[var(--editorial-surface)] hover:bg-[var(--editorial-surface-strong)] text-[var(--editorial-ink)] border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)] shadow-xs hover:-translate-y-0.5"
                } disabled:opacity-40 disabled:pointer-events-none`}
                title={`${platform.description} — Click to copy prompt & jump`}
              >
                <div
                  className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0"
                  style={{ color: isLaunching ? "#ffffff" : platform.accentColor }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="font-semibold">{platform.shortName}</span>
                {platform.prefillsPrompt && (
                  <span className="text-[8.5px] px-1 py-0.2 bg-black/5 dark:bg-white/10 text-[var(--editorial-muted)] font-mono rounded-none">
                    Prefill
                  </span>
                )}
                {isLaunching ? (
                  <Check className="w-3 h-3 text-white ml-0.5" />
                ) : (
                  <ArrowUpRight className="w-3 h-3 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-transform" />
                )}
              </button>
            );
          })}
        </div>

        {/* Expandable Additional Platforms */}
        {isExpanded && (
          <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 animate-fade-in">
            {additionalPlatforms.map((platform) => {
              const Icon = platform.icon;
              const isLaunching = activePlatformId === platform.id;
              return (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => handleLaunch(platform)}
                  disabled={!cleanPrompt}
                  className={`group flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs font-mono border transition-all duration-150 text-left ${
                    isLaunching
                      ? "bg-emerald-500 text-white border-emerald-600"
                      : "bg-[var(--editorial-surface-muted)] hover:bg-[var(--editorial-surface-strong)] text-[var(--editorial-ink)] border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)] shadow-xs"
                  } disabled:opacity-40 disabled:pointer-events-none`}
                  title={platform.description}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0"
                      style={{ color: isLaunching ? "#ffffff" : platform.accentColor }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="m-0 font-bold truncate text-[11px] leading-tight">{platform.shortName}</p>
                      <p className="m-0 text-[8.5px] text-[var(--editorial-muted)] truncate">{platform.tag}</p>
                    </div>
                  </div>
                  {isLaunching ? (
                    <Check className="w-3 h-3 text-white flex-shrink-0" />
                  ) : (
                    <ArrowUpRight className="w-3 h-3 opacity-30 group-hover:opacity-100 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {activePlatformId && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 font-mono text-[10px] animate-fade-in">
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span>
              Prompt copied to clipboard! Opening <strong>{IMAGE_GENERATOR_PLATFORMS.find((p) => p.id === activePlatformId)?.name}</strong>…
            </span>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // FULL BANNER / GRID VARIANT (Full section with categories & rich cards)
  // -------------------------------------------------------------
  return (
    <div className={`editorial-panel overflow-hidden ${className}`}>
      {/* Header */}
      <div className="editorial-panel__header flex flex-wrap items-center justify-between gap-3 py-2.5 px-4 bg-[var(--editorial-surface)]">
        <div className="flex items-center gap-2">
          <span className="editorial-badge editorial-badge--coral">
            <Sparkles className="w-3 h-3 mr-1 inline" /> 1-Click Launch
          </span>
          <h3 className="editorial-panel__title m-0 text-sm font-bold tracking-tight text-[var(--editorial-ink)]">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline font-mono text-[10px] text-[var(--editorial-muted)]">
            Prompt auto-copied to clipboard on click
          </span>
          <span className="editorial-badge editorial-badge--neutral">
            {filteredPlatforms.length} Direct Portals
          </span>
        </div>
      </div>

      {/* Optional Category Filter Pills */}
      {showCategoryFilter && (
        <div className="px-4 py-2 bg-[var(--editorial-surface-muted)] border-b border-[var(--editorial-rule)] flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[9.5px] uppercase font-bold text-[var(--editorial-muted)] mr-1">Filter:</span>
          {(
            [
              { id: "all", label: "All Platforms (12)" },
              { id: "autofill", label: "✨ Auto-Prefills Prompt (5)" },
              { id: "nologin", label: "🔓 100% Free / No Login (3)" },
              { id: "specialized", label: "🎨 Typography & Vectors (4)" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={`px-2 py-0.5 font-mono text-[10px] uppercase font-bold transition-all border ${
                activeFilter === tab.id
                  ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                  : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:text-[var(--editorial-ink)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Grid of Launcher Cards */}
      <div className="p-3.5 bg-[var(--editorial-paper)] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {filteredPlatforms.map((platform) => {
          const Icon = platform.icon;
          const isLaunching = activePlatformId === platform.id;

          return (
            <button
              key={platform.id}
              type="button"
              onClick={() => handleLaunch(platform)}
              disabled={!cleanPrompt}
              className={`group text-left p-3 border transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                isLaunching
                  ? "bg-emerald-500 text-white border-emerald-600 shadow-md scale-[0.99]"
                  : "bg-[var(--editorial-surface)] hover:bg-[var(--editorial-surface-strong)] text-[var(--editorial-ink)] border-[var(--editorial-rule)] hover:border-[var(--editorial-coral)] shadow-xs hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--editorial-coral)]"
              } disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed`}
              title={`${platform.description} — Click to copy & launch`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 flex items-center justify-center rounded-none shadow-xs text-white"
                      style={{ backgroundColor: isLaunching ? "#ffffff" : platform.accentColor }}
                    >
                      <Icon className={`w-4 h-4 ${isLaunching ? "text-emerald-600" : "text-white"}`} />
                    </div>
                    <div>
                      <h4
                        className={`m-0 font-mono text-xs font-bold transition-colors ${
                          isLaunching ? "text-white" : "text-[var(--editorial-ink)] group-hover:text-[var(--editorial-coral)]"
                        }`}
                      >
                        {platform.name}
                      </h4>
                    </div>
                  </div>

                  {isLaunching ? (
                    <span className="font-mono text-[9px] uppercase font-bold px-1.5 py-0.5 bg-white/20 text-white">
                      Copied!
                    </span>
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5 text-[var(--editorial-muted)] group-hover:text-[var(--editorial-coral)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  )}
                </div>

                <p
                  className={`m-0 font-mono text-[10.5px] line-clamp-2 leading-relaxed mb-2.5 ${
                    isLaunching ? "text-white/90" : "text-[var(--editorial-muted)]"
                  }`}
                >
                  {platform.description}
                </p>
              </div>

              <div className="flex items-center justify-between gap-1 pt-2 border-t border-black/5 dark:border-white/5">
                <span
                  className={`font-mono text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 ${
                    isLaunching
                      ? "bg-white/20 text-white"
                      : platform.tagType === "primary"
                      ? "bg-coral-100 text-coral-800 dark:bg-rose-950/40 dark:text-rose-300"
                      : platform.tagType === "nologin"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      : "bg-black/5 text-[var(--editorial-muted)] dark:bg-white/5"
                  }`}
                >
                  {platform.tag}
                </span>

                <span
                  className={`font-mono text-[9.5px] font-semibold flex items-center gap-1 ${
                    isLaunching ? "text-white" : "text-[var(--editorial-coral)]"
                  }`}
                >
                  {isLaunching ? "Opening…" : "Launch ➔"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {activePlatformId && (
        <div className="px-4 py-2 bg-emerald-500 text-white font-mono text-xs flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>
              Prompt copied to your clipboard! Opening <strong>{IMAGE_GENERATOR_PLATFORMS.find((p) => p.id === activePlatformId)?.name}</strong> in a new tab...
            </span>
          </div>
          <span className="text-[10px] opacity-80 uppercase tracking-wider">Paste ready (Ctrl+V / Cmd+V)</span>
        </div>
      )}
    </div>
  );
};

export default QuickImageGenerators;
