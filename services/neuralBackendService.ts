import { aiGenerateStructured, aiAnalyzeVision } from "./aiGatewayClient";
import { CinematicPrompt, CinematicPromptSchema, constructPrompt } from "../lib/schemas/cinematicPrompt";
import {
    ProfessionalPrompt,
    ProfessionalPromptSchema,
    constructProfessionalPrompt,
    getPromptSummary
} from "../lib/schemas/professionalPrompt";
import {
    BannerPrompt,
    BannerPromptSchema,
    constructBannerPrompt,
    getBannerPromptSummary
} from "../lib/schemas/bannerPrompt";

export interface NeuralBackendResult {
    success: boolean;
    data: CinematicPrompt | null;
    error: string | null;
}

export const generateCinematicPrompt = async (
    prompt: string,
    style: string,
    mood: string,
    imageContext?: string,
    onStatus?: (status: string) => void
): Promise<NeuralBackendResult> => {
    try {
        onStatus?.("Initializing Neural Backend...");
        const systemPrompt = `You are an expert Visual Alchemist and Prompt Engineer.
Your task is to convert the user's concept into a structured, high-fidelity image generation prompt.

User Concept: "${prompt}"
Target Style: "${style || 'Cinematic'}"
Mood: "${mood || 'Dynamic'}"
${imageContext ? `Visual Reference Context: ${imageContext}` : ''}

Output valid JSON adhering to the CinematicPrompt schema with subject, cinematography, artistic, and technical fields.`;

        onStatus?.("Generating structured prompt...");
        const res = await aiGenerateStructured<CinematicPrompt>({
            systemPrompt,
            userInput: prompt,
            taskType: 'structured_json',
        });

        const parsed = res.result;
        const validation = CinematicPromptSchema.safeParse(parsed);

        onStatus?.("Complete!");
        return {
            success: true,
            data: validation.success ? validation.data : (parsed || null),
            error: null
        };
    } catch (error: any) {
        console.error("Neural Backend failed:", error);
        return {
            success: false,
            data: null,
            error: error.message || "Unknown error"
        };
    }
};

export const generateCinematicFromImages = async (
    prompt: string,
    images: { base64: string; mimeType: string }[],
    style: string,
    mood: string,
    onStatus?: (status: string) => void
): Promise<NeuralBackendResult> => {
    try {
        onStatus?.("Analyzing reference images...");
        let imageContext = "";
        if (images.length > 0) {
            const visionRes = await aiAnalyzeVision({
                prompt: "Analyze the composition, colors, subjects, and style of this image for reference context.",
                imageBase64: images[0].base64,
                mimeType: images[0].mimeType,
            });
            imageContext = visionRes.result;
        }

        return await generateCinematicPrompt(prompt, style, mood, imageContext, onStatus);
    } catch (error: any) {
        return {
            success: false,
            data: null,
            error: error.message || "Unknown error"
        };
    }
};

export interface ProfessionalBackendResult {
    success: boolean;
    data: ProfessionalPrompt | null;
    constructedPrompt: string | null;
    summary: Record<string, string> | null;
    error: string | null;
}

export const generateProfessionalPrompt = async (
    concept: string,
    purpose: string,
    style: string,
    platform: 'midjourney' | 'dalle' | 'flux' | 'sdxl' | 'general' = 'general',
    onStatus?: (status: string) => void,
    userOverrides?: Partial<ProfessionalPrompt>
): Promise<ProfessionalBackendResult> => {
    try {
        onStatus?.("Initializing Professional Backend...");
        const systemPrompt = `You are an ELITE Commercial Photography Art Director and Prompt Engineer.
Convert the user's concept into a PROFESSIONAL, SELLABLE structured prompt.

Concept: "${concept}"
Purpose: "${purpose || 'product'}"
Style: "${style || 'Commercial'}"
Platform: "${platform}"

Output valid JSON for ProfessionalPrompt with scene, composition, camera, lighting, color_grading, materials, subject, mood, and post_processing.`;

        onStatus?.("Generating prompt...");
        const res = await aiGenerateStructured<ProfessionalPrompt>({
            systemPrompt,
            userInput: concept,
            taskType: 'structured_json',
        });

        let data = res.result;
        if (userOverrides) {
            data = { ...data, ...userOverrides };
        }

        const constructed = constructProfessionalPrompt(data, platform);
        const summary = getPromptSummary(data);

        onStatus?.("Ready!");
        return {
            success: true,
            data,
            constructedPrompt: constructed,
            summary,
            error: null
        };
    } catch (error: any) {
        return {
            success: false,
            data: null,
            constructedPrompt: null,
            summary: null,
            error: error.message || "Failed to generate professional prompt"
        };
    }
};

export const generateProfessionalFromImages = async (
    concept: string,
    images: { base64: string; mimeType: string }[],
    purpose: string,
    style: string,
    platform: 'midjourney' | 'dalle' | 'flux' | 'sdxl' | 'general' = 'general',
    onStatus?: (status: string) => void,
    userOverrides?: Partial<ProfessionalPrompt>
): Promise<ProfessionalBackendResult> => {
    try {
        let imageContext = "";
        if (images.length > 0) {
            const vision = await aiAnalyzeVision({
                prompt: "Extract camera, lighting, materials, and composition details from this photo.",
                imageBase64: images[0].base64,
                mimeType: images[0].mimeType,
            });
            imageContext = vision.result;
        }

        const fullConcept = `${concept}. Reference details: ${imageContext}`;
        return await generateProfessionalPrompt(fullConcept, purpose, style, platform, onStatus, userOverrides);
    } catch (error: any) {
        return {
            success: false,
            data: null,
            constructedPrompt: null,
            summary: null,
            error: error.message || "Failed to analyze reference images"
        };
    }
};

export interface BannerBackendResult {
    success: boolean;
    data: BannerPrompt | null;
    constructedPrompt: string | null;
    summary: Record<string, string> | null;
    error: string | null;
}

export const generateBannerPrompt = async (
    concept: string,
    environmentOrPlatform: string = 'studio',
    moodOrIndustry: string = 'professional',
    aspectRatioOrAesthetic: string = '16:9',
    negativeSpace?: string,
    platform: 'midjourney' | 'dalle' | 'flux' | 'sdxl' | 'general' = 'general',
    onStatus?: (status: string) => void,
    userOverrides?: Partial<BannerPrompt>
): Promise<BannerBackendResult> => {
    try {
        onStatus?.("Initializing Banner Generator...");
        const targetPlatform = platform || 'general';
        const environment = environmentOrPlatform || 'studio';
        const mood = moodOrIndustry || 'professional';
        const targetAspectRatio = ['1:1', '4:5', '16:9', '9:16'].includes(aspectRatioOrAesthetic) ? aspectRatioOrAesthetic : '16:9';
        const negSpace = negativeSpace || 'right';

        const systemPrompt = `You are a World-Class Graphic Designer and Commercial Banner Specialist.
Convert the user's concept into a structured BannerPrompt JSON adhering to the PPA schema:

User Product Concept: "${concept}"
Target Setting: ${environment}
Mood: ${mood}
Aspect Ratio: ${targetAspectRatio}
Negative Space Position: ${negSpace} (leave room for CTA and copy)
Target Platform: ${targetPlatform}

SCHEMA:
{
  "subject": {
    "product_name": "string",
    "product_form": "string",
    "material_composition": "string",
    "surface_texture": "string",
    "key_features": ["string"],
    "token_weight": 1.5
  },
  "context": {
    "environment": "studio|lifestyle|urban|natural|abstract|minimalist|luxury",
    "background_type": "seamless_white|seamless_black|gradient|textured_wall|marble_surface|wooden_table|natural_scenery|bokeh|solid_color",
    "lighting": "studio_high_key|studio_low_key|natural_daylight|golden_hour|blue_hour|dramatic_side|soft_diffused|cinematic|rim_lit"
  },
  "style": {
    "medium": "photorealistic|3d_render|product_visualization|editorial|commercial_photography|lifestyle_photography|high_fashion",
    "quality_terms": ["4K", "ultra_detailed"],
    "mood": "luxury|minimal|bold|elegant|playful|professional|warm|cool|energetic|calm|sophisticated|organic"
  },
  "technical": {
    "aspect_ratio": "${targetAspectRatio}",
    "negative_space_position": "${negSpace}",
    "negative_space_amount": "generous",
    "platform": "${targetPlatform}"
  }
}

Return valid JSON only.`;

        onStatus?.("Generating banner design...");
        const res = await aiGenerateStructured<BannerPrompt>({
            systemPrompt,
            userInput: concept,
            taskType: 'structured_json',
        });

        let data = res.result;
        if (userOverrides) {
            data = { ...data, ...userOverrides };
        }

        // Ensure baseline fields exist
        if (!data?.subject) {
            data = {
                subject: {
                    product_name: concept.slice(0, 80),
                    product_form: 'commercial product packaging',
                    material_composition: 'premium finish',
                    surface_texture: 'smooth pristine',
                    key_features: ['high quality', 'hero lighting'],
                    token_weight: 1.5,
                },
                context: {
                    environment: (environment as any) || 'studio',
                    background_type: 'gradient' as any,
                    lighting: 'studio_high_key' as any,
                },
                style: {
                    medium: 'commercial_photography' as any,
                    quality_terms: ['4K', 'ultra_detailed'] as any,
                    mood: (mood as any) || 'professional',
                },
                technical: {
                    aspect_ratio: (targetAspectRatio as any) || '16:9',
                    negative_space_position: (negSpace as any) || 'right',
                    negative_space_amount: 'generous' as any,
                    platform: targetPlatform as any,
                },
            };
        }

        const constructed = constructBannerPrompt(data, targetPlatform);
        const summary = getBannerPromptSummary(data);

        onStatus?.("Complete!");
        return {
            success: true,
            data,
            constructedPrompt: constructed,
            summary,
            error: null
        };
    } catch (error: any) {
        console.error("Banner generation error:", error);
        return {
            success: false,
            data: null,
            constructedPrompt: null,
            summary: null,
            error: error.message || "Failed to generate banner prompt"
        };
    }
};

export const generateBannerFromImages = async (
    concept: string,
    images: { base64: string; mimeType: string }[],
    environmentOrPlatform: string = 'studio',
    moodOrIndustry: string = 'professional',
    aspectRatioOrAesthetic: string = '16:9',
    negativeSpace?: string,
    platform: 'midjourney' | 'dalle' | 'flux' | 'sdxl' | 'general' = 'general',
    onStatus?: (status: string) => void
): Promise<BannerBackendResult> => {
    try {
        let imageContext = "";
        if (images.length > 0) {
            const vision = await aiAnalyzeVision({
                prompt: "Analyze the product, materials, colors, and layout of this banner reference.",
                imageBase64: images[0].base64,
                mimeType: images[0].mimeType,
            });
            imageContext = vision.result;
        }

        const fullConcept = `${concept}. Reference Visual Details: ${imageContext}`;
        return await generateBannerPrompt(
            fullConcept,
            environmentOrPlatform,
            moodOrIndustry,
            aspectRatioOrAesthetic,
            negativeSpace,
            platform,
            onStatus
        );
    } catch (error: any) {
        return {
            success: false,
            data: null,
            constructedPrompt: null,
            summary: null,
            error: error.message || "Failed to analyze banner reference images"
        };
    }
};

