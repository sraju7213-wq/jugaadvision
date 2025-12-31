import { z } from 'zod';

// The "Secret" System Schema
export const MasterPromptSchema = z.object({
    image_purpose: z.enum(['still_life', 'portrait', 'landscape', 'editorial', 'concept_art'])
        .describe("The core intent of the shot."),

    scene: z.object({
        environment: z.enum(['studio', 'interior', 'exterior', 'on_location']),
        background: z.object({
            material: z.string().describe("e.g., 'painted wall', 'seamless paper', 'natural scenery'"),
            color_tone: z.enum(['neutral-warm', 'neutral-cool', 'vivid', 'dark']),
            cleanliness: z.enum(['clean', 'textured', 'aged'])
        }),
        surface: z.object({
            material: z.string().describe("What is the subject sitting on? e.g., 'wood', 'stone'"),
            finish: z.enum(['matte', 'satin', 'glossy'])
        }).optional()
    }),

    composition: z.object({
        framing: z.enum(['horizontal', 'vertical', 'square', 'panoramic']),
        camera_height: z.enum(['eye-level', 'slightly above', 'slightly below', 'bird-eye', 'worm-eye']),
        negative_space: z.enum(['tight', 'medium', 'airy']),
        arrangement_notes: z.string().describe("How are elements placed? e.g., 'pyramid', 'asymmetric'")
    }),

    camera: z.object({
        focal_length_mm: z.number().describe("e.g., 35 for cinematic, 85 for portrait, 50 for human-eye"),
        aperture_f: z.number().describe("e.g., 1.4 for blur, 8 for sharp"),
        lens_type: z.enum(['prime', 'zoom', 'macro', 'tilt-shift']),
        focus_strategy: z.string().describe("What is sharp? e.g., 'sharp on eyes, soft background'")
    }),

    lighting: z.object({
        type: z.enum(['natural', 'strobe', 'continuous', 'softbox']),
        direction: z.enum(['left', 'right', 'back', 'top', 'front', 'rim']),
        quality: z.enum(['diffused', 'soft', 'hard', 'dramatic']),
        color_temperature: z.enum(['neutral', 'warm', 'cool', 'golden_hour', 'blue_hour']),
        shadow_behavior: z.enum(['soft edge', 'defined', 'long', 'minimal'])
    }),

    color_grading: z.object({
        palette_keywords: z.array(z.string()).describe("Specific colors, e.g., 'warm beige', 'soft teal'"),
        overall_warmth: z.enum(['cool', 'neutral', 'warm']),
        saturation_level: z.enum(['muted', 'natural', 'vivid', 'black_and_white'])
    }),

    materials_and_texture: z.object({
        primary_materials: z.array(z.string()),
        texture_notes: z.string().describe("Specific tactile details, e.g., 'fine grit', 'brushed lines'"),
        imperfections: z.object({
            include: z.boolean(),
            types: z.array(z.string()).describe("e.g., 'fingerprints', 'dust', 'scratches' (Critical for realism)")
        })
    }),

    mood: z.array(z.string()).describe("Emotional keywords, e.g., 'calm', 'earthy', 'mysterious'"),

    subjects: z.array(z.object({
        category: z.string(),
        pose_or_orientation: z.string(),
        special_features: z.array(z.string()),
        condition: z.string().describe("e.g., 'handmade irregularities', 'pristine'")
    })),

    post_processing: z.object({
        grain: z.enum(['none', 'subtle', 'heavy', 'film']),
        authenticity: z.string().describe("e.g., 'retain crafting marks', 'high-end polish'")
    })
});

export type MasterPrompt = z.infer<typeof MasterPromptSchema>;
