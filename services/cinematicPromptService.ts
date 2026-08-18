import { aiGenerateStructured } from "./aiGatewayClient";
import {
    CinematicPromptSchema,
    CinematicPrompt,
    constructPrompt,
} from "../lib/schemas/cinematicPrompt";

const VALID_LIGHTING = ['rembrandt', 'volumetric', 'chiaroscuro', 'bioluminescent', 'neon_noir', 'natural_diffused', 'studio_lighting', 'cinematic_haze'];
const VALID_CAMERA = ['eye_level', 'low_angle', 'high_angle', 'dutch_angle', 'macro', 'drone_view', 'wide_shot'];
const VALID_ASPECT = ['16:9', '9:16', '1:1', '2.39:1'];
const VALID_FILM_STOCK = ['Kodak Portra 400', 'Fujifilm Velvia', 'IMAX 70mm', 'Polaroid', 'Digital', '35mm'];
const VALID_LENS = ['35mm', '85mm', 'wide_angle', 'telephoto', 'macro_lens'];

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

export interface ReflexionResult {
    success: boolean;
    data: CinematicPrompt | null;
    attempts: number;
    errors: string[];
}

function sanitizeCinematicData(raw: any, fallbackPrompt: string): CinematicPrompt {
    const rawSubject = typeof raw?.subject === 'object' ? raw.subject : {};
    const rawCinema = typeof raw?.cinematography === 'object' ? raw.cinematography : {};
    const rawArt = typeof raw?.artistic === 'object' ? raw.artistic : {};
    const rawTech = typeof raw?.technical === 'object' ? raw.technical : {};

    const rawLighting = Array.isArray(rawCinema.lighting) ? rawCinema.lighting : [rawCinema.lighting].filter(Boolean);
    const validLighting = rawLighting
        .map((l: any) => String(l).toLowerCase().replace(/[-\s]/g, '_'))
        .filter((l: string) => VALID_LIGHTING.includes(l));

    const cameraAngle = String(rawCinema.camera_angle || '').toLowerCase().replace(/[-\s]/g, '_');
    const validCamera = VALID_CAMERA.includes(cameraAngle) ? cameraAngle : 'eye_level';

    const validLens = VALID_LENS.includes(rawCinema.lens) ? rawCinema.lens : '50mm' === rawCinema.lens ? '35mm' : '85mm';

    const validFilm = VALID_FILM_STOCK.includes(rawCinema.film_stock) ? rawCinema.film_stock : 'Digital';

    const validAspect = VALID_ASPECT.includes(rawTech.aspect_ratio) ? rawTech.aspect_ratio : '16:9';

    return {
        subject: {
            core: rawSubject.core || fallbackPrompt.slice(0, 100) || 'Subject',
            action: rawSubject.action || 'standing in atmospheric setting',
            attire: rawSubject.attire || undefined,
        },
        cinematography: {
            lighting: (validLighting.length > 0 ? validLighting : ['volumetric', 'cinematic_haze']) as any,
            camera_angle: validCamera as any,
            film_stock: validFilm as any,
            lens: (VALID_LENS.includes(validLens) ? validLens : '85mm') as any,
        },
        artistic: {
            style: rawArt.style || 'Cinematic',
            mood: rawArt.mood || 'Dramatic',
        },
        technical: {
            aspect_ratio: validAspect as any,
            stylize: typeof rawTech.stylize === 'number' ? Math.min(1000, Math.max(0, rawTech.stylize)) : 250,
            negative_prompt: rawTech.negative_prompt || 'blurry, low quality, distorted, watermark',
        },
    };
}

export async function generateWithReflexion(
    userDescription: string,
    maxAttempts: number = 2,
    onStatusUpdate?: (status: string) => void
): Promise<ReflexionResult> {
    const errors: string[] = [];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (onStatusUpdate) {
            onStatusUpdate(`Thinking (Attempt ${attempt}/${maxAttempts})...`);
        }

        try {
            const res = await aiGenerateStructured<CinematicPrompt>({
                systemPrompt: SYSTEM_PROMPT,
                userInput: userDescription,
                taskType: 'structured_json',
            });

            const parsed = res.result;
            const validation = CinematicPromptSchema.safeParse(parsed);

            if (validation.success) {
                if (onStatusUpdate) onStatusUpdate('Prompt generated successfully!');
                return {
                    success: true,
                    data: validation.data,
                    attempts: attempt,
                    errors,
                };
            } else if (parsed && typeof parsed === 'object') {
                const sanitized = sanitizeCinematicData(parsed, userDescription);
                if (onStatusUpdate) onStatusUpdate('Prompt generated successfully!');
                return {
                    success: true,
                    data: sanitized,
                    attempts: attempt,
                    errors,
                };
            } else {
                errors.push(`Attempt ${attempt} validation: ${validation.error.message}`);
            }
        } catch (err: any) {
            errors.push(`Attempt ${attempt} failed: ${err.message}`);
        }
    }

    return {
        success: false,
        data: null,
        attempts: maxAttempts,
        errors,
    };
}

export async function generateCinematicPrompt(
    prompt: string,
    style: string,
    mood: string,
    imageContext?: string,
    onStatus?: (status: string) => void
): Promise<{ success: boolean; data: CinematicPrompt | null; error: string | null }> {
    const fullDescription = `${prompt}. Style: ${style}. Mood: ${mood}.${imageContext ? ` Context: ${imageContext}` : ''}`;
    const result = await generateWithReflexion(fullDescription, 2, onStatus);
    return {
        success: result.success,
        data: result.data,
        error: result.errors.length > 0 ? result.errors.join('; ') : null,
    };
}

export async function generateCinematicFromImages(
    prompt: string,
    images: { base64: string; mimeType: string }[],
    style: string,
    mood: string,
    onStatus?: (status: string) => void
): Promise<{ success: boolean; data: CinematicPrompt | null; error: string | null }> {
    const imageInfo = images.map((_, i) => `Reference Image ${i + 1}`).join(', ');
    const fullDescription = `${prompt}. Reference context: ${imageInfo}. Style: ${style}. Mood: ${mood}.`;
    return generateCinematicPrompt(fullDescription, style, mood, undefined, onStatus);
}

export async function convertToStructuredPrompt(
    prompt: string,
    style: string = 'cinematic',
    onStatus?: (status: string) => void
): Promise<{ success: boolean; enhancedPrompt: string; data: CinematicPrompt | null; error: string | null }> {
    const result = await generateCinematicPrompt(prompt, style, 'Dynamic', undefined, onStatus);
    if (result.success && result.data) {
        const constructed = constructPrompt(result.data);
        return {
            success: true,
            enhancedPrompt: constructed || prompt,
            data: result.data,
            error: null,
        };
    }
    return {
        success: false,
        enhancedPrompt: `${prompt}, ${style} style, cinematic lighting, highly detailed`,
        data: null,
        error: result.error || 'Failed to convert to structured prompt',
    };
}

