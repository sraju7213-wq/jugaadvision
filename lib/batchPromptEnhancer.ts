/**
 * Batch Prompt Enhancer - Creative Brain v2
 * 
 * Centralized prompt enhancement logic that builds sophisticated
 * system prompts for the batch generator using multi-persona architecture.
 */

// ============================================================================
// PERSONA DEFINITIONS
// ============================================================================

interface PersonaDefinition {
    id: string;
    name: string;
    systemRole: string;
    focusAreas: string[];
    vocabulary: string[];
}

const PERSONAS: Record<string, PersonaDefinition> = {
    cinematographer: {
        id: 'cinematographer',
        name: 'Master Cinematographer',
        systemRole: `You are a world-class cinematographer with 30+ years of experience shooting Oscar-winning films. 
You think in terms of camera movement, lens choice, and emotional impact through visual framing.`,
        focusAreas: [
            'camera angles and movement (dolly, steadicam, crane)',
            'lens selection (anamorphic, prime, telephoto)',
            'depth of field and focus pulls',
            'aspect ratios and cinematic framing',
            'film stock emulation and grain'
        ],
        vocabulary: [
            'establishing shot', 'rack focus', 'pull back reveal', 'dutch angle',
            'golden hour', 'magic hour', 'available light', 'motivated lighting',
            '35mm', '65mm IMAX', 'anamorphic squeeze', 'bokeh', 'flare'
        ]
    },
    art_director: {
        id: 'art_director',
        name: 'Senior Art Director',
        systemRole: `You are a globally renowned Art Director who has led creative teams at top agencies.
You understand color theory, visual hierarchy, composition rules, and brand aesthetics at the highest level.`,
        focusAreas: [
            'color palette harmony and contrast',
            'visual hierarchy and focal points',
            'composition rules (thirds, golden ratio, symmetry)',
            'negative space utilization',
            'texture and material relationships'
        ],
        vocabulary: [
            'complementary colors', 'analogous palette', 'visual weight',
            'leading lines', 'rule of thirds', 'golden spiral', 'gestalt principles',
            'hero placement', 'breathing room', 'color blocking'
        ]
    },
    storyteller: {
        id: 'storyteller',
        name: 'Visual Storyteller',
        systemRole: `You are a legendary visual storyteller who has crafted narratives for iconic campaigns and films.
You understand that every image tells a story and evokes emotion through careful visual choices.`,
        focusAreas: [
            'emotional narrative and mood',
            'character presence and expression',
            'environmental storytelling',
            'tension and resolution in composition',
            'symbolic elements and metaphor'
        ],
        vocabulary: [
            'evokes', 'suggests', 'implies', 'resonates', 'atmosphere',
            'tension', 'serenity', 'momentum', 'stillness', 'anticipation',
            'melancholic', 'triumphant', 'ethereal', 'grounded'
        ]
    },
    balanced: {
        id: 'balanced',
        name: 'Creative Director',
        systemRole: `You are an experienced Creative Director who balances technical excellence with artistic vision.
You synthesize the best practices from cinematography, art direction, and storytelling.`,
        focusAreas: [
            'overall visual impact and cohesion',
            'technical quality and polish',
            'creative interpretation',
            'platform-appropriate optimization',
            'audience engagement'
        ],
        vocabulary: [
            'refined', 'polished', 'striking', 'captivating', 'immersive',
            'professional', 'artistic', 'balanced', 'harmonious', 'impactful'
        ]
    }
};

// ============================================================================
// NARRATIVE ARC TEMPLATES
// ============================================================================

interface NarrativeTemplate {
    instruction: string;
    modifiers: string[];
}

const NARRATIVE_ARCS: Record<string, NarrativeTemplate> = {
    establishing: {
        instruction: 'Create ESTABLISHING prompts that set the scene, introduce the world, and showcase the full context.',
        modifiers: ['wide shot', 'environmental context', 'scene-setting', 'atmospheric', 'expository']
    },
    tension: {
        instruction: 'Create TENSION prompts with dramatic conflict, close-ups, high contrast, and emotional intensity.',
        modifiers: ['close-up', 'intense', 'dramatic contrast', 'emotional peak', 'dynamic']
    },
    resolution: {
        instruction: 'Create RESOLUTION prompts that feel conclusive, peaceful, or reflective with balanced compositions.',
        modifiers: ['balanced', 'serene', 'resolved', 'contemplative', 'harmonious']
    },
    mixed: {
        instruction: 'Vary the narrative arc across prompts to create a complete visual story with different emotional beats.',
        modifiers: ['varied pacing', 'emotional range', 'narrative diversity', 'story arc']
    }
};

// ============================================================================
// VISUAL DENSITY LAYERS
// ============================================================================

const getVisualDensityGuidance = (density: number): string => {
    if (density <= 25) {
        return `VISUAL DENSITY: SPARSE (${density}%)
- Use minimal elements; focus on negative space
- Single focal point with clean, uncluttered backgrounds
- Simple color palette (1-2 colors max)
- Stripped-down compositions; let the subject breathe`;
    }
    if (density <= 50) {
        return `VISUAL DENSITY: MODERATE (${density}%)
- Balanced composition with primary and secondary elements
- Some environmental detail but clearly organized
- 3-4 color palette with clear hierarchy
- Purposeful supporting elements that don't compete`;
    }
    if (density <= 75) {
        return `VISUAL DENSITY: RICH (${density}%)
- Layered compositions with foreground, midground, background
- Detailed environments with meaningful secondary elements
- Rich color variations within a cohesive palette
- Textural depth and material diversity`;
    }
    return `VISUAL DENSITY: DENSE (${density}%)
- Maximum detail saturation without becoming chaotic
- Complex, layered scenes with intricate elements
- Full spectrum color when appropriate
- Rich textures, patterns, and environmental storytelling
- Every area of the frame contains intentional visual information`;
};

// ============================================================================
// ORIGINALITY CALIBRATION
// ============================================================================

const getOriginalityGuidance = (level: number): { guidance: string; temperature: number } => {
    if (level <= 30) {
        return {
            temperature: 0.5,
            guidance: `ORIGINALITY: CONSERVATIVE (${level}%)
- Stick to proven, commercially successful visual approaches
- Use familiar compositions and styles
- Prioritize clarity and accessibility
- Reference well-known aesthetic conventions`
        };
    }
    if (level <= 60) {
        return {
            temperature: 0.7,
            guidance: `ORIGINALITY: BALANCED (${level}%)
- Blend familiar elements with unexpected twists
- Introduce one surprising element per prompt
- Maintain recognizable style but push boundaries
- Creative interpretation within professional limits`
        };
    }
    if (level <= 85) {
        return {
            temperature: 0.85,
            guidance: `ORIGINALITY: CREATIVE (${level}%)
- Embrace unconventional angles and perspectives
- Unexpected color combinations and lighting
- Genre-blending and style fusion
- Metaphorical and symbolic interpretations allowed`
        };
    }
    return {
        temperature: 0.95,
        guidance: `ORIGINALITY: AVANT-GARDE (${level}%)
- Push absolute creative boundaries
- Surreal, unexpected, thought-provoking imagery
- Break conventional rules deliberately
- Dream-like logic and artistic abstraction encouraged
- Create prompts that would surprise even experienced artists`
    };
};

// ============================================================================
// DIVERSITY SCORING INSTRUCTION
// ============================================================================

const DIVERSITY_INSTRUCTION = `
CRITICAL: DIVERSITY ENFORCEMENT
Each prompt MUST be distinctly different. Before finalizing, verify:
1. Different focal points or subjects across prompts
2. Varied camera angles/perspectives
3. Distinct lighting setups
4. Unique color moods or palettes
5. Different emotional tones
6. Varied complexity levels

If two prompts feel too similar, rewrite one to diverge. The goal is a portfolio of CLEARLY DISTINCT options.
`;

// ============================================================================
// MAIN BUILDER FUNCTION
// ============================================================================

export interface CreativeEnhancerOptions {
    persona?: string;
    narrativeArc?: string;
    visualDensity?: number;
    originalityLevel?: number;
    creativeMode?: 'structured' | 'experimental';
}

export interface CreativeSystemPrompt {
    systemPrompt: string;
    temperature: number;
}

export const buildCreativeSystemPrompt = (
    basePrompt: string,
    count: number,
    options: CreativeEnhancerOptions
): CreativeSystemPrompt => {
    const {
        persona = 'balanced',
        narrativeArc = 'mixed',
        visualDensity = 60,
        originalityLevel = 50,
        creativeMode = 'structured',
    } = options;

    const selectedPersona = PERSONAS[persona] || PERSONAS.balanced;
    const narrative = NARRATIVE_ARCS[narrativeArc] || NARRATIVE_ARCS.mixed;
    const densityGuidance = getVisualDensityGuidance(visualDensity);
    const { guidance: originalityGuidance, temperature } = getOriginalityGuidance(originalityLevel);

    const experimentalBoost = creativeMode === 'experimental'
        ? `\n\nEXPERIMENTAL MODE ACTIVATED:
- Break conventional prompt structures when it serves the vision
- Inject unexpected artistic references or hybrid styles
- Use evocative, poetic language alongside technical terms
- Surprise the user with at least one wildcard interpretation`
        : '';

    const systemPrompt = `${selectedPersona.systemRole}

TASK: Generate ${count} DISTINCT, professional-grade image generation prompts based on this concept:

"${basePrompt}"

═══════════════════════════════════════════════════════════════════════════════
YOUR CREATIVE LENS
═══════════════════════════════════════════════════════════════════════════════

${narrative.instruction}
Key modifiers to weave in: ${narrative.modifiers.join(', ')}

${densityGuidance}

${originalityGuidance}
${experimentalBoost}

═══════════════════════════════════════════════════════════════════════════════
PROFESSIONAL VOCABULARY TO INTEGRATE
═══════════════════════════════════════════════════════════════════════════════

Focus Areas: ${selectedPersona.focusAreas.join('; ')}
Vocabulary Bank: ${selectedPersona.vocabulary.slice(0, 8).join(', ')}

${DIVERSITY_INSTRUCTION}

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════

Return ONLY valid JSON: { "prompts": ["prompt1", "prompt2", ...] }
Each prompt: 80-200 words, professional terminology, Safe-For-Work only.`;

    return {
        systemPrompt,
        temperature: Math.min(temperature + (creativeMode === 'experimental' ? 0.05 : 0), 1.0),
    };
};

/**
 * Utility: Get recommended temperature for given options
 */
export const getRecommendedTemperature = (options: CreativeEnhancerOptions): number => {
    const { originalityLevel = 50, creativeMode = 'structured' } = options;
    const base = getOriginalityGuidance(originalityLevel).temperature;
    return creativeMode === 'experimental' ? Math.min(base + 0.05, 1.0) : base;
};
