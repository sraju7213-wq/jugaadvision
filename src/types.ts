export enum Platform {
  Natural = "Natural Language",
  Midjourney = "Midjourney v6.1",
  Flux = "Flux AI Pro",
  SDXL = "SDXL",
  DallE3 = "DALL-E 3",
  Video = "Video AI (Runway/Kling)",
}

export enum Workflow {
  Dashboard = "Dashboard",
  PromptBuilder = "Prompt Builder",
  ImageToPrompt = "Image to Prompt",
  BatchGenerator = "Batch Generator",
  QuickIdeas = "Quick Ideas Studio",
  PromptLibrary = "My Prompt Library",
  Help = "Help & Resources",
  CreativeMixer = "Creative Mixer",
}

export type Theme = "light" | "dark";

export type WorkflowFeature =
  | "prompt-builder"
  | "image-to-prompt"
  | "creative-mixer"
  | "batch-generator"
  | "pro-prompter"
  | "studio"
  | "general";

export type LifecycleState =
  | "idle"
  | "validating"
  | "queued"
  | "generating"
  | "validating_result"
  | "success"
  | "partial_success"
  | "cancelled"
  | "error";

export interface UniversalPromptRecord {
  id: string;
  text: string;
  title?: string;
  platform: Platform;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  // Deprecated: retained for reference-image migration; will remove after migration
  imageUrl?: string;
  negativePrompt?: string;
  sourceFeature?: WorkflowFeature | string;
  mode?: string;
  model?: string;
  structuredResult?: Record<string, any>;
  references?: Array<{ url?: string; base64?: string; mimeType?: string; name?: string }>;
  originalInput?: Record<string, any>;
  version?: number;
}

// Backward compatibility alias
export type Prompt = UniversalPromptRecord;

export interface TokenItem {
  id: string;
  text: string;
  weight?: number; // 1.0 = normal, 1.2 = emphasized, 0.8 = de-emphasized
  category?: "subject" | "environment" | "lighting" | "camera" | "style" | "medium" | "general";
}

export interface FormulaSlots {
  subject: string;
  environment: string;
  lighting: string;
  camera: string;
  style: string;
  renderEngine: string;
}

export interface PromptQualityReport {
  overallScore: number;
  grade: "S" | "A" | "B" | "C" | "D";
  metrics: {
    subjectClarity: number; // 0-100
    lightingDepth: number; // 0-100
    opticalCamera: number; // 0-100
    colorAtmosphere: number; // 0-100
    platformOptimization: number; // 0-100
  };
  strengths: string[];
  suggestions: {
    title: string;
    description: string;
    quickFixModifier?: string;
    slotTarget?: keyof FormulaSlots;
  }[];
}

export interface DissectedPrompt {
  subject: string;
  environment: string;
  lighting: string;
  camera: string;
  style: string;
  renderEngine: string;
  negativePrompt: string;
  parameters: {
    aspectRatio?: string;
    stylize?: number;
    chaos?: number;
    weird?: number;
    styleRaw?: boolean;
    tile?: boolean;
    quality?: number;
  };
  rawCleanPrompt: string;
}

export interface PromptVariationOption {
  title: string;
  prompt: string;
  description: string;
  persona: string;
}

