import { GenerateContentResponse, Type } from "@google/genai";
import { executeWithRetry, PRIMARY_MODEL, STRUCTURED_MODEL } from "./apiKeyManager";
import {
    CinematicPromptSchema,
    CinematicPrompt,
    LightingType,
    CameraAngle,
    AspectRatio
} from "../lib/schemas/cinematicPrompt";

/**
 * Cinematic Prompt Service - "Neural Backend" with Reflexion Loop
 * Uses Gemini with structured JSON generation and self-correction
 * Now leveraging improved API key rotation from apiKeyManager v2.0
 */

// Task type for this service
const TASK_TYPE = 'structured_json' as const;

// === TIMEOUT HELPER ===

const withTimeout = <T>(promise: Promise<T>, ms: number = 12000): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Request timed out")), ms)
        ),
    ]);
};

// === ENUM VALIDATORS FOR ERROR MESSAGES ===

const VALID_LIGHTING = ['rembrandt', 'volumetric', 'chiaroscuro', 'bioluminescent', 'neon_noir', 'natural_diffused', 'studio_lighting', 'cinematic_haze'];
const VALID_CAMERA = ['eye_level', 'low_angle', 'high_angle', 'dutch_angle', 'macro', 'drone_view', 'wide_shot'];
const VALID_ASPECT = ['16:9', '9:16', '1:1', '2.39:1'];
const VALID_FILM_STOCK = ['Kodak Portra 400', 'Fujifilm Velvia', 'IMAX 70mm', 'Polaroid', 'Digital', '35mm'];
const VALID_LENS = ['35mm', '85mm', 'wide_angle', 'telephoto', 'macro_lens'];

// === JSON SCHEMA FOR GEMINI ===

const CINEMATIC_RESPONSE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        subject: {
            type: Type.OBJECT,
            properties: {
                core: { type: Type.STRING },
                action: { type: Type.STRING },
                attire: { type: Type.STRING },
            },
            required: ['core', 'action'],
        },
        cinematography: {
            type: Type.OBJECT,
            properties: {
                lighting: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                camera_angle: { type: Type.STRING },
                film_stock: { type: Type.STRING },
                lens: { type: Type.STRING },
            },
            required: ['lighting', 'camera_angle', 'film_stock', 'lens'],
        },
        artistic: {
            type: Type.OBJECT,
            properties: {
                style: { type: Type.STRING },
                mood: { type: Type.STRING },
            },
            required: ['style', 'mood'],
        },
        technical: {
            type: Type.OBJECT,
            properties: {
                aspect_ratio: { type: Type.STRING },
                stylize: { type: Type.NUMBER },
                negative_prompt: { type: Type.STRING },
            },
            required: ['aspect_ratio', 'stylize', 'negative_prompt'],
        },
    },
    required: ['subject', 'cinematography', 'artistic', 'technical'],
};

// === CORE SYSTEM PROMPT ===

const SYSTEM_PROMPT = `You are a professional Cinematographer and AI Prompt Engineer.

Your task is to transform the user's description into a structured JSON object for high-end image generation.

SCHEMA REQUIREMENTS:
1. **Subject Layer:**
   - core: Main subject (required)
   - action: What subject is doing (required)
   - attire: Optional clothing/appearance details

2. **Cinematography Layer:**
   - lighting: Array of 1-3 lighting types. MUST be from: ${VALID_LIGHTING.join(', ')}
   - camera_angle: MUST be one of: ${VALID_CAMERA.join(', ')}
   - film_stock: MUST be one of: ${VALID_FILM_STOCK.join(', ')}
   - lens: MUST be one of: ${VALID_LENS.join(', ')}

3. **Artistic Layer:**
   - style: The specific art style (e.g., 'Cyberpunk', 'Baroque', 'Synthwave')
   - mood: The emotional atmosphere (e.g., 'Melancholic', 'Energetic')

4. **Technical Layer:**
   - aspect_ratio: MUST be one of: ${VALID_ASPECT.join(', ')}
   - stylize: Number between 0-1000 (higher = more artistic)
   - negative_prompt: Things to avoid (e.g., "blurry, low quality, distorted")

CRITICAL: Only use the exact enum values specified. Do not invent variations.`;

// === REFLEXION LOOP: Generate with Self-Correction ===

export interface ReflexionResult {
    success: boolean;
    data: CinematicPrompt | null;
    attempts: number;
    errors: string[];
}

/**
 * Generate a structured cinematic prompt with reflexion (self-correction loop)
 * Now uses executeWithRetry for improved key rotation
 * @param userDescription - User's natural language description
 * @param maxAttempts - Maximum retry attempts (default: 2)
 */
export async function generateWithReflexion(
    userDescription: string,
    maxAttempts: number = 2,
    onStatusUpdate?: (status: string) => void
): Promise<ReflexionResult> {
    const errors: string[] = [];
    let systemContext = SYSTEM_PROMPT;
    let lastValidated: CinematicPrompt | null = null;
    let successfulAttempt = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (onStatusUpdate) {
            onStatusUpdate(`Thinking (Attempt ${attempt}/${maxAttempts})...`);
        }

        try {
            // Use executeWithRetry for automatic key rotation and rate limit handling
            const result = await executeWithRetry(TASK_TYPE, async (ai) => {
                const prompt = `${systemContext}

USER DESCRIPTION:
"${userDescription}"

Generate the structured JSON response following the exact schema.`;

                const response: GenerateContentResponse = await withTimeout(
                    ai.models.generateContent({
                        model: STRUCTURED_MODEL,
                        contents: prompt,
                        config: {
                            temperature: 0.7,
                            responseMimeType: "application/json",
                            responseSchema: CINEMATIC_RESPONSE_SCHEMA,
                        },
                    }),
                    15000 // 15 second timeout
                );

                const rawText = response.text?.trim();
                if (!rawText) {
                    throw new Error("Empty response from AI");
                }

                return rawText;
            });

            // Parse and validate outside of executeWithRetry
            const parsed = JSON.parse(result);
            const validated = CinematicPromptSchema.parse(parsed);
            lastValidated = validated;
            successfulAttempt = attempt;

            return {
                success: true,
                data: validated,
                attempts: attempt,
                errors,
            };

        } catch (error: any) {
            let errorMessage = error.message || "Unknown error";

            // Check for Zod validation errors
            if (error.name === 'ZodError' && error.errors) {
                const zodErrors = error.errors.map((e: any) => {
                    const path = e.path.join('.');
                    const received = e.received;

                    // Generate helpful correction message
                    if (path.includes('lighting')) {
                        return `Invalid lighting value "${received}". Must use one of: ${VALID_LIGHTING.join(', ')}`;
                    }
                    if (path.includes('camera_angle')) {
                        return `Invalid camera_angle "${received}". Must use one of: ${VALID_CAMERA.join(', ')}`;
                    }
                    if (path.includes('aspect_ratio')) {
                        return `Invalid aspect_ratio "${received}". Must use one of: ${VALID_ASPECT.join(', ')}`;
                    }
                    return `${path}: ${e.message}`;
                });

                errorMessage = zodErrors.join('; ');
            }

            errors.push(`Attempt ${attempt}: ${errorMessage}`);

            // If we haven't exhausted attempts, feed error back to AI for self-correction
            if (attempt < maxAttempts) {
                systemContext = `${SYSTEM_PROMPT}

⚠️ PREVIOUS ATTEMPT FAILED WITH ERROR:
"${errorMessage}"

Please correct your response and ONLY use the exact enum values specified.`;
            }
        }
    }

    // All attempts exhausted
    return {
        success: false,
        data: null,
        attempts: maxAttempts,
        errors,
    };
}

/**
 * Quick generate without reflexion (single attempt)
 */
export async function generateCinematicPrompt(
    userDescription: string
): Promise<CinematicPrompt> {
    const result = await generateWithReflexion(userDescription, 1);
    if (!result.success || !result.data) {
        throw new Error(result.errors.join('; ') || 'Failed to generate cinematic prompt');
    }
    return result.data;
}

/**
 * Generate cinematic prompt with reference images
 * Now uses executeWithRetry for improved key rotation
 */
export async function generateCinematicFromImages(
    userDescription: string,
    images: { base64: string; mimeType: string }[] = [],
    onStatusUpdate?: (status: string) => void
): Promise<ReflexionResult> {
    const errors: string[] = [];
    const maxAttempts = 2;

    const imageParts = images.map(img => ({
        inlineData: {
            data: img.base64,
            mimeType: img.mimeType,
        },
    }));

    const imageContext = images.length > 0
        ? `\n\nReference images are provided. Analyze them for composition, lighting, and mood cues.`
        : '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (onStatusUpdate) {
            onStatusUpdate(`Analyzing Images (Attempt ${attempt}/${maxAttempts})...`);
        }

        try {
            // Use executeWithRetry for automatic key rotation
            const rawText = await executeWithRetry(TASK_TYPE, async (ai) => {
                const textPart = {
                    text: `${SYSTEM_PROMPT}${imageContext}

USER DESCRIPTION:
"${userDescription}"

Generate the structured JSON response following the exact schema.`,
                };

                const response: GenerateContentResponse = await withTimeout(
                    ai.models.generateContent({
                        model: STRUCTURED_MODEL,
                        contents: { parts: [...imageParts, textPart] },
                        config: {
                            temperature: 0.7,
                            responseMimeType: "application/json",
                            responseSchema: CINEMATIC_RESPONSE_SCHEMA,
                        },
                    }),
                    20000 // 20 second timeout for image processing
                );

                const text = response.text?.trim();
                if (!text) throw new Error("Empty response");
                return text;
            });

            const parsed = JSON.parse(rawText);
            const validated = CinematicPromptSchema.parse(parsed);

            return { success: true, data: validated, attempts: attempt, errors };
        } catch (error: any) {
            errors.push(`Attempt ${attempt}: ${error.message}`);
        }
    }

    return { success: false, data: null, attempts: maxAttempts, errors };
}

/**
 * Convert any text prompt to structured JSON and output an enhanced professional prompt
 * Uses the cinematic schema for better accuracy and detail, max 1000 characters
 */
export async function convertToStructuredPrompt(
    originalPrompt: string
): Promise<{ structuredData: CinematicPrompt | null; enhancedPrompt: string; success: boolean }> {
    // This function uses generateWithReflexion which already handles key management
    // No need for separate AI client here

    // First, generate structured JSON from the prompt
    const result = await generateWithReflexion(originalPrompt, 2);

    if (!result.success || !result.data) {
        // Fallback: return enhanced version of original prompt
        return {
            structuredData: null,
            enhancedPrompt: originalPrompt.slice(0, 1000),
            success: false,
        };
    }

    // Now generate a more detailed, professional prompt from the structured data
    const { subject, cinematography, artistic, technical } = result.data;

    // Build a rich, professional prompt from the structured data
    const lightingDesc = cinematography.lighting
        .map(l => {
            const labels: Record<string, string> = {
                rembrandt: 'Rembrandt triangular',
                volumetric: 'volumetric god rays',
                chiaroscuro: 'dramatic chiaroscuro',
                bioluminescent: 'ethereal bioluminescent',
                neon_noir: 'neon noir',
                natural_diffused: 'soft natural diffused',
                studio_lighting: 'professional studio',
                cinematic_haze: 'cinematic haze',
            };
            return labels[l] || l;
        })
        .join(' and ');

    const cameraDesc: Record<string, string> = {
        eye_level: 'eye-level perspective',
        low_angle: 'dramatic low-angle shot',
        high_angle: 'elevated high-angle view',
        dutch_angle: 'dynamic Dutch angle tilt',
        macro: 'intimate macro close-up',
        drone_view: 'sweeping drone view',
        wide_shot: 'expansive wide shot',
    };

    // Construct the enhanced prompt
    const parts: string[] = [];

    // Subject with action
    parts.push(`${subject.core}, ${subject.action}`);
    if (subject.attire) {
        parts.push(subject.attire);
    }

    // Cinematography details
    parts.push(`${lightingDesc} lighting`);
    parts.push(cameraDesc[cinematography.camera_angle] || cinematography.camera_angle);
    parts.push(`${cinematography.lens} lens`);
    parts.push(`shot on ${cinematography.film_stock}`);

    // Artistic layer
    if (artistic) {
        parts.push(`Style: ${artistic.style}`);
        parts.push(`Mood: ${artistic.mood}`);
    }

    // Technical params in Midjourney format
    const technicalSuffix = `--ar ${technical.aspect_ratio} --stylize ${technical.stylize} --no ${technical.negative_prompt}`;

    let enhancedPrompt = parts.join(', ') + '. ' + technicalSuffix;

    // Ensure under 1000 characters
    if (enhancedPrompt.length > 1000) {
        enhancedPrompt = enhancedPrompt.slice(0, 997) + '...';
    }

    return {
        structuredData: result.data,
        enhancedPrompt,
        success: true,
    };
}
