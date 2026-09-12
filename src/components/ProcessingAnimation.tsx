import React, { useState, useEffect } from "react";

export type ProcessingTheme = "coral" | "violet" | "teal" | "gold" | "pink" | "auto";
export type ProcessingVariant = "page" | "panel" | "compact" | "inline";

export interface ProcessingAnimationProps {
  variant?: ProcessingVariant;
  theme?: ProcessingTheme;
  title?: string;
  status?: string;
  stages?: string[];
  stageIntervalMs?: number;
  showProgress?: boolean;
  progress?: number;
  subtext?: string;
  className?: string;
  badge?: string;
}

const THEME_STYLES: Record<
  ProcessingTheme,
  {
    accent: string;
    accentSoft: string;
    border: string;
    text: string;
    glow: string;
    badgeClass: string;
  }
> = {
  coral: {
    accent: "var(--editorial-coral)",
    accentSoft: "var(--editorial-coral-soft)",
    border: "rgba(227, 97, 79, 0.4)",
    text: "text-[var(--editorial-coral)]",
    glow: "rgba(227, 97, 79, 0.25)",
    badgeClass: "editorial-badge--coral",
  },
  violet: {
    accent: "var(--editorial-violet)",
    accentSoft: "var(--editorial-violet-soft)",
    border: "rgba(102, 84, 232, 0.4)",
    text: "text-[var(--editorial-violet)]",
    glow: "rgba(102, 84, 232, 0.25)",
    badgeClass: "editorial-badge--violet",
  },
  teal: {
    accent: "var(--editorial-teal)",
    accentSoft: "var(--editorial-teal-soft)",
    border: "rgba(75, 143, 136, 0.4)",
    text: "text-[var(--editorial-teal)]",
    glow: "rgba(75, 143, 136, 0.25)",
    badgeClass: "editorial-badge--teal",
  },
  gold: {
    accent: "var(--editorial-gold)",
    accentSoft: "var(--editorial-gold-soft)",
    border: "rgba(189, 139, 68, 0.4)",
    text: "text-[var(--editorial-gold)]",
    glow: "rgba(189, 139, 68, 0.25)",
    badgeClass: "editorial-badge--gold",
  },
  pink: {
    accent: "var(--editorial-pink)",
    accentSoft: "var(--editorial-pink-soft)",
    border: "rgba(198, 107, 220, 0.4)",
    text: "text-[var(--editorial-pink)]",
    glow: "rgba(198, 107, 220, 0.25)",
    badgeClass: "editorial-badge--pink",
  },
  auto: {
    accent: "var(--feature-accent, var(--editorial-coral))",
    accentSoft: "var(--feature-accent-soft, var(--editorial-coral-soft))",
    border: "rgba(227, 97, 79, 0.35)",
    text: "text-[var(--feature-accent,var(--editorial-coral))]",
    glow: "rgba(227, 97, 79, 0.2)",
    badgeClass: "editorial-badge--coral",
  },
};

export const ProcessingAnimation: React.FC<ProcessingAnimationProps> = ({
  variant = "panel",
  theme = "auto",
  title = "Synthesizing Directives",
  status,
  stages = [
    "Deconstructing visual latents",
    "Sampling creative neural weights",
    "Calibrating optical lighting & framing",
    "Assembling master prompt tokens",
  ],
  stageIntervalMs = 2400,
  showProgress = true,
  progress,
  subtext,
  className = "",
  badge,
}) => {
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [syntheticProgress, setSyntheticProgress] = useState(15);
  const themeConfig = THEME_STYLES[theme] || THEME_STYLES.auto;

  // Auto-cycle stages if multiple are provided
  useEffect(() => {
    if (!stages || stages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentStageIdx((prev) => (prev + 1) % stages.length);
    }, stageIntervalMs);
    return () => clearInterval(interval);
  }, [stages, stageIntervalMs]);

  // Smooth synthetic progress interpolation if external progress isn't fixed
  useEffect(() => {
    if (progress !== undefined) return;
    const interval = setInterval(() => {
      setSyntheticProgress((prev) => {
        if (prev >= 92) return 92; // Hold at 92% until completion
        const step = Math.max(1, (95 - prev) * 0.12);
        return Math.min(92, Math.round(prev + step));
      });
    }, 450);
    return () => clearInterval(interval);
  }, [progress]);

  const activeStatus = status || (stages && stages.length > 0 ? stages[currentStageIdx] : "Processing...");
  const currentProgress = progress !== undefined ? progress : syntheticProgress;

  if (variant === "inline") {
    return (
      <div className={`inline-flex items-center gap-2.5 font-mono text-xs ${className}`}>
        <div className="relative w-4 h-4 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full border border-dashed animate-spin"
            style={{
              borderColor: themeConfig.accent,
              animationDuration: "3s",
            }}
          />
          <div
            className="w-1.5 h-1.5 rounded-full animate-ping"
            style={{ backgroundColor: themeConfig.accent }}
          />
        </div>
        <span className={`font-bold uppercase tracking-wider ${themeConfig.text}`}>
          {activeStatus}
        </span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`p-3.5 border bg-[var(--editorial-surface-strong)] flex items-center gap-3.5 shadow-sm motion-fade ${className}`}
        style={{ borderColor: themeConfig.border }}
      >
        <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center">
          <div
            className="absolute inset-0 rounded-full border border-dashed animate-spin"
            style={{
              borderColor: themeConfig.accent,
              animationDuration: "4s",
            }}
          />
          <div
            className="absolute inset-1 rounded-full border-t-2 border-r-2 animate-spin"
            style={{
              borderColor: themeConfig.accent,
              animationDuration: "1.2s",
              animationDirection: "reverse",
            }}
          />
          <div
            className="w-2 h-2 rounded-full shadow-sm"
            style={{
              backgroundColor: themeConfig.accent,
              boxShadow: `0 0 8px ${themeConfig.glow}`,
            }}
          />
        </div>
        <div className="flex-grow min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--editorial-ink)] truncate">
              {title}
            </span>
            {showProgress && (
              <span className="font-mono text-[10px] font-bold text-[var(--editorial-muted)]">
                {currentProgress}%
              </span>
            )}
          </div>
          <p className={`m-0 font-mono text-[10px] tracking-wide truncate ${themeConfig.text} animate-pulse`}>
            {activeStatus}
          </p>
        </div>
      </div>
    );
  }

  // Full Page or Panel variant
  const isPage = variant === "page";

  return (
    <div
      className={`relative flex flex-col items-center justify-center text-center overflow-hidden motion-fade ${
        isPage ? "min-h-[62vh] py-12 px-6" : "p-8 sm:p-12 w-full"
      } ${className}`}
    >
      {/* Background Holographic Grid Accent */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-10"
        style={{
          backgroundImage: `linear-gradient(to right, ${themeConfig.accent} 1px, transparent 1px), linear-gradient(to bottom, ${themeConfig.accent} 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(circle at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 30%, transparent 75%)",
        }}
      />

      {/* Laser Scanning Line */}
      <div
        className="absolute inset-x-0 h-[2px] opacity-40 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${themeConfig.accent}, transparent)`,
          animation: "processingLaserScan 3s ease-in-out infinite alternate",
        }}
      />

      {/* Central Quantum Orb / Telemetry Visualizer */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-6 flex items-center justify-center">
        {/* Outer Orbit with Track and Dashes */}
        <div
          className="absolute inset-0 rounded-full border border-dashed animate-spin"
          style={{
            borderColor: themeConfig.accent,
            opacity: 0.45,
            animationDuration: "12s",
          }}
        />

        {/* Counter-rotating Arc */}
        <div
          className="absolute inset-1.5 rounded-full border-2 border-transparent border-t-[var(--editorial-ink)] border-b-[var(--editorial-ink)] opacity-30 animate-spin"
          style={{
            animationDuration: "6s",
            animationDirection: "reverse",
          }}
        />

        {/* Dynamic Glowing Arc */}
        <div
          className="absolute inset-3 rounded-full border-2 border-transparent animate-spin"
          style={{
            borderTopColor: themeConfig.accent,
            borderRightColor: themeConfig.accent,
            boxShadow: `0 0 16px ${themeConfig.glow}`,
            animationDuration: "1.6s",
          }}
        />

        {/* Inner Precision Grid Target */}
        <div
          className="absolute inset-5 rounded-full border border-[var(--editorial-rule)] flex items-center justify-center bg-[var(--editorial-surface)]"
          style={{
            boxShadow: `inset 0 0 10px ${themeConfig.glow}`,
          }}
        >
          {/* Pulsating Core Node */}
          <div
            className="w-3.5 h-3.5 rounded-full animate-ping opacity-60"
            style={{ backgroundColor: themeConfig.accent }}
          />
          <div
            className="absolute w-3 h-3 rounded-full"
            style={{
              backgroundColor: themeConfig.accent,
              boxShadow: `0 0 12px 2px ${themeConfig.accent}`,
            }}
          />
        </div>

        {/* Orbiting Satellite Dot */}
        <div
          className="absolute inset-0 animate-spin pointer-events-none"
          style={{ animationDuration: "2.8s" }}
        >
          <div
            className="w-2 h-2 rounded-full absolute -top-1 left-1/2 -translate-x-1/2 shadow-sm"
            style={{
              backgroundColor: themeConfig.accent,
              boxShadow: `0 0 8px ${themeConfig.accent}`,
            }}
          />
        </div>
      </div>

      {/* Header & Stage Narrative */}
      <div className="relative z-10 max-w-md mx-auto space-y-2">
        {badge && (
          <div className="inline-block mb-1">
            <span className={`editorial-badge ${themeConfig.badgeClass}`}>
              {badge}
            </span>
          </div>
        )}

        <h4 className="font-serif text-base sm:text-lg font-normal text-[var(--editorial-ink)] tracking-tight m-0">
          {title}
        </h4>

        {/* Dynamic Status / Stage Indicator with Wave Equalizer */}
        <div className="flex items-center justify-center gap-2 pt-1">
          {/* Soundwave equalizer bars */}
          <div className="flex items-center gap-[3px] h-3">
            {[0.4, 0.8, 1.2, 0.6, 0.9].map((delay, idx) => (
              <span
                key={idx}
                className="w-[2.5px] rounded-full inline-block"
                style={{
                  height: "100%",
                  backgroundColor: themeConfig.accent,
                  animation: `processingWaveBar 1.2s ease-in-out infinite alternate`,
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
          </div>

          <p
            className={`m-0 font-mono text-xs font-semibold uppercase tracking-wider ${themeConfig.text} transition-all duration-300`}
          >
            {activeStatus}
          </p>

          <div className="flex items-center gap-[3px] h-3">
            {[0.9, 0.6, 1.2, 0.8, 0.4].map((delay, idx) => (
              <span
                key={idx}
                className="w-[2.5px] rounded-full inline-block"
                style={{
                  height: "100%",
                  backgroundColor: themeConfig.accent,
                  animation: `processingWaveBar 1.2s ease-in-out infinite alternate`,
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
          </div>
        </div>

        {subtext && (
          <p className="font-mono text-[11px] text-[var(--editorial-muted)] max-w-xs mx-auto leading-relaxed pt-1">
            {subtext}
          </p>
        )}

        {/* High-Precision Progress Bar */}
        {showProgress && (
          <div className="pt-3 max-w-xs mx-auto w-full">
            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--editorial-muted)] mb-1">
              <span className="uppercase tracking-wider">Neural Latency Rate</span>
              <span className="font-bold text-[var(--editorial-ink)]">{currentProgress}%</span>
            </div>
            <div className="w-full h-1 bg-[var(--editorial-rule)] overflow-hidden relative">
              <div
                className="h-full transition-all duration-300 relative"
                style={{
                  width: `${currentProgress}%`,
                  backgroundColor: themeConfig.accent,
                  boxShadow: `0 0 8px ${themeConfig.glow}`,
                }}
              >
                {/* Leading edge light point */}
                <div
                  className="absolute top-0 right-0 bottom-0 w-2 bg-white opacity-80 animate-pulse"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Telemetry Footer Meta */}
      <div className="relative z-10 mt-6 flex items-center justify-center gap-4 text-[10px] font-mono text-[var(--editorial-faint)] uppercase tracking-widest border-t border-[var(--editorial-rule)] pt-3">
        <span className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full inline-block animate-pulse"
            style={{ backgroundColor: themeConfig.accent }}
          />
          Studio Matrix Active
        </span>
        <span className="hidden sm:inline-block">&bull;</span>
        <span className="hidden sm:inline-block">High Precision Latents</span>
        <span className="hidden sm:inline-block">&bull;</span>
        <span className="hidden sm:inline-block">Zero Artifact Guard</span>
      </div>
    </div>
  );
};

export default ProcessingAnimation;
