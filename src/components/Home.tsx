import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Aperture,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clapperboard,
  Copy,
  Feather,
  Layers,
  Layers3,
  Lightbulb,
  Package,
  Palette,
  RotateCw,
  ScanEye,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import ModelSelector from "./ModelSelector";

type IconType = React.ComponentType<{
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean | "true" | "false";
}>;

const CAPABILITIES: Array<{
  index: string;
  title: string;
  description: string;
  path: string;
  icon: IconType;
  tone: string;
  badge: string;
}> = [
  {
    index: "01",
    title: "Prompt Builder",
    description: "Shape a rough idea into one precise, layered prompt.",
    path: "/prompt-builder",
    icon: Wand2,
    tone: "violet",
    badge: "Core",
  },
  {
    index: "02",
    title: "Image-to-Prompt",
    description: "Read any reference back into camera, light and style.",
    path: "/image-to-prompt",
    icon: ScanEye,
    tone: "coral",
    badge: "Vision",
  },
  {
    index: "03",
    title: "Creative Mixer",
    description: "Blend styles and influences into a single direction.",
    path: "/creative-mixer",
    icon: Layers3,
    tone: "pink",
    badge: "Blend",
  },
  {
    index: "04",
    title: "Batch Generator",
    description: "Explore lighting, lens and mood variations in one pass.",
    path: "/batch-generator",
    icon: Layers,
    tone: "amber",
    badge: "Variations",
  },
  {
    index: "05",
    title: "Pro Prompter",
    description: "Layout-aware prompts for banners and campaign creative.",
    path: "/pro-prompter",
    icon: Aperture,
    tone: "teal",
    badge: "Ads",
  },
];

const COMPARISON_SAMPLES = [
  {
    category: "Cinematic",
    badPrompt: "a cool cyberpunk woman walking in rainy street at night neon lights hyperrealistic 8k cinematic masterpiece",
    badResult: "Flat lighting, cluttered background, plastic-looking skin.",
    goodPrompt:
      "Cinematic medium tracking shot, a solitary figure in a matte-black technical trench coat crossing a rain-slicked Neo-Tokyo alley. Anamorphic 35mm, f/1.4, cyan and amber neon rim light, deep volumetric shadows, authentic 35mm film grain, 2.39:1.",
    goodResult: "Atmospheric depth, accurate wet-road reflections, clean edge separation.",
  },
  {
    category: "Product",
    badPrompt: "luxury perfume bottle on stone table high end photorealistic commercial photo studio lighting",
    badResult: "Generic shape, blown-out highlights, fake digital gloss.",
    goodPrompt:
      "Studio macro of a fluted glass perfume flask on rough travertine limestone. Low-raking morning light, long sculptural shadows. 90mm tilt-shift macro, f/8, tack-sharp plane, warm amber refraction, negative space on the right for typography.",
    goodResult: "Tactile stone texture, realistic refraction, balanced key-to-fill ratio.",
  },
  {
    category: "Fashion",
    badPrompt: "fashion model in avant garde red dress editorial vogue magazine photoshoot",
    badResult: "Generic pose, unnatural folds, muddy background.",
    goodPrompt:
      "High-fashion editorial portrait, sculptural pleated scarlet silk gown in motion. High-key diffused softbox with warm fill. Medium format 80mm, f/2.8, pale concrete brutalist gallery, crisp textile weave and natural skin texture.",
    goodResult: "Strong silhouette, believable drapery, real skin texture, spatial presence.",
  },
];

const SANDBOX_PRESETS = [
  {
    discipline: "Cinematic",
    prompt:
      "Cinematic wide shot of a lone wanderer at the edge of a mist-shrouded Nordic cliff, diffuse golden-hour side light through coastal mist, 35mm anamorphic f/1.8, contemplative 65mm grain --ar 16:9",
  },
  {
    discipline: "Photography",
    prompt:
      "Still life of a handcrafted ceramic teapot on weathered Hinoki wood, soft window sidelight with gentle falloff, 50mm f/2.8 shallow depth of field, wabi-sabi warmth, tactile glaze detail --ar 16:9",
  },
  {
    discipline: "Fashion",
    prompt:
      "Editorial portrait in an avant-garde ecru linen trench with asymmetric lapels, high-contrast strobe with sharp shadows, 85mm f/4, crisp textile weave, bold runway silhouette --ar 16:9",
  },
  {
    discipline: "3D Render",
    prompt:
      "Brutalist modular architecture overtaken by moss and ferns, overcast Nordic skylight with soft ambient occlusion, 24mm tilt-shift f/11, tactile cast concrete, serene post-human geometry --ar 16:9",
  },
];

const WHY_POINTS: Array<{ icon: IconType; title: string; body: string }> = [
  {
    icon: Lightbulb,
    title: "Made from friction",
    body: "Built after too many hours lost re-rolling prompts just to fix a lighting angle.",
  },
  {
    icon: Feather,
    title: "Resourceful by design",
    body: "Jugaad means elegant answers with what you have — structure instead of guesswork.",
  },
  {
    icon: Palette,
    title: "Creator first",
    body: "An indie studio suite: no fluff, no lock-in, just tools that respect the craft.",
  },
];

const HERO_WORDS = ["every field.", "every frame.", "every medium.", "every vision."];
const HERO_STATS: Array<{ value: number; suffix: string; label: string }> = [
  { value: 5, suffix: "", label: "Studio tools" },
  { value: 10, suffix: "", label: "Creative fields" },
  { value: 7, suffix: "", label: "Directorial layers" },
  { value: 100, suffix: "%", label: "Creator crafted" },
];
const TICKER_ITEMS = [
  "Prompt Builder",
  "Image-to-Prompt",
  "Creative Mixer",
  "Batch Matrix",
  "Pro Prompter",
  "Photography",
  "Cinematic",
  "Fashion",
  "Architecture",
  "3D Latents",
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const supportsHover = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [activeComparisonIdx, setActiveComparisonIdx] = useState<number>(0);
  const [sandboxIdx, setSandboxIdx] = useState<number>(0);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [heroMounted, setHeroMounted] = useState<boolean>(false);
  const [heroWordIdx, setHeroWordIdx] = useState<number>(0);

  const heroRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const statRefs = useRef<Array<HTMLElement | null>>([]);
  const heroPointer = useRef<{ x: number; y: number } | null>(null);
  const panelPointer = useRef<{ x: number; y: number } | null>(null);
  const heroFrame = useRef<number>(0);
  const panelFrame = useRef<number>(0);

  const currentPreset = SANDBOX_PRESETS[sandboxIdx];
  const currentComparison = COMPARISON_SAMPLES[activeComparisonIdx];

  /* ------------------------------------------------------------------ *
   * Hero entrance + stat count-up (writes straight to the DOM so the
   * whole page never re-renders 60× per second during the animation).
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const frame = requestAnimationFrame(() => setHeroMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const writeStats = (values: number[]) => {
      values.forEach((value, i) => {
        const el = statRefs.current[i];
        const stat = HERO_STATS[i];
        if (el && stat) el.textContent = `${String(value).padStart(stat.value >= 100 ? 3 : 2, "0")}${stat.suffix}`;
      });
    };

    if (prefersReducedMotion()) {
      writeStats(HERO_STATS.map((s) => s.value));
      return;
    }

    let raf = 0;
    const start = performance.now();
    const duration = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      writeStats(HERO_STATS.map((s) => Math.round(s.value * eased)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = window.setInterval(() => setHeroWordIdx((i) => (i + 1) % HERO_WORDS.length), 2800);
    return () => window.clearInterval(id);
  }, []);

  /* Scroll reveals — one observer, unobserved as sections arrive. */
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".home-studio .reveal"));
    if (els.length === 0) return;
    if (prefersReducedMotion()) {
      els.forEach((el) => el.classList.add("reveal--in"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal--in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  /* rAF-throttled pointer tracking: at most one layout read per frame. */
  const flushHeroGlow = useCallback(() => {
    heroFrame.current = 0;
    const hero = heroRef.current;
    const point = heroPointer.current;
    if (!hero || !point) return;
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty("--mx", `${point.x - rect.left}px`);
    hero.style.setProperty("--my", `${point.y - rect.top}px`);
  }, []);

  const handleHeroPointer = (e: React.PointerEvent<HTMLElement>) => {
    if (!supportsHover()) return;
    heroPointer.current = { x: e.clientX, y: e.clientY };
    if (!heroFrame.current) heroFrame.current = requestAnimationFrame(flushHeroGlow);
  };

  const flushPanelTilt = useCallback(() => {
    panelFrame.current = 0;
    const panel = panelRef.current;
    const point = panelPointer.current;
    if (!panel || !point) return;
    const rect = panel.getBoundingClientRect();
    const px = (point.x - rect.left) / rect.width - 0.5;
    const py = (point.y - rect.top) / rect.height - 0.5;
    panel.style.setProperty("--tilt-y", `${(px * 7).toFixed(2)}deg`);
    panel.style.setProperty("--tilt-x", `${(-py * 7).toFixed(2)}deg`);
  }, []);

  const handlePanelPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!supportsHover() || prefersReducedMotion()) return;
    panelPointer.current = { x: e.clientX, y: e.clientY };
    if (!panelFrame.current) panelFrame.current = requestAnimationFrame(flushPanelTilt);
  };

  const resetPanelTilt = () => {
    panelPointer.current = null;
    panelRef.current?.style.setProperty("--tilt-y", "0deg");
    panelRef.current?.style.setProperty("--tilt-x", "0deg");
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSandboxSimulate = (idx: number) => {
    setSandboxIdx(idx);
    setIsSynthesizing(true);
    window.setTimeout(() => setIsSynthesizing(false), 450);
  };

  const handleCopySandboxPrompt = () => {
    navigator.clipboard?.writeText(currentPreset.prompt);
    setCopiedPrompt(true);
    window.setTimeout(() => setCopiedPrompt(false), 2000);
  };

  useEffect(
    () => () => {
      if (heroFrame.current) cancelAnimationFrame(heroFrame.current);
      if (panelFrame.current) cancelAnimationFrame(panelFrame.current);
    },
    [],
  );

  return (
    <div className="home-studio">
      <div className="home-studio__inner">
        {/* ========================================================================
            HERO
            ======================================================================== */}
        <section
          ref={heroRef}
          onPointerMove={handleHeroPointer}
          className={`studio-hero hero-enter${heroMounted ? " hero-enter--in" : ""}`}
          aria-labelledby="studio-hero-title"
        >
          <div className="hero-glow" aria-hidden="true" />
          <div className="studio-hero__copy">
            <p className="studio-eyebrow hero-enter__item" style={{ "--enter-delay": "0ms" } as React.CSSProperties}>
              <span className="studio-eyebrow__mark" aria-hidden="true" />
              Jugaad AI <span>/</span> Creative Director Intelligence
            </p>
            <h1
              id="studio-hero-title"
              className="studio-display hero-enter__item"
              style={{ "--enter-delay": "90ms" } as React.CSSProperties}
            >
              Direct the prompt for{" "}
              <em>
                <span key={HERO_WORDS[heroWordIdx]} className="hero-word">
                  {HERO_WORDS[heroWordIdx]}
                </span>
              </em>
            </h1>
            <p
              className="studio-hero__lede hero-enter__item"
              style={{ "--enter-delay": "180ms" } as React.CSSProperties}
            >
              One calm workspace that turns a rough idea into a production-ready prompt — subject, light, lens
              and mood, already directed.
            </p>
            <div className="studio-actions hero-enter__item" style={{ "--enter-delay": "260ms" } as React.CSSProperties}>
              <button
                type="button"
                onClick={() => navigate("/prompt-builder")}
                className="studio-button studio-button--primary"
              >
                <Wand2 aria-hidden="true" />
                Start Directing
                <ArrowUpRight aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollTo("comparison-section")}
                className="studio-button studio-button--outline"
              >
                See What Changes
                <ArrowRight aria-hidden="true" />
              </button>
            </div>

            <div
              className="hero-enter__item mt-6 max-w-xl"
              style={{ "--enter-delay": "300ms" } as React.CSSProperties}
            >
              <ModelSelector variant="card" showManageLink />
            </div>

            <div
              className="studio-hero__meta hero-enter__item"
              style={{ "--enter-delay": "340ms" } as React.CSSProperties}
              aria-label="System highlights"
            >
              {HERO_STATS.map((stat, i) => (
                <div key={stat.label}>
                  <strong
                    ref={(el) => {
                      statRefs.current[i] = el;
                    }}
                  >
                    {`0`.padStart(stat.value >= 100 ? 3 : 2, "0")}
                    {stat.suffix}
                  </strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            ref={panelRef}
            onPointerMove={handlePanelPointer}
            onPointerLeave={resetPanelTilt}
            className="prompt-panel tilt hero-enter__item"
            style={{ "--enter-delay": "200ms" } as React.CSSProperties}
            aria-label="Prompt intelligence preview"
          >
            <div className="prompt-panel__orb prompt-panel__orb--one" aria-hidden="true" />
            <div className="prompt-panel__orb prompt-panel__orb--two" aria-hidden="true" />
            <div className="prompt-panel__topline">
              <span>Studio Matrix / 01 Engine</span>
              <span className="prompt-panel__status">
                <i aria-hidden="true" /> Ready to Direct
              </span>
            </div>
            <div className="prompt-panel__body">
              <div className="prompt-panel__index">Directorial Architecture / 07 Layers</div>
              <div className="prompt-panel__headline">
                A quiet frame
                <br />
                <em>with deliberate optical depth.</em>
              </div>
              <div className="prompt-panel__code" aria-label="Prompt structure preview">
                <div>
                  <span className="prompt-panel__code-key">subject</span>
                  <span>Sculptural raw oak chair &amp; brushed brass</span>
                </div>
                <div>
                  <span className="prompt-panel__code-key">style</span>
                  <span>Editorial wabi-sabi minimalism / tactile</span>
                </div>
                <div>
                  <span className="prompt-panel__code-key">light</span>
                  <span>Late afternoon sun / long raking shadows</span>
                </div>
                <div>
                  <span className="prompt-panel__code-key">lens</span>
                  <span>50mm prime / f/1.8 / shallow depth of field</span>
                </div>
              </div>
              <div className="prompt-panel__quality">
                <div className="prompt-panel__quality-head">
                  <span>Synthesized Accuracy</span>
                  <strong>99.4%</strong>
                </div>
                <div className="prompt-panel__meter">
                  <span />
                </div>
              </div>
            </div>
            <div className="prompt-panel__footer">
              <span>
                <Zap aria-hidden="true" /> Creative Layers Synchronized
              </span>
              <span>01 — 05 Engines Active</span>
            </div>
          </div>
        </section>

        <div className="ticker reveal" aria-label="Creative disciplines ticker">
          <div className="ticker__track">
            {TICKER_ITEMS.map((item) => (
              <span key={`a-${item}`} className="ticker__item">
                {item}
                <i aria-hidden="true">✦</i>
              </span>
            ))}
            {TICKER_ITEMS.map((item) => (
              <span key={`b-${item}`} className="ticker__item" aria-hidden="true">
                {item}
                <i aria-hidden="true">✦</i>
              </span>
            ))}
          </div>
        </div>

        {/* ========================================================================
            01 — CORE STUDIO SUITE
            ======================================================================== */}
        <section className="studio-capabilities studio-section reveal" aria-labelledby="capabilities-title">
          <div className="studio-section__head studio-section__head--compact">
            <div>
              <p className="studio-section__kicker">01 / The Studio Suite</p>
              <h2 id="capabilities-title">
                Five tools.
                <br />
                <em>One creative thread.</em>
              </h2>
            </div>
            <p className="studio-section__intro">
              Start anywhere — every tool hands off cleanly to the next.
            </p>
          </div>

          <div className="capability-grid">
            {CAPABILITIES.map(({ index, title, description, path, icon: Icon, tone, badge }) => (
              <button
                type="button"
                className={`capability-card capability-card--${tone} group`}
                key={path}
                onClick={() => navigate(path)}
              >
                <div className="capability-card__top">
                  <span>{index}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 border border-current opacity-70">
                      {badge}
                    </span>
                    <Icon aria-hidden="true" />
                  </div>
                </div>
                <div className="capability-card__body">
                  <h3>{title}</h3>
                  <span>{description}</span>
                </div>
                <span className="capability-card__link">
                  Open Engine{" "}
                  <ArrowUpRight
                    className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                    aria-hidden="true"
                  />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ========================================================================
            02 — LIVE DEMO (lightweight, no extra network work)
            ======================================================================== */}
        <section className="studio-section studio-demo reveal" aria-labelledby="demo-title">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[var(--studio-rule)]">
            <div>
              <p className="studio-section__kicker m-0">02 / Try it live</p>
              <h2 id="demo-title" className="!mt-2">
                One line in.
                <br />
                <em>A directed prompt out.</em>
              </h2>
            </div>

            <div className="horizontal-scroll-ribbon items-center max-w-full" role="tablist" aria-label="Demo disciplines">
              {SANDBOX_PRESETS.map((preset, idx) => (
                <button
                  key={preset.discipline}
                  type="button"
                  role="tab"
                  aria-selected={sandboxIdx === idx}
                  onClick={() => handleSandboxSimulate(idx)}
                  className={`px-3.5 py-2 text-xs font-mono font-bold tracking-wider uppercase transition-all whitespace-nowrap flex-shrink-0 ${
                    sandboxIdx === idx
                      ? "bg-[var(--studio-ink)] text-[var(--studio-paper)] shadow-[2px_2px_0_var(--studio-coral)]"
                      : "bg-[var(--studio-surface)] text-[var(--studio-muted)] hover:text-[var(--studio-ink)] border border-[var(--studio-rule)]"
                  }`}
                >
                  {preset.discipline}
                </button>
              ))}
            </div>
          </div>

          <div key={sandboxIdx} className="swap-fade">
            <p className="studio-demo__output" aria-live="polite">
              {currentPreset.prompt}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySandboxPrompt}
                  className="studio-button studio-button--primary !min-h-[2.4rem] !py-1 !px-3 text-xs"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Prompt</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/prompt-builder")}
                  className="studio-button studio-button--outline !min-h-[2.4rem] !py-1 !px-3 text-xs"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Open in Prompt Builder</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleSandboxSimulate((sandboxIdx + 1) % SANDBOX_PRESETS.length)}
                disabled={isSynthesizing}
                className="studio-button studio-button--quiet !py-1 text-xs"
              >
                {isSynthesizing ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin text-[var(--studio-coral)]" />
                    <span>Rotating…</span>
                  </>
                ) : (
                  <>
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Next Sample</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================================
            03 — BEFORE / AFTER
            ======================================================================== */}
        <section
          id="comparison-section"
          className="studio-section studio-comparison reveal"
          aria-labelledby="comparison-title"
        >
          <div className="studio-section__head">
            <div>
              <p className="studio-section__kicker">03 / Before &amp; after</p>
              <h2 id="comparison-title">
                Same model.
                <br />
                <em>Better direction.</em>
              </h2>
            </div>
            <p className="studio-section__intro">
              The difference is not more words — it is structure where the model can read it.
            </p>
          </div>

          <div className="studio-comparison__panel">
            <div className="horizontal-scroll-ribbon items-center max-w-full" role="tablist" aria-label="Comparison categories">
              {COMPARISON_SAMPLES.map((sample, idx) => (
                <button
                  key={sample.category}
                  type="button"
                  role="tab"
                  aria-selected={activeComparisonIdx === idx}
                  onClick={() => setActiveComparisonIdx(idx)}
                  className={`px-3.5 py-2 text-xs font-mono font-bold uppercase transition-all whitespace-nowrap flex-shrink-0 ${
                    activeComparisonIdx === idx
                      ? "bg-[var(--studio-coral)] text-white shadow-sm"
                      : "bg-[var(--studio-surface-strong)] text-[var(--studio-muted)] border border-[var(--studio-rule)] hover:text-[var(--studio-ink)]"
                  }`}
                >
                  {sample.category}
                </button>
              ))}
            </div>

            <div key={activeComparisonIdx} className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5 swap-fade">
              <div className="studio-comparison__card studio-comparison__card--bad">
                <span className="studio-comparison__label">✕ Without direction</span>
                <p className="studio-comparison__prompt">“{currentComparison.badPrompt}”</p>
                <p className="studio-comparison__verdict">{currentComparison.badResult}</p>
              </div>
              <div className="studio-comparison__card studio-comparison__card--good">
                <span className="studio-comparison__label">✓ With Jugaad direction</span>
                <p className="studio-comparison__prompt">“{currentComparison.goodPrompt}”</p>
                <p className="studio-comparison__verdict">{currentComparison.goodResult}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================
            04 — WHY IT EXISTS
            ======================================================================== */}
        <section className="studio-section studio-why reveal" aria-labelledby="why-title">
          <div className="studio-section__head">
            <div>
              <p className="studio-section__kicker">04 / Why it exists</p>
              <h2 id="why-title">
                Built by a maker,
                <br />
                <em>for makers.</em>
              </h2>
            </div>
            <p className="studio-section__intro">
              Jugaad is the art of getting an elegant result with the tools already in your hands.
            </p>
          </div>

          <div className="why-grid">
            {WHY_POINTS.map(({ icon: Icon, title, body }) => (
              <article className="why-card" key={title}>
                <div className="why-card__icon">
                  <Icon aria-hidden="true" />
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>

          <div className="why-quote">
            <Sparkles aria-hidden="true" />
            <p>
              “Technology should never dilute your vision — it should amplify your instincts.”
            </p>
          </div>
        </section>

        {/* ========================================================================
            ENDCAP
            ======================================================================== */}
        <section className="studio-endcap reveal" aria-label="Continue your creative direction">
          <div>
            <p className="studio-section__kicker">Keep the thread</p>
            <h2>
              Your best directions
              <br />
              <em>deserve a home.</em>
            </h2>
          </div>
          <p>Save, revisit and evolve the prompts worth taking into production.</p>
          <div className="studio-endcap__actions">
            <button type="button" className="studio-button studio-button--primary" onClick={() => navigate("/library")}>
              <Check aria-hidden="true" /> Open Prompt Vault
            </button>
            <button type="button" className="studio-button studio-button--quiet" onClick={() => navigate("/studio")}>
              <Aperture aria-hidden="true" /> Persona Studio <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
