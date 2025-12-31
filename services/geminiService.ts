import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { createAIClient, executeWithRetry, reportKeyError, reportKeySuccess, PRIMARY_MODEL, STRUCTURED_MODEL } from "./apiKeyManager";

// Task type constants
type TaskType = 'image_generation' | 'prompt_enhancement' | 'text_generation' | 'structured_json';

// Helper to create AI client for specific task type
const getAIClient = (taskType: TaskType = 'text_generation') => {
  return createAIClient(taskType);
};

// Helper for timeout - 15 second default for faster failure detection
const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), ms));

const withTimeout = <T>(promise: Promise<T>, ms: number = 15000): Promise<T> => {
  return Promise.race([promise, timeout(ms)]) as Promise<T>;
};

const fileToGenerativePart = (base64: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
};

const THINKER_INSTRUCTIONS: Record<string, string> = {
  photographer:
    "Act as a professional photographer. Rewrite this description focusing on camera position, lens type (e.g., 35mm, 85mm), f-stop, depth of field, lighting setups, and real-world materials. Describe it as if briefing a photoshoot.",
  painter:
    "Act as a master oil painter. Rewrite the description into an art-piece prompt that highlights brushwork, texture, palette, pigment density, canvas mood, and lighting as paint. Avoid keyword stuffing; describe the scene as a painting coming to life.",
  cgi: "Act as a CGI artist working in Octane/Unreal Engine 5. Emphasize physically based rendering, materials, raytraced lighting, subsurface scattering, volumetrics, and camera movement cues.",
  illustrator:
    "Act as a vector/flat illustrator. Focus on clean linework, bold flat colors, simplified shapes, balance, negative space, and graphic composition. Keep it intentionally designed, not just 'cartoon'.",
  anime:
    "Act as an anime film director. Describe cel shading, Studio Ghibli/MAPPA sensibilities, cinematic framing, storyboard energy, and expressive character posing. Mention lighting as painted light.",
  concept:
    "Act as a concept artist for films/games. Emphasize atmosphere, scale, environment storytelling, matte painting depth, and production-ready readability.",
};

const getLengthGuidance = (value: number) => {
  if (value <= 0.33) {
    return {
      label: "Short / Concise",
      guidance:
        "Keep it lean: 1-2 sentences, high-density descriptors, minimal clauses.",
    };
  }
  if (value >= 0.67) {
    return {
      label: "Long / Verbose",
      guidance:
        "Use 3-5 sentences, layered detail, lighting, mood, materials, environment, and camera notes.",
    };
  }
  return {
    label: "Balanced",
    guidance:
      "2-3 sentences with clear subject, setting, and lighting; keep it readable while detailed.",
  };
};

export const rewritePrompt = async (
  userInput: string,
  selectedStyle: string,
  lengthValue: number,
): Promise<string[]> => {
  const ai = getAIClient();
  const personaInstruction =
    THINKER_INSTRUCTIONS[selectedStyle] ||
    "Act as a senior creative director. Rewrite the description into a vivid, technically aware art prompt.";
  const lengthGuidance = getLengthGuidance(lengthValue);

  const systemPrompt = `SYSTEM ROLE:
${personaInstruction}

TASK:
- Rewrite the USER INPUT into 3-4 distinct prompt options ready for image generation.
- Preserve the subject but allow small composition/mood shifts between options.
- Integrate technical details relevant to the persona (camera, brushwork, rendering engine, or linework).

PROMPT LENGTH MODE: ${lengthGuidance.label} — ${lengthGuidance.guidance}

USER INPUT:
${userInput}

CONSTRAINTS:
1) Each prompt must be under 900 characters.
2) Absolutely Safe-For-Work, no restricted terms.
3) Return valid JSON: { "prompts": ["...", "..."] }`;

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: STRUCTURED_MODEL, // Full flash model for JSON schema
    contents: systemPrompt,
    config: {
      temperature: 0.75,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          prompts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      },
    },
  });

  const parsed = JSON.parse(response.text || "{}");
  if (!parsed.prompts || !Array.isArray(parsed.prompts)) {
    throw new Error("Thinker could not produce prompt options.");
  }
  return parsed.prompts;
};

export const enhancePrompt = async (
  originalPrompt: string,
  style: string,
  length: "Short" | "Medium" | "Long" = "Long",
): Promise<string> => {
  // 1. Construct the "Director" System Instruction
  let systemInstruction = `You are an expert AI Art Director and Prompt Engineer for Midjourney/Stable Diffusion.
  Your task is to rewrite the user's simple description into a highly detailed, creative, and visual prompt.

  User Input: "${originalPrompt}"
  Target Style: "${style}"
  Target Length: "${length}"

  RULES:
  - Do NOT just add the style name. Merge it into the scene.
  - Describe lighting (e.g., volumetric, cinematic, studio).
  - Describe camera angles and lens types (e.g., 85mm, wide-angle).
  - Describe textures and atmosphere.
  - If the User Input is very short, hallucinate creative details that fit the style.
  - Output ONLY the final prompt text. No "Here is the prompt:" prefix.`;

  // 2. Adjust for Length
  if (length === "Short")
    systemInstruction += " Keep it punchy, under 15 words.";
  if (length === "Long")
    systemInstruction +=
      " Be extremely verbose, distinct, and descriptive (over 50 words).";

  // 3. Call Gemini API
  try {
    const ai = getAIClient();
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: systemInstruction,
    });
    return response.text
      ? response.text.trim()
      : `${originalPrompt}, ${style}, high quality`;
  } catch (error) {
    console.error("Thinker failed:", error);
    return `${originalPrompt}, ${style}, high quality`; // Fallback
  }
};

export const enhancePromptWithCreativity = async (
  originalPrompt: string,
  creativityLevel: number, // 0-100 percentage
): Promise<string> => {
  try {
    const ai = getAIClient();

    // Translate creativity level to temperature and guidance
    const temperature = 0.3 + (creativityLevel / 100) * 0.7; // Range: 0.3 to 1.0
    let creativityGuidance = "";

    if (creativityLevel <= 30) {
      creativityGuidance = "Be conservative. Keep the original intent intact while adding minor professional polish. Add subtle technical details only.";
    } else if (creativityLevel <= 70) {
      creativityGuidance = "Be balanced. Enhance the prompt with creative details while respecting the core subject. Add lighting, mood, and composition hints.";
    } else {
      creativityGuidance = "Be highly creative. Transform the prompt into something vivid and imaginative. Add unexpected artistic flourishes, dramatic lighting, unique perspectives, and rich atmospheric details.";
    }

    const systemInstruction = `You are an expert AI Art Director and Prompt Engineer.
    
TASK: Enhance and transform the user's prompt into a vivid, professional-grade image generation prompt.

ORIGINAL PROMPT: "${originalPrompt}"

CREATIVITY MODE (${creativityLevel}%): ${creativityGuidance}

ENHANCEMENT RULES:
1. Preserve the core subject/concept from the original prompt.
2. Add professional photography/art terminology (lighting, composition, lens, textures).
3. Include mood and atmosphere descriptors.
4. Use comma-separated descriptive phrases (ready for AI image generators).
5. Keep the output under 800 characters.
6. Output ONLY the enhanced prompt text. No prefixes, explanations, or quotes.
7. Ensure the content is Safe-For-Work.`;

    const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: systemInstruction,
      config: {
        temperature: temperature,
      },
    }));

    const enhancedText = response.text?.trim();
    if (!enhancedText) {
      throw new Error("No enhanced text returned");
    }

    return enhancedText;
  } catch (error) {
    console.error("Creativity enhancement failed:", error);
    // Fallback: return original with basic enhancement
    return `${originalPrompt}, high quality, detailed, professional`;
  }
};

export const describeImageToText = async (
  base64Image: string,
  mimeType: string,
): Promise<string> => {
  const ai = getAIClient();
  const imagePart = fileToGenerativePart(base64Image, mimeType);

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: PRIMARY_MODEL,
    contents: {
      parts: [
        imagePart,
        {
          text: `You are an observant visual analyst. Describe the image in 4-6 sentences.
- Mention subjects, setting, lighting, materials, mood, and notable details.
- Avoid style guesses (do not say "painting" or "3d render"); stay objective.
- Keep it under 900 characters and Safe-For-Work.`,
        },
      ],
    },
  });

  return response.text?.trim() || "Unable to read the image.";
};

export const extractPromptFromImage = async (
  base64Image: string,
  mimeType: string,
): Promise<string> => {
  const ai = getAIClient();
  const imagePart = fileToGenerativePart(base64Image, mimeType);

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: {
      parts: [
        imagePart,
        {
          text: `Describe this image in extreme detail, focusing on subject, lighting, composition, and style. Output ONLY the description.`,
        },
      ],
    },
  });

  return response.text?.trim() || "";
};

export const generatePromptFromImage = async (
  base64Image: string,
  mimeType: string,
  styles: string[],
): Promise<string> => {
  try {
    const ai = getAIClient();
    const imagePart = fileToGenerativePart(base64Image, mimeType);

    const styleInstruction =
      styles.length > 0
        ? `Combine the following artistic styles/approaches: "${styles.join(" + ")}".`
        : "Use a balanced, high-quality descriptive style.";

    const textPart = {
      text: `Analyze this image and generate a descriptive prompt for an AI image generator.

      STYLE INSTRUCTION: ${styleInstruction}

      Focus on visual elements, mood, lighting, composition, and textures.

      CRITICAL CONSTRAINTS:
      1. The output must be strictly UNDER 1000 characters.
      2. Prioritize high-density descriptive keywords and artistic terms over long, flowery sentences to maximize detail within the limit.
      3. Avoid any words that could be considered sensitive or restricted by AI safety filters. Instead, use creative, descriptive, and approachable alternatives to convey concepts metaphorically or artistically.`,
    };

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: { parts: [imagePart, textPart] },
    });

    return response.text?.trim() || "Could not generate description.";
  } catch (error) {
    console.error("Error generating prompt from image:", error);
    throw error;
  }
};

// Advanced Batch Generation Options Interface
export interface BatchGenerationOptions {
  basePrompt: string;
  focusKeywords: string[];
  count: number;
  // Basic variation controls
  detailLevel: 'minimal' | 'balanced' | 'elaborate';
  tone: 'professional' | 'creative' | 'dramatic' | 'whimsical';
  complexity: 'simple' | 'moderate' | 'complex';
  perspective: 'neutral' | 'artistic' | 'technical' | 'cinematic';
  // Advanced options
  lighting?: string[];
  cameraAngle?: string;
  aspectRatio?: string;
  artStyle?: string;
  negativePrompt?: string;
  promptLength?: 'short' | 'medium' | 'long';
  includeHooks?: boolean;
  targetPlatform?: 'midjourney' | 'dalle' | 'sdxl' | 'flux' | 'general';
  // Creative Brain v2 options
  creativeMode?: 'structured' | 'experimental';
  narrativeArc?: 'establishing' | 'tension' | 'resolution' | 'mixed';
  visualDensity?: number; // 0-100
  originalityLevel?: number; // 0-100
  persona?: 'cinematographer' | 'art_director' | 'storyteller' | 'balanced';
  presetId?: string;
}

export const generateBatchPrompts = async (
  options: BatchGenerationOptions
): Promise<string[]> => {
  try {
    const ai = getAIClient();

    const {
      basePrompt,
      focusKeywords,
      count,
      detailLevel,
      tone,
      complexity,
      perspective,
      lighting,
      cameraAngle,
      aspectRatio,
      artStyle,
      negativePrompt,
      promptLength,
      includeHooks,
      targetPlatform,
      // Creative Brain v2 options
      creativeMode = 'structured',
      narrativeArc = 'mixed',
      visualDensity = 60,
      originalityLevel = 50,
      persona = 'balanced',
    } = options;

    // Build instruction components
    const focusInstruction =
      focusKeywords.length > 0
        ? `Focus intensely on these styles/keywords: ${focusKeywords.join(", ")}.`
        : "";

    const negativeInstruction = negativePrompt
      ? `STRICTLY AVOID these elements: ${negativePrompt}.`
      : "";

    const lightingInstruction = lighting && lighting.length > 0
      ? `Use the following lighting styles: ${lighting.join(", ")}.`
      : "";

    const cameraInstruction = cameraAngle
      ? `Shot from ${cameraAngle.replace(/_/g, ' ')} perspective.`
      : "";

    const styleInstruction = artStyle
      ? `Apply "${artStyle}" art style consistently.`
      : "";

    const lengthGuidance = promptLength === 'short'
      ? "Keep each prompt concise (under 100 words)."
      : promptLength === 'long'
        ? "Make each prompt detailed and verbose (150+ words with rich descriptions)."
        : "Use balanced prompt length (80-120 words).";

    const hookInstruction = includeHooks
      ? "Include emotional hooks and evocative language to create impact."
      : "";

    const platformGuidance = targetPlatform && targetPlatform !== 'general'
      ? `Optimize prompts for ${targetPlatform === 'midjourney' ? 'Midjourney (use --ar, --s, --no flags)' :
        targetPlatform === 'dalle' ? 'DALL-E 3 (natural language, detailed descriptions)' :
          targetPlatform === 'sdxl' ? 'Stable Diffusion XL (weighted tags, quality tokens)' :
            'Flux AI (cinematic terms, professional descriptors)'}.`
      : "";

    const aspectInstruction = aspectRatio
      ? `Target aspect ratio: ${aspectRatio}.`
      : "";

    // ═══════════════════════════════════════════════════════════════════════
    // CREATIVE BRAIN V2 - PERSONA & NARRATIVE INTEGRATION
    // ═══════════════════════════════════════════════════════════════════════

    const personaInstructions: Record<string, string> = {
      cinematographer: `You are a MASTER CINEMATOGRAPHER with 30+ years of Oscar-winning experience.
Think in terms of: camera movement (dolly, steadicam, crane), lens selection (anamorphic, prime, telephoto), 
depth of field, aspect ratios, film stock emulation. Use vocabulary like: establishing shot, rack focus, 
dutch angle, golden hour, 35mm, 65mm IMAX, anamorphic squeeze, bokeh.`,
      art_director: `You are a SENIOR ART DIRECTOR from a world-class creative agency.
Think in terms of: color palette harmony, visual hierarchy, composition rules (thirds, golden ratio), 
negative space, texture relationships. Use vocabulary like: complementary colors, visual weight, 
leading lines, gestalt principles, hero placement, color blocking.`,
      storyteller: `You are a LEGENDARY VISUAL STORYTELLER crafting narratives for iconic campaigns.
Think in terms of: emotional narrative, character presence, environmental storytelling, 
tension and resolution, symbolic elements. Use vocabulary like: evokes, resonates, atmosphere, 
tension, serenity, melancholic, triumphant, ethereal.`,
      balanced: `You are an EXPERT CREATIVE DIRECTOR balancing technical excellence with artistic vision.
Synthesize cinematography, art direction, and storytelling for maximum impact.`,
    };

    const narrativeInstructions: Record<string, string> = {
      establishing: "Create ESTABLISHING prompts: wide shots, scene-setting, atmospheric, expository.",
      tension: "Create TENSION prompts: dramatic conflict, close-ups, high contrast, emotional intensity.",
      resolution: "Create RESOLUTION prompts: conclusive, peaceful, balanced compositions, reflective.",
      mixed: "Vary narrative arc across prompts to create a complete visual story with different emotional beats.",
    };

    const densityGuidance = visualDensity <= 25
      ? `SPARSE DENSITY (${visualDensity}%): Minimal elements, single focal point, 1-2 colors max.`
      : visualDensity <= 50
        ? `MODERATE DENSITY (${visualDensity}%): Balanced composition, 3-4 color palette, organized.`
        : visualDensity <= 75
          ? `RICH DENSITY (${visualDensity}%): Layered compositions, detailed environments, textural depth.`
          : `DENSE (${visualDensity}%): Maximum detail saturation, complex layered scenes, full spectrum.`;

    const originalityGuidance = originalityLevel <= 30
      ? `CONSERVATIVE (${originalityLevel}%): Proven approaches, familiar compositions, commercially safe.`
      : originalityLevel <= 60
        ? `BALANCED (${originalityLevel}%): Blend familiar with unexpected, one surprising element per prompt.`
        : originalityLevel <= 85
          ? `CREATIVE (${originalityLevel}%): Unconventional angles, unexpected combinations, genre-blending.`
          : `AVANT-GARDE (${originalityLevel}%): Push absolute boundaries, surreal, dream-like, thought-provoking.`;

    const experimentalBoost = creativeMode === 'experimental'
      ? `\n\nEXPERIMENTAL MODE: Break conventions, inject unexpected references, use poetic language, include one wildcard interpretation.`
      : "";

    // Calculate dynamic temperature
    const baseTemp = originalityLevel <= 30 ? 0.5 : originalityLevel <= 60 ? 0.7 : originalityLevel <= 85 ? 0.85 : 0.95;
    const finalTemp = Math.min(baseTemp + (creativeMode === 'experimental' ? 0.05 : 0), 1.0);

    const systemInstruction = `${personaInstructions[persona] || personaInstructions.balanced}

TASK: Generate ${count} DISTINCT, professional-grade prompt variations.

BASE CONCEPT: "${basePrompt}"

═══════════════════════════════════════════════════════════════════════════════
CREATIVE CALIBRATION
═══════════════════════════════════════════════════════════════════════════════

${narrativeInstructions[narrativeArc] || narrativeInstructions.mixed}
${densityGuidance}
${originalityGuidance}
${experimentalBoost}

═══════════════════════════════════════════════════════════════════════════════
VARIATION CONTROLS
═══════════════════════════════════════════════════════════════════════════════

- Detail Level: ${detailLevel} (${detailLevel === 'minimal' ? 'sparse, key elements only' : detailLevel === 'elaborate' ? 'rich, layered descriptions' : 'balanced detail'})
- Tone: ${tone} (${tone === 'professional' ? 'polished, commercial-ready' : tone === 'dramatic' ? 'intense, high-contrast emotional' : tone === 'whimsical' ? 'playful, imaginative' : 'artistically expressive'})
- Complexity: ${complexity} (${complexity === 'simple' ? 'straightforward composition' : complexity === 'complex' ? 'intricate, multi-element scenes' : 'moderately layered'})
- Perspective: ${perspective}

${focusInstruction}
${lightingInstruction}
${cameraInstruction}
${styleInstruction}
${aspectInstruction}
${hookInstruction}
${platformGuidance}
${negativeInstruction}

═══════════════════════════════════════════════════════════════════════════════
DIVERSITY ENFORCEMENT
═══════════════════════════════════════════════════════════════════════════════

CRITICAL: Each prompt MUST be distinctly different:
✓ Different focal points or subjects
✓ Varied camera angles/perspectives  
✓ Distinct lighting setups
✓ Unique color moods
✓ Different emotional tones

If two prompts feel too similar, REWRITE one to diverge.

═══════════════════════════════════════════════════════════════════════════════
OUTPUT RULES
═══════════════════════════════════════════════════════════════════════════════

1. ${lengthGuidance}
2. Include technical photography/art terms relevant to the persona.
3. Keep all prompts UNDER 1000 characters.
4. Ensure all content is Safe-For-Work.

Output JSON format ONLY: { "prompts": ["prompt1", "prompt2", ...] }`;

    const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
      model: STRUCTURED_MODEL,
      contents: systemInstruction,
      config: {
        responseMimeType: "application/json",
        temperature: finalTemp,
      },
    }), 30000);

    const parsed = JSON.parse(response.text?.trim() || "{}");
    if (parsed.prompts && Array.isArray(parsed.prompts)) {
      return parsed.prompts;
    }
    return [];
  } catch (error) {
    console.error("Batch generation failed:", error);
    return Array(options.count).fill(`${options.basePrompt}, high quality`);
  }
};

export const generateCreativeMix = async (
  prompt: string,
  style: string,
  mood: string,
  images: ({ base64: string; mimeType: string } | null)[] = [],
): Promise<string> => {
  return executeWithRetry('prompt_enhancement', async (ai) => {
    const validImages = images.filter((img) => img !== null) as {
      base64: string;
      mimeType: string;
    }[];
    const imageParts = validImages.map((img) =>
      fileToGenerativePart(img.base64, img.mimeType),
    );

    let imageInstructions = "";
    if (validImages.length === 0) {
      imageInstructions = "- No reference images provided. Rely entirely on the Text Concept.";
    } else {
      let partIndex = 1;
      if (images[0])
        imageInstructions += `- [Image ${partIndex++}]: Use this for Composition/Structure.\n`;
      if (images.length > 1 && images[1])
        imageInstructions += `- [Image ${partIndex++}]: Use this for Art Style/Texture.\n`;
      if (images.length > 2 && images[2])
        imageInstructions += `- [Image ${partIndex++}]: Use this for Lighting/Color Palette.\n`;
    }

    // Inject a random seed string to prevent caching and ensure variety
    const varietySeed = Math.random().toString(36).substring(7);

    const systemInstruction = `You are an expert Visual Alchemist and Prompt Engineer.
    
    **Task:** Create a unified, professional-level image generation prompt.
    **Goal:** The user wants a UNIQUE, CREATIVE, and ARTISTIC interpretation every time.

    **Inputs:**
    - Concept: '${prompt ? prompt : "Analyze the reference images and synthesize a strong concept from them"}'
    - Target Style: '${style || "Creative Mix"}'
    - Mood: '${mood || "Dynamic"}'
    - Variation Seed: '${varietySeed}' (Use this to subtly shift the focus/phrasing)
    ${imageInstructions}

    **Rules:**
    1. Do NOT just list the inputs. Synthesize them into a single, cohesive visual description.
    2. BE CREATIVE. Don't simply describe; *interpret* the concept. Add interesting details that fit the mood.
    3. Use professional photography/art terms (e.g., 'rule of thirds', 'impasto brushwork', 'split-lighting', '85mm lens').
    4. If no text concept is provided, you MUST hallucinate a cohesive scene based on the visuals of the images.
    5. Output ONLY the final detailed prompt.
    6. Ensure the result is different from a generic description.`;

    const textPart = { text: systemInstruction };

    const response: GenerateContentResponse = await withTimeout(ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: { parts: [...imageParts, textPart] },
      config: {
        temperature: 0.9, // Higher temperature for variety
      },
    }));

    return response.text?.trim() || prompt;
  });
};

export const generateCelebrityPrompt = async (
  name: string,
  modifiers: string[],
  extraDetails: string,
): Promise<string> => {
  try {
    const ai = getAIClient();
    const modifiersText =
      modifiers.length > 0 ? modifiers.join(", ") : "Standard Portrait";

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: `Generate a high-end, photorealistic, and detailed AI art prompt for a portrait of the celebrity "${name}".

            SELECTED ATTRIBUTES: ${modifiersText}
            ADDITIONAL USER INSTRUCTIONS: ${extraDetails}

            INSTRUCTIONS:
            1. Synthesize the selected attributes into a cohesive visual description. If a specific Director or Movie Style is mentioned, adopt that specific visual language (lighting, color grading, lens choice).
            2. Focus heavily on facial fidelity, skin texture (pores, imperfections), and realistic eyes.
            3. Use professional photography terminology suitable for the requested vibe.
            4. SAFETY: Ensure the prompt is respectful and Safe-For-Work. Use artistic terms to describe fashion or mood, avoiding restricted content.
            5. LENGTH: Strictly UNDER 1000 characters. High information density.

            Output only the final prompt text.`,
    });
    return response.text?.trim() || "Could not generate celebrity prompt.";
  } catch (error) {
    console.error("Error generating celebrity prompt:", error);
    throw error;
  }
};

export const generateCelebrityPromptFromImage = async (
  name: string,
  base64Image: string,
  mimeType: string,
): Promise<string> => {
  try {
    const ai = getAIClient();
    const imagePart = fileToGenerativePart(base64Image, mimeType);
    const textPart = {
      text: `Analyze the style, lighting, color grading, composition, and "vibe" of this image.

            TASK: Generate a high-fidelity AI art prompt that applies THIS EXACT STYLE to a portrait of "${name}".

            INSTRUCTIONS:
            1. Do NOT describe the person in the uploaded image. Instead, transfer the artistic direction (lens choice, film stock, lighting setup, mood) to the target celebrity: ${name}.
            2. Ensure the description of ${name} is highly realistic and recognizable.
            3. Use technical photography terms derived from the image analysis.
            4. SAFETY: Ensure the output is Safe-For-Work and respectful.
            5. LENGTH: Strictly UNDER 1000 characters.

            Output only the generated prompt.`,
    };

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: { parts: [imagePart, textPart] },
    });

    return response.text?.trim() || "Could not generate prompt from image.";
  } catch (error) {
    console.error("Error generating celebrity prompt from image:", error);
    throw error;
  }
};

export const generateImage = async (
  prompt: string,
  model: "fast" | "premium" = "fast",
  aspectRatio: string = "1:1",
): Promise<string> => {
  return executeWithRetry('image_generation', async (ai) => {
    let imageUrl = "";

    const modelName =
      model === "premium"
        ? "gemini-3-pro-image-preview"
        : "gemini-2.5-flash-image";
    const imageSize = model === "premium" ? "1K" : undefined;

    const response = await withTimeout(ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          ...(imageSize && { imageSize: imageSize as "1K" | "2K" | "4K" }),
        },
      },
    }), 45000); // 45s timeout for images

    const candidates = response.candidates;
    if (
      !candidates ||
      candidates.length === 0 ||
      !candidates[0].content?.parts
    ) {
      const textResponse = response.text?.trim();
      if (textResponse) {
        throw new Error(`Model returned text: "${textResponse}"`);
      }
      throw new Error("No candidates returned from generation model.");
    }

    let foundImage = false;
    for (const part of candidates[0].content.parts) {
      if (part.inlineData) {
        const base64ImageBytes = part.inlineData.data;
        imageUrl = `data:image/png;base64,${base64ImageBytes}`;
        foundImage = true;
        break;
      }
    }

    if (!foundImage) {
      throw new Error(
        "The model generated a text response instead of an image. Try simplifying the prompt.",
      );
    }

    return imageUrl;
  }, 3); // Max 3 retries with different keys
}
export const editImage = async (
  base64Image: string,
  mimeType: string,
  prompt: string,
  maskBase64?: string,
): Promise<string> => {
  return executeWithRetry('image_generation', async (ai) => {
    let imageUrl = "";

    const parts: any[] = [
      { inlineData: { data: base64Image, mimeType: mimeType } },
    ];

    let finalPrompt = prompt || "Enhance this image";

    if (maskBase64) {
      parts.push({ inlineData: { data: maskBase64, mimeType: "image/png" } });
      finalPrompt = `Using the provided mask image (the second image, where content is white on a transparent/black background), apply the following change ONLY to the masked (white) areas. Do not change the unmasked areas. The change to make is: "${prompt}"`;
    }

    parts.push({ text: finalPrompt });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts },
    });

    const candidates = response.candidates;
    if (
      !candidates ||
      candidates.length === 0 ||
      !candidates[0].content?.parts
    ) {
      throw new Error("No candidates returned from generation model.");
    }

    let foundImage = false;
    for (const part of candidates[0].content.parts) {
      if (part.inlineData) {
        const base64ImageBytes = part.inlineData.data;
        imageUrl = `data:image/png;base64,${base64ImageBytes}`;
        foundImage = true;
        break;
      }
    }

    if (!foundImage) {
      throw new Error(
        "The model generated a text response instead of an image.",
      );
    }

    return imageUrl;
  }, 3); // Max 3 retries with different keys
};

export const generateChainSkeleton = async (goal: string): Promise<any> => {
  try {
    const ai = getAIClient();
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: STRUCTURED_MODEL, // Full flash model for JSON schema
      contents: `You are an expert project planner and AI assistant. Given the user's goal, generate a structured Chain-of-Thought (CoT) skeleton.

            GOAL: "${goal}"

            INSTRUCTIONS:
            1. Break down the goal into 3-5 logical "Phases". Each phase should have a clear title.
            2. For each phase, propose 3-5 "Steps". Each step needs a concise title and a detailed reasoning/description.
            3. Ensure the reasoning for each step explains *why* it's important and *what* it aims to achieve.
            4. Use clear, actionable language.
            5. The entire output should be a VALID JSON object, strictly following this schema:
               {
                 "title": "Chain for [User's Goal]",
                 "description": "A step-by-step reasoning chain for achieving the goal: ${goal}",
                 "phases": [
                   {
                     "title": "Phase Title 1",
                     "steps": [
                       {
                         "title": "Step Title 1.1",
                         "reasoning": "Detailed explanation of this step...",
                         "tags": ["planning", "research"]
                       },
                       {
                         "title": "Step Title 1.2",
                         "reasoning": "Detailed explanation of this step...",
                         "tags": ["data"]
                       }
                     ]
                   },
                   {
                     "title": "Phase Title 2",
                     "steps": [...]
                   }
                 ]
               }
            6. SAFETY: Ensure all generated content is professional, respectful, and safe-for-work.`,
      config: {
        responseMimeType: "application/json",
      },
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("No response from AI");

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating chain skeleton:", error);
    throw error;
  }
};

export const generateStepFromInstruction = async (
  instruction: string,
): Promise<{ title: string; reasoning: string; tags: string[] }> => {
  try {
    const ai = getAIClient();
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: STRUCTURED_MODEL, // Full flash model for JSON schema
      contents: `Extract a structured Step from the user's instruction.

        USER INSTRUCTION: "${instruction}"

        INSTRUCTIONS:
        1. Extract a clear Title from the instruction (e.g. "Add step: Define Scope" -> Title: "Define Scope").
        2. Extract or Generate Reasoning. If the user provided reasoning, use it. If not, infer logical reasoning based on the title.
        3. Return a VALID JSON object:
        {
          "title": "Short concise title",
          "reasoning": "Detailed explanation based on the instruction",
          "tags": ["tag1", "tag2"]
        }
        `,
      config: { responseMimeType: "application/json" },
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("No response");
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Error generating step:", error);
    throw error;
  }
};
