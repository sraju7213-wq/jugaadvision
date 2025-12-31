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
  GenerateImage = "Generate Images",
  ImageEditor = "Image Editor",
}

export type Theme = "light" | "dark";

export interface Prompt {
  id: string;
  text: string;
  platform: Platform;
  tags: string[];
  createdAt: string;
  imageUrl?: string;
}
