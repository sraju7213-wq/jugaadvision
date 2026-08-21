import React from "react";
import { Link } from "react-router-dom";
import {
  Wand2,
  ScanEye,
  FlaskConical,
  Layers,
  Sparkles,
  ArrowLeft,
} from "lucide-react";

export interface FeatureTool {
  id: string;
  name: string;
  shortName: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  description: string;
}

export const FEATURE_TOOLS: FeatureTool[] = [
  {
    id: "builder",
    name: "Prompt Builder",
    shortName: "Builder",
    path: "/prompt-builder",
    icon: Wand2,
    tag: "TOKEN & SYNTAX ENGINE",
    description:
      "Modular multi-platform token engine with structured syntax and real-time AI enhancements.",
  },
  {
    id: "image-to-prompt",
    name: "Image to Prompt",
    shortName: "Vision AI",
    path: "/image-to-prompt",
    icon: ScanEye,
    tag: "VISION REVERSE-ENGINEER",
    description:
      "Multimodal vision analyzer that extracts detailed photographic, lighting, and style prompts from images.",
  },
  {
    id: "creative-mixer",
    name: "Creative Mixer",
    shortName: "Mixer",
    path: "/creative-mixer",
    icon: FlaskConical,
    tag: "STYLE & CONCEPT FUSION",
    description:
      "Blend multiple creative concepts, artist aesthetics, lighting setups, and atmospheres into unified prompts.",
  },
  {
    id: "batch-generator",
    name: "Batch Generator",
    shortName: "Batch Studio",
    path: "/batch-generator",
    icon: Layers,
    tag: "VARIATION MATRIX",
    description:
      "High-volume permutation matrix and multi-variation generator ready for mass production.",
  },
  {
    id: "pro-prompter",
    name: "Pro Prompter",
    shortName: "Banner Pro",
    path: "/pro-prompter",
    icon: Sparkles,
    tag: "CINEMATIC & BANNER ARCHITECT",
    description:
      "Architectural composition, aspect-ratio locked layouts, typography specs, and professional studio lighting.",
  },
];

const TOOL_CONFIG: Record<
  string,
  {
    index: string;
    accentClass: string;
  }
> = {
  builder: {
    index: "01",
    accentClass: "text-[var(--ui-violet)] border-[var(--ui-violet)]/30 bg-[var(--ui-violet-soft)]",
  },
  "image-to-prompt": {
    index: "02",
    accentClass: "text-[var(--ui-coral)] border-[var(--ui-coral)]/30 bg-[var(--ui-coral-soft)]",
  },
  "creative-mixer": {
    index: "03",
    accentClass: "text-[var(--ui-pink)] border-[var(--ui-pink)]/30 bg-[var(--ui-pink-soft)]",
  },
  "batch-generator": {
    index: "04",
    accentClass: "text-[var(--ui-gold)] border-[var(--ui-gold)]/30 bg-[var(--ui-gold-soft)]",
  },
  "pro-prompter": {
    index: "05",
    accentClass: "text-[var(--ui-teal)] border-[var(--ui-teal)]/30 bg-[var(--ui-teal-soft)]",
  },
};

interface FeatureHeaderProps {
  currentId: "builder" | "image-to-prompt" | "creative-mixer" | "batch-generator" | "pro-prompter";
  title?: string;
  subtitle?: string;
  badge?: string;
}

export const FeatureHeader: React.FC<FeatureHeaderProps> = ({
  currentId,
  title,
  subtitle,
  badge,
}) => {
  const currentTool = FEATURE_TOOLS.find((t) => t.id === currentId) || FEATURE_TOOLS[0];
  const Icon = currentTool.icon;
  const config = TOOL_CONFIG[currentId] || {
    index: "01",
    accentClass: "text-[var(--ui-violet)] border-[var(--ui-violet)]/30 bg-[var(--ui-violet-soft)]",
  };

  return (
    <div className="w-full max-w-[1820px] mx-auto mb-8 motion-section-enter">
      {/* Quiet, thin breadcrumb */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[var(--ui-muted)] hover:text-[var(--ui-ink)] transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Studio</span>
          </Link>
          <span className="text-[var(--ui-border)]">/</span>
          <span className="text-[var(--ui-muted)] font-mono text-[11px] uppercase tracking-wider">
            Engines
          </span>
          <span className="text-[var(--ui-border)]">/</span>
          <span className="text-[var(--ui-ink)] font-mono text-[11px] font-bold uppercase tracking-wider">
            {currentTool.name}
          </span>
        </nav>

        <div className="hidden sm:flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--ui-muted)]">
            Engine {config.index} / 05
          </span>
        </div>
      </div>

      {/* Editorial Header with Eyebrow, Outlined Accent Icon, Serif Title & Description */}
      <header className="editorial-page__header">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div
            className={`w-7 h-7 rounded-sm border flex items-center justify-center flex-shrink-0 ${config.accentClass}`}
            aria-hidden="true"
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
          <p className="editorial-page__eyebrow m-0">
            <span className="editorial-page__eyebrow-mark" aria-hidden="true" />
            <span>Creative engine / {config.index} &bull; {badge || currentTool.tag}</span>
          </p>
        </div>

        <h1 className="editorial-page__title">
          {title || currentTool.name}
        </h1>

        <p className="editorial-page__description">
          {subtitle || currentTool.description}
        </p>
      </header>
    </div>
  );
};

export default FeatureHeader;

