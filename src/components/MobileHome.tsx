import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Aperture,
  ArrowRight,
  Bookmark,
  BookOpen,
  ChevronRight,
  FlaskConical,
  Layers,
  Palette,
  ScanEye,
  Settings as SettingsIcon,
  Sparkles,
  Wand2,
} from "lucide-react";
import { triggerHaptic } from "../services/nativeMedia";

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean | "true" | "false" }>;

interface Tool {
  name: string;
  blurb: string;
  path: string;
  icon: IconType;
  tone: string;
  badge?: string;
}

const TOOLS: Tool[] = [
  {
    name: "Prompt Builder",
    blurb: "Build pro prompts",
    path: "/prompt-builder",
    icon: Wand2,
    tone: "violet",
    badge: "Popular",
  },
  {
    name: "Image to Prompt",
    blurb: "Learn from any image",
    path: "/image-to-prompt",
    icon: ScanEye,
    tone: "coral",
  },
  {
    name: "Creative Mixer",
    blurb: "Fuse styles & moods",
    path: "/creative-mixer",
    icon: FlaskConical,
    tone: "pink",
  },
  {
    name: "Batch Generator",
    blurb: "Many variations at once",
    path: "/batch-generator",
    icon: Layers,
    tone: "gold",
  },
  {
    name: "Pro Prompter",
    blurb: "Banners & commercial",
    path: "/pro-prompter",
    icon: Aperture,
    tone: "teal",
  },
  {
    name: "Studio",
    blurb: "Persona & style studio",
    path: "/studio",
    icon: Palette,
    tone: "blue",
  },
];

const MORE_LINKS: Array<{ name: string; path: string; icon: IconType }> = [
  { name: "Prompt Library", path: "/library", icon: Bookmark },
  { name: "Settings", path: "/settings", icon: SettingsIcon },
  { name: "Help & Resources", path: "/help", icon: BookOpen },
];

const MobileHome: React.FC = () => {
  const navigate = useNavigate();

  const go = (path: string) => {
    triggerHaptic("selection");
    navigate(path);
  };

  return (
    <div className="mobile-home min-h-full px-4 pt-20 pb-6">
      {/* Header */}
      <header className="mb-5">
        <p className="m-0 text-[10px]  font-bold tracking-[0.2em] text-[var(--ui-primary)] mb-1.5">
          Jugaad Vision
        </p>
        <h1 className="m-0  text-[26px] leading-tight text-[var(--ui-ink)]">
          Your AI creative
          <br />
          studio, <em className="text-[var(--ui-primary)]">in your pocket.</em>
        </h1>
        <p className="m-0 mt-2 text-[13px] leading-relaxed text-[var(--ui-muted)]">
          Pick a tool and start creating — no setup, no fuss.
        </p>
      </header>

      {/* Quick start */}
      <button
        type="button"
        onClick={() => go("/prompt-builder")}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 mb-6 rounded-2xl bg-[var(--ui-ink)] text-[var(--ui-bg)] shadow-lg active:scale-[0.98] transition-transform"
      >
        <span className="flex items-center gap-2.5">
          <Sparkles className="w-5 h-5 text-[var(--ui-primary)]" aria-hidden="true" />
          <span className="text-sm font-semibold">Start Directing</span>
        </span>
        <ArrowRight className="w-4.5 h-4.5" aria-hidden="true" />
      </button>

      {/* Tools grid */}
      <section aria-labelledby="mobile-tools-title" className="mb-6">
        <h2 id="mobile-tools-title" className="m-0 mb-3 text-[11px]  font-bold tracking-[0.18em] text-[var(--ui-muted)]">
          Tools
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {TOOLS.map(({ name, blurb, path, icon: Icon, tone, badge }) => (
            <button
              key={path}
              type="button"
              onClick={() => go(path)}
              className="relative flex flex-col items-start gap-2.5 p-3.5 text-left rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] active:scale-[0.97] transition-transform"
            >
              {badge && (
                <span className="absolute top-2.5 right-2.5 text-[8px]  font-bold  px-1.5 py-0.5 rounded-full bg-[var(--ui-primary)] text-white">
                  {badge}
                </span>
              )}
              <span
                className="flex items-center justify-center w-10 h-10 rounded-xl"
                style={{
                  color: `var(--ui-${tone === 'coral' || tone === 'violet' ? 'primary' : tone})`,
                  background: `var(--ui-${tone === 'coral' || tone === 'violet' ? 'primary' : tone}-soft)`,
                }}
              >
                <Icon className="w-5 h-5" strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="w-full">
                <span className="block text-[13px] font-semibold leading-tight text-[var(--ui-ink)]">
                  {name}
                </span>
                <span className="block mt-0.5 text-[11px] leading-snug text-[var(--ui-muted)]">
                  {blurb}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* More */}
      <section aria-labelledby="mobile-more-title">
        <h2 id="mobile-more-title" className="m-0 mb-3 text-[11px]  font-bold tracking-[0.18em] text-[var(--ui-muted)]">
          More
        </h2>
        <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] overflow-hidden">
          {MORE_LINKS.map(({ name, path, icon: Icon }, idx) => (
            <button
              key={path}
              type="button"
              onClick={() => go(path)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-[var(--ui-surface)] transition-colors ${
                idx > 0 ? "border-t border-[var(--ui-border)]" : ""
              }`}
            >
              <Icon className="w-4.5 h-4.5 text-[var(--ui-muted)]" strokeWidth={1.8} aria-hidden="true" />
              <span className="flex-1 text-[13px] font-medium text-[var(--ui-ink)]">{name}</span>
              <ChevronRight className="w-4 h-4 text-[var(--ui-muted)]" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default MobileHome;
