import { z } from 'zod';

// ============================================================================
// PROFESSIONAL 15-LAYER JSON PROMPT SCHEMA
// Based on TeamCal AI methodology for generating sellable AI images
// ============================================================================

// Layer 1: Image Purpose
export const ImagePurposeEnum = z.enum([
    'product', 'portrait', 'lifestyle', 'editorial', 'concept_art',
    'still_life', 'fashion', 'architectural', 'food', 'landscape'
]);

// Layer 2: Scene Environment
export const EnvironmentEnum = z.enum([
    'studio', 'interior', 'exterior', 'on_location', 'abstract', 'underwater', 'aerial'
]);

// Layer 3: Background Configuration
export const BackgroundToneEnum = z.enum([
    'neutral-warm', 'neutral-cool', 'vivid', 'dark', 'white', 'gradient', 'natural'
]);
export const BackgroundTextureEnum = z.enum([
    'clean', 'textured', 'aged', 'seamless', 'bokeh', 'environmental'
]);

// Layer 4: Surface/Platform
export const SurfaceFinishEnum = z.enum([
    'matte', 'satin', 'glossy', 'rough', 'natural', 'reflective'
]);

// Layer 5: Composition
export const FramingEnum = z.enum([
    'horizontal', 'vertical', 'square', 'panoramic', 'cinematic_wide'
]);
export const CameraHeightEnum = z.enum([
    'eye-level', 'slightly-above', 'slightly-below', 'bird-eye', 'worm-eye', 'dutch-angle'
]);
export const NegativeSpaceEnum = z.enum([
    'tight', 'medium', 'airy', 'minimal', 'expansive'
]);
export const ArrangementEnum = z.enum([
    'hero-center', 'rule-of-thirds', 'golden-ratio', 'symmetrical', 'asymmetric',
    'diagonal', 'pyramid', 'scattered', 'layered'
]);

// Layer 6: Camera Settings
export const LensTypeEnum = z.enum([
    'prime', 'zoom', 'macro', 'tilt-shift', 'anamorphic', 'fisheye', 'telephoto'
]);

// Layer 7 & 8: Lighting
export const LightingTypeEnum = z.enum([
    'natural', 'strobe', 'continuous', 'softbox', 'ring_light', 'led_panel',
    'practical', 'mixed', 'neon', 'candle', 'window'
]);
export const LightingDirectionEnum = z.enum([
    'front', 'left-45', 'right-45', 'left-90', 'right-90', 'back', 'top', 'bottom', 'rim'
]);
export const LightingQualityEnum = z.enum([
    'diffused', 'soft', 'hard', 'dramatic', 'flat', 'contrasty', 'ethereal'
]);
export const ColorTemperatureEnum = z.enum([
    'neutral', 'warm', 'cool', 'golden_hour', 'blue_hour', 'tungsten', 'daylight', 'mixed'
]);

// Layer 9: Shadows
export const ShadowBehaviorEnum = z.enum([
    'soft-edge', 'defined', 'long', 'minimal', 'dramatic', 'fill-light', 'natural'
]);

// Layer 10: Color Grading
export const WarmthEnum = z.enum(['cool', 'neutral', 'warm', 'split-tone']);
export const SaturationEnum = z.enum([
    'muted', 'natural', 'vivid', 'desaturated', 'black_and_white', 'selective'
]);

// Layer 15: Post-Processing
export const GrainEnum = z.enum(['none', 'subtle', 'medium', 'heavy', 'film', 'digital_noise']);
export const OutputRatioEnum = z.enum([
    '1:1', '4:5', '3:4', '2:3', '9:16', '16:9', '2.39:1', '21:9'
]);

// ============================================================================
// MAIN SCHEMA - 15 LAYERS
// ============================================================================

export const ProfessionalPromptSchema = z.object({
    // Layer 1: Image Purpose
    image_purpose: ImagePurposeEnum.describe("The core intent and category of the shot"),

    // Layer 2 & 3 & 4: Scene Configuration
    scene: z.object({
        environment: EnvironmentEnum.describe("Where the scene takes place"),
        background: z.object({
            material: z.string().describe("Background material (e.g., 'seamless paper', 'textured wall', 'natural scenery')"),
            tone: BackgroundToneEnum.describe("Overall color temperature of background"),
            texture: BackgroundTextureEnum.describe("Surface quality of background")
        }),
        surface: z.object({
            material: z.string().describe("What subject sits on (e.g., 'marble', 'oak wood', 'linen cloth')"),
            finish: SurfaceFinishEnum.describe("Surface reflectivity")
        }).optional()
    }),

    // Layer 5: Composition
    composition: z.object({
        framing: FramingEnum.describe("Image orientation and aspect"),
        camera_height: CameraHeightEnum.describe("Vertical angle of view"),
        negative_space: NegativeSpaceEnum.describe("Amount of breathing room around subject"),
        arrangement: ArrangementEnum.describe("How elements are placed in frame")
    }),

    // Layer 6: Camera Technical Settings
    camera: z.object({
        focal_length_mm: z.number().min(12).max(800).describe("Lens focal length (35=cinematic, 50=human-eye, 85=portrait, 200+=telephoto)"),
        aperture_f: z.number().min(1).max(22).describe("F-stop (1.4=shallow DOF, 8+=deep focus)"),
        lens_type: LensTypeEnum.describe("Type of lens used"),
        focus_strategy: z.string().describe("What is sharp and what is soft (e.g., 'tack sharp on eyes, creamy bokeh background')")
    }),

    // Layer 7 & 8: Lighting Setup
    lighting: z.object({
        primary: z.object({
            type: LightingTypeEnum.describe("Main light source"),
            direction: LightingDirectionEnum.describe("Where primary light comes from"),
            quality: LightingQualityEnum.describe("Hard or soft light quality")
        }),
        secondary: z.object({
            type: LightingTypeEnum.describe("Fill or accent light"),
            position: z.string().describe("Where secondary light is placed (e.g., 'right-fill', 'hair-light from above')")
        }).optional(),
        color_temperature: ColorTemperatureEnum.describe("Overall lighting warmth"),

        // Layer 9: Shadow Control
        shadow_behavior: ShadowBehaviorEnum.describe("How shadows appear in the image")
    }),

    // Layer 10: Color Grading
    color_grading: z.object({
        palette: z.array(z.string()).min(1).max(5).describe("Key colors in the image (e.g., 'warm beige', 'forest green', 'dusty rose')"),
        warmth: WarmthEnum.describe("Overall color temperature of final image"),
        saturation: SaturationEnum.describe("Color intensity level")
    }),

    // Layer 11 & 12: Materials and Textures
    materials: z.object({
        primary: z.array(z.string()).min(1).max(5).describe("Main materials visible (e.g., 'ceramic', 'leather', 'brushed metal')"),
        texture_notes: z.string().describe("Specific tactile details (e.g., 'fine grain', 'hand-stitched imperfections')"),
        imperfections: z.object({
            include: z.boolean().describe("Whether to add realistic imperfections"),
            types: z.array(z.string()).describe("Types of imperfections (e.g., 'fingerprints', 'dust motes', 'micro-scratches')")
        }).describe("Critical for photorealism - adds organic authenticity")
    }),

    // Layer 13: Subject Details
    subject: z.object({
        category: z.string().describe("What the subject is (e.g., 'artisanal ceramic vase', 'fashion model', 'gourmet dish')"),
        pose_or_orientation: z.string().describe("How subject is positioned (e.g., 'angled 30-degrees', 'profile view', 'dynamic action pose')"),
        features: z.array(z.string()).describe("Key visual features to emphasize (e.g., 'hand-painted details', 'dramatic cheekbones')"),
        condition: z.string().describe("State of subject (e.g., 'pristine', 'weathered vintage', 'handmade irregularities')")
    }),

    // Layer 14: Mood and Emotion
    mood: z.array(z.string()).min(1).max(5).describe("Emotional keywords (e.g., 'calm', 'luxurious', 'nostalgic', 'energetic')"),

    // Layer 15: Post-Processing & Output
    post_processing: z.object({
        grain: GrainEnum.describe("Film grain or noise level"),
        authenticity: z.string().describe("Finishing notes (e.g., 'retain crafting marks', 'high-end polish', 'magazine-ready')"),
        output_ratio: OutputRatioEnum.describe("Final aspect ratio")
    })
});

export type ProfessionalPrompt = z.infer<typeof ProfessionalPromptSchema>;

// ============================================================================
// HUMAN-READABLE LABELS FOR UI
// ============================================================================

export const PURPOSE_LABELS: Record<string, string> = {
    'product': '📦 Product',
    'portrait': '👤 Portrait',
    'lifestyle': '🏡 Lifestyle',
    'editorial': '📰 Editorial',
    'concept_art': '🎨 Concept Art',
    'still_life': '🍎 Still Life',
    'fashion': '👗 Fashion',
    'architectural': '🏛️ Architectural',
    'food': '🍽️ Food',
    'landscape': '🏔️ Landscape'
};

export const ENVIRONMENT_LABELS: Record<string, string> = {
    'studio': 'Studio',
    'interior': 'Interior',
    'exterior': 'Exterior',
    'on_location': 'On Location',
    'abstract': 'Abstract',
    'underwater': 'Underwater',
    'aerial': 'Aerial'
};

export const FRAMING_LABELS: Record<string, string> = {
    'horizontal': 'Horizontal (Landscape)',
    'vertical': 'Vertical (Portrait)',
    'square': 'Square',
    'panoramic': 'Panoramic',
    'cinematic_wide': 'Cinematic Wide'
};

export const LIGHTING_TYPE_LABELS: Record<string, string> = {
    'natural': 'Natural Light',
    'strobe': 'Strobe/Flash',
    'continuous': 'Continuous',
    'softbox': 'Softbox',
    'ring_light': 'Ring Light',
    'led_panel': 'LED Panel',
    'practical': 'Practical (In-Scene)',
    'mixed': 'Mixed Sources',
    'neon': 'Neon',
    'candle': 'Candlelight',
    'window': 'Window Light'
};

export const LIGHTING_QUALITY_LABELS: Record<string, string> = {
    'diffused': 'Diffused',
    'soft': 'Soft',
    'hard': 'Hard',
    'dramatic': 'Dramatic',
    'flat': 'Flat',
    'contrasty': 'High Contrast',
    'ethereal': 'Ethereal'
};

export const ARRANGEMENT_LABELS: Record<string, string> = {
    'hero-center': 'Hero Center',
    'rule-of-thirds': 'Rule of Thirds',
    'golden-ratio': 'Golden Ratio',
    'symmetrical': 'Symmetrical',
    'asymmetric': 'Asymmetric',
    'diagonal': 'Diagonal',
    'pyramid': 'Pyramid',
    'scattered': 'Scattered',
    'layered': 'Layered'
};

export const OUTPUT_RATIO_LABELS: Record<string, string> = {
    '1:1': 'Square (1:1)',
    '4:5': 'Instagram Portrait (4:5)',
    '3:4': 'Classic Portrait (3:4)',
    '2:3': 'Standard Photo (2:3)',
    '9:16': 'Stories/Reels (9:16)',
    '16:9': 'Widescreen (16:9)',
    '2.39:1': 'Cinematic (2.39:1)',
    '21:9': 'Ultra-Wide (21:9)'
};

// ============================================================================
// PROMPT CONSTRUCTION - Flatten to Optimized String
// ============================================================================

export const constructProfessionalPrompt = (data: ProfessionalPrompt, platform: 'midjourney' | 'dalle' | 'flux' | 'sdxl' | 'general' = 'general'): string => {
    if (!data?.subject?.category) return "";

    // Build the core description
    const coreParts: string[] = [];

    // Subject & Purpose
    coreParts.push(`${data.subject.category}`);
    if (data.subject.pose_or_orientation) {
        coreParts.push(data.subject.pose_or_orientation);
    }

    // Scene & Environment
    if (data.scene?.environment) {
        coreParts.push(`${ENVIRONMENT_LABELS[data.scene.environment] || data.scene.environment} setting`);
    }
    if (data.scene?.background?.material) {
        coreParts.push(`${data.scene.background.material} background`);
    }
    if (data.scene?.surface?.material) {
        coreParts.push(`on ${data.scene.surface.material}`);
    }

    // Composition
    if (data.composition?.arrangement) {
        coreParts.push(`${ARRANGEMENT_LABELS[data.composition.arrangement] || data.composition.arrangement} composition`);
    }
    if (data.composition?.camera_height && data.composition.camera_height !== 'eye-level') {
        coreParts.push(`shot from ${data.composition.camera_height.replace(/-/g, ' ')}`);
    }

    // Camera Technical
    if (data.camera?.focal_length_mm) {
        coreParts.push(`${data.camera.focal_length_mm}mm lens`);
    }
    if (data.camera?.aperture_f) {
        coreParts.push(`f/${data.camera.aperture_f}`);
    }
    if (data.camera?.focus_strategy) {
        coreParts.push(data.camera.focus_strategy);
    }

    // Lighting
    if (data.lighting?.primary) {
        const lightParts: string[] = [];
        if (data.lighting.primary.quality) {
            lightParts.push(LIGHTING_QUALITY_LABELS[data.lighting.primary.quality] || data.lighting.primary.quality);
        }
        if (data.lighting.primary.type) {
            lightParts.push(LIGHTING_TYPE_LABELS[data.lighting.primary.type] || data.lighting.primary.type);
        }
        if (lightParts.length > 0) {
            coreParts.push(`${lightParts.join(' ')} from ${data.lighting.primary.direction?.replace(/-/g, ' ') || 'front'}`);
        }
    }
    if (data.lighting?.color_temperature && data.lighting.color_temperature !== 'neutral') {
        coreParts.push(`${data.lighting.color_temperature.replace(/_/g, ' ')} light`);
    }

    // Color & Mood
    if (data.color_grading?.palette?.length > 0) {
        coreParts.push(`color palette: ${data.color_grading.palette.slice(0, 3).join(', ')}`);
    }
    if (data.mood?.length > 0) {
        coreParts.push(data.mood.slice(0, 3).join(', ') + ' mood');
    }

    // Materials & Textures
    if (data.materials?.primary?.length > 0) {
        coreParts.push(`featuring ${data.materials.primary.slice(0, 3).join(', ')}`);
    }
    if (data.materials?.imperfections?.include && data.materials.imperfections.types?.length > 0) {
        coreParts.push(`subtle imperfections: ${data.materials.imperfections.types.slice(0, 2).join(', ')}`);
    }

    // Subject features
    if (data.subject?.features?.length > 0) {
        coreParts.push(data.subject.features.slice(0, 3).join(', '));
    }

    // Post-processing
    if (data.post_processing?.grain && data.post_processing.grain !== 'none') {
        coreParts.push(`${data.post_processing.grain} film grain`);
    }
    if (data.post_processing?.authenticity) {
        coreParts.push(data.post_processing.authenticity);
    }

    // Build the main prompt
    let prompt = coreParts.filter(Boolean).join(', ');

    // Platform-specific formatting
    switch (platform) {
        case 'midjourney':
            const mjFlags: string[] = [];
            if (data.post_processing?.output_ratio) {
                mjFlags.push(`--ar ${data.post_processing.output_ratio}`);
            }
            mjFlags.push('--v 6.1');
            mjFlags.push('--style raw');
            prompt = `/imagine prompt: ${prompt} ${mjFlags.join(' ')}`;
            break;

        case 'dalle':
            prompt = `Create a professional ${PURPOSE_LABELS[data.image_purpose] || data.image_purpose} photograph: ${prompt}. Hyperrealistic, professional photography, 8K resolution.`;
            break;

        case 'flux':
            prompt = `${prompt}, professional photography, cinematic quality, hyperdetailed, 8K UHD`;
            break;

        case 'sdxl':
            const quality = 'masterpiece, best quality, highly detailed, professional photography';
            const negative = data.materials?.imperfections?.include === false
                ? 'blurry, low quality, distorted, watermark'
                : 'blurry, low quality, watermark';
            prompt = `${quality}, ${prompt}\n\nNegative prompt: ${negative}`;
            break;

        default:
            prompt = `${prompt}, professional photography, high quality, detailed`;
    }

    return prompt.trim();
};

// ============================================================================
// COMPACT JSON OUTPUT - For Display
// ============================================================================

export const getPromptSummary = (data: ProfessionalPrompt): Record<string, string> => {
    return {
        'Purpose': PURPOSE_LABELS[data.image_purpose] || data.image_purpose,
        'Subject': data.subject?.category || 'N/A',
        'Environment': ENVIRONMENT_LABELS[data.scene?.environment] || data.scene?.environment || 'N/A',
        'Composition': ARRANGEMENT_LABELS[data.composition?.arrangement] || data.composition?.arrangement || 'N/A',
        'Camera': data.camera?.focal_length_mm ? `${data.camera.focal_length_mm}mm f/${data.camera.aperture_f}` : 'N/A',
        'Lighting': data.lighting?.primary?.type ? LIGHTING_TYPE_LABELS[data.lighting.primary.type] : 'N/A',
        'Mood': data.mood?.slice(0, 3).join(', ') || 'N/A',
        'Output': OUTPUT_RATIO_LABELS[data.post_processing?.output_ratio] || data.post_processing?.output_ratio || 'N/A'
    };
};
