import type { CanvasEdge, CanvasNode } from "../components/prompt-builder/InteractiveCanvas";

export type NodeModePlatform = "midjourney" | "dalle" | "flux" | "sdxl" | "general";

export interface PromptDiagnostic {
  severity: "error" | "warning";
  message: string;
  nodeIds?: string[];
}

export interface PromptIR {
  subject: string[];
  scene: string[];
  style: string[];
  lighting: string[];
  camera: string[];
  modifiers: string[];
  exclusions: string[];
  technical: string[];
  references: string[];
  diagnostics: PromptDiagnostic[];
}

export interface CompiledNodePrompt {
  prompt: string;
  ir: PromptIR;
  diagnostics: PromptDiagnostic[];
}

const sectionRank: Record<string, number> = {
  prompt: 10,
  image: 15,
  style: 20,
  lighting: 30,
  camera: 40,
  modifier: 50,
  weighting: 60,
  gate: 70,
  output: 999,
};

const normalize = (value: string) => value.trim().replace(/\s+/g, " ");

const isNegativeLabel = (node: CanvasNode) =>
  /negative|exclude|no-go|avoid/i.test(`${node.label} ${node.text}`);

const isTechnicalLabel = (node: CanvasNode) =>
  /technical|aspect|ratio|seed|stylize|platform|parameter/i.test(`${node.label} ${node.text}`);

const isEnabled = (node: CanvasNode) =>
  (node as CanvasNode & { enabled?: boolean }).enabled !== false;

function upstreamOrder(nodes: CanvasNode[], edges: CanvasEdge[]): { nodes: CanvasNode[]; diagnostics: PromptDiagnostic[] } {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const predecessors = new Map<string, string[]>();
  const output = nodes.find((node) => node.kind === "output");
  const reachable = new Set<string>();
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const diagnostics: PromptDiagnostic[] = [];

  edges.forEach((edge) => {
    const current = predecessors.get(edge.to) ?? [];
    current.push(edge.from);
    predecessors.set(edge.to, current);
  });

  const walk = (id: string) => {
    if (visiting.has(id)) {
      diagnostics.push({ severity: "error", message: "The graph contains a cycle.", nodeIds: [id] });
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    reachable.add(id);
    (predecessors.get(id) ?? []).forEach(walk);
    visiting.delete(id);
    visited.add(id);
  };

  if (output) {
    walk(output.id);
  } else {
    nodes.filter((node) => node.kind !== "output").forEach((node) => reachable.add(node.id));
    diagnostics.push({ severity: "warning", message: "No Output node is present; using all visible nodes." });
  }

  const ordered = nodes
    .filter((node) => node.kind !== "output" && reachable.has(node.id) && isEnabled(node))
    .sort((left, right) => {
      const rankDiff = (sectionRank[left.kind] ?? 80) - (sectionRank[right.kind] ?? 80);
      return rankDiff || left.x - right.x || left.y - right.y || left.id.localeCompare(right.id);
    });

  const disconnected = nodes.filter((node) => node.kind !== "output" && isEnabled(node) && !reachable.has(node.id));
  if (disconnected.length) {
    diagnostics.push({
      severity: "warning",
      message: `${disconnected.length} enabled node${disconnected.length === 1 ? " is" : "s are"} disconnected from Output.`,
      nodeIds: disconnected.map((node) => node.id),
    });
  }

  return { nodes: ordered, diagnostics };
}

export function buildPromptIR(nodes: CanvasNode[], edges: CanvasEdge[]): PromptIR {
  const diagnostics: PromptDiagnostic[] = [];
  const ir: PromptIR = {
    subject: [],
    scene: [],
    style: [],
    lighting: [],
    camera: [],
    modifiers: [],
    exclusions: [],
    technical: [],
    references: [],
    diagnostics,
  };

  const ordered = upstreamOrder(nodes, edges);
  diagnostics.push(...ordered.diagnostics);
  const imageNodes = nodes.filter((node) => node.kind === "image" && isEnabled(node));
  imageNodes.forEach((node) => {
    const outgoing = edges.filter((edge) => edge.from === node.id);
    if (!node.imageUrl) {
      diagnostics.push({ severity: "warning", message: `${node.label || "Image reference"} has no image yet.`, nodeIds: [node.id] });
    } else if (!outgoing.length) {
      diagnostics.push({ severity: "warning", message: `Connect ${node.label || "this image reference"} to a subject, style, lighting, or output node so it can guide the prompt.`, nodeIds: [node.id] });
    }
  });
  ordered.nodes.forEach((node) => {
    const text = normalize(node.text || "");
    if (!text) {
      diagnostics.push({ severity: "warning", message: `${node.label || "A node"} is empty.`, nodeIds: [node.id] });
      return;
    }

    if (node.kind === "image") {
      const analysis = node.imageAnalysis;
      if (analysis?.subject) ir.subject.push(`reference subject: ${normalize(analysis.subject)}`);
      if (analysis?.composition) ir.scene.push(`reference composition: ${normalize(analysis.composition)}`);
      if (analysis?.lighting) ir.lighting.push(`reference lighting: ${normalize(analysis.lighting)}`);
      if (analysis?.style) ir.style.push(`reference style: ${normalize(analysis.style)}`);
      if (analysis?.colors) ir.style.push(`reference palette: ${normalize(analysis.colors)}`);
      if (analysis?.negativePrompt) ir.exclusions.push(normalize(analysis.negativePrompt));
      if (text && !/^upload a visual reference/i.test(text)) ir.references.push(text);
      return;
    }

    if (isNegativeLabel(node) || node.kind === "gate" && /^not$/i.test(text)) {
      ir.exclusions.push(text.replace(/^not\s*/i, ""));
      return;
    }
    if (isTechnicalLabel(node)) {
      ir.technical.push(text);
      return;
    }

    const weighted = node.weight && node.weight !== 1 ? `${text}::${node.weight.toFixed(1)}` : text;
    switch (node.kind) {
      case "prompt":
        if (/scene|environment|setting|context/i.test(node.label)) ir.scene.push(weighted);
        else ir.subject.push(weighted);
        break;
      case "style":
        ir.style.push(weighted);
        break;
      case "lighting":
        ir.lighting.push(weighted);
        break;
      case "camera":
        ir.camera.push(weighted);
        break;
      case "modifier":
      case "weighting":
        ir.modifiers.push(weighted);
        break;
      case "gate":
        if (!/^and$|^or$|^blend$/i.test(text)) ir.modifiers.push(weighted);
        break;
      default:
        ir.modifiers.push(weighted);
    }
  });

  if (!ir.subject.length && !ir.scene.length) {
    diagnostics.push({ severity: "error", message: "Add a subject or scene node before generating." });
  }

  return ir;
}

function renderCanonical(ir: PromptIR): string {
  return [
    ...ir.subject,
    ...ir.scene,
    ...ir.style,
    ...ir.lighting,
    ...ir.camera,
    ...ir.modifiers,
  ].filter(Boolean).join(", ");
}

export function renderNodePrompt(ir: PromptIR, platform: NodeModePlatform): string {
  const canonical = renderCanonical(ir);
  const exclusions = ir.exclusions.filter(Boolean).join(", ");
  const technical = ir.technical.filter(Boolean).join(", ");
  const references = ir.references.filter(Boolean).join(", ");

  switch (platform) {
    case "midjourney": {
      const suffix = [technical, references ? `reference guidance: ${references}` : "", exclusions ? `--no ${exclusions}` : ""].filter(Boolean).join(" ");
      return `/imagine prompt: ${canonical}${suffix ? ` ${suffix}` : ""}`.trim();
    }
    case "dalle":
      return [
        "Create an image with the following direction:",
        `Subject and scene: ${[...ir.subject, ...ir.scene].join(", ") || "not specified"}`,
        `Style and finish: ${[...ir.style, ...ir.modifiers].join(", ") || "not specified"}`,
        `Lighting and camera: ${[...ir.lighting, ...ir.camera].join(", ") || "not specified"}`,
        technical ? `Technical constraints: ${technical}` : "",
        references ? `Reference guidance: ${references}` : "",
        exclusions ? `Do not include: ${exclusions}` : "",
      ].filter(Boolean).join("\n").trim();
    case "sdxl":
      return `${[...ir.modifiers, ...ir.subject, ...ir.scene, ...ir.style, ...ir.lighting, ...ir.camera, ...ir.references].join(", ")}\n\nNegative prompt: ${exclusions || "none"}`.trim();
    case "flux":
      return `${canonical}${technical ? `, ${technical}` : ""}${references ? `, reference guidance: ${references}` : ""}${exclusions ? `. Avoid ${exclusions}.` : ""}`.trim();
    default:
      return `${canonical}${technical ? `, ${technical}` : ""}${references ? `, reference guidance: ${references}` : ""}${exclusions ? `, avoid ${exclusions}` : ""}`.trim();
  }
}

export function compileNodePrompt(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  platform: NodeModePlatform = "general",
): CompiledNodePrompt {
  const ir = buildPromptIR(nodes, edges);
  return { prompt: renderNodePrompt(ir, platform), ir, diagnostics: ir.diagnostics };
}
