/**
 * Token-Efficient Prompt to JSON Converter
 * 
 * Converts generated prompts to structured JSON locally (no API calls).
 * Uses keyword matching and pattern recognition to classify prompt segments.
 */

// === TYPES ===

export interface JsonPrompt {
    core: {
        subject: string;
        action: string;
    };
    style: {
        type: string;
        references: string[];
    };
    mood: {
        primary: string;
        secondary?: string;
    };
    camera: {
        angle: string;
        lens: string;
    };
    lighting: {
        type: string;
        quality: string;
    };
    colors: string[];
    materials: string[];
    modifiers: string[];
    _raw: string; // Original prompt
}

// === KEYWORD MAPS ===

const STYLE_KEYWORDS: Record<string, string[]> = {
    'cinematic': ['cinematic', 'film', 'movie', 'hollywood', 'blockbuster', 'imax'],
    'photorealistic': ['photorealistic', 'realistic', 'photograph', 'photo', 'hyperrealistic'],
    'anime': ['anime', 'manga', 'ghibli', 'mappa', 'cel-shaded'],
    'digital_art': ['digital art', 'digital painting', 'concept art', 'cg'],
    'oil_painting': ['oil painting', 'oil on canvas', 'impasto', 'painterly'],
    'watercolor': ['watercolor', 'aquarelle', 'wash'],
    'fantasy': ['fantasy', 'magical', 'mythical', 'enchanted'],
    'cyberpunk': ['cyberpunk', 'neon', 'futuristic', 'sci-fi', 'dystopian'],
    'noir': ['noir', 'film noir', 'black and white', 'monochrome'],
    'pop_art': ['pop art', 'andy warhol', 'bold colors', 'graphic'],
    'minimalist': ['minimalist', 'minimal', 'simple', 'clean'],
    'surreal': ['surreal', 'surrealist', 'dali', 'dreamlike'],
};

const MOOD_KEYWORDS: Record<string, string[]> = {
    'epic': ['epic', 'grand', 'majestic', 'powerful', 'heroic'],
    'dramatic': ['dramatic', 'intense', 'tension', 'striking'],
    'peaceful': ['peaceful', 'calm', 'serene', 'tranquil', 'zen'],
    'mysterious': ['mysterious', 'enigmatic', 'eerie', 'haunting'],
    'joyful': ['joyful', 'happy', 'cheerful', 'vibrant', 'playful'],
    'melancholic': ['melancholic', 'sad', 'somber', 'nostalgic', 'bittersweet'],
    'romantic': ['romantic', 'love', 'intimate', 'tender'],
    'dark': ['dark', 'gritty', 'ominous', 'foreboding', 'gothic'],
    'ethereal': ['ethereal', 'dreamy', 'otherworldly', 'celestial'],
    'energetic': ['energetic', 'dynamic', 'action', 'explosive'],
};

const CAMERA_ANGLE_KEYWORDS: Record<string, string[]> = {
    'eye_level': ['eye level', 'straight on', 'front view'],
    'low_angle': ['low angle', 'worm eye', 'looking up', 'from below'],
    'high_angle': ['high angle', 'bird eye', 'looking down', 'from above', 'aerial', 'drone'],
    'dutch_angle': ['dutch angle', 'tilted', 'canted'],
    'close_up': ['close up', 'close-up', 'macro', 'detail shot'],
    'wide_shot': ['wide shot', 'wide angle', 'establishing shot', 'panoramic'],
    'medium_shot': ['medium shot', 'waist shot', 'mid shot'],
};

const LENS_KEYWORDS: Record<string, string[]> = {
    '35mm': ['35mm', '35 mm'],
    '50mm': ['50mm', '50 mm', 'nifty fifty'],
    '85mm': ['85mm', '85 mm', 'portrait lens'],
    'telephoto': ['telephoto', '200mm', '300mm', 'zoom'],
    'wide_angle': ['wide angle', '24mm', '16mm', 'ultra wide'],
    'macro': ['macro', 'macro lens', 'close-up lens'],
    'anamorphic': ['anamorphic', 'cinemascope'],
};

const LIGHTING_TYPE_KEYWORDS: Record<string, string[]> = {
    'natural': ['natural light', 'sunlight', 'daylight', 'golden hour', 'blue hour'],
    'studio': ['studio lighting', 'softbox', 'flash', 'strobe'],
    'volumetric': ['volumetric', 'god rays', 'light rays', 'atmospheric'],
    'neon': ['neon', 'neon lights', 'neon glow'],
    'dramatic': ['dramatic lighting', 'chiaroscuro', 'rembrandt', 'split lighting'],
    'soft': ['soft light', 'diffused', 'overcast'],
    'rim': ['rim light', 'backlit', 'silhouette', 'edge lighting'],
    'cinematic': ['cinematic lighting', 'film lighting', 'three-point'],
};

const LIGHTING_QUALITY_KEYWORDS: Record<string, string[]> = {
    'soft': ['soft', 'diffused', 'gentle', 'even'],
    'hard': ['hard', 'harsh', 'sharp shadows', 'direct'],
    'dramatic': ['dramatic', 'high contrast', 'moody'],
    'ethereal': ['ethereal', 'glowing', 'luminous'],
    'warm': ['warm', 'golden', 'amber', 'orange tones'],
    'cool': ['cool', 'blue tones', 'cold', 'icy'],
};

const COLOR_KEYWORDS = [
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'violet',
    'pink', 'cyan', 'magenta', 'teal', 'coral', 'turquoise', 'gold',
    'silver', 'bronze', 'crimson', 'scarlet', 'navy', 'emerald',
    'amber', 'ivory', 'obsidian', 'pastel', 'muted', 'vibrant',
    'monochrome', 'black and white', 'sepia', 'earth tones',
];

const MATERIAL_KEYWORDS = [
    'glass', 'metal', 'wood', 'stone', 'marble', 'concrete', 'leather',
    'fabric', 'silk', 'velvet', 'fur', 'feathers', 'crystal', 'water',
    'ice', 'fire', 'smoke', 'fog', 'mist', 'clouds', 'sand', 'rust',
    'chrome', 'copper', 'brass', 'steel', 'iron', 'porcelain', 'ceramic',
];

const MODIFIER_KEYWORDS = [
    'highly detailed', 'ultra detailed', '8k', '4k', 'hd', 'uhd',
    'sharp focus', 'intricate', 'masterpiece', 'award winning',
    'trending on artstation', 'unreal engine', 'octane render',
    'ray tracing', 'photorealistic', 'hyperrealistic', 'professional',
    'high quality', 'best quality', 'stunning', 'beautiful',
];

// === HELPER FUNCTIONS ===

function matchKeywords(text: string, keywordMap: Record<string, string[]>): string[] {
    const matches: string[] = [];
    const lowerText = text.toLowerCase();

    for (const [category, keywords] of Object.entries(keywordMap)) {
        if (keywords.some(kw => lowerText.includes(kw))) {
            matches.push(category);
        }
    }

    return matches;
}

function findKeywordsInText(text: string, keywords: string[]): string[] {
    const lowerText = text.toLowerCase();
    return keywords.filter(kw => lowerText.includes(kw.toLowerCase()));
}

function extractSubject(prompt: string): { subject: string; action: string } {
    // Split by common delimiters and take first meaningful segment
    const segments = prompt.split(/[,;.]/).map(s => s.trim()).filter(s => s.length > 0);

    if (segments.length === 0) {
        return { subject: prompt.slice(0, 100), action: '' };
    }

    const firstSegment = segments[0];

    // Try to split into subject and action using common patterns
    const actionPatterns = [
        /^(.+?)\s+(is|are|was|were)\s+(.+)$/i,
        /^(.+?)\s+(standing|sitting|walking|running|flying|floating|looking|holding)(.*)$/i,
        /^(.+?)\s+(in|at|on|by|near|with)(.*)$/i,
    ];

    for (const pattern of actionPatterns) {
        const match = firstSegment.match(pattern);
        if (match) {
            return {
                subject: match[1].trim(),
                action: (match[2] + (match[3] || '')).trim(),
            };
        }
    }

    // Fallback: use first segment as subject
    return {
        subject: firstSegment,
        action: segments.length > 1 ? segments[1] : '',
    };
}

// === MAIN CONVERTER ===

/**
 * Convert a generated prompt to structured JSON format.
 * This is done locally without API calls for token efficiency.
 */
export function convertPromptToJson(prompt: string): JsonPrompt {
    const lowerPrompt = prompt.toLowerCase();

    // 1. Extract core subject and action
    const core = extractSubject(prompt);

    // 2. Match style
    const styleMatches = matchKeywords(prompt, STYLE_KEYWORDS);
    const style = {
        type: styleMatches[0] || 'creative',
        references: styleMatches.slice(1),
    };

    // 3. Match mood
    const moodMatches = matchKeywords(prompt, MOOD_KEYWORDS);
    const mood = {
        primary: moodMatches[0] || 'dynamic',
        secondary: moodMatches[1],
    };

    // 4. Match camera settings
    const angleMatches = matchKeywords(prompt, CAMERA_ANGLE_KEYWORDS);
    const lensMatches = matchKeywords(prompt, LENS_KEYWORDS);
    const camera = {
        angle: angleMatches[0] || 'eye_level',
        lens: lensMatches[0] || '50mm',
    };

    // 5. Match lighting
    const lightingTypeMatches = matchKeywords(prompt, LIGHTING_TYPE_KEYWORDS);
    const lightingQualityMatches = matchKeywords(prompt, LIGHTING_QUALITY_KEYWORDS);
    const lighting = {
        type: lightingTypeMatches[0] || 'natural',
        quality: lightingQualityMatches[0] || 'soft',
    };

    // 6. Extract colors
    const colors = findKeywordsInText(prompt, COLOR_KEYWORDS).slice(0, 5);
    if (colors.length === 0) colors.push('balanced');

    // 7. Extract materials
    const materials = findKeywordsInText(prompt, MATERIAL_KEYWORDS).slice(0, 5);

    // 8. Extract modifiers
    const modifiers = findKeywordsInText(prompt, MODIFIER_KEYWORDS).slice(0, 5);
    if (modifiers.length === 0) modifiers.push('high quality');

    return {
        core,
        style,
        mood,
        camera,
        lighting,
        colors,
        materials,
        modifiers,
        _raw: prompt,
    };
}

/**
 * Enhance the JSON prompt with smart defaults for missing fields.
 * Adds professional touches without API calls.
 */
export function enhanceJsonPrompt(json: JsonPrompt): JsonPrompt {
    const enhanced = { ...json };

    // Add complementary mood if only primary
    if (!enhanced.mood.secondary && enhanced.mood.primary) {
        const complementaryMoods: Record<string, string> = {
            'epic': 'dramatic',
            'peaceful': 'ethereal',
            'mysterious': 'dark',
            'joyful': 'energetic',
            'dramatic': 'intense',
            'romantic': 'ethereal',
        };
        enhanced.mood.secondary = complementaryMoods[enhanced.mood.primary];
    }

    // Ensure at least 2 modifiers
    if (enhanced.modifiers.length < 2) {
        const defaults = ['highly detailed', 'professional'];
        for (const d of defaults) {
            if (!enhanced.modifiers.includes(d)) {
                enhanced.modifiers.push(d);
                if (enhanced.modifiers.length >= 2) break;
            }
        }
    }

    // Add style reference if style is matched but no references
    if (enhanced.style.type && enhanced.style.references.length === 0) {
        const styleReferences: Record<string, string> = {
            'cinematic': 'blockbuster film',
            'photorealistic': 'professional photography',
            'anime': 'Studio Ghibli',
            'digital_art': 'ArtStation trending',
            'cyberpunk': 'Blade Runner',
            'fantasy': 'high fantasy art',
        };
        if (styleReferences[enhanced.style.type]) {
            enhanced.style.references.push(styleReferences[enhanced.style.type]);
        }
    }

    return enhanced;
}

/**
 * Format JSON prompt for display (pretty JSON string)
 */
export function formatJsonPrompt(json: JsonPrompt): string {
    // Create a display version without the raw prompt for cleaner output
    const displayJson = {
        core: json.core,
        style: json.style,
        mood: json.mood,
        camera: json.camera,
        lighting: json.lighting,
        colors: json.colors,
        materials: json.materials,
        modifiers: json.modifiers,
    };

    return JSON.stringify(displayJson, null, 2);
}

/**
 * Main entry point: Convert and enhance a prompt to JSON
 */
export function promptToJson(prompt: string): { json: JsonPrompt; formatted: string } {
    const json = convertPromptToJson(prompt);
    const enhanced = enhanceJsonPrompt(json);
    const formatted = formatJsonPrompt(enhanced);

    return { json: enhanced, formatted };
}
