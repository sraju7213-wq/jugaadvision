export enum Platform {
  Natural = "Natural Language",
  Midjourney = "Midjourney v6.1",
  SDXL = "SDXL",
  Flux = "Flux AI Pro",
  DallE3 = "DALL-E 3",
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
