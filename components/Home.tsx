import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Aperture,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Box,
  BrainCircuit,
  Building2,
  Camera,
  Check,
  Clapperboard,
  Compass,
  Copy,
  Cpu,
  Feather,
  Flame,
  Focus,
  Layers,
  Layers3,
  LibraryBig,
  Lightbulb,
  Loader2,
  Move3d,
  Package,
  Palette,
  PenTool,
  RotateCw,
  ScanEye,
  Shirt,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  SunMedium,
  Target,
  Terminal,
  Type,
  Wand2,
  Zap,
} from "lucide-react";

type IconType = React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean | "true" | "false" }>;

const FIELDS: Array<{ name: string; note: string; icon: IconType; tag: string }> = [
  { name: "Photography", note: "light + optical lens", icon: Camera, tag: "Photo" },
  { name: "Product", note: "form + material finish", icon: Package, tag: "Industrial" },
  { name: "Fashion", note: "silhouette + textile styling", icon: Shirt, tag: "Editorial" },
  { name: "Cinematic", note: "scene + atmospheric motion", icon: Clapperboard, tag: "Film" },
  { name: "Illustration", note: "line weight + worldbuilding", icon: PenTool, tag: "Art" },
  { name: "Typography", note: "letterform + typographic rhythm", icon: Type, tag: "Type" },
  { name: "Branding", note: "brand voice + visual system", icon: Palette, tag: "Brand" },
  { name: "Architecture", note: "brutalist space + structure", icon: Building2, tag: "Spatial" },
  { name: "Motion", note: "tempo + fluid kinetic flow", icon: Move3d, tag: "Motion" },
  { name: "3D Latents", note: "geometric volume + shaders", icon: Box, tag: "Render" },
];

const CAPABILITIES: Array<{
  index: string;
  title: string;
  label: string;
  description: string;
  path: string;
  icon: IconType;
  tone: string;
  badge: string;
}> = [
  {
    index: "01",
    title: "Prompt Builder",
    label: "DIRECTORIAL FOUNDATION",
    description:
      "Sculpt raw concepts into surgical, multi-platform prompt blueprints with 7-layer precision and non-destructive AI enhancement.",
    path: "/prompt-builder",
    icon: Wand2,
    tone: "violet",
    badge: "Most Popular",
  },
  {
    index: "02",
    title: "Image-to-Prompt",
    label: "VISION REVERSE ENGINE",
    description:
      "Deconstruct reference images into exact camera parameters, optical lighting schemes, color palettes, and stylistic DNA.",
    path: "/image-to-prompt",
    icon: ScanEye,
    tone: "coral",
    badge: "Vision AI",
  },
  {
    index: "03",
    title: "Creative Mixer",
    label: "HYBRID STYLE SYNTHESIS",
    description:
      "Fuse multiple disparate visual worlds, film directors, moods, and aesthetics into one coherent avant-garde direction.",
    path: "/creative-mixer",
    icon: Layers3,
    tone: "pink",
    badge: "Multi-Source",
  },
  {
    index: "04",
    title: "Batch Generator",
    label: "EXPLORATION MATRIX",
    description:
      "Spawn wide variation matrices across diverse lighting setups, cameras, and creative moods from a single directorial brief.",
    path: "/batch-generator",
    icon: Layers,
    tone: "amber",
    badge: "Matrix 24x",
  },
  {
    index: "05",
    title: "Pro & Banner Prompter",
    label: "COMMERCIAL COMPOSITION",
    description:
      "Direct negative space, typography safe zones, aspect ratios, and visual hierarchy for high-converting commercial banners.",
    path: "/pro-prompter",
    icon: Aperture,
    tone: "teal",
    badge: "Commercial",
  },
];

const ANATOMY: Array<{ name: string; value: string; icon: IconType; tone: string }> = [
  { name: "Subject", value: "Primary focal element & physical gesture", icon: Focus, tone: "violet" },
  { name: "Style", value: "Aesthetic lineage & art direction", icon: Palette, tone: "coral" },
  { name: "Lighting", value: "Volumetric quality, Kelvin temp & key/rim", icon: SunMedium, tone: "gold" },
  { name: "Composition", value: "Rule of thirds, golden ratio & spatial negative", icon: Aperture, tone: "blue" },
  { name: "Optics / Lens", value: "Focal length, aperture f-stop & bokeh", icon: Camera, tone: "pink" },
  { name: "Atmosphere", value: "Emotional temperature, haze & environmental mood", icon: Sparkles, tone: "teal" },
  { name: "Quality Directives", value: "Photorealistic latents & zero-artifact syntax", icon: SlidersHorizontal, tone: "violet" },
];

interface StoryChapter {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  quote: string;
  paragraphs: string[];
  stat: { number: string; label: string };
  icon: IconType;
}

const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: "frustration",
    tag: "01 / The Catalyst",
    title: "The Death of Intentional Art Direction",
    subtitle: "Why typing random keywords into AI image generators was deeply broken.",
    quote: "We were given supercomputers that could render anything, yet we were forced to play slot machines with words.",
    paragraphs: [
      "When modern generative AI models exploded onto the scene, something felt fundamentally missing. Millions of creators were typing disjointed word salads — '8k, ultra-realistic, octane render, photorealistic masterpiece' — praying the neural network would magically guess what they had in mind.",
      "The result? Homogenized, plastic-looking renders with zero intentionality. Commercial creators, art directors, and designers were spending 4 hours re-rolling prompts just to fix a basic lighting angle or lens perspective.",
      "Creative direction is not about guessing; it is about deliberate, optical precision. I created Jugaad Vision to replace trial-and-error chaos with true directorial control.",
    ],
    stat: { number: "80%", label: "Prompt re-rolls eliminated" },
    icon: Flame,
  },
  {
    id: "philosophy",
    tag: "02 / The Philosophy",
    title: "The True Spirit of 'Jugaad'",
    subtitle: "Turning constraints into surgical, resourceful brilliance.",
    quote: "Jugaad is not a messy shortcut. It is the highest form of creative ingenuity under strict constraints.",
    paragraphs: [
      "In India, 'Jugaad' is legendary. It describes the innate human ability to look at tough boundaries and invent a surprisingly elegant, resourceful solution that works brilliantly with whatever tools you have.",
      "Generative AI has constraints: token limits, latent hallucinations, style bleed, and fuzzy syntax. Instead of fighting these constraints blindly, Jugaad Vision engineers them.",
      "We took the soulful ingenuity of Jugaad and turned it into an architectural framework: combining deep optical physics, cinema lighting ratios, and semantic token layering so that every creator commands the AI like a seasoned cinematographer.",
    ],
    stat: { number: "7", label: "Directorial latent layers" },
    icon: Lightbulb,
  },
  {
    id: "engine",
    tag: "03 / The Architecture",
    title: "Engineering the 7-Layer Matrix",
    subtitle: "Deconstructing visual thoughts into structured optical parameters.",
    quote: "When you break an image into subject, light, optics, and texture, the machine finally understands intent.",
    paragraphs: [
      "Traditional prompts clump everything into a single comma-separated mess where styles fight each other. Jugaad Vision isolates the visual DNA into dedicated semantic tracks: Subject, Lighting, Optics, Composition, Texture, Atmosphere, and Negative Constraints.",
      "By structuring prompts this way, our models (whether Midjourney, Flux, Stable Diffusion, or Imagen) receive cleanly weighted token trajectories. The difference between an amateur prompt and a Jugaad prompt is the difference between a blurry snapshot and a 70mm IMAX frame.",
      "Everything you see here — the Image-to-Prompt reverse engine, the Creative Mixer, the Batch Matrix — was hand-crafted to give creators a cohesive studio suite.",
    ],
    stat: { number: "10+", label: "Creative fields mastered" },
    icon: Cpu,
  },
  {
    id: "manifesto",
    tag: "04 / The Vision",
    title: "A Home for Creators & Visionaries",
    subtitle: "Built with passion for anyone who believes visual craft still matters.",
    quote: "Technology should never dilute your vision. It should amplify your wildest creative instincts.",
    paragraphs: [
      "I built Jugaad Vision as an indie project with one uncompromising rule: Zero Generic Fluff. Every button, every color tone, every slider in this application was designed to feel tactile, intentional, and inspiring.",
      "Whether you are an independent game developer designing brutalist landscapes, a fashion stylist generating lookbooks, a filmmaker crafting storyboards, or a marketer building high-conversion campaign banners — this workspace is yours.",
      "Take the tools. Direct your frames. Let your imagination run completely untamed.",
    ],
    stat: { number: "100%", label: "Open & creator-first" },
    icon: Feather,
  },
];

const COMPARISON_SAMPLES = [
  {
    category: "Cinematic Film",
    badTitle: "Raw / Amateur Prompt",
    badPrompt: "A cool cyberpunk woman walking in rainy street at night neon lights hyperrealistic 8k cinematic masterpiece",
    badResult: "Plastic skin, oversaturated neon clutter, chaotic background with random floating artifacts, flat lighting.",
    goodTitle: "Jugaad Directorial Blueprint",
    goodPrompt: "Cinematic medium tracking shot, a solitary figure in bespoke matte-black technical trench coat walking through a rain-slicked Neo-Tokyo alleyway. Anamorphic 35mm lens, f/1.4 aperture, subtle halation on wet asphalt. Cyan and warm amber neon rim lighting, deep volumetric shadows, authentic Kodak 5219 35mm film grain, 2.39:1 widescreen ratio.",
    goodResult: "Atmospheric depth, physically accurate wet road reflections, crisp edge separation, tangible textiles, cinematic color grading.",
  },
  {
    category: "Product & Commercial",
    badTitle: "Raw / Amateur Prompt",
    badPrompt: "luxury perfume bottle on stone table high end photorealistic commercial photo studio lighting",
    badResult: "Generic glass shape, blown-out white highlights, fake digital gloss, blurry brand typography.",
    goodTitle: "Jugaad Directorial Blueprint",
    goodPrompt: "Studio macro product photography of an architectural fluted glass perfume flask resting on rough travertine limestone. Low-raking morning sunlight creating long sculptural shadows. 90mm tilt-shift macro lens, f/8, tack-sharp focal plane, subtle condensation droplets, warm amber liquid refraction, negative space on right for editorial typography.",
    goodResult: "Tactile mineral stone textures, realistic glass optical refraction, balanced studio key-to-fill ratio, commercial negative space.",
  },
  {
    category: "Fashion Editorial",
    badTitle: "Raw / Amateur Prompt",
    badPrompt: "fashion model in avant garde red dress editorial vogue magazine photoshoot",
    badResult: "Generic model pose, unnatural fabric folds, muddy background with no sense of spatial atmosphere.",
    goodTitle: "Jugaad Directorial Blueprint",
    goodPrompt: "High-fashion editorial portrait, sculptural pleated scarlet silk gown cascading with dynamic motion. High-key diffused softbox lighting with subtle warm fill. Hasselblad medium format 80mm lens, f/2.8, editorial Vogue Paris styling, pale concrete brutalist gallery background, crisp textural weave and natural skin pores.",
    goodResult: "High-fashion silhouette, dynamic drapery physics, authentic skin texture without artificial smoothing, gallery spatial presence.",
  },
];

const SANDBOX_PRESETS = [
  {
    discipline: "Cinematic",
    subject: "A solitary wanderer in a weathered canvas duster standing at the edge of a mist-shrouded Nordic cliffside",
    light: "Diffuse golden-hour side lighting through dense coastal mist",
    lens: "35mm anamorphic, f/1.8, subtle optical barrel distortion",
    mood: "Contemplative, hauntingly vast, cinematic 65mm film grain",
  },
  {
    discipline: "Photography",
    subject: "A handcrafted ceramic teapot with textured matte glaze resting on weathered Japanese Hinoki wood",
    light: "Soft window sidelight with gentle bounce and natural falloff",
    lens: "50mm prime, f/2.8, shallow depth of field, tactile focal plane",
    mood: "Wabi-sabi minimalism, serene, tactile organic warmth",
  },
  {
    discipline: "Fashion",
    subject: "Avant-garde sculptural structured trench coat in raw ecru linen with asymmetric geometric lapels",
    light: "High-contrast editorial strobe with sharp sculptural shadows",
    lens: "85mm portrait telephoto, f/4, razor-sharp textile weave detail",
    mood: "High-fashion Paris runway, bold silhouette, tactile elegance",
  },
  {
    discipline: "3D Render",
    subject: "Brutalist modular monolithic architecture intersecting with lush cascading overgrown moss and ferns",
    light: "Overcast Nordic skylight with subtle ambient occlusion and raytraced reflections",
    lens: "24mm architectural tilt-shift, perspective corrected, f/11",
    mood: "Tactile cast concrete, atmospheric depth, serene post-human geometry",
  },
];

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [activeChapter, setActiveChapter] = useState<string>("frustration");
  const [activeComparisonIdx, setActiveComparisonIdx] = useState<number>(0);
  const [sandboxIdx, setSandboxIdx] = useState<number>(0);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  const currentPreset = SANDBOX_PRESETS[sandboxIdx];
  const activeChapterData = STORY_CHAPTERS.find((c) => c.id === activeChapter) || STORY_CHAPTERS[0];
  const currentComparison = COMPARISON_SAMPLES[activeComparisonIdx];

  const handleSandboxSimulate = (idx: number) => {
    setIsSynthesizing(true);
    setSandboxIdx(idx);
    setTimeout(() => {
      setIsSynthesizing(false);
    }, 450);
  };

  const handleCopySandboxPrompt = () => {
    const fullText = `${currentPreset.subject}, directed with ${currentPreset.light}, shot on ${currentPreset.lens}, expressing ${currentPreset.mood} --ar 16:9 --v 6.1`;
    navigator.clipboard.writeText(fullText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="home-studio">
      <div className="home-studio__inner">
        {/* =========================================================================
            01. STUDIO HERO SECTION
            ========================================================================= */}
        <section className="studio-hero" aria-labelledby="studio-hero-title">
          <div className="studio-hero__copy">
            <p className="studio-eyebrow">
              <span className="studio-eyebrow__mark" aria-hidden="true" />
              Jugaad AI <span>/</span> Creative Director Intelligence
            </p>
            <h1 id="studio-hero-title" className="studio-display">
              Master prompt
              <br />
              generation <em>across</em>
              <br />
              every field.
            </h1>
            <p className="studio-hero__lede">
              One intelligent creative system for turning raw imagination into production-ready visual direction—
              from the first subject cue to the final quality control.
            </p>
            <div className="studio-actions">
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
                onClick={() => {
                  const storyElem = document.getElementById("creator-story-section");
                  if (storyElem) {
                    storyElem.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="studio-button studio-button--outline"
              >
                <BookOpen aria-hidden="true" />
                Read Why I Built This
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
            <div className="studio-hero__meta" aria-label="System highlights">
              <div>
                <strong>05</strong>
                <span>Core Studio Tools</span>
              </div>
              <div>
                <strong>10</strong>
                <span>Creative Disciplines</span>
              </div>
              <div>
                <strong>07</strong>
                <span>Directorial Layers</span>
              </div>
              <div>
                <strong>100%</strong>
                <span>Creator Crafted</span>
              </div>
            </div>
          </div>

          {/* Interactive Hero Telemetry Prompt Intelligence Panel */}
          <div className="prompt-panel" aria-label="Prompt intelligence preview">
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
                A quiet frame<br />
                <em>with deliberate optical depth.</em>
              </div>
              <div className="prompt-panel__code" aria-label="Prompt structure preview">
                <div>
                  <span className="prompt-panel__code-key">subject</span>
                  <span>Sculptural raw oak chair & brushed brass</span>
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

        {/* =========================================================================
            02. TOOLS AT THE TOP: CORE STUDIO TOOLKIT (TOP PLACEMENT)
            ========================================================================= */}
        <section className="studio-capabilities studio-section !mt-12" aria-labelledby="capabilities-title">
          <div className="studio-section__head studio-section__head--compact">
            <div>
              <p className="studio-section__kicker">01 / The Core Studio Suite</p>
              <h2 id="capabilities-title">
                Surgical tools for<br />
                <em>the entire creative process.</em>
              </h2>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="studio-section__count">05 / Dedicated Engines</p>
              <span className="text-[11px] font-mono text-[var(--studio-muted)]">Click any tool to launch directly</span>
            </div>
          </div>

          {/* 5 Core Capabilities Grid */}
          <div className="capability-grid">
            {CAPABILITIES.map(({ index, title, label, description, path, icon: Icon, tone, badge }) => (
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
                  <p>{label}</p>
                  <h3>{title}</h3>
                  <span>{description}</span>
                </div>
                <span className="capability-card__link">
                  Open Engine <ArrowUpRight className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>

          {/* Interactive Live Prompt Synthesizer Sandbox (Interactive Creative Play Area) */}
          <div className="mt-8 p-5 sm:p-7 border border-[var(--studio-rule)] bg-[var(--studio-surface)] backdrop-blur-md shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--studio-rule)]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-[var(--studio-coral)] animate-pulse" />
                  <p className="studio-section__kicker m-0">Interactive Studio Sandbox</p>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl text-[var(--studio-ink)] m-0 font-normal">
                  Test the Directorial Latents in Real-Time
                </h3>
              </div>

              {/* Preset Selector Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {SANDBOX_PRESETS.map((preset, idx) => (
                  <button
                    key={preset.discipline}
                    type="button"
                    onClick={() => handleSandboxSimulate(idx)}
                    className={`px-3 py-1.5 text-xs font-mono font-bold tracking-wider uppercase transition-all ${
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

            {/* Sandbox Live Output Display */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5 items-stretch">
              {/* Left: Deconstructed Layer Tiles */}
              <div className="lg:col-span-5 flex flex-col gap-2 font-mono text-xs">
                <div className="p-3 border border-[var(--studio-rule)] bg-[var(--studio-surface-strong)]">
                  <span className="text-[10px] font-bold text-[var(--studio-coral)] uppercase block mb-1">01 / Subject Cue</span>
                  <p className="m-0 text-[var(--studio-ink)] leading-relaxed">{currentPreset.subject}</p>
                </div>
                <div className="p-3 border border-[var(--studio-rule)] bg-[var(--studio-surface-strong)]">
                  <span className="text-[10px] font-bold text-[var(--studio-gold)] uppercase block mb-1">02 / Optical Lighting</span>
                  <p className="m-0 text-[var(--studio-ink)] leading-relaxed">{currentPreset.light}</p>
                </div>
                <div className="p-3 border border-[var(--studio-rule)] bg-[var(--studio-surface-strong)]">
                  <span className="text-[10px] font-bold text-[var(--studio-violet)] uppercase block mb-1">03 / Camera & Optics</span>
                  <p className="m-0 text-[var(--studio-ink)] leading-relaxed">{currentPreset.lens}</p>
                </div>
              </div>

              {/* Right: Assembled Production Master Prompt */}
              <div className="lg:col-span-7 flex flex-col justify-between p-4 sm:p-5 border border-[var(--studio-rule)] bg-[var(--studio-surface-strong)] relative">
                <div>
                  <div className="flex items-center justify-between gap-2 pb-2 mb-3 border-b border-[var(--studio-rule)] text-[11px] font-mono text-[var(--studio-muted)]">
                    <span className="flex items-center gap-1.5 uppercase tracking-wider font-bold text-[var(--studio-ink)]">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--studio-coral)]" />
                      Assembled Directorial Master Prompt
                    </span>
                    <span className="text-[10px] uppercase">{currentPreset.discipline} Matrix</span>
                  </div>

                  <p className="font-mono text-xs sm:text-[13px] text-[var(--studio-ink)] leading-relaxed bg-[var(--studio-surface)] p-3.5 border border-[var(--studio-rule)] m-0 select-all">
                    {currentPreset.subject}, directed with {currentPreset.light}, shot on {currentPreset.lens}, expressing {currentPreset.mood} --ar 16:9 --v 6.1
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-[var(--studio-rule)]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopySandboxPrompt}
                      className="studio-button studio-button--primary !min-h-[2.4rem] !py-1 !px-3 text-xs"
                    >
                      {copiedPrompt ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Copied to Clipboard</span>
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
                        <span>Rotating Latents...</span>
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
            </div>
          </div>
        </section>

        {/* =========================================================================
            03. FULL SPECTRUM DISCIPLINE CARDS
            ========================================================================= */}
        <section className="studio-spectrum studio-section !mt-16" aria-labelledby="spectrum-title">
          <div className="studio-section__head">
            <div>
              <p className="studio-section__kicker">The Full Spectrum</p>
              <h2 id="spectrum-title">
                Every field is<br />
                <em>fair game.</em>
              </h2>
            </div>
            <p className="studio-section__intro">
              One system. Ten disciplines. A wider creative range without switching tools or losing the directorial thread.
            </p>
          </div>
          <div className="studio-spectrum__grid">
            {FIELDS.map(({ name, note, icon: Icon, tag }, index) => (
              <div
                className="spectrum-field group cursor-pointer"
                key={name}
                onClick={() => navigate("/prompt-builder")}
                title={`Launch ${name} Directing`}
              >
                <div className="w-full flex items-center justify-between">
                  <span className="spectrum-field__number">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[var(--studio-muted)] group-hover:text-[var(--studio-paper)] opacity-70">
                    {tag}
                  </span>
                </div>
                <span className="spectrum-field__icon">
                  <Icon aria-hidden="true" />
                </span>
                <span className="spectrum-field__name">{name}</span>
                <span className="spectrum-field__note">{note}</span>
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================================
            04. THE STORY SECTION: WHY I CREATED JUGAAD VISION (BELOW TOOLS)
            ========================================================================= */}
        <section
          id="creator-story-section"
          className="studio-section pt-10 border-t-2 border-[var(--studio-ink)]"
          aria-labelledby="story-title"
        >
          <div className="studio-section__head">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--studio-coral)] text-white text-[10px] font-mono font-bold">
                  ★
                </span>
                <p className="studio-section__kicker m-0">02 / The Genesis & Creator Philosophy</p>
              </div>
              <h2 id="story-title">
                Why I built<br />
                <em>Jugaad Vision.</em>
              </h2>
            </div>
            <p className="studio-section__intro">
              The story of transforming chaotic "prompt engineering" into surgical, human-centered creative direction.
            </p>
          </div>

          {/* Interactive Story Chapters Navigator */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Story Chapter Navigation Sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--studio-muted)] mb-2 px-1">
                The Journey / 4 Chapters
              </span>
              {STORY_CHAPTERS.map((chapter) => {
                const isSelected = activeChapter === chapter.id;
                const ChapterIcon = chapter.icon;
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => setActiveChapter(chapter.id)}
                    className={`p-4 text-left border transition-all relative ${
                      isSelected
                        ? "bg-[var(--studio-surface-strong)] border-[var(--studio-ink)] shadow-[4px_4px_0_var(--studio-coral)]"
                        : "bg-[var(--studio-surface)] border-[var(--studio-rule)] hover:border-[var(--studio-coral)] hover:bg-[var(--studio-surface-strong)]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono font-bold text-[var(--studio-coral)] mb-1">
                      <span>{chapter.tag}</span>
                      <ChapterIcon className="w-4 h-4" />
                    </div>
                    <h3 className="font-serif text-base text-[var(--studio-ink)] font-normal m-0 mb-1">
                      {chapter.title}
                    </h3>
                    <p className="font-mono text-[11px] text-[var(--studio-muted)] line-clamp-2 m-0">
                      {chapter.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Story Chapter Main Reading Canvas */}
            <div className="lg:col-span-8 p-6 sm:p-9 border border-[var(--studio-rule)] bg-[var(--studio-surface-strong)] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none font-serif text-9xl">
                JV
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-[var(--studio-rule)]">
                <div>
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-[var(--studio-coral)] block mb-1">
                    {activeChapterData.tag}
                  </span>
                  <h3 className="font-serif text-2xl sm:text-3xl text-[var(--studio-ink)] font-normal m-0">
                    {activeChapterData.title}
                  </h3>
                </div>

                <div className="flex items-center gap-3 p-2.5 bg-[var(--studio-surface)] border border-[var(--studio-rule)]">
                  <div className="text-right">
                    <strong className="font-serif text-2xl text-[var(--studio-coral)] leading-none block">
                      {activeChapterData.stat.number}
                    </strong>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--studio-muted)]">
                      {activeChapterData.stat.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Callout Quote */}
              <blockquote className="p-4 my-5 border-l-4 border-[var(--studio-coral)] bg-[var(--studio-surface)] font-serif italic text-base sm:text-lg text-[var(--studio-ink)] leading-relaxed m-0">
                "{activeChapterData.quote}"
              </blockquote>

              {/* Narrative Paragraphs */}
              <div className="space-y-4 text-sm sm:text-base text-[var(--studio-muted)] leading-relaxed font-sans">
                {activeChapterData.paragraphs.map((para, i) => (
                  <p key={i} className="m-0">
                    {para}
                  </p>
                ))}
              </div>

              {/* Story Interactive Directing Action */}
              <div className="mt-8 pt-6 border-t border-[var(--studio-rule)] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-mono text-[var(--studio-muted)]">
                  <Terminal className="w-3.5 h-3.5 text-[var(--studio-violet)]" />
                  <span>Built from real production needs & creative obsession.</span>
                </div>

                <button
                  type="button"
                  onClick={() => navigate("/prompt-builder")}
                  className="studio-button studio-button--primary !min-h-[2.4rem] !py-1.5 !px-4 text-xs"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Experience The Directing Engine</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Before vs. After Directorial Comparison */}
          <div className="mt-12 p-6 sm:p-8 border border-[var(--studio-rule)] bg-[var(--studio-surface)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-6 border-b border-[var(--studio-rule)]">
              <div>
                <p className="studio-section__kicker m-0">Interactive Directorial Breakdown</p>
                <h3 className="font-serif text-xl sm:text-2xl text-[var(--studio-ink)] font-normal m-0">
                  Amateur Prompts vs. Jugaad Architecture
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                {COMPARISON_SAMPLES.map((sample, idx) => (
                  <button
                    key={sample.category}
                    type="button"
                    onClick={() => setActiveComparisonIdx(idx)}
                    className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-all ${
                      activeComparisonIdx === idx
                        ? "bg-[var(--studio-coral)] text-white"
                        : "bg-[var(--studio-surface-strong)] text-[var(--studio-muted)] border border-[var(--studio-rule)] hover:text-[var(--studio-ink)]"
                    }`}
                  >
                    {sample.category}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bad / Raw Prompt Card */}
              <div className="p-5 border border-red-500/30 bg-red-500/5 relative flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-red-600 dark:text-red-400 mb-3 pb-2 border-b border-red-500/20">
                    <span className="uppercase tracking-wider">✕ {currentComparison.badTitle}</span>
                    <span>Common Pitfall</span>
                  </div>
                  <p className="font-mono text-xs text-[var(--studio-ink)] p-3 bg-[var(--studio-surface)] border border-red-500/20 mb-3">
                    "{currentComparison.badPrompt}"
                  </p>
                </div>
                <div className="pt-2 text-xs font-mono text-[var(--studio-muted)] border-t border-red-500/10">
                  <strong className="text-red-500 block mb-1 font-bold">Why it fails:</strong>
                  {currentComparison.badResult}
                </div>
              </div>

              {/* Good / Jugaad Blueprint Card */}
              <div className="p-5 border border-emerald-500/40 bg-emerald-500/5 relative flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mb-3 pb-2 border-b border-emerald-500/20">
                    <span className="uppercase tracking-wider">✓ {currentComparison.goodTitle}</span>
                    <span>Directorial Blueprint</span>
                  </div>
                  <p className="font-mono text-xs text-[var(--studio-ink)] p-3 bg-[var(--studio-surface)] border border-emerald-500/30 mb-3 leading-relaxed">
                    "{currentComparison.goodPrompt}"
                  </p>
                </div>
                <div className="pt-2 text-xs font-mono text-[var(--studio-muted)] border-t border-emerald-500/20">
                  <strong className="text-emerald-600 dark:text-emerald-400 block mb-1 font-bold">Why it succeeds:</strong>
                  {currentComparison.goodResult}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            05. PROMPT INTELLIGENCE ANATOMY (7 LAYERS)
            ========================================================================= */}
        <section className="studio-intelligence studio-section" aria-labelledby="intelligence-title">
          <div className="studio-intelligence__copy">
            <p className="studio-section__kicker">03 / The 7 Directorial Layers</p>
            <h2 id="intelligence-title">
              The difference is<br />
              <em>in the layers.</em>
            </h2>
            <p>
              Great prompts are not longer—they are better directed. Jugaad AI keeps the creative intent visible while it builds the details that make an image feel deliberate, dimensional, and usable.
            </p>
            <button
              type="button"
              className="studio-button studio-button--outline"
              onClick={() => navigate("/prompt-builder")}
            >
              Build a Layered Prompt <ArrowRight aria-hidden="true" />
            </button>
          </div>
          <div className="anatomy-grid">
            {ANATOMY.map(({ name, value, icon: Icon, tone }) => (
              <div className={`anatomy-card anatomy-card--${tone}`} key={name}>
                <div className="anatomy-card__icon">
                  <Icon aria-hidden="true" />
                </div>
                <div>
                  <h3>{name}</h3>
                  <p>{value}</p>
                </div>
                <BadgeCheck className="anatomy-card__check" aria-hidden="true" />
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================================
            06. STUDIO ENDCAP & ACTION HOME
            ========================================================================= */}
        <section className="studio-endcap" aria-label="Continue your creative direction">
          <div>
            <p className="studio-section__kicker">Keep the thread</p>
            <h2>
              Your best directions<br />
              <em>deserve a home.</em>
            </h2>
          </div>
          <p>Save, revisit, and evolve the prompts that are worth taking further into production.</p>
          <div className="studio-endcap__actions">
            <button
              type="button"
              className="studio-button studio-button--primary"
              onClick={() => navigate("/library")}
            >
              <LibraryBig aria-hidden="true" /> Open Prompt Vault
            </button>
            <button
              type="button"
              className="studio-button studio-button--quiet"
              onClick={() => navigate("/studio")}
            >
              <Palette aria-hidden="true" /> Persona Studio <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
