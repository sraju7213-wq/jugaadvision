import React, {
  useCallback,
  useRef,
  useState,
  useEffect,
  useMemo,
  CSSProperties,
} from "react";
import {
  Maximize2,
  Minimize2,
  Plus,
  Wand2,
  Layers,
  Sparkles,
  Sliders,
  Eye,
  EyeOff,
  Copy,
  Check,
  RotateCcw,
  Download,
  Upload,
  Grid,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Trash2,
  Split,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Camera,
  Sun,
  Palette,
  Cpu,
  Scale,
  Sparkle,
  Share2,
} from "lucide-react";
import {
  NODE_CANVAS_AUDIENCE_LABELS,
  NODE_CANVAS_CATEGORIES,
  NODE_CANVAS_PRESETS,
  type PresetAudience,
  type NodeCanvasPreset,
} from "../../lib/nodeCanvasLibrary";

export type CanvasNodeKind =
  | "prompt"
  | "style"
  | "modifier"
  | "lighting"
  | "camera"
  | "image"
  | "gate"
  | "weighting"
  | "output";

export interface CanvasNode {
  id: string;
  kind: CanvasNodeKind;
  x: number;
  y: number;
  label: string;
  text: string;
  weight?: number;
  color?: string;
  icon?: string;
  width?: number;
  notes?: string;
  imageUrl?: string;
  imageName?: string;
  imageStatus?: "idle" | "analyzing" | "ready" | "error";
  imageAnalysis?: {
    subject?: string;
    composition?: string;
    lighting?: string;
    style?: string;
    colors?: string;
    negativePrompt?: string;
  };
}

export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style?: "solid" | "dashed" | "dotted";
  color?: string;
}

export interface CanvasSettings {
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  panX: number;
  panY: number;
  nodeWidth: number;
  defaultColors: Record<CanvasNodeKind, string>;
  showMiniMap: boolean;
  miniMapPosition: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  placeholderText: string;
}

const DEFAULT_SETTINGS: CanvasSettings = {
  gridSize: 20,
  snapToGrid: true,
  showGrid: true,
  zoom: 1,
  minZoom: 0.3,
  maxZoom: 2.5,
  panX: 40,
  panY: 40,
  nodeWidth: 200,
  defaultColors: {
    prompt: "#8b5cf6",
    style: "#0ea5e9",
    modifier: "#f59e0b",
    lighting: "#eab308",
    camera: "#06b6d4",
    image: "#ec4899",
    gate: "#f43f5e",
    weighting: "#a855f7",
    output: "#10b981",
  },
  showMiniMap: true,
  miniMapPosition: "bottom-right",
  placeholderText: "prompt fragment...",
};

const KIND_META: Record<
  CanvasNodeKind,
  { icon: string; color: string; bg: string; label: string; badge: string }
> = {
  prompt: {
    icon: "λ",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
    label: "Subject",
    badge: "PROMPT",
  },
  style: {
    icon: "◉",
    color: "#0ea5e9",
    bg: "rgba(14,165,233,0.12)",
    label: "Style",
    badge: "ART STYLE",
  },
  modifier: {
    icon: "⚙",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
    label: "Engine",
    badge: "MODIFIER",
  },
  lighting: {
    icon: "☀",
    color: "#eab308",
    bg: "rgba(234,179,8,0.12)",
    label: "Lighting",
    badge: "ILLUMINATION",
  },
  camera: {
    icon: "📷",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.12)",
    label: "Camera",
    badge: "OPTICS",
  },
  image: {
    icon: "▣",
    color: "#ec4899",
    bg: "rgba(236,72,153,0.12)",
    label: "Image Reference",
    badge: "VISUAL REF",
  },
  gate: {
    icon: "◈",
    color: "#f43f5e",
    bg: "rgba(244,63,94,0.12)",
    label: "Gate",
    badge: "LOGIC",
  },
  weighting: {
    icon: "⚖",
    color: "#a855f7",
    bg: "rgba(168,85,247,0.12)",
    label: "Weight",
    badge: "EMPHASIS",
  },
  output: {
    icon: "⬢",
    color: "#10b981",
    bg: "rgba(16,185,129,0.12)",
    label: "Output",
    badge: "TARGET",
  },
};

// Preset catalog categories
const TOKEN_CATALOG = [
  {
    category: "Lighting & Atmos",
    icon: "☀",
    kind: "lighting" as CanvasNodeKind,
    items: [
      "volumetric god rays, atmospheric dust",
      "cinematic teal and amber rim light",
      "softbox studio portrait lighting, 5600K",
      "bioluminescent neon glow, dark background",
      "golden hour sunlight, warm long shadows",
      "moody chiaroscuro, high contrast Rembrandt",
    ],
  },
  {
    category: "Camera & Lens",
    icon: "📷",
    kind: "camera" as CanvasNodeKind,
    items: [
      "85mm f/1.4 prime lens, shallow depth of field",
      "wide-angle 16mm perspective, dramatic scale",
      "macro lens 1:1 magnification, extreme detail",
      "anamorphic lens, horizontal blue flare, bokeh",
      "drone aerial top-down bird's eye view",
      "cinematic Dutch angle, dynamic motion blur",
    ],
  },
  {
    category: "Art Style & Medium",
    icon: "◉",
    kind: "style" as CanvasNodeKind,
    items: [
      "analog 35mm film photography, Kodak Portra 400",
      "hyperrealistic digital painting, Artstation HQ",
      "vibrant Studio Ghibli anime cel shading",
      "dark baroque oil painting, textured canvas",
      "cyberpunk neon aesthetic, retro-futurism",
      "minimalist architectural editorial, neutral tones",
    ],
  },
  {
    category: "Rendering & Modifiers",
    icon: "⚙",
    kind: "modifier" as CanvasNodeKind,
    items: [
      "Unreal Engine 5 render, global illumination",
      "Octane 3D render, photorealistic materials",
      "8K resolution, micro-surface textures",
      "raytraced reflections, subsurface scattering",
      "award-winning National Geographic specimen",
      "masterpiece, intricate organic details",
    ],
  },
];

const TEMPLATE_WORKFLOWS = [
  {
    title: "Cinematic Sci-Fi Hero",
    desc: "Cybernetic nomad in neon rain with anamorphic lighting",
    nodes: [
      { id: "t1", kind: "prompt" as CanvasNodeKind, x: 50, y: 80, label: "Subject", text: "cybernetic wandering nomad in weathered titanium armor" },
      { id: "t2", kind: "lighting" as CanvasNodeKind, x: 50, y: 220, label: "Lighting", text: "volumetric teal and orange neon rim lighting, misty rain" },
      { id: "t3", kind: "camera" as CanvasNodeKind, x: 320, y: 80, label: "Optics", text: "85mm anamorphic lens, subtle horizontal lens flare, cinematic bokeh" },
      { id: "t4", kind: "modifier" as CanvasNodeKind, x: 320, y: 220, label: "Engine", text: "Octane 3D render, raytraced reflections, 8k resolution" },
      { id: "t5", kind: "output" as CanvasNodeKind, x: 590, y: 150, label: "Output", text: "" },
    ],
    edges: [
      { id: "te1", from: "t1", to: "t3" },
      { id: "te2", from: "t2", to: "t3" },
      { id: "te3", from: "t3", to: "t5" },
      { id: "te4", from: "t4", to: "t5" },
    ],
  },
  {
    title: "Vogue Fashion Editorial",
    desc: "High fashion studio portrait with softbox lighting and Kodak tones",
    nodes: [
      { id: "v1", kind: "prompt" as CanvasNodeKind, x: 50, y: 80, label: "Model", text: "avant-garde haute couture model in sculpted silk garments" },
      { id: "v2", kind: "style" as CanvasNodeKind, x: 50, y: 220, label: "Film Style", text: "editorial Vogue cover aesthetic, Kodak Portra 400 grain" },
      { id: "v3", kind: "lighting" as CanvasNodeKind, x: 320, y: 150, label: "Studio Light", text: "diffused profoto softbox, pristine catchlights, neutral backdrop" },
      { id: "v4", kind: "output" as CanvasNodeKind, x: 580, y: 150, label: "Output", text: "" },
    ],
    edges: [
      { id: "ve1", from: "v1", to: "v3" },
      { id: "ve2", from: "v2", to: "v3" },
      { id: "ve3", from: "v3", to: "v4" },
    ],
  },
  {
    title: "Boolean Logic Branching",
    desc: "Conditional prompt chaining with AND, OR, and NOT gates",
    nodes: [
      { id: "b1", kind: "prompt" as CanvasNodeKind, x: 50, y: 60, label: "Core Concept", text: "futuristic hover vehicle speeding through metropolis" },
      { id: "b2", kind: "gate" as CanvasNodeKind, x: 50, y: 180, label: "Logic Gate", text: "AND" },
      { id: "b3", kind: "style" as CanvasNodeKind, x: 50, y: 280, label: "Art Aesthetic", text: "Syd Mead retro-futuristic concept art" },
      { id: "b4", kind: "gate" as CanvasNodeKind, x: 320, y: 180, label: "Exclusion", text: "NOT" },
      { id: "b5", kind: "prompt" as CanvasNodeKind, x: 320, y: 280, label: "Negative Term", text: "blurry, low poly, distortion" },
      { id: "b6", kind: "output" as CanvasNodeKind, x: 580, y: 180, label: "Output", text: "" },
    ],
    edges: [
      { id: "be1", from: "b1", to: "b2" },
      { id: "be2", from: "b3", to: "b2" },
      { id: "be3", from: "b2", to: "b4" },
      { id: "be4", from: "b5", to: "b4" },
      { id: "be5", from: "b4", to: "b6" },
    ],
  },
];

interface Props {
  initialNodes?: CanvasNode[];
  initialEdges?: CanvasEdge[];
  initialSettings?: Partial<CanvasSettings>;
  onChange?: (
    nodes: CanvasNode[],
    edges: CanvasEdge[],
    composed: string,
    settings: CanvasSettings
  ) => void;
  onCompose?: (composed: string) => void;
  onSettingsChange?: (settings: CanvasSettings) => void;
  onImageUpload?: (
    nodeId: string,
    file: File,
    updateNode: (patch: Partial<CanvasNode>) => void,
  ) => void;
}

type Transform = { zoom: number; panX: number; panY: number };

// ── Compose Logic ──────────────────────────────────────────────────────────

export function composePrompt(nodes: CanvasNode[], edges: CanvasEdge[]): string {
  if (nodes.length === 0) return "";
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const preds = new Map<string, string[]>();
  for (const e of edges) {
    if (!preds.has(e.to)) preds.set(e.to, []);
    preds.get(e.to)!.push(e.from);
  }
  const outNodes = nodes.filter((n) => n.kind === "output");
  if (outNodes.length) {
    const target = outNodes[0];
    const visited = new Set<string>();
    const order: CanvasNode[] = [];
    function dfs(id: string) {
      if (visited.has(id)) return;
      visited.add(id);
      for (const pid of preds.get(id) ?? []) dfs(pid);
      const n = byId.get(id);
      if (n && n.kind !== "output") order.push(n);
    }
    dfs(target.id);
    const parts = order.map((n) => {
      if (n.weight && n.weight !== 1.0 && n.kind !== "gate") {
        return `${n.text}::${n.weight.toFixed(1)}`;
      }
      return n.text;
    });
    let out = "";
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p === "AND" || p === "OR") continue;
      if (p === "NOT") {
        const nxt = parts[i + 1];
        if (nxt && nxt !== "AND" && nxt !== "OR" && nxt !== "NOT") {
          out += (out ? ", " : "") + `--no ${nxt}`;
          i++;
        }
        continue;
      }
      const gateBefore = parts[i - 1];
      const sep = gateBefore === "OR" ? " | " : ", ";
      out += (out ? sep : "") + p;
    }
    return out;
  }
  return nodes
    .filter((n) => n.kind !== "output")
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .map((n) => (n.weight && n.weight !== 1.0 ? `${n.text}::${n.weight.toFixed(1)}` : n.text))
    .join(", ");
}

function snap(v: number, grid: number): number {
  return Math.round(v / grid) * grid;
}

function zoomPercent(z: number): string {
  return `${Math.round(z * 100)}%`;
}

function makeId(): string {
  return `n${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── MiniMap Component ───────────────────────────────────────────────────────

const MiniMap: React.FC<{
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  transform: Transform;
  settings: CanvasSettings;
  onPan: (x: number, y: number) => void;
}> = ({ nodes, edges, transform, settings, onPan }) => {
  const mmRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);

  const bounds = useMemo(() => {
    if (!nodes.length) return { x: 0, y: 0, w: 600, h: 400 };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    }
    const w = Math.max(600, maxX + 300 - minX);
    const h = Math.max(400, maxY + 200 - minY);
    return { x: minX, y: minY, w, h };
  }, [nodes]);

  const totalW = 160;
  const totalH = 96;
  const scale = Math.min(totalW / bounds.w, totalH / bounds.h, 1);

  const mx = (x: number) => (x - bounds.x) * scale;
  const my = (y: number) => (y - bounds.y) * scale;

  const viewW = totalW / transform.zoom;
  const viewH = totalH / transform.zoom;
  const viewX = -transform.panX / transform.zoom;
  const viewY = -transform.panY / transform.zoom;

  const viewportRect = useMemo(() => {
    return {
      x: Math.max(0, (viewX - bounds.x) * scale),
      y: Math.max(0, (viewY - bounds.y) * scale),
      w: Math.min(totalW, (viewW / bounds.w) * totalW),
      h: Math.min(totalH, (viewH / bounds.h) * totalH),
    };
  }, [viewX, viewY, viewW, viewH, bounds, totalW, totalH, scale]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const rect = mmRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const worldX = bounds.x + clickX / scale;
    const worldY = bounds.y + clickY / scale;
    onPan(-worldX * transform.zoom + totalW * 2, -worldY * transform.zoom + totalH * 2);
    setDrag({ dx: clickX, dy: clickY });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  return (
    <div
      ref={mmRef}
      onPointerDown={handlePointerDown}
      className={`absolute z-30 border border-[var(--editorial-rule)] bg-[var(--editorial-paper)]/95 backdrop-blur shadow-lg rounded overflow-hidden select-none cursor-crosshair ${
        settings.miniMapPosition.includes("bottom") ? "bottom-3" : "top-3"
      } ${settings.miniMapPosition.includes("right") ? "right-3" : "left-3"}`}
      style={{ width: totalW, height: totalH }}
      title="Radar Mini-Map (Click to navigate)"
    >
      <div className="flex items-center justify-between px-1.5 py-0.5 bg-[var(--editorial-surface)] border-b border-[var(--editorial-rule)] text-[8px] font-mono text-[var(--editorial-muted)]">
        <span>RADAR</span>
        <span>{zoomPercent(transform.zoom)}</span>
      </div>
      <div className="relative w-full h-[calc(100%-16px)]">
        {/* Viewport Box */}
        <div
          className="absolute border border-[var(--editorial-violet)] bg-[var(--editorial-violet)]/20 pointer-events-none rounded-sm transition-all duration-75"
          style={{
            left: viewportRect.x,
            top: viewportRect.y,
            width: Math.max(16, viewportRect.w),
            height: Math.max(12, viewportRect.h),
          }}
        />
        {/* Nodes */}
        {nodes.map((n) => {
          const kindMeta = KIND_META[n.kind] || KIND_META.prompt;
          return (
            <div
              key={n.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: mx(n.x + 80),
                top: my(n.y + 20),
                width: 5,
                height: 5,
                backgroundColor: n.color || kindMeta.color,
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

// ── Color Picker Tool ──────────────────────────────────────────────────────

const CompactColorPicker: React.FC<{
  value: string;
  onChange: (c: string) => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const colors = [
    "#8b5cf6",
    "#0ea5e9",
    "#f59e0b",
    "#eab308",
    "#06b6d4",
    "#f43f5e",
    "#a855f7",
    "#10b981",
    "#ec4899",
    "#3b82f6",
  ];

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-5 h-5 rounded border border-[var(--editorial-rule)] flex items-center justify-center p-0.5"
        style={{ backgroundColor: value }}
        title="Node accent color"
      />
      {open && (
        <div
          className="absolute right-0 bottom-full mb-1 z-50 p-2 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] shadow-xl rounded grid grid-cols-5 gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className="w-4 h-4 rounded border border-black/10 hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────

const InteractiveCanvas: React.FC<Props> = ({
  initialNodes,
  initialEdges,
  initialSettings,
  onChange,
  onCompose,
  onSettingsChange,
  onImageUpload,
}) => {
  const settings: CanvasSettings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...initialSettings }),
    [initialSettings]
  );

  const [nodes, setNodes] = useState<CanvasNode[]>(
    initialNodes ?? [
      {
        id: "n1",
        kind: "prompt",
        x: 60,
        y: 60,
        label: "Subject",
        text: "cybernetic wandering samurai with titanium armor",
        weight: 1.0,
      },
      {
        id: "n2",
        kind: "lighting",
        x: 60,
        y: 220,
        label: "Lighting",
        text: "volumetric god rays, cyan and amber neon rim light",
        weight: 1.0,
      },
      {
        id: "n3",
        kind: "camera",
        x: 360,
        y: 60,
        label: "Optics",
        text: "85mm anamorphic prime lens, cinematic shallow depth of field",
        weight: 1.2,
      },
      {
        id: "n4",
        kind: "modifier",
        x: 360,
        y: 220,
        label: "Engine",
        text: "Unreal Engine 5 render, raytraced reflections, 8k resolution",
        weight: 1.0,
      },
      {
        id: "n5",
        kind: "output",
        x: 660,
        y: 140,
        label: "Output Merge",
        text: "",
      },
    ]
  );

  const [edges, setEdges] = useState<CanvasEdge[]>(
    initialEdges ?? [
      { id: "e1", from: "n1", to: "n3", style: "solid" },
      { id: "e2", from: "n2", to: "n3", style: "solid" },
      { id: "e3", from: "n3", to: "n5", style: "solid" },
      { id: "e4", from: "n4", to: "n5", style: "solid" },
    ]
  );

  const [settingsState, setSettingsState] = useState<CanvasSettings>(settings);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [multiSelect, setMultiSelect] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [panState, setPanState] = useState<{
    active: boolean;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  // UI Panels state
  const [showCatalogDock, setShowCatalogDock] = useState(true);
  const [showInspectorDock, setShowInspectorDock] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [catalogTab, setCatalogTab] = useState<"library" | "tokens" | "templates">("tokens");
  const [searchQuery, setSearchQuery] = useState("");
  const [libraryAudience, setLibraryAudience] = useState<PresetAudience | "all">("all");
  const [libraryCategory, setLibraryCategory] = useState("All categories");
  const [librarySubcategory, setLibrarySubcategory] = useState("All subcategories");

  const filteredLibraryPresets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return NODE_CANVAS_PRESETS.filter((preset) => {
      const matchesAudience = libraryAudience === "all" || preset.audience === libraryAudience;
      const matchesCategory = libraryCategory === "All categories" || preset.category === libraryCategory;
      const matchesSubcategory = librarySubcategory === "All subcategories" || preset.subcategory === librarySubcategory;
      const haystack = [preset.title, preset.description, preset.category, preset.subcategory, ...preset.tags]
        .join(" ")
        .toLowerCase();
      return matchesAudience && matchesCategory && matchesSubcategory && (!query || haystack.includes(query));
    });
  }, [libraryAudience, libraryCategory, librarySubcategory, searchQuery]);

  const librarySubcategories = useMemo(() => {
    const scoped = libraryCategory === "All categories"
      ? NODE_CANVAS_PRESETS
      : NODE_CANVAS_PRESETS.filter((preset) => preset.category === libraryCategory);
    return Array.from(new Set(scoped.map((preset) => preset.subcategory)));
  }, [libraryCategory]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const emit = useCallback(
    (ns: CanvasNode[], es: CanvasEdge[]) => {
      const c = composePrompt(ns, es);
      onChange?.(ns, es, c, settingsState);
    },
    [onChange, settingsState]
  );

  const currentNode = selected ? nodes.find((n) => n.id === selected) || null : null;

  // ── Auto-Layout Graph (Topological Grid Layout) ───────────────────────────
  const autoLayoutGraph = useCallback(() => {
    if (nodes.length === 0) return;

    // Calculate in-degrees
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    nodes.forEach((n) => {
      inDegree.set(n.id, 0);
      adj.set(n.id, []);
    });

    edges.forEach((e) => {
      if (adj.has(e.from)) adj.get(e.from)!.push(e.to);
      if (inDegree.has(e.to)) inDegree.set(e.to, inDegree.get(e.to)! + 1);
    });

    // Assign rank levels
    const levels = new Map<string, number>();
    const queue: { id: string; level: number }[] = [];

    nodes.forEach((n) => {
      if ((inDegree.get(n.id) || 0) === 0) {
        queue.push({ id: n.id, level: 0 });
        levels.set(n.id, 0);
      }
    });

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      const neighbors = adj.get(id) || [];
      for (const nextId of neighbors) {
        const nextLevel = Math.max(levels.get(nextId) || 0, level + 1);
        levels.set(nextId, nextLevel);
        queue.push({ id: nextId, level: nextLevel });
      }
    }

    // Group by rank
    const columns: Record<number, CanvasNode[]> = {};
    nodes.forEach((n) => {
      const lvl = levels.get(n.id) || 0;
      if (!columns[lvl]) columns[lvl] = [];
      columns[lvl].push(n);
    });

    const colWidth = 300;
    const rowHeight = 150;

    const nextNodes = nodes.map((n) => {
      const lvl = levels.get(n.id) || 0;
      const colNodes = columns[lvl] || [n];
      const indexInCol = colNodes.findIndex((cn) => cn.id === n.id);
      const totalInCol = colNodes.length;

      const targetX = 60 + lvl * colWidth;
      const targetY = 60 + (indexInCol - (totalInCol - 1) / 2) * rowHeight + 110;

      return {
        ...n,
        x: Math.max(40, snap(targetX, settingsState.gridSize)),
        y: Math.max(40, snap(targetY, settingsState.gridSize)),
      };
    });

    setNodes(nextNodes);
    emit(nextNodes, edges);
  }, [nodes, edges, settingsState.gridSize, emit]);

  // ── Wheel Zoom ────────────────────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (!canvasRef.current) return;
      const factor = e.deltaY > 0 ? 0.93 : 1.07;
      const newZoom = Math.max(
        settingsState.minZoom,
        Math.min(settingsState.maxZoom, settingsState.zoom * factor)
      );

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - settingsState.panX) * (newZoom / settingsState.zoom);
      const newPanY = mouseY - (mouseY - settingsState.panY) * (newZoom / settingsState.zoom);

      setSettingsState((s) => ({
        ...s,
        zoom: newZoom,
        panX: newPanX,
        panY: newPanY,
      }));
    },
    [settingsState]
  );

  // ── Pan Handlers ──────────────────────────────────────────────────────────
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (
        e.button === 1 ||
        (e.button === 0 && e.target === canvasRef.current) ||
        (e.button === 0 && (e.target as HTMLElement)?.classList?.contains("canvas-bg-target"))
      ) {
        e.preventDefault();
        setPanState({
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          panX: settingsState.panX,
          panY: settingsState.panY,
        });
        (e.target as Element).setPointerCapture?.(e.pointerId);
      }
    },
    [settingsState]
  );

  const handleCanvasPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (panState?.active) {
        const dx = e.clientX - panState.startX;
        const dy = e.clientY - panState.startY;
        setSettingsState((s) => ({
          ...s,
          panX: panState.panX + dx,
          panY: panState.panY + dy,
        }));
      }
    },
    [panState]
  );

  const handleCanvasPointerUp = useCallback(() => {
    setPanState(null);
  }, []);

  // ── Node Drag Handlers ────────────────────────────────────────────────────
  const onPointerDownNode = useCallback(
    (e: React.PointerEvent, n: CanvasNode) => {
      e.stopPropagation();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const worldX = (e.clientX - rect.left - settingsState.panX) / settingsState.zoom;
      const worldY = (e.clientY - rect.top - settingsState.panY) / settingsState.zoom;

      if (e.shiftKey) {
        setMultiSelect((prev) => {
          const next = new Set(prev);
          if (next.has(n.id)) next.delete(n.id);
          else next.add(n.id);
          return next;
        });
        setSelected(n.id);
        return;
      }

      setSelected(n.id);
      setDrag({ id: n.id, dx: worldX - n.x, dy: worldY - n.y });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [settingsState]
  );

  const onPointerMoveNode = useCallback(
    (e: React.PointerEvent) => {
      if (!drag || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - settingsState.panX) / settingsState.zoom;
      const worldY = (e.clientY - rect.top - settingsState.panY) / settingsState.zoom;

      const targetX = worldX - drag.dx;
      const targetY = worldY - drag.dy;

      const finalX = settingsState.snapToGrid
        ? snap(targetX, settingsState.gridSize)
        : targetX;
      const finalY = settingsState.snapToGrid
        ? snap(targetY, settingsState.gridSize)
        : targetY;

      setNodes((prev) => {
        const next = prev.map((p) =>
          p.id === drag.id
            ? { ...p, x: Math.max(10, finalX), y: Math.max(10, finalY) }
            : p
        );
        emit(next, edges);
        return next;
      });
    },
    [drag, edges, emit, settingsState]
  );

  const onPointerUpNode = useCallback(() => {
    setDrag(null);
  }, []);

  // ── Node & Edge Operations ────────────────────────────────────────────────
  const addNode = useCallback(
    (kind: CanvasNodeKind, text?: string, label?: string) => {
      const id = makeId();
      const meta = KIND_META[kind];
      const nodeText =
        text ??
        (kind === "gate"
          ? "AND"
          : kind === "output"
          ? ""
          : kind === "image"
          ? "Upload a visual reference and connect it to subject, style, or lighting"
          : settingsState.placeholderText);
      const nodeLabel = label ?? (text ? text.split(",")[0].slice(0, 18) : meta.label);

      // Place near center of viewport
      const cx = (-settingsState.panX + 300) / settingsState.zoom + Math.random() * 80;
      const cy = (-settingsState.panY + 200) / settingsState.zoom + Math.random() * 80;

      const n: CanvasNode = {
        id,
        kind,
        x: Math.max(40, snap(cx, settingsState.gridSize)),
        y: Math.max(40, snap(cy, settingsState.gridSize)),
        label: nodeLabel,
        text: nodeText,
        weight: 1.0,
        icon: meta.icon,
        color: settingsState.defaultColors[kind] || meta.color,
      };

      const next = [...nodes, n];
      setNodes(next);
      setSelected(id);
      emit(next, edges);
      return n;
    },
    [nodes, edges, emit, settingsState]
  );

  const duplicateNode = useCallback(
    (id: string) => {
      const src = nodes.find((n) => n.id === id);
      if (!src) return;
      const newId = makeId();
      const n: CanvasNode = {
        ...src,
        id: newId,
        x: src.x + 30,
        y: src.y + 30,
        label: `${src.label} (copy)`,
      };
      const nextNodes = [...nodes, n];
      const nextEdges = [
        ...edges,
        ...edges
          .filter((e) => e.to === id)
          .map((e) => ({ ...e, id: `e_${Date.now()}_${Math.random()}`, to: newId })),
      ];
      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelected(newId);
      emit(nextNodes, nextEdges);
    },
    [nodes, edges, emit]
  );

  const removeNode = useCallback(
    (id: string) => {
      const nextNodes = nodes.filter((n) => n.id !== id);
      const nextEdges = edges.filter((e) => e.from !== id && e.to !== id);
      setNodes(nextNodes);
      setEdges(nextEdges);
      if (selected === id) setSelected(null);
      emit(nextNodes, nextEdges);
    },
    [nodes, edges, selected, emit]
  );

  const toggleGate = useCallback(
    (id: string) => {
      setNodes((prev) => {
        const next = prev.map((n) => {
          if (n.id === id && n.kind === "gate") {
            const sequence: Record<string, string> = {
              AND: "OR",
              OR: "NOT",
              NOT: "BLEND",
              BLEND: "AND",
            };
            return { ...n, text: sequence[n.text] || "AND" };
          }
          return n;
        });
        emit(next, edges);
        return next;
      });
    },
    [edges, emit]
  );

  const connectNodes = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      const exists = edges.some((e) => e.from === fromId && e.to === toId);
      if (exists) return;
      const newEdge: CanvasEdge = {
        id: `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        from: fromId,
        to: toId,
        style: "solid",
      };
      const next = [...edges, newEdge];
      setEdges(next);
      emit(nodes, next);
    },
    [edges, nodes, emit]
  );

  const removeEdge = useCallback(
    (edgeId: string) => {
      const next = edges.filter((e) => e.id !== edgeId);
      setEdges(next);
      emit(nodes, next);
    },
    [edges, nodes, emit]
  );

  const updateNode = useCallback(
    (id: string, patch: Partial<CanvasNode>) => {
      setNodes((prev) => {
        const next = prev.map((node) => node.id === id ? { ...node, ...patch } : node);
        emit(next, edges);
        return next;
      });
    },
    [edges, emit],
  );

  const fitToView = useCallback(() => {
    if (!containerRef.current || nodes.length === 0) return;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const pad = 80;
    const graphW = maxX - minX + settingsState.nodeWidth + pad * 2;
    const graphH = maxY - minY + 160 + pad * 2;

    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;

    const z = Math.min(Math.max(settingsState.minZoom, Math.min(cw / graphW, ch / graphH)), 1.5);
    const px = (cw - graphW * z) / 2 - minX * z + pad * z;
    const py = (ch - graphH * z) / 2 - minY * z + pad * z;

    setSettingsState((s) => ({
      ...s,
      zoom: z,
      panX: px,
      panY: py,
    }));
  }, [nodes, settingsState]);

  const loadWorkflowTemplate = useCallback(
    (tpl: Pick<NodeCanvasPreset, "nodes" | "edges">) => {
      setNodes(tpl.nodes);
      setEdges(tpl.edges);
      emit(tpl.nodes, tpl.edges);
      setTimeout(fitToView, 50);
    },
    [emit, fitToView]
  );

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected) removeNode(selected);
      } else if (e.key === "Escape") {
        setSelected(null);
        setConnecting(null);
        if (isFullscreen) setIsFullscreen(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        setMultiSelect(new Set(nodes.map((n) => n.id)));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, removeNode, isFullscreen, nodes]);

  const composed = useMemo(() => composePrompt(nodes, edges), [nodes, edges]);

  const handleCopyPrompt = useCallback(() => {
    if (!composed) return;
    navigator.clipboard.writeText(composed);
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2000);
  }, [composed]);

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[100] flex flex-col bg-[var(--editorial-paper)] p-3 overflow-hidden"
          : "editorial-panel flex flex-col p-2.5 xl:p-3.5 w-full transition-all duration-200"
      }
    >
      {/* ── TOP MULTI-DECK STUDIO CONTROLLER ──────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 mb-2 border-b border-[var(--editorial-rule)] bg-[var(--editorial-surface)] px-3 py-2 rounded">
        {/* Left Stats & Title */}
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--editorial-violet)] animate-pulse shadow-[0_0_8px_var(--editorial-violet)]" />
          <div>
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--editorial-ink)] flex items-center gap-1.5 m-0">
              Interactive Prompt Canvas
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--editorial-violet)]/10 text-[var(--editorial-violet)] font-bold">
                PRO WORKBENCH
              </span>
            </h3>
            <span className="text-[9px] text-[var(--editorial-muted)] font-mono">
              {nodes.length} Nodes · {edges.length} Wires · {composed.split(/\s+/).filter(Boolean).length} Words ·{" "}
              {zoomPercent(settingsState.zoom)} Zoom
            </span>
          </div>
        </div>

        {/* Quick Node Spawners */}
        <div className="hidden lg:flex items-center gap-1 bg-[var(--editorial-paper)] p-1 rounded border border-[var(--editorial-rule)]">
          <span className="text-[8px] font-mono font-bold uppercase text-[var(--editorial-muted)] px-1">
            + Quick Add:
          </span>
          {(Object.keys(KIND_META) as CanvasNodeKind[]).map((k) => {
            const m = KIND_META[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => addNode(k)}
                className="px-2 py-1 text-[9.5px] font-mono font-bold border border-transparent rounded hover:border-[var(--editorial-rule)] flex items-center gap-1 transition-all hover:scale-105"
                style={{ color: m.color }}
                title={`Spawn ${m.label} node`}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={autoLayoutGraph}
            className="px-2.5 py-1 text-[10px] font-mono font-bold border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-[var(--editorial-ink)] hover:border-[var(--editorial-violet)] hover:text-[var(--editorial-violet)] rounded flex items-center gap-1 transition-all"
            title="Auto-organize nodes into clean hierarchical pipeline"
          >
            <Wand2 className="w-3 h-3 text-[var(--editorial-violet)]" />
            <span>Auto-Layout</span>
          </button>

          <button
            type="button"
            onClick={fitToView}
            className="px-2 py-1 text-[10px] font-mono font-bold border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-[var(--editorial-ink)] hover:border-[var(--editorial-violet)] rounded flex items-center gap-1"
            title="Fit graph to view"
          >
            <Crosshair className="w-3 h-3" />
            <span>Fit</span>
          </button>

          {/* Zoom buttons */}
          <div className="flex items-center border border-[var(--editorial-rule)] rounded bg-[var(--editorial-paper)]">
            <button
              type="button"
              onClick={() =>
                setSettingsState((s) => ({
                  ...s,
                  zoom: Math.max(s.minZoom, s.zoom - 0.15),
                }))
              }
              className="p-1 text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface)]"
              title="Zoom out"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[8.5px] font-mono text-[var(--editorial-muted)] px-1.5 min-w-[32px] text-center">
              {zoomPercent(settingsState.zoom)}
            </span>
            <button
              type="button"
              onClick={() =>
                setSettingsState((s) => ({
                  ...s,
                  zoom: Math.min(s.maxZoom, s.zoom + 0.15),
                }))
              }
              className="p-1 text-[var(--editorial-ink)] hover:bg-[var(--editorial-surface)] border-l border-[var(--editorial-rule)]"
              title="Zoom in"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          {/* Dock Toggles */}
          <button
            type="button"
            onClick={() => setShowCatalogDock((v) => !v)}
            className={`px-2 py-1 text-[10px] font-mono font-bold border rounded flex items-center gap-1 transition-colors ${
              showCatalogDock
                ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                : "bg-[var(--editorial-paper)] text-[var(--editorial-ink)] border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)]"
            }`}
            title="Toggle Token & Template Catalog Dock"
          >
            <Layers className="w-3 h-3" />
            <span className="hidden sm:inline">Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => setShowInspectorDock((v) => !v)}
            className={`px-2 py-1 text-[10px] font-mono font-bold border rounded flex items-center gap-1 transition-colors ${
              showInspectorDock
                ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                : "bg-[var(--editorial-paper)] text-[var(--editorial-ink)] border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)]"
            }`}
            title="Toggle Node Inspector Dock"
          >
            <Sliders className="w-3 h-3" />
            <span className="hidden sm:inline">Inspector</span>
          </button>

          {/* Fullscreen Expansion */}
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            className={`px-2.5 py-1 text-[10px] font-mono font-bold border rounded flex items-center gap-1 transition-all ${
              isFullscreen
                ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                : "border-[var(--editorial-violet)] bg-[var(--editorial-violet)] text-white hover:bg-[var(--editorial-violet)]/90 shadow-sm"
            }`}
            title={isFullscreen ? "Exit Fullscreen" : "Expand to Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            <span>{isFullscreen ? "Exit" : "Expand"}</span>
          </button>
        </div>
      </div>

      {/* ── MAIN WORKSPACE BODY (CATALOG DOCK + CANVAS + INSPECTOR DOCK) ────── */}
      <div
        className={
          isFullscreen
            ? "flex-1 flex gap-2.5 min-h-0 w-full relative overflow-hidden"
            : "flex gap-2.5 w-full relative overflow-hidden h-[62vh] min-h-[500px] xl:min-h-[580px] xl:h-[65vh]"
        }
      >
        {/* ── LEFT DOCK: TOKEN & WORKFLOW CATALOG ────────────────────────── */}
        {showCatalogDock && (
          <aside className="w-64 xl:w-72 flex-shrink-0 flex flex-col border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] rounded overflow-hidden z-20 shadow-sm animate-fade-in">
            {/* Dock Tabs */}
            <div className="flex border-b border-[var(--editorial-rule)] bg-[var(--editorial-paper)]">
              <button
                type="button"
                onClick={() => setCatalogTab("tokens")}
                className={`flex-1 py-1.5 text-[9.5px] font-mono font-bold uppercase tracking-wider text-center transition-colors ${
                  catalogTab === "tokens"
                    ? "border-b-2 border-[var(--editorial-violet)] text-[var(--editorial-violet)] bg-[var(--editorial-surface)]"
                    : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                }`}
              >
                Tokens
              </button>
              <button
                type="button"
                onClick={() => setCatalogTab("templates")}
                className={`flex-1 py-1.5 text-[9.5px] font-mono font-bold uppercase tracking-wider text-center transition-colors ${
                  catalogTab === "templates"
                    ? "border-b-2 border-[var(--editorial-violet)] text-[var(--editorial-violet)] bg-[var(--editorial-surface)]"
                    : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                }`}
              >
                Workflows
              </button>
              <button
                type="button"
                onClick={() => setCatalogTab("library")}
                className={`flex-1 py-1.5 text-[9.5px] font-mono font-bold uppercase tracking-wider text-center transition-colors ${
                  catalogTab === "library"
                    ? "border-b-2 border-[var(--editorial-violet)] text-[var(--editorial-violet)] bg-[var(--editorial-surface)]"
                    : "text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)]"
                }`}
              >
                Library
              </button>
            </div>

            {/* Dock Search */}
            <div className="p-2 border-b border-[var(--editorial-rule)] bg-[var(--editorial-paper)]">
              <input
                type="text"
                placeholder="Search tokens, workflows, presets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-[9px] font-mono px-2 py-1 border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] text-[var(--editorial-ink)] rounded focus:outline-none focus:border-[var(--editorial-violet)]"
              />
            </div>

            {/* Tab Content 1: Token Chips */}
            {catalogTab === "tokens" && (
              <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                {TOKEN_CATALOG.map((cat) => {
                  const filtered = cat.items.filter((item) =>
                    item.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  if (filtered.length === 0 && searchQuery) return null;
                  return (
                    <div key={cat.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-[9px] font-mono font-bold text-[var(--editorial-ink)] uppercase">
                        <span className="flex items-center gap-1">
                          <span>{cat.icon}</span>
                          <span>{cat.category}</span>
                        </span>
                        <span className="text-[8px] text-[var(--editorial-muted)]">
                          {filtered.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {filtered.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => addNode(cat.kind, item)}
                            className="text-left px-2 py-1 text-[9px] font-mono bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)] hover:bg-[var(--editorial-violet)]/5 rounded text-[var(--editorial-ink)] transition-all group flex items-center justify-between"
                            title="Click to spawn node on canvas"
                          >
                            <span className="truncate flex-1">{item}</span>
                            <Plus className="w-2.5 h-2.5 text-[var(--editorial-muted)] group-hover:text-[var(--editorial-violet)] flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab Content 2: Workflow Templates */}
            {catalogTab === "templates" && (
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                <div className="text-[8px] font-mono text-[var(--editorial-muted)] uppercase px-1">
                  1-Click Pipeline Starters:
                </div>
                {TEMPLATE_WORKFLOWS.map((tpl) => (
                  <div
                    key={tpl.title}
                    className="p-2 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] rounded hover:border-[var(--editorial-violet)] transition-all space-y-1.5"
                  >
                    <div className="font-mono text-[10px] font-bold text-[var(--editorial-ink)]">
                      {tpl.title}
                    </div>
                    <p className="text-[8.5px] font-mono text-[var(--editorial-muted)] m-0 leading-tight">
                      {tpl.desc}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[8px] font-mono text-[var(--editorial-violet)] font-bold">
                        {tpl.nodes.length} Nodes · {tpl.edges.length} Wires
                      </span>
                      <button
                        type="button"
                        onClick={() => loadWorkflowTemplate(tpl)}
                        className="px-2 py-0.5 text-[8.5px] font-mono font-bold bg-[var(--editorial-ink)] text-[var(--editorial-paper)] rounded hover:bg-[var(--editorial-violet)] transition-colors"
                      >
                        Load Graph
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Tab Content 3: Expanded Preset Library */}
            {catalogTab === "library" && (
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                <div className="flex items-end justify-between px-1">
                  <div>
                    <div className="text-[8px] font-mono text-[var(--editorial-violet)] uppercase tracking-wider font-bold">
                      Node Canvas Library
                    </div>
                    <div className="text-[8px] font-mono text-[var(--editorial-muted)] mt-0.5">
                      {filteredLibraryPresets.length} of {NODE_CANVAS_PRESETS.length} setups
                    </div>
                  </div>
                  <span className="text-[8px] font-mono text-[var(--editorial-muted)]">1-click graphs</span>
                </div>

                <div className="flex gap-1 overflow-x-auto pb-0.5 custom-scrollbar">
                  {(["all", "professional", "casual"] as const).map((audience) => (
                    <button
                      key={audience}
                      type="button"
                      onClick={() => setLibraryAudience(audience)}
                      className={`whitespace-nowrap px-2 py-1 rounded border text-[8px] font-mono font-bold transition-all ${
                        libraryAudience === audience
                          ? "bg-[var(--editorial-ink)] text-[var(--editorial-paper)] border-[var(--editorial-ink)]"
                          : "bg-[var(--editorial-paper)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)]"
                      }`}
                    >
                      {NODE_CANVAS_AUDIENCE_LABELS[audience]}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <select
                    value={libraryCategory}
                    onChange={(e) => {
                      setLibraryCategory(e.target.value);
                      setLibrarySubcategory("All subcategories");
                    }}
                    className="min-w-0 px-1.5 py-1.5 rounded border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-[8px] font-mono text-[var(--editorial-ink)] focus:outline-none focus:border-[var(--editorial-violet)]"
                    aria-label="Filter by category"
                  >
                    <option>All categories</option>
                    {NODE_CANVAS_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                  </select>
                  <select
                    value={librarySubcategory}
                    onChange={(e) => setLibrarySubcategory(e.target.value)}
                    className="min-w-0 px-1.5 py-1.5 rounded border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] text-[8px] font-mono text-[var(--editorial-ink)] focus:outline-none focus:border-[var(--editorial-violet)]"
                    aria-label="Filter by subcategory"
                  >
                    <option>All subcategories</option>
                    {librarySubcategories.map((subcategory) => <option key={subcategory}>{subcategory}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  {filteredLibraryPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="p-2 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] rounded hover:border-[var(--editorial-violet)] hover:shadow-sm transition-all"
                    >
                      <div className="flex gap-1.5 items-start">
                        <span className="text-sm leading-none mt-0.5" aria-hidden="true">{preset.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex gap-1 items-start justify-between">
                            <div className="text-[9px] font-mono font-bold text-[var(--editorial-ink)] leading-tight">
                              {preset.title}
                            </div>
                            <span className={`shrink-0 text-[7px] uppercase font-mono font-bold px-1 py-0.5 rounded ${
                              preset.audience === "professional"
                                ? "bg-[var(--editorial-violet)]/10 text-[var(--editorial-violet)]"
                                : "bg-[var(--editorial-coral)]/10 text-[var(--editorial-coral)]"
                            }`}>
                              {preset.audience === "professional" ? "PRO" : "CASUAL"}
                            </span>
                          </div>
                          <div className="text-[7.5px] font-mono text-[var(--editorial-muted)] mt-0.5 truncate">
                            {preset.category} / {preset.subcategory}
                          </div>
                        </div>
                      </div>
                      <p className="text-[8px] font-mono text-[var(--editorial-muted)] leading-tight mt-1.5 mb-1.5 line-clamp-2">
                        {preset.description}
                      </p>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[7.5px] font-mono text-[var(--editorial-violet)] font-bold">
                          {preset.nodes.length - 1} nodes · {preset.time}
                        </span>
                        <button
                          type="button"
                          onClick={() => loadWorkflowTemplate(preset)}
                          className="px-2 py-1 text-[8px] font-mono font-bold bg-[var(--editorial-ink)] text-[var(--editorial-paper)] rounded hover:bg-[var(--editorial-violet)] transition-colors"
                        >
                          Load graph
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredLibraryPresets.length === 0 && (
                    <div className="p-4 text-center border border-dashed border-[var(--editorial-rule)] rounded">
                      <div className="text-[9px] font-mono font-bold text-[var(--editorial-ink)]">No setup found</div>
                      <div className="text-[8px] font-mono text-[var(--editorial-muted)] mt-1">Try another search or filter.</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        )}

        {/* ── CENTER INTERACTIVE CANVAS STAGE ────────────────────────────── */}
        <div
          ref={containerRef}
          className="flex-1 h-full min-w-0 border border-[var(--editorial-rule)] bg-[var(--editorial-paper)] rounded relative overflow-hidden select-none"
          style={{ touchAction: "none" }}
        >
          {/* Canvas Transformable World */}
          <div
            ref={canvasRef}
            onWheel={handleWheel}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing canvas-bg-target"
            style={{
              backgroundImage: settingsState.showGrid
                ? "radial-gradient(circle at 1px 1px, var(--editorial-rule) 1.5px, transparent 0)"
                : "none",
              backgroundSize: settingsState.showGrid
                ? `${settingsState.gridSize * settingsState.zoom}px ${settingsState.gridSize * settingsState.zoom}px`
                : "none",
              backgroundPosition: `${settingsState.panX}px ${settingsState.panY}px`,
            }}
          >
            {/* Scaled & Translated Layer */}
            <div
              className="absolute inset-0 origin-top-left pointer-events-none"
              style={{
                transform: `translate(${settingsState.panX}px, ${settingsState.panY}px) scale(${settingsState.zoom})`,
              }}
            >
              {/* SVG Smooth Cubic Bezier Connecting Cables */}
              <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
                <defs>
                  <linearGradient id="wireGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--editorial-violet)" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
                  </linearGradient>
                  <marker
                    id="arrowhead"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                  >
                    <polygon points="0 0, 8 4, 0 8" fill="var(--editorial-violet)" />
                  </marker>
                </defs>

                {edges.map((e) => {
                  const fromNode = nodes.find((n) => n.id === e.from);
                  const toNode = nodes.find((n) => n.id === e.to);
                  if (!fromNode || !toNode) return null;

                  const startX = fromNode.x + (fromNode.width || settingsState.nodeWidth);
                  const startY = fromNode.y + 40;
                  const endX = toNode.x;
                  const endY = toNode.y + 40;

                  const dx = Math.abs(endX - startX) * 0.5;
                  const pathData = `M ${startX} ${startY} C ${startX + Math.max(dx, 40)} ${startY}, ${
                    endX - Math.max(dx, 40)
                  } ${endY}, ${endX} ${endY}`;

                  return (
                    <g key={e.id} className="pointer-events-auto group">
                      {/* Wider invisible stroke for easy clicking */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={16}
                        className="cursor-pointer"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          removeEdge(e.id);
                        }}
                      />
                      {/* Visible Cable */}
                      <path
                        d={pathData}
                        fill="none"
                        stroke={e.color || "url(#wireGradient)"}
                        strokeWidth={2.5}
                        strokeDasharray={
                          e.style === "dashed" ? "5 4" : e.style === "dotted" ? "2 3" : undefined
                        }
                        markerEnd="url(#arrowhead)"
                        className="transition-all duration-150 group-hover:stroke-[var(--editorial-coral)] group-hover:stroke-[3.5px]"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Node Cards */}
              {nodes.map((n) => {
                const kindMeta = KIND_META[n.kind] || KIND_META.prompt;
                const isSelected = selected === n.id;
                const isInMulti = multiSelect.has(n.id);
                const isGate = n.kind === "gate";
                const isImage = n.kind === "image";
                const isOutput = n.kind === "output";
                const nodeW = n.width || settingsState.nodeWidth;

                return (
                  <div
                    key={n.id}
                    onPointerDown={(e) => onPointerDownNode(e, n)}
                    onPointerMove={onPointerMoveNode}
                    onPointerUp={onPointerUpNode}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (connecting && connecting !== n.id) {
                        connectNodes(connecting, n.id);
                        setConnecting(null);
                      } else {
                        setSelected(n.id);
                      }
                    }}
                    onDoubleClick={() => {
                      if (isGate) toggleGate(n.id);
                    }}
                    className={`absolute rounded-lg border bg-[var(--editorial-paper)] pointer-events-auto select-none shadow-md transition-shadow duration-150 ${
                      isSelected
                        ? "ring-2 ring-[var(--editorial-violet)] shadow-xl"
                        : isInMulti
                        ? "ring-1 ring-[var(--editorial-violet)]/60"
                        : "hover:shadow-lg"
                    }`}
                    style={{
                      left: n.x,
                      top: n.y,
                      width: nodeW,
                      borderColor: n.color || kindMeta.color,
                      borderLeftWidth: "4px",
                    }}
                  >
                    {/* Left Input Port Handle */}
                    {!isGate && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          if (connecting && connecting !== n.id) {
                            connectNodes(connecting, n.id);
                            setConnecting(null);
                          }
                        }}
                        className={`absolute -left-2.5 top-9 w-4 h-4 rounded-full border-2 border-white bg-[var(--editorial-rule)] hover:scale-125 transition-transform cursor-pointer flex items-center justify-center ${
                          connecting && connecting !== n.id ? "bg-[var(--editorial-violet)] animate-bounce" : ""
                        }`}
                        title="Input wire target"
                      >
                        <span className="w-1 h-1 rounded-full bg-white" />
                      </div>
                    )}

                    {/* Right Output Port Handle */}
                    {!isOutput && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setConnecting(connecting === n.id ? null : n.id);
                        }}
                        className={`absolute -right-2.5 top-9 w-4 h-4 rounded-full border-2 border-white transition-transform hover:scale-125 cursor-pointer flex items-center justify-center ${
                          connecting === n.id
                            ? "bg-[var(--editorial-violet)] ring-2 ring-[var(--editorial-violet)]/40 scale-125"
                            : "bg-[var(--editorial-ink)]"
                        }`}
                        title="Drag / Click wire source"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                    )}

                    {/* Node Header */}
                    <div className="flex items-center justify-between p-2 border-b border-[var(--editorial-rule)] bg-[var(--editorial-surface)] rounded-t-lg">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-4 h-4 rounded flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                          style={{ backgroundColor: n.color || kindMeta.color }}
                        >
                          {n.icon || kindMeta.icon}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-[var(--editorial-ink)] truncate">
                          {n.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {n.weight && n.weight !== 1.0 && (
                          <span className="text-[8px] font-mono font-bold px-1 rounded bg-[var(--editorial-violet)]/10 text-[var(--editorial-violet)]">
                            {n.weight.toFixed(1)}x
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateNode(n.id);
                          }}
                          className="text-[var(--editorial-muted)] hover:text-[var(--editorial-ink)] p-0.5"
                          title="Duplicate node"
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNode(n.id);
                          }}
                          className="text-[var(--editorial-muted)] hover:text-red-500 p-0.5"
                          title="Delete node"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Node Body */}
                    <div className="p-2 space-y-1.5">
                      {isGate ? (
                        <div
                          onClick={() => toggleGate(n.id)}
                          className="py-1.5 px-2 bg-[var(--editorial-surface)] border border-[var(--editorial-coral)] text-center cursor-pointer rounded hover:bg-[var(--editorial-coral)]/10 transition-colors"
                        >
                          <span className="text-xs font-mono font-bold text-[var(--editorial-coral)]">
                            [ {n.text} GATE ]
                          </span>
                          <div className="text-[7.5px] font-mono text-[var(--editorial-muted)]">
                            Double click to cycle logic
                          </div>
                        </div>
                      ) : isOutput ? (
                        <div className="py-1.5 px-2 bg-emerald-500/10 border border-emerald-500/30 text-center rounded">
                          <span className="text-[9.5px] font-mono font-bold text-emerald-600">
                            ★ SYNTHESIZED DESTINATION
                          </span>
                        </div>
                      ) : (
                        <>
                          {isImage && (
                            <div className="space-y-1.5">
                              {n.imageUrl ? (
                                <div className="relative overflow-hidden rounded border border-[var(--editorial-rule)] bg-black/5">
                                  <img src={n.imageUrl} alt={n.imageName || "Visual reference"} className="h-24 w-full object-cover" />
                                  <span className={`absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[7px] font-mono font-bold uppercase ${n.imageStatus === "analyzing" ? "bg-amber-500 text-white" : n.imageStatus === "error" ? "bg-red-500 text-white" : "bg-emerald-600 text-white"}`}>
                                    {n.imageStatus === "analyzing" ? "Analyzing" : n.imageStatus === "error" ? "Needs review" : "Reference ready"}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex h-20 items-center justify-center rounded border border-dashed border-[var(--editorial-rule)] bg-[var(--editorial-surface)] px-2 text-center text-[8px] font-mono text-[var(--editorial-muted)]">
                                  Add a reference image, then connect this node to the visual trait it should guide.
                                </div>
                              )}
                              <label htmlFor={`image-upload-${n.id}`} className="flex cursor-pointer items-center justify-center gap-1 rounded border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] py-1 text-[8px] font-mono font-bold uppercase text-[var(--editorial-ink)] hover:border-[var(--editorial-pink)]">
                                <Upload className="h-2.5 w-2.5" />
                                {n.imageUrl ? "Replace image" : "Add image"}
                              </label>
                              <input
                                id={`image-upload-${n.id}`}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const imageUrl = URL.createObjectURL(file);
                                  if (n.imageUrl) URL.revokeObjectURL(n.imageUrl);
                                  updateNode(n.id, { imageUrl, imageName: file.name, imageStatus: "analyzing" });
                                  onImageUpload?.(n.id, file, (patch) => updateNode(n.id, patch));
                                  e.currentTarget.value = "";
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          )}
                          <textarea
                            value={n.text}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateNode(n.id, { text: val });
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            rows={isImage ? 3 : 2}
                            placeholder={isImage ? "Optional guidance: preserve this lighting, use this palette, match this composition..." : settingsState.placeholderText}
                            className="w-full text-[9.5px] font-mono p-1.5 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] rounded text-[var(--editorial-ink)] resize-none focus:outline-none focus:border-[var(--editorial-violet)] custom-scrollbar"
                          />
                        </>
                      )}

                      {/* Connect Indicator */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConnecting(connecting === n.id ? null : n.id);
                        }}
                        className={`w-full py-1 text-[8px] font-mono font-bold uppercase rounded border transition-colors flex items-center justify-center gap-1 ${
                          connecting === n.id
                            ? "bg-[var(--editorial-violet)] text-white border-[var(--editorial-violet)] animate-pulse"
                            : "bg-[var(--editorial-surface)] text-[var(--editorial-muted)] border-[var(--editorial-rule)] hover:border-[var(--editorial-violet)] hover:text-[var(--editorial-ink)]"
                        }`}
                      >
                        <Share2 className="w-2.5 h-2.5" />
                        <span>{connecting === n.id ? "Connecting Wire..." : "Connect Next"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Floating Radar MiniMap */}
          {settingsState.showMiniMap && (
            <MiniMap
              nodes={nodes}
              edges={edges}
              transform={{
                zoom: settingsState.zoom,
                panX: settingsState.panX,
                panY: settingsState.panY,
              }}
              settings={settingsState}
              onPan={(tx, ty) => {
                setSettingsState((s) => ({ ...s, panX: tx, panY: ty }));
              }}
            />
          )}

          {/* Floating Quick Hint Bar */}
          <div className="absolute bottom-3 left-3 z-20 hidden md:flex items-center gap-2 text-[8.5px] font-mono text-[var(--editorial-muted)] bg-[var(--editorial-paper)]/90 backdrop-blur border border-[var(--editorial-rule)] px-2.5 py-1 rounded shadow-sm">
            <span>💡 Wheel: Zoom · Drag bg: Pan · Click node port to wire · Del: Delete</span>
          </div>
        </div>

        {/* ── RIGHT DOCK: LIVE INSPECTOR & PROMPT TELEMETRY ─────────────── */}
        {showInspectorDock && (
          <aside className="w-64 xl:w-80 flex-shrink-0 flex flex-col border border-[var(--editorial-rule)] bg-[var(--editorial-surface)] rounded overflow-hidden z-20 shadow-sm animate-fade-in">
            {/* Dock Header */}
            <div className="flex items-center justify-between p-2.5 border-b border-[var(--editorial-rule)] bg-[var(--editorial-paper)]">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--editorial-ink)] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[var(--editorial-violet)]" />
                Live Node Inspector
              </span>
              {currentNode && (
                <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[var(--editorial-violet)]/10 text-[var(--editorial-violet)] font-bold">
                  {currentNode.kind.toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3.5 custom-scrollbar">
              {currentNode ? (
                <>
                  {/* Label & Accent Color */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[8.5px] font-mono text-[var(--editorial-muted)] uppercase">
                        Node Label & Accent
                      </label>
                      <CompactColorPicker
                        value={currentNode.color || KIND_META[currentNode.kind].color}
                        onChange={(c) => {
                          setNodes((prev) => {
                            const next = prev.map((n) =>
                              n.id === currentNode.id ? { ...n, color: c } : n
                            );
                            emit(next, edges);
                            return next;
                          });
                        }}
                      />
                    </div>
                    <input
                      type="text"
                      value={currentNode.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNodes((prev) => {
                          const next = prev.map((n) =>
                            n.id === currentNode.id ? { ...n, label: val } : n
                          );
                          emit(next, edges);
                          return next;
                        });
                      }}
                      className="w-full text-[10px] font-mono px-2 py-1 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] rounded text-[var(--editorial-ink)] focus:outline-none focus:border-[var(--editorial-violet)]"
                    />
                  </div>

                  {/* Weight Slider */}
                  {currentNode.kind !== "gate" && currentNode.kind !== "output" && (
                    <div className="space-y-1 bg-[var(--editorial-paper)] p-2 rounded border border-[var(--editorial-rule)]">
                      <div className="flex items-center justify-between text-[8.5px] font-mono">
                        <span className="text-[var(--editorial-muted)] uppercase">Emphasis Weight</span>
                        <span className="font-bold text-[var(--editorial-violet)]">
                          {(currentNode.weight || 1.0).toFixed(1)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.2"
                        max="2.0"
                        step="0.1"
                        value={currentNode.weight || 1.0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setNodes((prev) => {
                            const next = prev.map((n) =>
                              n.id === currentNode.id ? { ...n, weight: val } : n
                            );
                            emit(next, edges);
                            return next;
                          });
                        }}
                        className="w-full accent-[var(--editorial-violet)] cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Node Prompt Content */}
                  {currentNode.kind !== "output" && (
                    <div className="space-y-1">
                      <label className="text-[8.5px] font-mono text-[var(--editorial-muted)] uppercase">
                        Prompt Content
                      </label>
                      <textarea
                        rows={3}
                        value={currentNode.text}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNodes((prev) => {
                            const next = prev.map((n) =>
                              n.id === currentNode.id ? { ...n, text: val } : n
                            );
                            emit(next, edges);
                            return next;
                          });
                        }}
                        className="w-full text-[10px] font-mono p-2 bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] rounded text-[var(--editorial-ink)] focus:outline-none focus:border-[var(--editorial-violet)] custom-scrollbar"
                      />
                    </div>
                  )}

                  {/* Connected Wires */}
                  <div className="space-y-1.5 bg-[var(--editorial-paper)] p-2 rounded border border-[var(--editorial-rule)]">
                    <span className="text-[8.5px] font-mono text-[var(--editorial-muted)] uppercase block">
                      Connected Connections
                    </span>
                    {edges.filter((e) => e.from === currentNode.id || e.to === currentNode.id).length ===
                    0 ? (
                      <div className="text-[8.5px] font-mono text-[var(--editorial-muted)] italic">
                        No connected wires.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {edges
                          .filter((e) => e.from === currentNode.id || e.to === currentNode.id)
                          .map((e) => {
                            const isSource = e.from === currentNode.id;
                            const target = nodes.find((n) => n.id === (isSource ? e.to : e.from));
                            return (
                              <div
                                key={e.id}
                                className="flex items-center justify-between text-[8.5px] font-mono p-1 bg-[var(--editorial-surface)] rounded border border-[var(--editorial-rule)]"
                              >
                                <span>
                                  {isSource ? "→ to " : "← from "}
                                  <strong>{target?.label || "Node"}</strong>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeEdge(e.id)}
                                  className="text-red-500 hover:text-red-700 text-[8px]"
                                >
                                  ✕ Cut Wire
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => duplicateNode(currentNode.id)}
                      className="py-1.5 text-[9px] font-mono font-bold bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] rounded text-[var(--editorial-ink)] hover:border-[var(--editorial-violet)] transition-colors flex items-center justify-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Duplicate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeNode(currentNode.id)}
                      className="py-1.5 text-[9px] font-mono font-bold bg-red-500/10 border border-red-500/30 rounded text-red-600 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-4 text-center space-y-2 border border-dashed border-[var(--editorial-rule)] rounded bg-[var(--editorial-paper)]">
                  <Sliders className="w-6 h-6 text-[var(--editorial-muted)] mx-auto opacity-50" />
                  <div className="text-[10px] font-mono font-bold text-[var(--editorial-ink)]">
                    No Node Selected
                  </div>
                  <p className="text-[8.5px] font-mono text-[var(--editorial-muted)] leading-relaxed m-0">
                    Click on any node on the canvas to inspect properties, adjust weights, wire connections, or format styles.
                  </p>
                </div>
              )}

              {/* Execution Flow Breadcrumb */}
              <div className="space-y-1.5 pt-2 border-t border-[var(--editorial-rule)]">
                <span className="text-[8.5px] font-mono text-[var(--editorial-muted)] uppercase block">
                  Topological Graph Flow
                </span>
                <div className="flex flex-wrap gap-1">
                  {nodes
                    .filter((n) => n.kind !== "output")
                    .map((n, idx) => (
                      <span
                        key={n.id}
                        onClick={() => setSelected(n.id)}
                        className={`text-[8.5px] font-mono px-1.5 py-0.5 rounded cursor-pointer transition-all ${
                          selected === n.id
                            ? "bg-[var(--editorial-violet)] text-white font-bold"
                            : "bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] text-[var(--editorial-ink)] hover:border-[var(--editorial-violet)]"
                        }`}
                      >
                        {idx + 1}. {n.label}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* ── BOTTOM LIVE SYNTHESIZED SPECIMEN STRIP ────────────────────────── */}
      <div className="mt-2.5 p-2.5 bg-[var(--editorial-surface)] border border-[var(--editorial-rule)] rounded flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3 h-3 text-[var(--editorial-violet)]" />
            <span className="text-[9px] font-mono font-bold uppercase text-[var(--editorial-muted)]">
              Synthesized Prompt Specimen ({composed.length} Chars ·{" "}
              {composed.split(/\s+/).filter(Boolean).length} Words)
            </span>
          </div>
          <div className="text-[10.5px] font-mono text-[var(--editorial-ink)] bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] p-2 rounded truncate select-all">
            {composed || <span className="text-[var(--editorial-muted)] italic">— Compose graph nodes to synthesize prompt —</span>}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleCopyPrompt}
            disabled={!composed}
            className="px-3 py-2 text-[10px] font-mono font-bold bg-[var(--editorial-paper)] border border-[var(--editorial-rule)] text-[var(--editorial-ink)] hover:border-[var(--editorial-violet)] rounded flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            {copiedFeedback ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            <span>{copiedFeedback ? "Copied!" : "Copy"}</span>
          </button>

          <button
            type="button"
            onClick={() => onCompose?.(composed)}
            disabled={!composed}
            className="px-4 py-2 text-[10px] font-mono font-bold bg-[var(--editorial-ink)] text-[var(--editorial-paper)] rounded hover:bg-[var(--editorial-violet)] transition-colors shadow-sm disabled:opacity-40 flex items-center gap-1.5"
          >
            <Sparkle className="w-3 h-3 text-amber-400" />
            <span>Apply to Studio</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default InteractiveCanvas;
