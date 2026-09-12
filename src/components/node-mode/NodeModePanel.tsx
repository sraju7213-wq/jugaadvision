import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";
import InteractiveCanvas, {
  CanvasEdge,
  CanvasNode,
} from "../prompt-builder/InteractiveCanvas";
import {
  CheckIcon,
  CopyIcon,
  FolderIcon,
  SparklesIcon,
  BrainCircuitIcon,
  MagicWandIcon,
  RefreshIcon,
} from "../icons";
import { Loader2, AlertCircle, Sparkles, ArrowRight, Wand2 } from "lucide-react";
import { compileNodePrompt, NodeModePlatform } from "../../lib/nodeModeCompiler";
import {
  generateStructuredVisionPrompt,
  generateCreativeMix,
  aiElaboratePrompt,
} from "../../services/geminiService";
import {
  generateBannerPrompt,
  generateCinematicPrompt,
} from "../../services/neuralBackendService";
import { compressImage, FAST_VISION_PRESET } from "../../utils/imageOptimizer";
import QuickImageGenerators from "../QuickImageGenerators";
import { ProcessingAnimation } from "../ProcessingAnimation";

type NodeModeFeature = "creative-mixer" | "pro-prompter";

interface NodeModePanelProps {
  feature: NodeModeFeature;
  initialPrompt?: string;
  selectedStyle?: string;
  selectedMood?: string;
  selectedPlatform?: string;
  aspectRatio?: string;
  onGenerate: (prompt: string) => Promise<string | void> | void;
  onSendToBuilder: (prompt: string) => void;
  onSaveToLibrary: (prompt: string) => void;
}

const makeNode = (
  id: string,
  kind: CanvasNode["kind"],
  x: number,
  y: number,
  label: string,
  text: string,
  weight = 1,
): CanvasNode => ({
  id,
  kind,
  x,
  y,
  label,
  text,
  weight,
});

function buildCreativeMixerGraph(
  prompt: string,
  style: string,
  mood: string,
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const nodes = [
    makeNode("mixer-subject", "prompt", 60, 80, "Core Subject", prompt || "Add your core visual concept"),
    makeNode("mixer-style", "style", 60, 240, "Style Direction", style || "editorial hybrid visual language"),
    makeNode("mixer-mood", "modifier", 60, 400, "Mood", mood || "cinematic and atmospheric"),
    makeNode("mixer-lighting", "lighting", 350, 160, "Lighting", "soft cinematic key light with controlled rim light"),
    makeNode("mixer-camera", "camera", 350, 330, "Camera", "85mm lens, eye-level hero framing, shallow depth of field", 1.1),
    makeNode("mixer-reference", "image", 60, 555, "Visual Reference", "Upload a visual reference and connect it to subject, style, or lighting"),
    makeNode("mixer-output", "output", 670, 300, "Prompt Output", ""),
  ];
  const edges = [
    { id: "mixer-e1", from: "mixer-subject", to: "mixer-lighting", style: "solid" as const },
    { id: "mixer-e2", from: "mixer-style", to: "mixer-lighting", style: "solid" as const },
    { id: "mixer-e3", from: "mixer-mood", to: "mixer-lighting", style: "solid" as const },
    { id: "mixer-e4", from: "mixer-lighting", to: "mixer-camera", style: "solid" as const },
    { id: "mixer-e5", from: "mixer-reference", to: "mixer-lighting", style: "dashed" as const, label: "guides" },
    { id: "mixer-e6", from: "mixer-camera", to: "mixer-output", style: "solid" as const },
  ];
  return { nodes, edges };
}

function buildProPrompterGraph(
  prompt: string,
  style: string,
  mood: string,
  aspectRatio: string,
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const nodes = [
    makeNode("banner-product", "prompt", 60, 80, "P1 Product", prompt || "Add product description and physical attributes", 1.5),
    makeNode("banner-context", "prompt", 60, 255, "P2 Context", "premium studio setting with a clean commercial background"),
    makeNode("banner-style", "style", 60, 430, "P3 Style", `${style || "commercial photography"}, ${mood || "professional"} mood`),
    makeNode("banner-lighting", "lighting", 350, 170, "Lighting", "soft diffused studio light with a subtle rim highlight"),
    makeNode("banner-composition", "modifier", 350, 345, "Copy Layout", "hero product on the left with generous negative space on the right for headline and CTA"),
    makeNode("banner-technical", "modifier", 350, 520, "P4 Technical", `${aspectRatio || "4:5"} aspect ratio, commercial quality, clean typography area`),
    makeNode("banner-reference", "image", 60, 620, "Visual Reference", "Upload a product or style reference and connect it to product, lighting, or copy layout"),
    makeNode("banner-output", "output", 670, 340, "Banner Prompt Output", ""),
  ];
  const edges = [
    { id: "banner-e1", from: "banner-product", to: "banner-lighting", style: "solid" as const },
    { id: "banner-e2", from: "banner-context", to: "banner-lighting", style: "solid" as const },
    { id: "banner-e3", from: "banner-style", to: "banner-lighting", style: "solid" as const },
    { id: "banner-e4", from: "banner-lighting", to: "banner-composition", style: "solid" as const },
    { id: "banner-e5", from: "banner-composition", to: "banner-technical", style: "solid" as const },
    { id: "banner-e6", from: "banner-reference", to: "banner-composition", style: "dashed" as const, label: "guides" },
    { id: "banner-e7", from: "banner-technical", to: "banner-output", style: "solid" as const },
  ];
  return { nodes, edges };
}

const NodeModePanel: React.FC<NodeModePanelProps> = ({
  feature,
  initialPrompt = "",
  selectedStyle = "",
  selectedMood = "",
  selectedPlatform = "general",
  aspectRatio = "",
  onGenerate,
  onSendToBuilder,
  onSaveToLibrary,
}) => {
  const graph = useMemo(
    () =>
      feature === "creative-mixer"
        ? buildCreativeMixerGraph(initialPrompt, selectedStyle, selectedMood)
        : buildProPrompterGraph(initialPrompt, selectedStyle, selectedMood, aspectRatio),
    [feature, initialPrompt, selectedStyle, selectedMood, aspectRatio],
  );

  const compilerPlatform: NodeModePlatform = /midjourney/i.test(selectedPlatform)
    ? "midjourney"
    : /stable diffusion|sdxl/i.test(selectedPlatform)
    ? "sdxl"
    : /dall|gpt image/i.test(selectedPlatform)
    ? "dalle"
    : /flux/i.test(selectedPlatform)
    ? "flux"
    : "general";

  const [liveGraph, setLiveGraph] = useState(graph);
  const [composed, setComposed] = useState(() => compileNodePrompt(graph.nodes, graph.edges, compilerPlatform).prompt);
  const [synthesizedResult, setSynthesizedResult] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [copiedCompiled, setCopiedCompiled] = useState(false);
  const [copiedSynthesized, setCopiedSynthesized] = useState(false);
  const [savedCompiled, setSavedCompiled] = useState(false);
  const [savedSynthesized, setSavedSynthesized] = useState(false);
  const [imageAnalysisState, setImageAnalysisState] = useState<Record<string, string>>({});

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const title = feature === "creative-mixer" ? "Creative Fusion Graph" : "Commercial Banner Graph";
  const subtitle =
    feature === "creative-mixer"
      ? "Connect subject, style, mood, lighting, and camera nodes into a deliberate visual direction."
      : "Assemble product, context, style, copy layout, and technical constraints for a commercial banner.";

  const handleChange = (nodes: CanvasNode[], edges: CanvasEdge[], _nextComposed: string) => {
    setLiveGraph({ nodes, edges });
    const compiledPrompt = compileNodePrompt(nodes, edges, compilerPlatform).prompt;
    setComposed(compiledPrompt);
  };

  const compiled = useMemo(
    () => compileNodePrompt(liveGraph.nodes, liveGraph.edges, compilerPlatform),
    [liveGraph, compilerPlatform],
  );

  const imageNodes = liveGraph.nodes.filter((node) => node.kind === "image");
  const imageGuidance = imageNodes.map((node) => {
    const outgoing = liveGraph.edges.filter((edge) => edge.from === node.id);
    const targets = outgoing
      .map((edge) => liveGraph.nodes.find((candidate) => candidate.id === edge.to)?.label)
      .filter(Boolean);
    return { node, targets };
  });

  const handleImageUpload = async (
    nodeId: string,
    file: File,
    updateNode: (patch: Partial<CanvasNode>) => void,
  ) => {
    setImageAnalysisState((previous) => ({ ...previous, [nodeId]: "Compressing reference..." }));
    try {
      const compressed = await compressImage(file, { ...FAST_VISION_PRESET });
      setImageAnalysisState((previous) => ({ ...previous, [nodeId]: "Analyzing visual traits..." }));
      const vision = await generateStructuredVisionPrompt(
        compressed.base64,
        compressed.mimeType,
        selectedStyle ? [selectedStyle] : [],
        undefined,
        true,
        {
          platform: selectedPlatform,
          useCase: feature === "pro-prompter" ? "Product / e-commerce" : "Concept art",
          fidelity: "Balanced interpretation",
          detailLevel: "Professional",
          aspectRatio: aspectRatio || "Match source",
          composition: "Preserve observed framing",
          lighting: "Preserve observed lighting",
          colorTreatment: "Preserve observed palette",
          styleDirection: selectedStyle || "Preserve observed style",
          creativeDirection: "Use this visual reference as connected guidance, not as a literal copy.",
        },
      );
      updateNode({
        imageStatus: "ready",
        imageAnalysis: {
          subject: vision.subject,
          composition: vision.composition,
          lighting: vision.lighting,
          style: vision.style,
          colors: vision.colorPalette,
          negativePrompt: vision.negativePrompt,
        },
        text: "Preserve the connected reference traits while following the downstream node guidance.",
      });
      setImageAnalysisState((previous) => ({ ...previous, [nodeId]: "Reference analyzed" }));
    } catch (err) {
      updateNode({ imageStatus: "error" });
      setImageAnalysisState((previous) => ({
        ...previous,
        [nodeId]: err instanceof Error ? err.message : "Analysis failed",
      }));
    }
  };

  const handleCopyCompiled = async () => {
    if (!composed) return;
    await navigator.clipboard.writeText(composed);
    setCopiedCompiled(true);
    window.setTimeout(() => setCopiedCompiled(false), 1800);
  };

  const handleSaveCompiled = () => {
    if (!composed) return;
    onSaveToLibrary(composed);
    setSavedCompiled(true);
    window.setTimeout(() => setSavedCompiled(false), 1800);
  };

  const handleCopySynthesized = async () => {
    if (!synthesizedResult) return;
    await navigator.clipboard.writeText(synthesizedResult);
    setCopiedSynthesized(true);
    window.setTimeout(() => setCopiedSynthesized(false), 1800);
  };

  const handleSaveSynthesized = () => {
    if (!synthesizedResult) return;
    onSaveToLibrary(synthesizedResult);
    setSavedSynthesized(true);
    window.setTimeout(() => setSavedSynthesized(false), 1800);
  };

  // Main Generator from Graph Action
  const handleGenerateFromGraph = async () => {
    const promptToSynthesize =
      composed.trim() ||
      liveGraph.nodes
        .filter((n) => n.kind !== "output" && n.text.trim())
        .map((n) => n.text)
        .join(", ");

    if (!promptToSynthesize.trim()) {
      setError("Please add at least one prompt or concept node to the graph before generating.");
      return;
    }

    setIsGenerating(true);
    setStatusMessage("Compiling graph directives & references...");
    setError(null);

    try {
      // 1. Invoke parent onGenerate handler first
      let generatedText: string | void | null = null;
      try {
        generatedText = await onGenerate(promptToSynthesize);
      } catch (parentErr) {
        console.warn("Parent onGenerate warning, executing internal synthesizer fallback:", parentErr);
      }

      // 2. If parent didn't return a string, run feature-specific AI synthesis directly
      if (!generatedText || typeof generatedText !== "string" || !generatedText.trim()) {
        setStatusMessage("Synthesizing master prompt direction via AI...");
        if (feature === "creative-mixer") {
          generatedText = await generateCreativeMix(
            promptToSynthesize,
            selectedStyle || "editorial hybrid",
            selectedMood || "cinematic"
          );
        } else if (feature === "pro-prompter") {
          const bannerRes = await generateBannerPrompt(
            promptToSynthesize,
            "studio setting",
            selectedMood || "professional",
            aspectRatio || "16:9",
            "negative space for copy",
            compilerPlatform,
            (status) => {
              if (isMounted.current) setStatusMessage(status);
            }
          );
          if (bannerRes.success && bannerRes.constructedPrompt) {
            generatedText = bannerRes.constructedPrompt;
          } else {
            generatedText = await aiElaboratePrompt(promptToSynthesize);
          }
        } else {
          generatedText = await aiElaboratePrompt(promptToSynthesize);
        }
      }

      if (isMounted.current && generatedText) {
        setSynthesizedResult(generatedText);

        // Update the graph's Output node text if present
        setLiveGraph((prev) => {
          const updatedNodes = prev.nodes.map((node) => {
            if (node.kind === "output") {
              return { ...node, text: generatedText as string };
            }
            return node;
          });
          return { ...prev, nodes: updatedNodes };
        });
      }
    } catch (err: any) {
      console.error("Generate from Graph failed:", err);
      if (isMounted.current) {
        setError(`Graph generation failed: ${err?.message || "Please check your connection and try again."}`);
      }
    } finally {
      if (isMounted.current) {
        setIsGenerating(false);
        setStatusMessage("");
      }
    }
  };

  const handleApplyToCanvasOutput = () => {
    if (!synthesizedResult) return;
    setLiveGraph((prev) => {
      const updatedNodes = prev.nodes.map((node) => {
        if (node.kind === "output") {
          return { ...node, text: synthesizedResult };
        }
        return node;
      });
      return { ...prev, nodes: updatedNodes };
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Interactive Node Graph Canvas */}
      <div className="editorial-panel">
        <div className="editorial-panel__header">
          <div>
            <span className="editorial-badge editorial-badge--pink">NODE MODE / VISUAL COMPILER</span>
            <h2 className="editorial-panel__title m-0 mt-2 text-base">{title}</h2>
            <p className="m-0 mt-1 max-w-2xl text-xs text-[var(--editorial-muted)]">{subtitle}</p>
          </div>
          <span className="editorial-badge editorial-badge--teal">{selectedPlatform.toUpperCase()}</span>
        </div>
        <div className="editorial-panel__body p-0">
          <InteractiveCanvas
            initialNodes={graph.nodes}
            initialEdges={graph.edges}
            onChange={handleChange}
            onCompose={(nextComposed) => setComposed(nextComposed)}
            onImageUpload={handleImageUpload}
          />
          <div className="border-t border-[var(--editorial-rule)] bg-[var(--editorial-surface)] p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="editorial-badge editorial-badge--pink">CONNECT GUIDANCE</span>
                <p className="m-0 mt-1 text-[11px] font-semibold text-[var(--editorial-ink)]">Make every reference intentional</p>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--editorial-muted)]">Image → trait → output</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {imageGuidance.map(({ node, targets }) => (
                <div key={node.id} className="rounded border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] font-mono font-bold text-[var(--editorial-ink)]">{node.label}</span>
                    <span className={`shrink-0 text-[8px] font-mono font-bold uppercase ${node.imageStatus === "ready" ? "text-emerald-600" : node.imageStatus === "error" ? "text-red-500" : "text-[var(--editorial-muted)]"}`}>
                      {node.imageStatus === "ready" ? "Analyzed" : node.imageStatus === "error" ? "Review" : "Waiting"}
                    </span>
                  </div>
                  <p className="m-0 mt-1 text-[9px] leading-relaxed text-[var(--editorial-muted)]">
                    {targets.length ? <>Guides <strong className="text-[var(--editorial-ink)]">{targets.join(", ")}</strong>.</> : "Not connected yet. Click Connect Next, then choose a subject, style, lighting, or output node."}
                  </p>
                  {imageAnalysisState[node.id] && <p className="m-0 mt-1 text-[8px] font-mono text-[var(--editorial-pink)]">{imageAnalysisState[node.id]}</p>}
                </div>
              ))}
            </div>
            <div className="rounded border border-dashed border-[var(--editorial-rule)] bg-[var(--editorial-paper)] p-2 text-[9px] leading-relaxed text-[var(--editorial-muted)]">
              <strong className="text-[var(--editorial-ink)]">Recommended wiring:</strong> connect a product reference to Product or Copy Layout, a style reference to Style or Lighting, and a composition reference to Camera or Output. Connected references contribute observed subject, composition, lighting, palette, style, and useful exclusions to the compiled prompt.
            </div>
            {compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length > 0 && (
              <div className="space-y-1">
                {compiled.diagnostics.filter((diagnostic) => diagnostic.severity === "warning").map((diagnostic, index) => (
                  <p key={`${diagnostic.message}-${index}`} className="m-0 text-[8px] font-mono text-amber-700">• {diagnostic.message}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compiled Graph Live Output Panel */}
      <div className="editorial-panel">
        <div className="editorial-panel__header">
          <div className="flex items-center gap-2">
            <span className="editorial-badge editorial-badge--teal">01 / GRAPH COMPILED SPEC</span>
            <h3 className="editorial-panel__title m-0 text-base">Topological Node Prompt</h3>
          </div>
          {composed && <span className="font-mono text-[10px] text-[var(--editorial-muted)]">{composed.length} characters</span>}
        </div>
        <div className="editorial-panel__body space-y-4">
          <textarea
            value={composed}
            onChange={(event) => setComposed(event.target.value)}
            placeholder="Connect nodes in the graph above to automatically compile prompt directives..."
            className="editorial-textarea min-h-[110px] font-mono text-xs leading-relaxed"
            aria-label="Compiled node prompt"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyCompiled}
                disabled={!composed}
                className="editorial-button editorial-button--sm editorial-button--secondary"
              >
                {copiedCompiled ? <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> : <CopyIcon className="h-3.5 w-3.5" />}
                {copiedCompiled ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleSaveCompiled}
                disabled={!composed}
                className="editorial-button editorial-button--sm editorial-button--secondary"
              >
                {savedCompiled ? <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> : <FolderIcon className="h-3.5 w-3.5" />}
                {savedCompiled ? "Saved" : "Save to Vault"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onSendToBuilder(composed)}
                disabled={!composed}
                className="editorial-button editorial-button--sm editorial-button--secondary"
              >
                <SparklesIcon className="h-3.5 w-3.5" />
                Send to Builder
              </button>

              <button
                type="button"
                onClick={handleGenerateFromGraph}
                disabled={isGenerating || !composed.trim()}
                className="editorial-button editorial-button--sm editorial-button--primary !bg-[var(--editorial-coral)] hover:!bg-[var(--editorial-coral)]/90 text-white shadow-sm flex items-center gap-1.5"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{statusMessage || "Synthesizing AI Master Prompt..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="font-bold">Generate from Graph</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded flex items-center justify-between gap-2 text-xs text-red-800 dark:text-red-300 font-mono animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={handleGenerateFromGraph}
                className="px-2 py-1 bg-red-600 text-white font-bold text-[10px] uppercase hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {composed && (
            <QuickImageGenerators prompt={composed} variant="compact" title="Direct Jump: Launch Compiled Graph Prompt" />
          )}
        </div>
      </div>

      {/* Generating State Animation */}
      {isGenerating && (
        <div className="editorial-panel p-4 animate-fade-in">
          <ProcessingAnimation
            variant="panel"
            theme="violet"
            badge="GRAPH NEURAL COMPILER"
            title="Synthesizing Master Visual Prompt from Graph"
            stages={[
              "Traversing active graph nodes, weights, and directed edges...",
              "Extracting visual reference traits, composition & lighting vectors...",
              "Harmonizing stylistic constraints and optical parameters...",
              "Synthesizing high-fidelity master directorial prompt...",
            ]}
            stageIntervalMs={1800}
            subtext={statusMessage || "Fusing node-based visual directives into a unified cinematic master prompt."}
          />
        </div>
      )}

      {/* AI Synthesized Master Result Panel */}
      {synthesizedResult && !isGenerating && (
        <div className="editorial-panel animate-fade-in space-y-4 border-2 border-[var(--editorial-coral)] shadow-md">
          <div className="editorial-panel__header bg-[var(--editorial-surface-elevated)] py-2.5 px-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="editorial-badge editorial-badge--coral animate-pulse">
                <Sparkles className="w-3 h-3 mr-1 inline" /> 02 / AI SYNTHESIZED MASTER PROMPT
              </span>
              <h3 className="editorial-panel__title m-0 text-base font-bold text-[var(--editorial-ink)]">
                Production-Ready Visual Direction
              </h3>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--editorial-muted)]">
              <span className="font-bold text-[var(--editorial-ink)]">{synthesizedResult.length} characters</span>
              <span>•</span>
              <span>{synthesizedResult.split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </div>

          <div className="editorial-panel__body space-y-4 p-4">
            <div className="p-3.5 bg-[var(--editorial-surface-sunken)] border border-[var(--editorial-rule)] rounded font-mono text-xs sm:text-[13px] leading-relaxed text-[var(--editorial-ink)] select-all whitespace-pre-wrap shadow-inner">
              {synthesizedResult}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--editorial-rule-subtle)]">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCopySynthesized}
                  className="editorial-button editorial-button--sm editorial-button--primary"
                >
                  {copiedSynthesized ? <CheckIcon className="w-3.5 h-3.5 text-white" /> : <CopyIcon className="w-3.5 h-3.5" />}
                  <span>{copiedSynthesized ? "Copied!" : "Copy Master Prompt"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveSynthesized}
                  className="editorial-button editorial-button--sm editorial-button--secondary"
                >
                  {savedSynthesized ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : <FolderIcon className="w-3.5 h-3.5" />}
                  <span>{savedSynthesized ? "Saved" : "Save to Vault"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleApplyToCanvasOutput}
                  className="editorial-button editorial-button--sm editorial-button--secondary"
                  title="Update graph Output node on canvas"
                >
                  <Wand2 className="w-3.5 h-3.5 text-[var(--editorial-coral)]" />
                  <span>Update Canvas Output Node</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => onSendToBuilder(synthesizedResult)}
                className="editorial-button editorial-button--sm editorial-button--secondary flex items-center gap-1.5"
              >
                <span>Transfer to Prompt Builder</span>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--editorial-coral)]" />
              </button>
            </div>

            {/* Direct Jump to Image Generators for Synthesized Prompt */}
            <div className="pt-2">
              <QuickImageGenerators prompt={synthesizedResult} variant="compact" title="Direct Jump: Launch AI Master Prompt in Image Creators" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeModePanel;
