import { z } from 'zod';

// ============================================================================
// PROFESSIONAL PROMPT ARCHITECTURE (PPA) FOR COMMERCIAL BANNER DESIGN
// Based on the PPA Framework for generating commercial product banner prompts
// ============================================================================

// ============================================================================
// P1. SUBJECT/PRODUCT MODULE - The Focus
// Defines the core product with high fidelity and detail
// ============================================================================

export const MaterialTypeEnum = z.enum([
    'leather', 'metal', 'plastic', 'glass', 'ceramic', 'wood', 'fabric',
    'stone', 'rubber', 'paper', 'composite', 'organic', 'synthetic'
]);

export const TextureFinishEnum = z.enum([
    'matte', 'glossy', 'brushed', 'polished', 'textured', 'smooth',
    'weathered', 'pristine', 'hand-finished', 'raw', 'lacquered'
]);

// ============================================================================
// P2. CONTEXT/SETTING MODULE - The Where & When
// Establishes environment, background, and atmospheric elements
// ============================================================================

export const EnvironmentTypeEnum = z.enum([
    'studio', 'lifestyle', 'urban', 'natural', 'abstract', 'minimalist', 'luxury'
]);

export const BackgroundTypeEnum = z.enum([
    'seamless_white', 'seamless_black', 'gradient', 'textured_wall',
    'marble_surface', 'wooden_table', 'natural_scenery', 'bokeh', 'solid_color'
]);

export const LightingConditionEnum = z.enum([
    'studio_high_key', 'studio_low_key', 'natural_daylight', 'golden_hour',
    'blue_hour', 'dramatic_side', 'soft_diffused', 'cinematic', 'rim_lit'
]);

// ============================================================================
// P3. STYLE/AESTHETIC MODULE - The Look
// Specifies artistic medium, rendering style, and visual quality
// ============================================================================

export const RenderMediumEnum = z.enum([
    'photorealistic', '3d_render', 'product_visualization', 'editorial',
    'commercial_photography', 'lifestyle_photography', 'high_fashion'
]);

export const MoodToneEnum = z.enum([
    'luxury', 'minimal', 'bold', 'elegant', 'playful', 'professional',
    'warm', 'cool', 'energetic', 'calm', 'sophisticated', 'organic'
]);

export const QualityTermEnum = z.enum([
    '4K', '8K', 'ultra_detailed', 'hyperrealistic', 'cinematic_quality',
    'magazine_quality', 'professional_grade', 'high_fidelity'
]);

// ============================================================================
// P4. CONSTRAINTS/TECHNICAL MODULE - The Rules (AUTO-INJECTED)
// Dictates output shape, resolution, consistency, and fidelity
// ============================================================================

export const AspectRatioEnum = z.enum([
    '1:1',    // Instagram Feed, Thumbnails
    '4:5',    // Instagram/Facebook Mobile (Scroll-stopper)
    '16:9',   // Website Headers, YouTube
    '9:16'    // Stories, TikTok, Mobile Full-Screen
]);

export const NegativeSpacePositionEnum = z.enum([
    'left', 'right', 'top', 'bottom', 'top_left', 'top_right',
    'bottom_left', 'bottom_right', 'center'
]);

export const NegativeSpaceAmountEnum = z.enum([
    'minimal', 'medium', 'generous', 'expansive'
]);

export const TargetPlatformEnum = z.enum([
    'general', 'midjourney', 'dalle', 'flux', 'sdxl'
]);



// ============================================================================
// ASPECT RATIO COMMERCIAL USE CASE MAPPING
// ============================================================================

export const ASPECT_RATIO_INFO: Record<string, { label: string; useCase: string; dimensions: string }> = {
    '1:1': {
        label: 'Square',
        useCase: 'Instagram Feed, Product Thumbnails, Profile Images',
        dimensions: '1000×1000'
    },
    '4:5': {
        label: 'Portrait',
        useCase: 'Instagram/Facebook Mobile Feed (Optimal Scroll-stopper)',
        dimensions: '1000×1250'
    },
    '16:9': {
        label: 'Widescreen',
        useCase: 'Website Headers, YouTube Thumbnails, Digital Display Ads',
        dimensions: '1920×1080'
    },
    '9:16': {
        label: 'Vertical',
        useCase: 'Instagram Stories, TikTok, Mobile Full-Screen Ads',
        dimensions: '1080×1920'
    }
};

// ============================================================================
// COMPOSITION PRESETS
// ============================================================================

export const COMPOSITION_PRESETS = {
    'rule_of_thirds_left': {
        label: 'Rule of Thirds (Product Left)',
        description: 'Product positioned on left third, CTA space on right',
        negativeSpacePosition: 'right' as const
    },
    'rule_of_thirds_right': {
        label: 'Rule of Thirds (Product Right)',
        description: 'Product positioned on right third, CTA space on left',
        negativeSpacePosition: 'left' as const
    },
    'hero_center_top': {
        label: 'Hero Center (Top Space)',
        description: 'Product centered with negative space above for text',
        negativeSpacePosition: 'top' as const
    },
    'hero_center_bottom': {
        label: 'Hero Center (Bottom Space)',
        description: 'Product centered with negative space below for CTA',
        negativeSpacePosition: 'bottom' as const
    }
} as const;

// ============================================================================
// MAIN PPA SCHEMA - 4 MODULES
// ============================================================================

export const BannerPromptSchema = z.object({
    // P1: SUBJECT/PRODUCT (The Focus)
    subject: z.object({
        product_name: z.string().describe("Main product identifier (e.g., 'leather bifold wallet')"),
        product_form: z.string().describe("Physical shape and structure (e.g., 'compact rectangular form')"),
        material_composition: z.string().describe("Primary materials (e.g., 'vegetable-tanned full-grain leather')"),
        surface_texture: z.string().describe("Texture details (e.g., 'visible hand-stitching, natural grain')"),
        key_features: z.array(z.string()).max(5).describe("Distinctive features to emphasize"),
        brand_colors: z.array(z.string()).max(5).optional().describe("Brand-specific colors to include"),
        token_weight: z.number().min(1).max(2).default(1.5).describe("Focus weight 1.0-2.0 (higher = more prominent)")
    }),

    // P2: CONTEXT/SETTING (The Where & When)
    context: z.object({
        environment: EnvironmentTypeEnum.describe("Overall scene environment"),
        background_type: BackgroundTypeEnum.describe("Background style"),
        background_description: z.string().optional().describe("Custom background details"),
        surface_material: z.string().optional().describe("What product sits on (e.g., 'marble countertop')"),
        lighting: LightingConditionEnum.describe("Lighting setup"),
        atmosphere_keywords: z.array(z.string()).max(3).optional().describe("Mood-setting atmosphere terms")
    }),

    // P3: STYLE/AESTHETIC (The Look)
    style: z.object({
        medium: RenderMediumEnum.describe("Visual rendering style"),
        quality_terms: z.array(QualityTermEnum).min(1).max(4).describe("Quality descriptors"),
        mood: MoodToneEnum.describe("Overall emotional tone"),
        artistic_reference: z.string().optional().describe("Style reference (e.g., 'Apple product photography')")
    }),

    // P4: CONSTRAINTS/TECHNICAL (The Rules - Auto-injected core elements)
    technical: z.object({
        aspect_ratio: AspectRatioEnum.describe("Output dimensions ratio"),
        negative_space_position: NegativeSpacePositionEnum.describe("Where to leave space for CTA/text"),
        negative_space_amount: NegativeSpaceAmountEnum.describe("How much breathing room"),
        composition_preset: z.string().optional().describe("Optional: use a preset composition"),
        seed: z.number().optional().describe("Seed for consistency (0-4294967295)"),
        platform: TargetPlatformEnum.default('general').describe("Target generation platform")
    })
});

export type BannerPrompt = z.infer<typeof BannerPromptSchema>;

// ============================================================================
// HUMAN-READABLE LABELS FOR UI
// ============================================================================

export const ENVIRONMENT_LABELS: Record<string, string> = {
    'studio': '📷 Studio',
    'lifestyle': '🏠 Lifestyle',
    'urban': '🏙️ Urban',
    'natural': '🌿 Natural',
    'abstract': '🎨 Abstract',
    'minimalist': '⬜ Minimalist',
    'luxury': '✨ Luxury'
};

export const BACKGROUND_LABELS: Record<string, string> = {
    'seamless_white': 'Seamless White',
    'seamless_black': 'Seamless Black',
    'gradient': 'Gradient',
    'textured_wall': 'Textured Wall',
    'marble_surface': 'Marble Surface',
    'wooden_table': 'Wooden Table',
    'natural_scenery': 'Natural Scenery',
    'bokeh': 'Bokeh Background',
    'solid_color': 'Solid Color'
};

export const LIGHTING_LABELS: Record<string, string> = {
    'studio_high_key': '☀️ Studio High-Key',
    'studio_low_key': '🌙 Studio Low-Key',
    'natural_daylight': '🌤️ Natural Daylight',
    'golden_hour': '🌅 Golden Hour',
    'blue_hour': '🌆 Blue Hour',
    'dramatic_side': '🎭 Dramatic Side Light',
    'soft_diffused': '💫 Soft Diffused',
    'cinematic': '🎬 Cinematic',
    'rim_lit': '✨ Rim Lit'
};

export const MEDIUM_LABELS: Record<string, string> = {
    'photorealistic': '📸 Photorealistic',
    '3d_render': '🎮 3D Render',
    'product_visualization': '📦 Product Viz',
    'editorial': '📰 Editorial',
    'commercial_photography': '💼 Commercial Photo',
    'lifestyle_photography': '🏡 Lifestyle Photo',
    'high_fashion': '👗 High Fashion'
};

export const MOOD_LABELS: Record<string, string> = {
    'luxury': '✨ Luxury',
    'minimal': '⬜ Minimal',
    'bold': '🔥 Bold',
    'elegant': '💎 Elegant',
    'playful': '🎈 Playful',
    'professional': '💼 Professional',
    'warm': '🌅 Warm',
    'cool': '❄️ Cool',
    'energetic': '⚡ Energetic',
    'calm': '🌊 Calm',
    'sophisticated': '🎩 Sophisticated',
    'organic': '🌿 Organic'
};

export const NEGATIVE_SPACE_LABELS: Record<string, string> = {
    'left': '⬅️ Left',
    'right': '➡️ Right',
    'top': '⬆️ Top',
    'bottom': '⬇️ Bottom',
    'top_left': '↖️ Top Left',
    'top_right': '↗️ Top Right',
    'bottom_left': '↙️ Bottom Left',
    'bottom_right': '↘️ Bottom Right',
    'center': '⏺️ Center'
};

// ============================================================================
// PROMPT CONSTRUCTION - Flatten PPA to Optimized String
// ============================================================================

export const constructBannerPrompt = (
    data: BannerPrompt,
    platform: 'midjourney' | 'dalle' | 'flux' | 'sdxl' | 'general' = 'general'
): string => {
    if (!data?.subject?.product_name) return "";

    const parts: string[] = [];

    // P1: Subject/Product with token weighting
    const productDesc = [
        data.subject.product_name,
        data.subject.material_composition,
        data.subject.surface_texture
    ].filter(Boolean).join(', ');

    // Add token weight for Midjourney
    if (platform === 'midjourney' && data.subject.token_weight > 1) {
        parts.push(`${productDesc}::${data.subject.token_weight}`);
    } else {
        parts.push(productDesc);
    }

    if (data.subject.product_form) {
        parts.push(data.subject.product_form);
    }

    if (data.subject.key_features?.length) {
        parts.push(data.subject.key_features.slice(0, 3).join(', '));
    }

    // P2: Context/Setting
    if (data.context.environment) {
        parts.push(`${data.context.environment} setting`);
    }
    if (data.context.background_type) {
        parts.push(`${BACKGROUND_LABELS[data.context.background_type] || data.context.background_type} background`);
    }
    if (data.context.surface_material) {
        parts.push(`on ${data.context.surface_material}`);
    }
    if (data.context.lighting) {
        parts.push(`${LIGHTING_LABELS[data.context.lighting]?.replace(/^[^\s]+\s/, '') || data.context.lighting} lighting`);
    }
    if (data.context.atmosphere_keywords?.length) {
        parts.push(data.context.atmosphere_keywords.join(', '));
    }

    // P3: Style/Aesthetic
    if (data.style.medium) {
        parts.push(MEDIUM_LABELS[data.style.medium]?.replace(/^[^\s]+\s/, '') || data.style.medium);
    }
    if (data.style.mood) {
        parts.push(`${data.style.mood} mood`);
    }
    if (data.style.quality_terms?.length) {
        parts.push(data.style.quality_terms.map(q => q.replace(/_/g, ' ')).join(', '));
    }
    if (data.style.artistic_reference) {
        parts.push(`style of ${data.style.artistic_reference}`);
    }

    // P4: Technical Constraints (AUTO-INJECTED)
    // Negative space instruction (critical for commercial banners)
    const spacePos = NEGATIVE_SPACE_LABELS[data.technical.negative_space_position]?.replace(/^[^\s]+\s/, '') || data.technical.negative_space_position;
    parts.push(`ample negative space on ${spacePos} for text overlay`);

    // Construct base prompt
    let prompt = parts.filter(Boolean).join(', ');

    // Platform-specific formatting
    switch (platform) {
        case 'midjourney':
            const mjFlags: string[] = [];
            mjFlags.push(`--ar ${data.technical.aspect_ratio}`);
            if (data.technical.seed) {
                mjFlags.push(`--seed ${data.technical.seed}`);
            }
            mjFlags.push('--v 6.1');
            mjFlags.push('--style raw');
            prompt = `/imagine prompt: ${prompt} ${mjFlags.join(' ')}`;
            break;

        case 'dalle':
            prompt = `Professional commercial product banner: ${prompt}. Hyperrealistic, professional photography, 8K resolution.`;
            break;

        case 'flux':
            prompt = `${prompt}, professional photography, commercial quality, hyperdetailed, 8K UHD, sharp focus`;
            break;

        case 'sdxl':
            const quality = 'masterpiece, best quality, highly detailed, professional photography, commercial product shot';
            prompt = `${quality}, ${prompt}`;
            break;

        default:
            prompt = `${prompt}, professional photography, commercial quality, high detail`;
    }

    return prompt.trim();
};

// ============================================================================
// COMPACT SUMMARY FOR UI DISPLAY
// ============================================================================

export const getBannerPromptSummary = (data: BannerPrompt): Record<string, string> => {
    return {
        'Product': data.subject?.product_name || 'N/A',
        'Material': data.subject?.material_composition || 'N/A',
        'Environment': ENVIRONMENT_LABELS[data.context?.environment] || data.context?.environment || 'N/A',
        'Lighting': LIGHTING_LABELS[data.context?.lighting] || data.context?.lighting || 'N/A',
        'Style': MEDIUM_LABELS[data.style?.medium] || data.style?.medium || 'N/A',
        'Mood': MOOD_LABELS[data.style?.mood] || data.style?.mood || 'N/A',
        'Aspect Ratio': ASPECT_RATIO_INFO[data.technical?.aspect_ratio]?.label || data.technical?.aspect_ratio || 'N/A',
        'CTA Space': NEGATIVE_SPACE_LABELS[data.technical?.negative_space_position] || data.technical?.negative_space_position || 'N/A'
    };
};
