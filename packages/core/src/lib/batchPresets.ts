/**
 * Professional Batch Presets
 * Pre-configured bundles optimized for different creative outcomes
 */

export interface BatchPreset {
    id: string;
    name: string;
    icon: string;
    description: string;
    config: {
        tone: 'professional' | 'creative' | 'dramatic' | 'whimsical';
        detailLevel: 'minimal' | 'balanced' | 'elaborate';
        complexity: 'simple' | 'moderate' | 'complex';
        perspective: 'neutral' | 'artistic' | 'technical' | 'cinematic';
        creativeMode: 'structured' | 'experimental';
        originalityLevel: number;
        visualDensity: number;
        persona: 'cinematographer' | 'art_director' | 'storyteller' | 'balanced';
        narrativeArc: 'establishing' | 'tension' | 'resolution' | 'mixed';
        promptLength: 'short' | 'medium' | 'long';
        includeHooks: boolean;
    };
}

export const BATCH_PRESETS: BatchPreset[] = [
    {
        id: 'cinematic_epic',
        name: 'Cinematic Epic',
        icon: '🎬',
        description: 'Dramatic film-quality shots with lens precision',
        config: {
            tone: 'dramatic',
            detailLevel: 'elaborate',
            complexity: 'complex',
            perspective: 'cinematic',
            creativeMode: 'structured',
            originalityLevel: 65,
            visualDensity: 80,
            persona: 'cinematographer',
            narrativeArc: 'tension',
            promptLength: 'long',
            includeHooks: true,
        },
    },
    {
        id: 'commercial_polish',
        name: 'Commercial Polish',
        icon: '💼',
        description: 'Clean, sellable, stock-photo ready',
        config: {
            tone: 'professional',
            detailLevel: 'balanced',
            complexity: 'moderate',
            perspective: 'technical',
            creativeMode: 'structured',
            originalityLevel: 35,
            visualDensity: 60,
            persona: 'art_director',
            narrativeArc: 'establishing',
            promptLength: 'medium',
            includeHooks: false,
        },
    },
    {
        id: 'dreamscape',
        name: 'Dreamscape',
        icon: '🌌',
        description: 'Surreal, imaginative, boundary-pushing',
        config: {
            tone: 'whimsical',
            detailLevel: 'elaborate',
            complexity: 'complex',
            perspective: 'artistic',
            creativeMode: 'experimental',
            originalityLevel: 95,
            visualDensity: 90,
            persona: 'storyteller',
            narrativeArc: 'mixed',
            promptLength: 'long',
            includeHooks: true,
        },
    },
    {
        id: 'technical_precision',
        name: 'Technical Precision',
        icon: '🔬',
        description: 'Exact specifications, reproducible results',
        config: {
            tone: 'professional',
            detailLevel: 'elaborate',
            complexity: 'moderate',
            perspective: 'technical',
            creativeMode: 'structured',
            originalityLevel: 20,
            visualDensity: 70,
            persona: 'balanced',
            narrativeArc: 'establishing',
            promptLength: 'long',
            includeHooks: false,
        },
    },
    {
        id: 'abstract_vision',
        name: 'Abstract Vision',
        icon: '🎨',
        description: 'Minimal, conceptual, artistic statements',
        config: {
            tone: 'creative',
            detailLevel: 'minimal',
            complexity: 'simple',
            perspective: 'artistic',
            creativeMode: 'experimental',
            originalityLevel: 85,
            visualDensity: 30,
            persona: 'art_director',
            narrativeArc: 'resolution',
            promptLength: 'short',
            includeHooks: false,
        },
    },
    {
        id: 'narrative_journey',
        name: 'Narrative Journey',
        icon: '📖',
        description: 'Story-driven, emotionally evocative',
        config: {
            tone: 'dramatic',
            detailLevel: 'elaborate',
            complexity: 'complex',
            perspective: 'cinematic',
            creativeMode: 'experimental',
            originalityLevel: 70,
            visualDensity: 75,
            persona: 'storyteller',
            narrativeArc: 'tension',
            promptLength: 'long',
            includeHooks: true,
        },
    },
];

/**
 * Get a preset by ID
 */
export const getPresetById = (id: string): BatchPreset | undefined => {
    return BATCH_PRESETS.find((p) => p.id === id);
};

/**
 * Apply preset config to current options
 */
export const applyPreset = <T extends Partial<BatchPreset['config']>>(
    currentOptions: T,
    presetId: string
): T => {
    const preset = getPresetById(presetId);
    if (!preset) return currentOptions;
    return { ...currentOptions, ...preset.config };
};
