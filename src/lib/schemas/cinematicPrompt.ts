import { z } from 'zod';

export const CinematicPromptSchema = z.object({
    subject: z.object({
        core: z.string().describe("The main subject of the image (e.g., 'A cyberpunk samurai', 'An ancient temple')"),
        action: z.string().describe("What is the subject doing? (e.g., 'standing in the rain', 'meditating')"),
        attire: z.string().optional().describe("Detailed clothing description")
    }),
    cinematography: z.object({
        lighting: z.array(z.enum([
            'rembrandt', 'volumetric', 'chiaroscuro', 'bioluminescent', 'neon_noir', 'natural_diffused', 'studio_lighting', 'cinematic_haze'
        ])).describe("Select 1-3 lighting types that best fit the mood."),
        camera_angle: z.enum([
            'eye_level', 'low_angle', 'high_angle', 'dutch_angle', 'macro', 'drone_view', 'wide_shot'
        ]),
        film_stock: z.enum(['Kodak Portra 400', 'Fujifilm Velvia', 'IMAX 70mm', 'Polaroid', 'Digital', '35mm']),
        lens: z.enum(['35mm', '85mm', 'wide_angle', 'telephoto', 'macro_lens'])
    }),
    artistic: z.object({
        style: z.string().describe("The specific art style (e.g., 'Cyberpunk', 'Baroque', 'Synthwave')"),
        mood: z.string().describe("The emotional atmosphere (e.g., 'Melancholic', 'Energetic')")
    }),
    technical: z.object({
        aspect_ratio: z.enum(['16:9', '9:16', '1:1', '2.39:1']),
        stylize: z.number().min(0).max(1000).describe("Midjourney --s value"),
        negative_prompt: z.string().describe("Elements to exclude (e.g., 'blur, deformity, watermark')")
    })
});

export type CinematicPrompt = z.infer<typeof CinematicPromptSchema>;

// Enum types for external use
export type LightingType = 'rembrandt' | 'volumetric' | 'chiaroscuro' | 'bioluminescent' | 'neon_noir' | 'natural_diffused' | 'studio_lighting' | 'cinematic_haze';
export type CameraAngle = 'eye_level' | 'low_angle' | 'high_angle' | 'dutch_angle' | 'macro' | 'drone_view' | 'wide_shot';
export type AspectRatio = '16:9' | '9:16' | '1:1' | '2.39:1';
export type FilmStock = 'Kodak Portra 400' | 'Fujifilm Velvia' | 'IMAX 70mm' | 'Polaroid' | 'Digital' | '35mm';
export type LensType = '35mm' | '85mm' | 'wide_angle' | 'telephoto' | 'macro_lens';

// Human-readable labels for UI display
export const LIGHTING_LABELS: Record<string, string> = {
    'rembrandt': 'Rembrandt',
    'volumetric': 'Volumetric',
    'chiaroscuro': 'Chiaroscuro',
    'bioluminescent': 'Bioluminescent',
    'neon_noir': 'Neon Noir',
    'natural_diffused': 'Natural Diffused',
    'studio_lighting': 'Studio Lighting',
    'cinematic_haze': 'Cinematic Haze'
};

export const CAMERA_LABELS: Record<string, string> = {
    'eye_level': 'Eye Level',
    'low_angle': 'Low Angle',
    'high_angle': 'High Angle',
    'dutch_angle': 'Dutch Angle',
    'macro': 'Macro',
    'drone_view': 'Drone View',
    'wide_shot': 'Wide Shot'
};

export const ASPECT_RATIO_LABELS: Record<string, string> = {
    '16:9': 'Widescreen (16:9)',
    '9:16': 'Portrait (9:16)',
    '1:1': 'Square (1:1)',
    '2.39:1': 'Cinematic (2.39:1)'
};

// Helper to flatten the structured object into a copy-paste prompt string
export const constructPrompt = (data: CinematicPrompt): string => {
    if (!data?.subject) return "";

    const parts = [
        `/imagine prompt: ${data.subject.core}`,
        data.subject.action,
        data.subject.attire ? `wearing ${data.subject.attire}` : null,
        data.cinematography?.lighting?.length > 0
            ? `${data.cinematography.lighting.map(l => LIGHTING_LABELS[l] || l).join(', ')} lighting`
            : null,
        data.cinematography?.film_stock ? `shot on ${data.cinematography.film_stock}` : null,
        data.cinematography?.lens || null,
        data.cinematography?.camera_angle
            ? CAMERA_LABELS[data.cinematography.camera_angle] || data.cinematography.camera_angle
            : null,
        data.artistic?.style ? `Style: ${data.artistic.style}` : null,
        data.artistic?.mood ? `Mood: ${data.artistic.mood}` : null,
    ].filter(Boolean).join('. ');

    const flags = [
        data.technical?.aspect_ratio ? `--ar ${data.technical.aspect_ratio}` : null,
        data.technical?.stylize !== undefined ? `--stylize ${data.technical.stylize}` : null,
        data.technical?.negative_prompt ? `--no ${data.technical.negative_prompt}` : null,
    ].filter(Boolean).join(' ');

    return `${parts} ${flags}`.trim();
};
