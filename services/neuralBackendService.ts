import { GoogleGenAI, GenerateContentResponse, Type, Schema } from "@google/genai";
import { executeWithRetry, PRIMARY_MODEL, STRUCTURED_MODEL, FALLBACK_MODEL } from "./apiKeyManager";
import { CinematicPrompt, CinematicPromptSchema } from "../lib/schemas/cinematicPrompt";
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

// Convert Zod schema to Google GenAI schema format
const cinematicSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        subject: {
            type: Type.OBJECT,
            properties: {
                core: { type: Type.STRING, description: "The main subject of the image" },
                action: { type: Type.STRING, description: "What is the subject doing?" },
                attire: { type: Type.STRING, description: "Detailed clothing description", nullable: true }
            },
            required: ["core", "action"]
        },
        cinematography: {
            type: Type.OBJECT,
            properties: {
                lighting: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                        enum: ['rembrandt', 'volumetric', 'chiaroscuro', 'bioluminescent', 'neon_noir', 'natural_diffused', 'studio_lighting', 'cinematic_haze']
                    },
                    description: "Select 1-3 lighting types"
                },
                camera_angle: {
                    type: Type.STRING,
                    enum: ['eye_level', 'low_angle', 'high_angle', 'dutch_angle', 'macro', 'drone_view', 'wide_shot']
                },
                film_stock: {
                    type: Type.STRING,
                    enum: ['Kodak Portra 400', 'Fujifilm Velvia', 'IMAX 70mm', 'Polaroid', 'Digital', '35mm']
                },
                lens: {
                    type: Type.STRING,
                    enum: ['35mm', '85mm', 'wide_angle', 'telephoto', 'macro_lens']
                }
            },
            required: ["lighting", "camera_angle", "film_stock", "lens"]
        },
        artistic: {
            type: Type.OBJECT,
            properties: {
                style: { type: Type.STRING, description: "The specific art style" },
                mood: { type: Type.STRING, description: "The emotional atmosphere" }
            },
            required: ["style", "mood"]
        },
        technical: {
            type: Type.OBJECT,
            properties: {
                aspect_ratio: {
                    type: Type.STRING,
                    enum: ['16:9', '9:16', '1:1', '2.39:1']
                },
                stylize: { type: Type.NUMBER, description: "Stylization value 0-1000" },
                negative_prompt: { type: Type.STRING, description: "Elements to exclude" }
            },
            required: ["aspect_ratio", "stylize", "negative_prompt"]
        }
    },
    required: ["subject", "cinematography", "artistic", "technical"]
};

// Helper for timeout
const timeout = (ms: number) => new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), ms)
);

const withTimeout = <T>(promise: Promise<T>, ms: number = 30000): Promise<T> => {
    return Promise.race([promise, timeout(ms)]) as Promise<T>;
};

export interface NeuralBackendResult {
    success: boolean;
    data: CinematicPrompt | null;
    error: string | null;
}

/**
 * Neural Backend: Generate structured CinematicPrompt using Gemini's JSON mode
 * This is the high-performance replacement for the old Creative Mixer
 */
export const generateCinematicPrompt = async (
    prompt: string,
    style: string,
    mood: string,
    imageContext?: string,
    onStatus?: (status: string) => void
): Promise<NeuralBackendResult> => {
    try {
        return await executeWithRetry('structured_json', async (ai) => {
            onStatus?.("Initializing Neural Backend...");
            // Notice: We don't need createAIClient here, 'ai' is provided by executeWithRetry

            const systemPrompt = `You are an expert Visual Alchemist and Prompt Engineer.
Your task is to convert the user's concept into a structured, high-fidelity image generation prompt.

User Concept: "${prompt}"
Target Style: "${style || 'Cinematic'}"
Mood: "${mood || 'Dynamic'}"
${imageContext ? `Visual Reference Context: ${imageContext}` : ''}

RULES:
1. Do NOT just copy the user input. Hallucinate specific details (lighting, camera, attire) that fit the Style.
2. If the user input is vague, fill in the blanks creatively.
3. Ensure the 'lighting' and 'camera_angle' fields strictly match the allowed Enums.
4. Be creative with the subject description - add vivid sensory details.
5. Choose lighting that enhances the mood.
6. Select appropriate film_stock and lens for the desired aesthetic.`;

            onStatus?.("Generating structured prompt...");

            const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
                model: STRUCTURED_MODEL, // Full flash model for JSON schema support
                contents: systemPrompt + "\n\nGenerate the cinematic prompt structure now.",
                config: {
                    temperature: 0.7, // High creativity
                    responseMimeType: "application/json",
                    responseSchema: cinematicSchema,
                },
            }), 30000);

            const jsonText = response.text?.trim();
            if (!jsonText) {
                throw new Error("No response from Neural Backend");
            }

            onStatus?.("Parsing response...");
            const parsed = JSON.parse(jsonText) as CinematicPrompt;

            // Validate with Zod schema
            const validation = CinematicPromptSchema.safeParse(parsed);
            if (!validation.success) {
                console.warn("Schema validation warnings:", validation.error);
                // Still return the data even if there are minor validation issues
            }

            onStatus?.("Complete!");
            return {
                success: true,
                data: parsed,
                error: null
            };
        });
    } catch (error: any) {
        console.error("Neural Backend failed:", error);
        return {
            success: false,
            data: null,
            error: error.message || "Unknown error"
        };
    }
};

/**
 * Neural Backend with image context: Analyze images and generate structured prompt
 */
export const generateCinematicFromImages = async (
    prompt: string,
    images: { base64: string; mimeType: string }[],
    style: string,
    mood: string,
    onStatus?: (status: string) => void
): Promise<NeuralBackendResult> => {
    try {
        return await executeWithRetry('structured_json', async (ai) => {
            onStatus?.("Analyzing reference images...");

            const imageParts = images.map((img, i) => ({
                inlineData: {
                    data: img.base64,
                    mimeType: img.mimeType,
                }
            }));

            let imageInstructions = "";
            if (images.length >= 1) imageInstructions += "- Image 1: Use for Composition/Structure\n";
            if (images.length >= 2) imageInstructions += "- Image 2: Use for Art Style/Texture\n";
            if (images.length >= 3) imageInstructions += "- Image 3: Use for Lighting/Color Palette\n";

            const systemPrompt = `You are an expert Visual Alchemist and Prompt Engineer.
Analyze the provided reference images and synthesize them with the user's concept into a structured prompt.

User Concept: "${prompt || 'Synthesize a cohesive scene from the reference images'}"
Target Style: "${style || 'Creative Mix'}"
Mood: "${mood || 'Dynamic'}"

IMAGE REFERENCE ROLES:
${imageInstructions}

RULES:
1. Extract composition cues from Image 1, style cues from Image 2, and lighting/color from Image 3.
2. Merge these visual elements with the user's concept creatively.
3. Do NOT describe the reference images literally - use them as inspiration.
4. Generate a unique, vivid scene that captures the essence of all inputs.`;

            onStatus?.("Generating structured prompt from images...");

            const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
                model: STRUCTURED_MODEL,
                contents: {
                    parts: [
                        ...imageParts,
                        { text: systemPrompt + "\n\nGenerate the cinematic prompt structure now." }
                    ]
                },
                config: {
                    temperature: 0.8,
                    responseMimeType: "application/json",
                    responseSchema: cinematicSchema,
                },
            }), 45000);

            const jsonText = response.text?.trim();
            if (!jsonText) {
                throw new Error("No response from Neural Backend");
            }

            onStatus?.("Complete!");
            const parsed = JSON.parse(jsonText) as CinematicPrompt;

            return {
                success: true,
                data: parsed,
                error: null
            };
        });
    } catch (error: any) {
        console.error("Neural Backend (images) failed:", error);
        return {
            success: false,
            data: null,
            error: error.message || "Unknown error"
        };
    }
};

// ============================================================================
// PROFESSIONAL 15-LAYER PROMPT GENERATION
// ============================================================================

// Deep merge helper for overrides
const mergeOverrides = (target: any, source: any) => {
    if (!source) return target;
    const result = { ...target };
    Object.keys(source).forEach(key => {
        const value = source[key];
        if (value === undefined || value === null) return;

        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = mergeOverrides(target[key] || {}, value);
        } else {
            result[key] = value;
        }
    });
    return result;
};

// Convert Professional Zod schema to Google GenAI schema format
const professionalSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        image_purpose: {
            type: Type.STRING,
            enum: ['product', 'portrait', 'lifestyle', 'editorial', 'concept_art', 'still_life', 'fashion', 'architectural', 'food', 'landscape']
        },
        scene: {
            type: Type.OBJECT,
            properties: {
                environment: {
                    type: Type.STRING,
                    enum: ['studio', 'interior', 'exterior', 'on_location', 'abstract', 'underwater', 'aerial']
                },
                background: {
                    type: Type.OBJECT,
                    properties: {
                        material: { type: Type.STRING, description: "Background material (e.g., 'seamless paper', 'textured concrete')" },
                        tone: { type: Type.STRING, enum: ['neutral-warm', 'neutral-cool', 'vivid', 'dark', 'white', 'gradient', 'natural'] },
                        texture: { type: Type.STRING, enum: ['clean', 'textured', 'aged', 'seamless', 'bokeh', 'environmental'] }
                    },
                    required: ["material", "tone", "texture"]
                },
                surface: {
                    type: Type.OBJECT,
                    properties: {
                        material: { type: Type.STRING, description: "What subject sits on" },
                        finish: { type: Type.STRING, enum: ['matte', 'satin', 'glossy', 'rough', 'natural', 'reflective'] }
                    },
                    nullable: true
                }
            },
            required: ["environment", "background"]
        },
        composition: {
            type: Type.OBJECT,
            properties: {
                framing: { type: Type.STRING, enum: ['horizontal', 'vertical', 'square', 'panoramic', 'cinematic_wide'] },
                camera_height: { type: Type.STRING, enum: ['eye-level', 'slightly-above', 'slightly-below', 'bird-eye', 'worm-eye', 'dutch-angle'] },
                negative_space: { type: Type.STRING, enum: ['tight', 'medium', 'airy', 'minimal', 'expansive'] },
                arrangement: { type: Type.STRING, enum: ['hero-center', 'rule-of-thirds', 'golden-ratio', 'symmetrical', 'asymmetric', 'diagonal', 'pyramid', 'scattered', 'layered'] }
            },
            required: ["framing", "camera_height", "negative_space", "arrangement"]
        },
        camera: {
            type: Type.OBJECT,
            properties: {
                focal_length_mm: { type: Type.NUMBER, description: "Lens focal length (35-200mm)" },
                aperture_f: { type: Type.NUMBER, description: "F-stop value (1.4-16)" },
                lens_type: { type: Type.STRING, enum: ['prime', 'zoom', 'macro', 'tilt-shift', 'anamorphic', 'fisheye', 'telephoto'] },
                focus_strategy: { type: Type.STRING, description: "Focus description" }
            },
            required: ["focal_length_mm", "aperture_f", "lens_type", "focus_strategy"]
        },
        lighting: {
            type: Type.OBJECT,
            properties: {
                primary: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING, enum: ['natural', 'strobe', 'continuous', 'softbox', 'ring_light', 'led_panel', 'practical', 'mixed', 'neon', 'candle', 'window'] },
                        direction: { type: Type.STRING, enum: ['front', 'left-45', 'right-45', 'left-90', 'right-90', 'back', 'top', 'bottom', 'rim'] },
                        quality: { type: Type.STRING, enum: ['diffused', 'soft', 'hard', 'dramatic', 'flat', 'contrasty', 'ethereal'] }
                    },
                    required: ["type", "direction", "quality"]
                },
                secondary: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING },
                        position: { type: Type.STRING }
                    },
                    nullable: true
                },
                color_temperature: { type: Type.STRING, enum: ['neutral', 'warm', 'cool', 'golden_hour', 'blue_hour', 'tungsten', 'daylight', 'mixed'] },
                shadow_behavior: { type: Type.STRING, enum: ['soft-edge', 'defined', 'long', 'minimal', 'dramatic', 'fill-light', 'natural'] }
            },
            required: ["primary", "color_temperature", "shadow_behavior"]
        },
        color_grading: {
            type: Type.OBJECT,
            properties: {
                palette: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 key colors" },
                warmth: { type: Type.STRING, enum: ['cool', 'neutral', 'warm', 'split-tone'] },
                saturation: { type: Type.STRING, enum: ['muted', 'natural', 'vivid', 'desaturated', 'black_and_white', 'selective'] }
            },
            required: ["palette", "warmth", "saturation"]
        },
        materials: {
            type: Type.OBJECT,
            properties: {
                primary: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Main materials visible" },
                texture_notes: { type: Type.STRING, description: "Tactile details" },
                imperfections: {
                    type: Type.OBJECT,
                    properties: {
                        include: { type: Type.BOOLEAN },
                        types: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ["include", "types"]
                }
            },
            required: ["primary", "texture_notes", "imperfections"]
        },
        subject: {
            type: Type.OBJECT,
            properties: {
                category: { type: Type.STRING, description: "What the subject is" },
                pose_or_orientation: { type: Type.STRING, description: "How subject is positioned" },
                features: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Key visual features" },
                condition: { type: Type.STRING, description: "State of subject" }
            },
            required: ["category", "pose_or_orientation", "features", "condition"]
        },
        mood: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3-5 emotional keywords" },
        post_processing: {
            type: Type.OBJECT,
            properties: {
                grain: { type: Type.STRING, enum: ['none', 'subtle', 'medium', 'heavy', 'film', 'digital_noise'] },
                authenticity: { type: Type.STRING, description: "Finishing notes" },
                output_ratio: { type: Type.STRING, enum: ['1:1', '4:5', '3:4', '2:3', '9:16', '16:9', '2.39:1', '21:9'] }
            },
            required: ["grain", "authenticity", "output_ratio"]
        }
    },
    required: ["image_purpose", "scene", "composition", "camera", "lighting", "color_grading", "materials", "subject", "mood", "post_processing"]
};

export interface ProfessionalBackendResult {
    success: boolean;
    data: ProfessionalPrompt | null;
    constructedPrompt: string | null;
    summary: Record<string, string> | null;
    error: string | null;
}

/**
 * Professional Backend: Generate structured 15-layer prompt for sellable AI images
 * Based on TeamCal AI methodology for commercial-quality outputs
 */
export const generateProfessionalPrompt = async (
    concept: string,
    purpose: string,
    style: string,
    platform: 'midjourney' | 'dalle' | 'flux' | 'sdxl' | 'general' = 'general',
    onStatus?: (status: string) => void,
    userOverrides?: Partial<ProfessionalPrompt>
): Promise<ProfessionalBackendResult> => {
    try {
        return await executeWithRetry('structured_json', async (ai) => {
            onStatus?.("🧠 Initializing Professional Backend...");

            const systemPrompt = `You are an ELITE Commercial Photography Art Director and Prompt Engineer.
Your task is to convert the user's concept into a PROFESSIONAL, SELLABLE 15-layer structured prompt.

User Concept: "${concept}"
Image Purpose: "${purpose || 'product'}"
Target Style: "${style || 'Commercial'}"
Target Platform: "${platform}"

PROFESSIONAL PHOTOGRAPHY RULES:
1. Think like a commercial photographer preparing a high-budget shoot.
2. Every layer must be carefully considered for commercial viability.
3. Use SPECIFIC, PROFESSIONAL terminology (not vague descriptions).
4. Consider how the image would look in a magazine, e-commerce, or stock library.
5. Add realistic IMPERFECTIONS for authenticity (fingerprints, dust, micro-scratches).
6. Choose lighting setups that flatter the subject and create depth.
7. Select color palettes that are trend-aware and visually cohesive.
8. The output must be SELLABLE - think stock photography quality.

LAYER-BY-LAYER GUIDANCE:
- Image Purpose: Match to user concept (product, portrait, lifestyle, etc.)
- Scene: Professional studio or carefully curated location
- Composition: Use proven compositional rules (rule of thirds, golden ratio)
- Camera: Real camera settings a photographer would use
- Lighting: Professional multi-light setup with fill and accent
- Color Grading: Magazine-quality, trend-aware palette
- Materials: Specific, tactile descriptions
- Subject: Detailed, sharp, commercially appealing
- Mood: Evocative but accessible emotions
- Post-Processing: Professional finish appropriate to platform

Generate the complete 15-layer structure now.`;

            onStatus?.("📐 Generating 15-layer structure...");

            const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
                model: STRUCTURED_MODEL,
                contents: systemPrompt,
                config: {
                    temperature: 0.75,
                    responseMimeType: "application/json",
                    responseSchema: professionalSchema,
                },
            }), 35000);

            const jsonText = response.text?.trim();
            if (!jsonText) {
                throw new Error("No response from Professional Backend");
            }

            onStatus?.("✨ Validating and constructing prompt...");
            const parsed = JSON.parse(jsonText) as ProfessionalPrompt;

            // Apply manual overrides if provided
            const finalData = userOverrides ? mergeOverrides(parsed, userOverrides) : parsed;

            // Validate with Zod schema
            const validation = ProfessionalPromptSchema.safeParse(finalData);
            if (!validation.success) {
                console.warn("Schema validation warnings:", validation.error);
            }

            // Construct the final prompt for the target platform
            const constructedPrompt = constructProfessionalPrompt(finalData, platform);
            const summary = getPromptSummary(finalData);

            onStatus?.("✅ Complete!");
            return {
                success: true,
                data: finalData,
                constructedPrompt,
                summary,
                error: null
            };
        });
    } catch (error: any) {
        console.error("Professional Backend failed:", error);
        return {
            success: false,
            data: null,
            constructedPrompt: null,
            summary: null,
            error: error.message || "Unknown error"
        };
    }
};

/**
 * Professional Backend with image analysis: Analyze images and generate 15-layer structure
 */
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
        return await executeWithRetry('structured_json', async (ai) => {
            onStatus?.("🔍 Analyzing reference images...");

            const imageParts = images.map((img) => ({
                inlineData: {
                    data: img.base64,
                    mimeType: img.mimeType,
                }
            }));

            let imageInstructions = "";
            if (images.length >= 1) imageInstructions += "- Image 1: Extract COMPOSITION and ARRANGEMENT\n";
            if (images.length >= 2) imageInstructions += "- Image 2: Extract ART STYLE and TEXTURES\n";
            if (images.length >= 3) imageInstructions += "- Image 3: Extract LIGHTING and COLOR PALETTE\n";

            const systemPrompt = `You are an ELITE Commercial Photography Art Director and Prompt Engineer.
Analyze the provided reference images and synthesize them into a PROFESSIONAL 15-layer structured prompt.

User Concept: "${concept || 'Create a sellable image inspired by these references'}"
Image Purpose: "${purpose || 'product'}"
Target Style: "${style || 'Commercial'}"
Target Platform: "${platform}"

IMAGE ANALYSIS ROLES:
${imageInstructions}

PROFESSIONAL ANALYSIS RULES:
1. Do NOT describe the reference images literally.
2. EXTRACT the visual DNA: composition, lighting setup, color story, material quality.
3. SYNTHESIZE these elements into a unique, commercially viable concept.
4. Fill ALL 15 layers with professional-grade specifications.
5. Add IMPERFECTIONS for realism (fingerprints, dust, natural variations).
6. The result should be SELLABLE - think stock photography meets art direction.

Generate the complete 15-layer structure based on image analysis now.`;

            onStatus?.("📐 Generating 15-layer structure from images...");

            const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
                model: STRUCTURED_MODEL,
                contents: {
                    parts: [
                        ...imageParts,
                        { text: systemPrompt }
                    ]
                },
                config: {
                    temperature: 0.8,
                    responseMimeType: "application/json",
                    responseSchema: professionalSchema,
                },
            }), 50000);

            const jsonText = response.text?.trim();
            if (!jsonText) {
                throw new Error("No response from Professional Backend");
            }

            onStatus?.("✅ Complete!");
            const parsed = JSON.parse(jsonText) as ProfessionalPrompt;

            // Apply manual overrides if provided
            const finalData = userOverrides ? mergeOverrides(parsed, userOverrides) : parsed;

            const constructedPrompt = constructProfessionalPrompt(finalData, platform);
            const summary = getPromptSummary(finalData);

            return {
                success: true,
                data: finalData,
                constructedPrompt,
                summary,
                error: null
            };
        });
    } catch (error: any) {
        console.error("Professional Backend (images) failed:", error);
        return {
            success: false,
            data: null,
            constructedPrompt: null,
            summary: null,
            error: error.message || "Unknown error"
        };
    }
};

// ============================================================================
// BANNER DESIGN PROMPT GENERATION (PPA Framework)
// Professional Prompt Architecture for Commercial Banner Design
// ============================================================================

// Convert Banner Zod schema to Google GenAI schema format
const bannerSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        subject: {
            type: Type.OBJECT,
            properties: {
                product_name: { type: Type.STRING, description: "Main product identifier" },
                product_form: { type: Type.STRING, description: "Physical shape and structure" },
                material_composition: { type: Type.STRING, description: "Primary materials" },
                surface_texture: { type: Type.STRING, description: "Texture details" },
                key_features: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Distinctive features" },
                brand_colors: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
                token_weight: { type: Type.NUMBER, description: "Focus weight 1.0-2.0" }
            },
            required: ["product_name", "product_form", "material_composition", "surface_texture", "key_features", "token_weight"]
        },
        context: {
            type: Type.OBJECT,
            properties: {
                environment: { type: Type.STRING, enum: ['studio', 'lifestyle', 'urban', 'natural', 'abstract', 'minimalist', 'luxury'] },
                background_type: { type: Type.STRING, enum: ['seamless_white', 'seamless_black', 'gradient', 'textured_wall', 'marble_surface', 'wooden_table', 'natural_scenery', 'bokeh', 'solid_color'] },
                background_description: { type: Type.STRING, nullable: true },
                surface_material: { type: Type.STRING, nullable: true },
                lighting: { type: Type.STRING, enum: ['studio_high_key', 'studio_low_key', 'natural_daylight', 'golden_hour', 'blue_hour', 'dramatic_side', 'soft_diffused', 'cinematic', 'rim_lit'] },
                atmosphere_keywords: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true }
            },
            required: ["environment", "background_type", "lighting"]
        },
        style: {
            type: Type.OBJECT,
            properties: {
                medium: { type: Type.STRING, enum: ['photorealistic', '3d_render', 'product_visualization', 'editorial', 'commercial_photography', 'lifestyle_photography', 'high_fashion'] },
                quality_terms: { type: Type.ARRAY, items: { type: Type.STRING, enum: ['4K', '8K', 'ultra_detailed', 'hyperrealistic', 'cinematic_quality', 'magazine_quality', 'professional_grade', 'high_fidelity'] } },
                mood: { type: Type.STRING, enum: ['luxury', 'minimal', 'bold', 'elegant', 'playful', 'professional', 'warm', 'cool', 'energetic', 'calm', 'sophisticated', 'organic'] },
                artistic_reference: { type: Type.STRING, nullable: true }
            },
            required: ["medium", "quality_terms", "mood"]
        },
        technical: {
            type: Type.OBJECT,
            properties: {
                aspect_ratio: { type: Type.STRING, enum: ['1:1', '4:5', '16:9', '9:16'] },
                negative_space_position: { type: Type.STRING, enum: ['left', 'right', 'top', 'bottom', 'top_left', 'top_right', 'bottom_left', 'bottom_right', 'center'] },
                negative_space_amount: { type: Type.STRING, enum: ['minimal', 'medium', 'generous', 'expansive'] },
                composition_preset: { type: Type.STRING, nullable: true },
                seed: { type: Type.NUMBER, nullable: true },
                platform: { type: Type.STRING, enum: ['general', 'midjourney', 'dalle', 'flux', 'sdxl'] }
            },
            required: ["aspect_ratio", "negative_space_position", "negative_space_amount", "platform"]
        }
    },
    required: ["subject", "context", "style", "technical"]
};

export interface BannerBackendResult {
    success: boolean;
    data: BannerPrompt | null;
    constructedPrompt: string | null;
    summary: Record<string, string> | null;
    error: string | null;
}

/**
 * Banner Backend: Generate structured PPA 4-module prompt for commercial banners
 * Implements the Professional Prompt Architecture (PPA) Framework
 */
export const generateBannerPrompt = async (
    productDescription: string,
    environment: string,
    mood: string,
    aspectRatio: '1:1' | '4:5' | '16:9' | '9:16' = '4:5',
    negativeSpacePosition: string = 'right',
    platform: 'midjourney' | 'dalle' | 'flux' | 'sdxl' | 'general' = 'general',
    onStatus?: (status: string) => void
): Promise<BannerBackendResult> => {
    try {
        return await executeWithRetry('structured_json', async (ai) => {
            onStatus?.("🎯 Initializing Banner Design Backend...");

            const systemPrompt = `You are an ELITE Commercial Banner Design Specialist and PPA (Professional Prompt Architecture) Expert.
Your task is to convert the user's product concept into a COMMERCIAL-GRADE 4-module banner prompt.

=== USER INPUT ===
Product Description: "${productDescription}"
Environment: "${environment || 'studio'}"
Mood/Tone: "${mood || 'professional'}"
Target Aspect Ratio: "${aspectRatio}" (for ${aspectRatio === '1:1' ? 'Instagram Feed' : aspectRatio === '4:5' ? 'Mobile Feed Scroll-stopper' : aspectRatio === '16:9' ? 'Website Headers' : 'Stories/TikTok'})
Negative Space Position: "${negativeSpacePosition}" (for CTA/text overlay)
Target Platform: "${platform}"

=== PPA FRAMEWORK RULES ===

**P1. SUBJECT/PRODUCT (The Focus):**
- Be ULTRA-SPECIFIC about materials, textures, and form
- Add vivid sensory details (not generic descriptions)
- Include token_weight > 1.0 for primary product elements
- Example: "vegetable-tanned full-grain leather bifold wallet with visible hand-stitching and natural grain variations"

**P2. CONTEXT/SETTING (The Where & When):**
- Choose environment that enhances product appeal
- Select lighting that flatters the product and creates depth
- Background should complement, not compete with product
- Add atmosphere keywords for mood

**P3. STYLE/AESTHETIC (The Look):**
- Default to PHOTOREALISTIC for commercial banners
- Include quality terms: 8K, hyperrealistic, professional_grade
- Match mood to brand identity
- Reference professional photography styles

**P4. CONSTRAINTS/TECHNICAL (The Rules):**
- CRITICAL: Specify negative_space_position for CTA overlay area
- Set negative_space_amount based on banner purpose

=== COMMERCIAL BANNER REQUIREMENTS ===
1. Product must be CLEARLY VISIBLE and the focal point
2. NEGATIVE SPACE must be preserved for text/CTA overlays
3. Image must be COMMERCIALLY VIABLE (sellable quality)
4. Avoid busy backgrounds that compete with product
5. Lighting should create professional studio look unless lifestyle shot

Generate the complete PPA 4-module structure now.`;

            onStatus?.("📐 Generating PPA structure...");

            const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
                model: STRUCTURED_MODEL,
                contents: systemPrompt,
                config: {
                    temperature: 0.7,
                    responseMimeType: "application/json",
                    responseSchema: bannerSchema,
                },
            }), 35000);

            const jsonText = response.text?.trim();
            if (!jsonText) {
                throw new Error("No response from Banner Backend");
            }

            onStatus?.("✨ Validating and constructing prompt...");
            const parsed = JSON.parse(jsonText) as BannerPrompt;

            // Validate with Zod schema
            const validation = BannerPromptSchema.safeParse(parsed);
            if (!validation.success) {
                console.warn("Banner schema validation warnings:", validation.error);
            }

            // Construct the final prompt for the target platform
            const constructedPrompt = constructBannerPrompt(parsed, platform);
            const summary = getBannerPromptSummary(parsed);

            onStatus?.("✅ Banner prompt ready!");
            return {
                success: true,
                data: parsed,
                constructedPrompt,
                summary,
                error: null
            };
        });
    } catch (error: any) {
        console.error("Banner Backend failed:", error);
        return {
            success: false,
            data: null,
            constructedPrompt: null,
            summary: null,
            error: error.message || "Unknown error"
        };
    }
};

/**
 * Banner Backend with product image analysis: Analyze product images and generate PPA structure
 */
export const generateBannerFromImages = async (
    productDescription: string,
    images: { base64: string; mimeType: string }[],
    environment: string,
    mood: string,
    aspectRatio: '1:1' | '4:5' | '16:9' | '9:16' = '4:5',
    negativeSpacePosition: string = 'right',
    platform: 'midjourney' | 'dalle' | 'flux' | 'sdxl' | 'general' = 'general',
    onStatus?: (status: string) => void
): Promise<BannerBackendResult> => {
    try {
        return await executeWithRetry('structured_json', async (ai) => {
            onStatus?.("🔍 Analyzing product images...");

            const imageParts = images.map((img) => ({
                inlineData: {
                    data: img.base64,
                    mimeType: img.mimeType,
                }
            }));

            let imageInstructions = "";
            if (images.length >= 1) imageInstructions += "- Image 1: MAIN PRODUCT - Extract form, materials, textures, colors\n";
            if (images.length >= 2) imageInstructions += "- Image 2: STYLE REFERENCE - Extract composition and aesthetic cues\n";
            if (images.length >= 3) imageInstructions += "- Image 3: ENVIRONMENT/MOOD - Extract lighting and atmosphere\n";

            const systemPrompt = `You are an ELITE Commercial Banner Design Specialist and PPA Expert.
Analyze the product images and generate a COMMERCIAL-GRADE 4-module banner prompt.

=== USER INPUT ===
Product Description: "${productDescription || 'Analyze product from images'}"
Environment: "${environment || 'studio'}"
Mood/Tone: "${mood || 'professional'}"
Target Aspect Ratio: "${aspectRatio}"
Negative Space Position: "${negativeSpacePosition}"
Target Platform: "${platform}"

=== IMAGE ANALYSIS ROLES ===
${imageInstructions}

=== PPA EXTRACTION RULES ===

**P1. SUBJECT/PRODUCT (From Images):**
- EXTRACT exact materials, textures, colors from product image
- Note surface finishes (matte, glossy, brushed, etc.)
- Identify distinctive features and craftsmanship details
- Do NOT invent features not visible in images

**P2. CONTEXT/SETTING:**
- Choose environment that best showcases the product
- If style reference provided, extract composition cues
- Match lighting to product type (jewelry = dramatic, food = soft, etc.)

**P3. STYLE/AESTHETIC:**
- Match visual style to product category
- Include professional quality terms
- Reference any style cues from images

**P4. CONSTRAINTS/TECHNICAL:**
- ALWAYS preserve negative space for CTA
- Set appropriate aspect ratio

Generate the complete PPA 4-module structure based on image analysis.`;

            onStatus?.("📐 Generating PPA structure from images...");

            const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
                model: STRUCTURED_MODEL,
                contents: {
                    parts: [
                        ...imageParts,
                        { text: systemPrompt }
                    ]
                },
                config: {
                    temperature: 0.75,
                    responseMimeType: "application/json",
                    responseSchema: bannerSchema,
                },
            }), 50000);

            const jsonText = response.text?.trim();
            if (!jsonText) {
                throw new Error("No response from Banner Backend");
            }

            onStatus?.("✅ Banner prompt ready!");
            const parsed = JSON.parse(jsonText) as BannerPrompt;

            const constructedPrompt = constructBannerPrompt(parsed, platform);
            const summary = getBannerPromptSummary(parsed);

            return {
                success: true,
                data: parsed,
                constructedPrompt,
                summary,
                error: null
            };
        });
    } catch (error: any) {
        console.error("Banner Backend (images) failed:", error);
        return {
            success: false,
            data: null,
            constructedPrompt: null,
            summary: null,
            error: error.message || "Unknown error"
        };
    }
};
