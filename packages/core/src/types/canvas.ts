/**
 * Shared node-canvas domain types.
 *
 * These live in core (not the InteractiveCanvas component) so the preset
 * library (nodeCanvasLibrary.ts) can consume them without importing from the
 * UI layer, which would create a circular dependency.
 */

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
