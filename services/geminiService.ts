import {
  aiGenerateText,
  aiGenerateStructured,
  aiAnalyzeVision,
} from "./aiGatewayClient";

// Exported model constants for backwards compatibility
export const PRIMARY_MODEL = 'custom';
export const STRUCTURED_MODEL = 'custom';
export const FALLBACK_MODEL = 'custom';
export const LOW_COST_MODEL = 'custom';

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

  const schema = {
    type: "object",
    properties: {
      prompts: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["prompts"],
  };

  try {
    const res = await aiGenerateStructured<{ prompts: string[] }>({
      systemPrompt,
      userInput,
      taskType: "structured_json",
      schema,
    });

    if (res.result?.prompts && Array.isArray(res.result.prompts) && res.result.prompts.length > 0) {
      return res.result.prompts;
    }
  } catch (err) {
    console.warn("Structured rewrite fallback:", err);
  }

  // Fallback to text generation if structured JSON parsing had issues
  const textRes = await aiGenerateText({
    systemPrompt,
    userInput,
    taskType: "prompt_enhancement",
  });

  const lines = textRes.result
    .split("\n")
    .map((l) => l.replace(/^[\d.-]+\s*/, "").replace(/^"|"$/g, "").trim())
    .filter((l) => l.length > 10);

  return lines.length > 0
    ? lines.slice(0, 4)
    : [`${userInput}, ${selectedStyle} style, highly detailed visual masterpiece`];
};

export const enhancePrompt = async (
  originalPrompt: string,
  style: string,
  length: "Short" | "Medium" | "Long" = "Long",
): Promise<string> => {
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

  if (length === "Short") {
    systemInstruction += " Keep it punchy, under 15 words.";
  } else if (length === "Long") {
    systemInstruction += " Be extremely verbose, distinct, and descriptive (over 50 words).";
  }

  try {
    const response = await aiGenerateText({
      systemPrompt: systemInstruction,
      userInput: originalPrompt,
      taskType: "prompt_enhancement",
    });

    return response.result?.trim() || `${originalPrompt}, ${style}, high quality`;
  } catch (error) {
    console.error("Enhance prompt failed:", error);
    return `${originalPrompt}, ${style}, high quality`;
  }
};

export const enhancePromptWithCreativity = async (
  originalPrompt: string,
  creativityLevel: number,
): Promise<string> => {
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

  try {
    const response = await aiGenerateText({
      systemPrompt: systemInstruction,
      userInput: originalPrompt,
      taskType: "prompt_enhancement",
      temperature: 0.3 + (creativityLevel / 100) * 0.7,
    });

    return response.result?.trim() || originalPrompt;
  } catch (error) {
    console.error("Enhance with creativity failed:", error);
    return originalPrompt;
  }
};

export const describeImageToText = async (
  base64Image: string,
  mimeType: string = "image/jpeg",
): Promise<string> => {
  const prompt = "Describe this image in rich visual detail. Focus on the main subject, setting, lighting, mood, colors, camera framing, and textures so that someone could recreate the scene.";
  const res = await aiAnalyzeVision({
    prompt,
    imageBase64: base64Image,
    mimeType,
  });
  return res.result || "";
};

export const extractPromptFromImage = async (
  base64Image: string,
  mimeType: string = "image/jpeg",
): Promise<string> => {
  const prompt = `Analyze this image and construct a ready-to-use AI image generation prompt (Midjourney style).
Identify the subject, the art style, the lighting style, color palette, camera shot, and renderer cues.
Output ONLY the final image generation prompt text.`;

  const res = await aiAnalyzeVision({
    prompt,
    imageBase64: base64Image,
    mimeType,
  });
  return res.result || "";
};

export const generatePromptFromImage = async (
  base64Image: string,
  mimeType: string,
  style: string | string[] = "Cinematic",
): Promise<string> => {
  const styleStr = Array.isArray(style) ? style.join(", ") : style;
  const prompt = `Analyze this image and reverse-engineer it into a detailed AI generation prompt.
Target style: ${styleStr}.
Include key details: subject, action, lighting, camera angle, and artistic medium.
Output ONLY the prompt text.`;

  const res = await aiAnalyzeVision({
    prompt,
    imageBase64: base64Image,
    mimeType,
  });
  return res.result || "";
};

export interface StructuredVisionPrompt {
  subject: string;
  composition: string;
  camera: string;
  lighting: string;
  colorPalette: string;
  materials: string;
  style: string;
  mood: string;
  textInImage: string;
  negativePrompt: string;
  assembledPrompt: string;
}

export const generateStructuredVisionPrompt = async (
  base64Image: string,
  mimeType: string,
  styles: string[] = [],
  preferredModel?: string,
  preferFree = true,
  opts?: { signal?: AbortSignal },
): Promise<StructuredVisionPrompt & { durationMs?: number; model?: string; provider?: string }> => {
  const styleList = styles.join(", ");
  const styleInstruction = styleList
    ? `TARGET AESTHETICS: ${styleList}`
    : "TARGET AESTHETICS: None selected. Describe the image's observed visual style without applying a preset.";
  const systemPrompt = `You are an expert AI Vision Analyst and Creative Prompt Architect.
Analyze the provided image in exhaustive detail and reverse-engineer it into a structured prompt breakdown.

${styleInstruction}

OUTPUT FORMAT:
Return valid JSON matching this schema:
{
  "subject": "Detailed breakdown of the primary subject, expressions, attire, and poses",
  "composition": "Rule of thirds, symmetry, perspective, depth layers",
  "camera": "Lens, focal length, angle (e.g. 50mm f/1.8, low-angle shot)",
  "lighting": "Key light, rim light, ambient, shadows, volumetric cues",
  "colorPalette": "Dominant tones, saturation, harmony, color accents",
  "materials": "Textures, surfaces, fabric details, finishes",
  "style": "Observed visual style from the image",
  "mood": "Atmospheric, emotional vibe",
  "textInImage": "Preserve any exact visible words or text found in the image, or empty string if none",
  "negativePrompt": "Elements to avoid (e.g. blurry, low quality, artifacts)",
  "assembledPrompt": "Complete, production-ready image generation prompt synthesizing all above elements"
}`;

  const schema = {
    type: "object",
    properties: {
      subject: { type: "string" },
      composition: { type: "string" },
      camera: { type: "string" },
      lighting: { type: "string" },
      colorPalette: { type: "string" },
      materials: { type: "string" },
      style: { type: "string" },
      mood: { type: "string" },
      textInImage: { type: "string" },
      negativePrompt: { type: "string" },
      assembledPrompt: { type: "string" },
    },
    required: ["subject", "assembledPrompt"],
  };

  try {
    const rawRes = await aiAnalyzeVision({
      prompt: systemPrompt,
      imageBase64: base64Image,
      mimeType,
      preferredModel: preferredModel || undefined,
      preferFree,
      signal: opts?.signal,
    });

    let parsed: any;
    try {
      const match = rawRes.result.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      const jsonStr = match ? match[1].trim() : rawRes.result.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      // Fallback assembly if direct JSON parse had issues
      return {
        subject: rawRes.result.slice(0, 150),
        composition: "Dynamic framing",
        camera: "Cinematic shot",
        lighting: "Dramatic illumination",
        colorPalette: "Rich color grading",
        materials: "High fidelity textures",
        style: styleList,
        mood: "Atmospheric",
        textInImage: "",
        negativePrompt: "blurry, low quality, distortion",
        assembledPrompt: rawRes.result.trim(),
        durationMs: (rawRes as any).durationMs,
        model: (rawRes as any).model,
        provider: (rawRes as any).provider,
      } as any;
    }

    return {
      subject: parsed.subject || "Detailed subject",
      composition: parsed.composition || "Balanced composition",
      camera: parsed.camera || "Cinematic 50mm",
      lighting: parsed.lighting || "Atmospheric lighting",
      colorPalette: parsed.colorPalette || "Curated palette",
      materials: parsed.materials || "Photorealistic surfaces",
      style: parsed.style || styleList,
      mood: parsed.mood || "Cinematic",
      textInImage: parsed.textInImage || "",
      negativePrompt: parsed.negativePrompt || "blurry, artifacts, bad anatomy",
      assembledPrompt: parsed.assembledPrompt || `${parsed.subject}, ${parsed.lighting}, ${parsed.style}`,
      durationMs: (rawRes as any).durationMs,
      model: (rawRes as any).model,
      provider: (rawRes as any).provider,
    } as any;
  } catch (err: any) {
    console.error("Structured vision analysis failed:", err);
    throw err;
  }
};


export interface BatchGenerationOptions {
  basePrompt: string;
  count?: number;
  creativity?: number;
  style?: string;
  artStyle?: string;
  aspectRatio?: string;
  focusKeywords?: string[];
  detailLevel?: string;
  tone?: string;
  complexity?: string;
  perspective?: string;
  lighting?: string[];
  cameraAngle?: string;
  negativePrompt?: string;
  promptLength?: string;
  includeHooks?: boolean;
  targetPlatform?: string;
  creativeMode?: 'structured' | 'experimental';
  narrativeArc?: string;
  visualDensity?: number;
  originalityLevel?: number;
  persona?: string;
}

export const generateBatchPrompts = async (
  options: BatchGenerationOptions,
): Promise<string[]> => {
  const count = options.count || 3;
  const targetStyle = options.artStyle || options.style || "Cinematic";
  const creativity = options.originalityLevel ?? options.creativity ?? 50;

  const extraDetails = [
    options.focusKeywords?.length ? `Keywords: ${options.focusKeywords.join(', ')}` : null,
    options.tone ? `Tone: ${options.tone}` : null,
    options.detailLevel ? `Detail Level: ${options.detailLevel}` : null,
    options.perspective ? `Perspective: ${options.perspective}` : null,
    options.lighting?.length ? `Lighting: ${options.lighting.join(', ')}` : null,
    options.cameraAngle ? `Camera Angle: ${options.cameraAngle}` : null,
    options.aspectRatio ? `Aspect Ratio: ${options.aspectRatio}` : null,
    options.targetPlatform ? `Platform: ${options.targetPlatform}` : null,
    options.narrativeArc ? `Narrative Arc: ${options.narrativeArc}` : null,
  ].filter(Boolean).join('; ');

  const systemPrompt = `You are an expert prompt engineer generating a batch of diverse prompt variations for AI image generators.
Generate exactly ${count} unique, high-quality prompt variations based on the base concept: "${options.basePrompt}".
Target Style: ${targetStyle}.
Creativity Level: ${creativity}%.
${extraDetails ? `Creative Guidelines: ${extraDetails}` : ''}
Each variation must explore a distinct lighting setup, camera angle, atmospheric mood, or compositional element while maintaining the core subject.
Return ONLY a valid JSON object: { "prompts": ["prompt 1", "prompt 2", ...] }`;

  const schema = {
    type: "object",
    properties: {
      prompts: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["prompts"],
  };

  try {
    const res = await aiGenerateStructured<{ prompts: string[] }>({
      systemPrompt,
      userInput: options.basePrompt,
      schema,
      taskType: "structured_json",
      temperature: 0.3 + (creativity / 100) * 0.6,
    });

    if (res.result?.prompts && Array.isArray(res.result.prompts) && res.result.prompts.length > 0) {
      return res.result.prompts;
    }
  } catch (err) {
    console.warn("Batch structured failed, falling back to text:", err);
  }

  const textRes = await aiGenerateText({
    systemPrompt,
    userInput: options.basePrompt,
    taskType: "text_generation",
    temperature: 0.3 + (creativity / 100) * 0.6,
  });

  const lines = textRes.result
    .split("\n")
    .map((l) => l.replace(/^[\d.-]+\s*/, "").replace(/^"|"$/g, "").trim())
    .filter((l) => l.length > 10);

  return lines.length >= count
    ? lines.slice(0, count)
    : lines.length > 0
    ? lines
    : [
        `${options.basePrompt}, ${targetStyle} style, cinematic lighting, ultra-detailed`,
        `${options.basePrompt}, dramatic perspective, ${targetStyle}, volumetric light`,
        `${options.basePrompt}, intimate close-up, intricate details, masterwork`,
      ].slice(0, count);
};

export const generateCreativeMix = async (
  promptOrItems: string | string[],
  style: string = "Cinematic",
  moodOrCustom?: string,
  images?: { base64: string; mimeType: string }[],
): Promise<string> => {
  const elements = Array.isArray(promptOrItems) ? promptOrItems.join(", ") : (promptOrItems || "");
  let imageContext = "";

  if (images && images.length > 0) {
    try {
      const vision = await aiAnalyzeVision({
        prompt: "Analyze the core visual subjects, colors, and atmosphere in this image briefly.",
        imageBase64: images[0].base64,
        mimeType: images[0].mimeType,
      });
      imageContext = vision.result;
    } catch {
      // ignore
    }
  }

  const prompt = `Synthesize the following creative elements into a cohesive, masterpiece image prompt:
Concept & Elements: ${elements}
Style: ${style}
${moodOrCustom ? `Mood / Special Instructions: ${moodOrCustom}` : ""}
${imageContext ? `Reference Image Details: ${imageContext}` : ""}
Output ONLY the synthesized prompt text.`;

  const res = await aiGenerateText({
    systemPrompt: "You are a visionary art director specializing in fusion and creative mixing.",
    userInput: prompt,
    taskType: "prompt_enhancement",
  });

  return res.result?.trim() || elements;
};

export const generateCelebrityPrompt = async (
  celebrityName: string,
  style: string,
  setting: string,
  activity: string,
): Promise<string> => {
  const prompt = `Create a cinematic, respectful, high-fashion art prompt featuring ${celebrityName}.
Setting: ${setting}
Activity: ${activity}
Style: ${style}
Focus on photorealistic lighting, natural expression, elegant attire, and editorial photography standards.
Output ONLY the final prompt.`;

  const res = await aiGenerateText({
    systemPrompt: "You are a celebrity fashion photographer and creative director.",
    userInput: prompt,
    taskType: "prompt_enhancement",
  });

  return res.result?.trim() || `${celebrityName} in ${setting}, ${style} style`;
};

export const generateCelebrityPromptFromImage = async (
  base64Image: string,
  mimeType: string,
  style: string,
  setting: string,
): Promise<string> => {
  const prompt = `Analyze this reference image for facial characteristics and pose.
Create a new prompt in "${style}" style placed in "${setting}".
Output ONLY the generated prompt.`;

  const res = await aiAnalyzeVision({
    prompt,
    imageBase64: base64Image,
    mimeType,
  });

  return res.result || "";
};

export const generateChainSkeleton = async (goal: string): Promise<any> => {
  const systemPrompt = `You are an expert project planner and AI assistant. Given the user's goal, generate a structured Chain-of-Thought (CoT) skeleton.

GOAL: "${goal}"

INSTRUCTIONS:
1. Break down the goal into 3-5 logical "Phases". Each phase should have a clear title.
2. For each phase, propose 3-5 "Steps". Each step needs a concise title and a detailed reasoning/description.
3. Ensure the reasoning for each step explains *why* it's important and *what* it aims to achieve.
4. Return valid JSON: { "phases": [ { "title": "...", "steps": [ { "title": "...", "reasoning": "..." } ] } ] }`;

  const res = await aiGenerateStructured({
    systemPrompt,
    userInput: goal,
    taskType: "structured_json",
  });

  return res.result;
};

// ============================================================================
// ADVANCED PROMPT ENGINEERING & STUDIO ENGINES
// ============================================================================

export interface PersonaPromptOption {
  id: string;
  name: string;
  instruction: string;
}

export const PROMPT_ENGINEERING_PERSONAS: Record<string, { name: string; icon: string; systemDirective: string }> = {
  cinematographer: {
    name: "Cinematographer",
    icon: "🎬",
    systemDirective: "Act as an award-winning Director of Photography and Master Cinematographer. Formulate cinematic prompts focusing on optical geometry, camera bodies (ARRI Alexa, IMAX 70mm), prime lenses (35mm/85mm Anamorphic), lighting ratios, volumetric depth, color grading, and film stocks."
  },
  fashion: {
    name: "Editorial Fashion",
    icon: "📸",
    systemDirective: "Act as a high-end Vogue fashion photographer and creative director. Emphasize couture textiles, sculpted silhouettes, skin texture realism, studio lighting (Rembrandt, softbox catchlights), and editorial composition."
  },
  concept_art: {
    name: "Concept Art / Matte",
    icon: "🚀",
    systemDirective: "Act as a senior environment concept artist and matte painter for AAA films. Emphasize monumental scale, atmospheric depth, complex architecture, terrain storytelling, and ArtStation trending aesthetic."
  },
  anime: {
    name: "Anime / Manga Master",
    icon: "🌅",
    systemDirective: "Act as a visionary anime director (Makoto Shinkai & Studio Ghibli style). Emphasize emotional sky gradients, painterly light bloom, dramatic keyframe angles, expressive character energy, and crisp cel-shading."
  },
  avant_garde: {
    name: "Avant-Garde & Surreal",
    icon: "🔮",
    systemDirective: "Act as an avant-garde surrealist art director. Focus on metaphorical symbolism, juxtaposition of unexpected elements, sculptural textures, dramatic chiaroscuro contrast, and thought-provoking visual tension."
  },
  flux_physics: {
    name: "Flux Pro Physics",
    icon: "⚡",
    systemDirective: "Act as a Flux.1 / DALL-E 3 prompt architect. Construct natural language descriptive paragraphs with rich sensory physics, subsurface scattering, accurate tactile materials, natural hand/eye descriptions, and precise spatial layout."
  }
};

/**
 * Elaborates a simple prompt into an expertly engineered visual prompt tailored by persona
 */
export const aiElaboratePromptWithPersona = async (
  originalPrompt: string,
  personaKey: string = "cinematographer",
  creativityLevel: number = 50,
  platform: string = "Natural Language",
  maxChars: number = 1000
): Promise<string> => {
  const persona = PROMPT_ENGINEERING_PERSONAS[personaKey] || PROMPT_ENGINEERING_PERSONAS.cinematographer;
  const targetChars = Math.min(2000, Math.max(300, maxChars));

  const systemPrompt = `SYSTEM ROLE:
${persona.systemDirective}

TARGET PLATFORM SYNTAX: ${platform}

TASK:
Take the user's raw prompt concept and elaborate it into a world-class, production-ready AI image generation prompt following the style and discipline of your persona.

RULES & CONSTRAINTS:
1. Preserve the user's core subject and focal intent.
2. Layer rich details: Lighting setup, camera framing, color grading, textures, and atmospheric depth.
3. If platform is Midjourney or SDXL, use comma-separated dense descriptive tokens. If Flux or DALL-E 3, use clear descriptive narrative clauses.
4. STRICT CONSTRAINT: Output MUST be under ${targetChars - 40} characters (maximum total budget: ${targetChars} characters).
5. Output ONLY the resulting prompt text. No explanations, no markdown formatting, no quotes.
6. Safe For Work only.`;

  try {
    const response = await aiGenerateText({
      systemPrompt,
      userInput: originalPrompt,
      taskType: "prompt_enhancement",
      temperature: 0.3 + (creativityLevel / 100) * 0.6,
    });

    const result = response.result?.trim() || originalPrompt;
    return result.length > targetChars ? result.slice(0, targetChars - 10) + "..." : result;
  } catch (error) {
    console.error("Persona prompt elaboration failed:", error);
    return `${originalPrompt}, cinematic lighting, highly detailed, 8k masterpiece`;
  }
};



/**
 * Dissects an unformatted raw prompt into structured semantic layers
 */
export const aiDissectPrompt = async (rawPrompt: string): Promise<{
  subject: string;
  environment: string;
  lighting: string;
  camera: string;
  style: string;
  renderEngine: string;
  negativePrompt: string;
  parameters: {
    aspectRatio?: string;
    stylize?: number;
    chaos?: number;
    weird?: number;
    styleRaw?: boolean;
    tile?: boolean;
    quality?: number;
  };
  rawCleanPrompt: string;
}> => {
  // Extract regex parameters first for Midjourney
  let cleanText = rawPrompt;
  const params: any = {};

  const arMatch = cleanText.match(/--ar\s+([^\s]+)/i);
  if (arMatch) {
    params.aspectRatio = arMatch[1];
    cleanText = cleanText.replace(/--ar\s+[^\s]+/i, "");
  }

  const sMatch = cleanText.match(/--s(?:tylize)?\s+(\d+)/i);
  if (sMatch) {
    params.stylize = parseInt(sMatch[1], 10);
    cleanText = cleanText.replace(/--s(?:tylize)?\s+\d+/i, "");
  }

  const cMatch = cleanText.match(/--c(?:haos)?\s+(\d+)/i);
  if (cMatch) {
    params.chaos = parseInt(cMatch[1], 10);
    cleanText = cleanText.replace(/--c(?:haos)?\s+\d+/i, "");
  }

  const wMatch = cleanText.match(/--w(?:eird)?\s+(\d+)/i);
  if (wMatch) {
    params.weird = parseInt(wMatch[1], 10);
    cleanText = cleanText.replace(/--w(?:eird)?\s+\d+/i, "");
  }

  if (/--style\s+raw/i.test(cleanText)) {
    params.styleRaw = true;
    cleanText = cleanText.replace(/--style\s+raw/i, "");
  }

  if (/--tile/i.test(cleanText)) {
    params.tile = true;
    cleanText = cleanText.replace(/--tile/i, "");
  }

  const noMatch = cleanText.match(/--no\s+([^--]+)/i);
  let extractedNegative = "";
  if (noMatch) {
    extractedNegative = noMatch[1].trim();
    cleanText = cleanText.replace(/--no\s+[^--]+/i, "");
  }

  cleanText = cleanText.replace(/--v\s+[^\s]+/i, "").trim();

  const systemPrompt = `You are an AI Prompt Dissector. Given a raw image prompt, decompose it into 6 modular semantic layers:
1. "subject": Main character, object, action, or focal point.
2. "environment": Setting, background, weather, or architecture.
3. "lighting": Lighting style, illumination angle, and atmosphere.
4. "camera": Lens, focal length, framing, or camera perspective.
5. "style": Art style, director/artist cues, or aesthetic genre.
6. "renderEngine": Shaders, film stocks, or texture fidelity notes.
7. "negativePrompt": Elements explicitly marked to avoid, or suggested exclusions.

RAW PROMPT: "${cleanText}"

Return valid JSON:
{
  "subject": "...",
  "environment": "...",
  "lighting": "...",
  "camera": "...",
  "style": "...",
  "renderEngine": "...",
  "negativePrompt": "..."
}`;

  const schema = {
    type: "object",
    properties: {
      subject: { type: "string" },
      environment: { type: "string" },
      lighting: { type: "string" },
      camera: { type: "string" },
      style: { type: "string" },
      renderEngine: { type: "string" },
      negativePrompt: { type: "string" },
    },
    required: ["subject"]
  };

  try {
    const res = await aiGenerateStructured<any>({
      systemPrompt,
      userInput: cleanText,
      taskType: "structured_json",
      schema,
    });

    const parsed = res.result || {};
    return {
      subject: parsed.subject || cleanText.slice(0, 100),
      environment: parsed.environment || "",
      lighting: parsed.lighting || "",
      camera: parsed.camera || "",
      style: parsed.style || "",
      renderEngine: parsed.renderEngine || "",
      negativePrompt: extractedNegative || parsed.negativePrompt || "",
      parameters: params,
      rawCleanPrompt: cleanText,
    };
  } catch (err) {
    console.warn("Dissect fallback:", err);
    return {
      subject: cleanText,
      environment: "",
      lighting: "",
      camera: "",
      style: "",
      renderEngine: "",
      negativePrompt: extractedNegative,
      parameters: params,
      rawCleanPrompt: cleanText,
    };
  }
};

/**
 * Analyzes prompt quality & provides real-time semantic score and optimization tips
 */
export const aiAnalyzePromptQuality = async (
  promptText: string,
  platform: string = "Natural Language"
): Promise<{
  overallScore: number;
  grade: "S" | "A" | "B" | "C" | "D";
  metrics: {
    subjectClarity: number;
    lightingDepth: number;
    opticalCamera: number;
    colorAtmosphere: number;
    platformOptimization: number;
  };
  strengths: string[];
  suggestions: Array<{
    title: string;
    description: string;
    quickFixModifier?: string;
  }>;
}> => {
  if (!promptText || promptText.trim().length < 5) {
    return {
      overallScore: 20,
      grade: "D",
      metrics: {
        subjectClarity: 30,
        lightingDepth: 10,
        opticalCamera: 0,
        colorAtmosphere: 10,
        platformOptimization: 50,
      },
      strengths: ["Clean start"],
      suggestions: [
        {
          title: "Define a clear subject",
          description: "Describe what the primary focal subject is doing or wearing.",
          quickFixModifier: "a detailed cybernetic samurai in ornate armor",
        },
        {
          title: "Add lighting cues",
          description: "Specify lighting setup like Golden Hour or Volumetric God Rays.",
          quickFixModifier: "volumetric god rays, dramatic rim light",
        },
      ],
    };
  }

  const systemPrompt = `You are a Senior AI Prompt Linter and Quality Analyst.
Analyze the following image prompt targeting "${platform}":
"${promptText}"

Evaluate the prompt across 5 key dimensions (0 to 100):
1. subjectClarity: Is the subject well-defined and focused?
2. lightingDepth: Are there clear lighting and shadow cues?
3. opticalCamera: Are camera angles, focal lengths, or lenses specified?
4. colorAtmosphere: Are colors, mood, and materials described?
5. platformOptimization: Is the syntax aligned with best practices for ${platform}?

Calculate overallScore (0-100) as weighted average.
Assign grade: S (90-100), A (80-89), B (70-79), C (55-69), D (<55).
List 1-2 strengths and 1-3 actionable suggestions with quickFixModifier.

Return valid JSON:
{
  "overallScore": 85,
  "grade": "A",
  "metrics": {
    "subjectClarity": 90,
    "lightingDepth": 80,
    "opticalCamera": 75,
    "colorAtmosphere": 85,
    "platformOptimization": 90
  },
  "strengths": ["Strong subject definition", "Good mood atmosphere"],
  "suggestions": [
    {
      "title": "Add lens specification",
      "description": "Specify a portrait prime lens like 85mm f/1.4 for creamy bokeh.",
      "quickFixModifier": "85mm f/1.4 portrait lens, creamy bokeh"
    }
  ]
}`;

  const schema = {
    type: "object",
    properties: {
      overallScore: { type: "number" },
      grade: { type: "string" },
      metrics: {
        type: "object",
        properties: {
          subjectClarity: { type: "number" },
          lightingDepth: { type: "number" },
          opticalCamera: { type: "number" },
          colorAtmosphere: { type: "number" },
          platformOptimization: { type: "number" }
        },
        required: ["subjectClarity", "lightingDepth", "opticalCamera", "colorAtmosphere", "platformOptimization"]
      },
      strengths: { type: "array", items: { type: "string" } },
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            quickFixModifier: { type: "string" }
          },
          required: ["title", "description"]
        }
      }
    },
    required: ["overallScore", "grade", "metrics", "strengths", "suggestions"]
  };

  try {
    const res = await aiGenerateStructured<any>({
      systemPrompt,
      userInput: promptText,
      taskType: "structured_json",
      schema,
      temperature: 0.2,
    });

    if (res.result && typeof res.result.overallScore === "number") {
      return res.result;
    }
  } catch (err) {
    console.warn("Quality linter AI call fallback:", err);
  }

  // Fast heuristic fallback
  const hasLighting = /light|shadow|glow|sun|neon|chiaroscuro|ray/i.test(promptText);
  const hasCamera = /lens|angle|mm|shot|view|close-up|wide|dslr|hasselblad|arri|bokeh/i.test(promptText);
  const hasColor = /color|tone|palette|tint|kodak|portra|monochrome/i.test(promptText);
  const hasStyle = /cinematic|photo|art|anime|painting|render|engine|octane/i.test(promptText);

  let score = 50;
  if (hasLighting) score += 12;
  if (hasCamera) score += 14;
  if (hasColor) score += 12;
  if (hasStyle) score += 12;
  score = Math.min(95, score);

  return {
    overallScore: score,
    grade: score >= 90 ? "S" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D",
    metrics: {
      subjectClarity: 75,
      lightingDepth: hasLighting ? 85 : 35,
      opticalCamera: hasCamera ? 90 : 25,
      colorAtmosphere: hasColor ? 80 : 40,
      platformOptimization: 80,
    },
    strengths: hasStyle ? ["Stylistic direction clearly stated"] : ["Solid baseline subject"],
    suggestions: [
      !hasCamera && {
        title: "Add camera / lens specification",
        description: "Specify a lens like 35mm wide or 85mm portrait for realistic depth.",
        quickFixModifier: "85mm prime lens, shallow depth of field",
      },
      !hasLighting && {
        title: "Define lighting setup",
        description: "Add lighting cues like Volumetric God Rays or Rembrandt softbox.",
        quickFixModifier: "volumetric god rays, dramatic rim lighting",
      },
    ].filter(Boolean) as any,
  };
};

/**
 * Automatically creates smart negative prompt tailored to the positive prompt
 */
export const aiGenerateSmartNegative = async (
  positivePrompt: string,
  platform: string = "Natural Language"
): Promise<string> => {
  const systemPrompt = `You are an AI Negative Prompt Specialist.
Generate a concise, targeted negative prompt for the following positive concept:
"${positivePrompt}"
Platform: ${platform}

TARGET DEFECTS TO PREVENT:
- Distorted anatomy, extra limbs, fused fingers, bad eyes
- Low resolution, compression artifacts, blur, chromatic aberration
- Watermarks, signatures, ugly text, borders
- Plastic/oversaturated look if aiming for photorealism

Output ONLY the negative prompt string (comma-separated). Keep it under 600 characters.`;

  try {
    const res = await aiGenerateText({
      systemPrompt,
      userInput: positivePrompt,
      taskType: "prompt_enhancement",
      temperature: 0.2,
    });
    return res.result?.trim() || "blurry, low quality, bad anatomy, distorted, watermark, text, plastic skin";
  } catch (err) {
    return "blurry, low quality, bad anatomy, extra limbs, watermark, text, deformed";
  }
};

/**
 * Generates 3 distinct stylistic interpretations of a prompt
 */
export const aiGeneratePromptVariations = async (
  originalPrompt: string,
  count: number = 3,
  maxChars: number = 1000
): Promise<Array<{ title: string; prompt: string; description: string; persona: string }>> => {
  const targetChars = Math.min(2000, Math.max(300, maxChars));
  const systemPrompt = `You are a visionary AI Art Director generating ${count} distinct, creative prompt variations for the concept: "${originalPrompt}".

Generate ${count} distinct interpretations:
1. "Cinematic Drama" (Anamorphic, volumetric lighting, film stock)
2. "Editorial High Realism" (Hasselblad portrait, natural textures, studio lighting)
3. "Surreal / Avant-Garde" (Creative fusion, unique art style, unexpected atmosphere)

STRICT RULES:
- Each prompt MUST be under ${targetChars - 40} characters (maximum total budget: ${targetChars} characters).
- Output valid JSON matching this schema:
{
  "variations": [
    {
      "title": "Short catchy title",
      "prompt": "Full generation-ready prompt",
      "description": "1-sentence visual summary",
      "persona": "Cinematic | Editorial | Surreal"
    }
  ]
}`;

  const schema = {
    type: "object",
    properties: {
      variations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            prompt: { type: "string" },
            description: { type: "string" },
            persona: { type: "string" }
          },
          required: ["title", "prompt", "description", "persona"]
        }
      }
    },
    required: ["variations"]
  };

  try {
    const res = await aiGenerateStructured<{ variations: Array<{ title: string; prompt: string; description: string; persona: string }> }>({
      systemPrompt,
      userInput: originalPrompt,
      taskType: "structured_json",
      schema,
      temperature: 0.6,
    });

    if (res.result?.variations && Array.isArray(res.result.variations) && res.result.variations.length > 0) {
      return res.result.variations.slice(0, count);
    }
  } catch (err) {
    console.warn("Prompt variations structured failed, falling back:", err);
  }

  return [
    {
      title: "Cinematic Film Still",
      prompt: `${originalPrompt}, shot on ARRI Alexa LF 85mm anamorphic lens, volumetric lighting, deep cinematic shadow, 8k resolution`,
      description: "Film still with atmospheric lighting and lens flare",
      persona: "Cinematic"
    },
    {
      title: "Editorial High Realism",
      prompt: `${originalPrompt}, Hasselblad H6D-100c, 100mm portrait lens, soft studio diffusion lighting, intricate micro-textures, photorealistic`,
      description: "Editorial studio shoot with authentic natural details",
      persona: "Editorial"
    },
    {
      title: "Surreal Avant-Garde",
      prompt: `${originalPrompt}, conceptual surrealism, ethereal bioluminescent glow, hyper-dimensional geometric lighting, dreamscape aesthetic`,
      description: "Avant-garde dreamlike composition with glowing accents",
      persona: "Surreal"
    }
  ];
};

/**
 * Strips conversational fluff and compresses prompts into dense, high-signal tokens
 */
export const aiCompressPrompt = async (originalPrompt: string, maxChars: number = 600): Promise<string> => {
  const systemPrompt = `You are an AI Prompt Compression and Token Optimizer.
TASK:
- Strip all conversational filler, redundant adjectives, and low-information words.
- Maximize the density of high-impact visual tokens.
- Return a lean, punchy comma-separated token prompt under ${maxChars} characters.
- Output ONLY the compressed prompt text.`;

  try {
    const response = await aiGenerateText({
      systemPrompt,
      userInput: originalPrompt,
      taskType: "prompt_enhancement",
      temperature: 0.2,
    });
    return response.result?.trim() || originalPrompt;
  } catch (error) {
    console.error("Prompt compression failed:", error);
    return originalPrompt;
  }
};

/**
 * Creative Scientist Laboratory: Molecular Prompt Recombination
 * Chemically splices two concepts with a specific fusion ratio (0-100%).
 */
export const aiMolecularRecombination = async (
  compoundA: string,
  compoundB: string,
  fusionRatio: number = 50,
  maxChars: number = 1000
): Promise<string> => {
  const targetChars = Math.min(2000, Math.max(300, maxChars));
  const systemPrompt = `SYSTEM: Creative Scientist Molecular Prompt Synthesizer.
TASK: Chemically fuse Compound A and Compound B into a single avant-garde, hyper-detailed prompt.
Compound A Weight: ${100 - fusionRatio}%
Compound B Weight: ${fusionRatio}%

RULES:
- Synthesize an organic hybrid where visual motifs, shaders, and materials from both compounds intertwine seamlessly.
- Preserve key subject traits while cross-pollinating lighting, optics, and aesthetic DNA.
- Strictly under ${targetChars - 40} characters (maximum total budget: ${targetChars} characters).
- Output ONLY the synthesized prompt string.`;

  const userInput = `Compound A: "${compoundA}"\nCompound B: "${compoundB}"\nFusion Ratio: ${fusionRatio}% Compound B`;

  try {
    const res = await aiGenerateText({
      systemPrompt,
      userInput,
      taskType: "prompt_enhancement",
      temperature: 0.7,
    });
    return res.result?.trim() || `${compoundA}, hybridized with ${compoundB}, molecular synthesis, complex textures`;
  } catch (err) {
    return `${compoundA}, fused with ${compoundB}, cinematic synthesis, intricate detail`;
  }
};

/**
 * Creative Scientist Laboratory: Quantum Entropy & Genetic Mutation
 * Mutates a prompt by perturbing tokens according to an entropy coefficient.
 */
export const aiQuantumEntropyMutate = async (
  basePrompt: string,
  entropy: number = 40,
  maxChars: number = 1000
): Promise<string> => {
  const targetChars = Math.min(2000, Math.max(300, maxChars));
  const systemPrompt = `SYSTEM: Quantum Prompt Mutation Engine.
TASK: Apply controlled quantum entropy / genetic mutation to the input prompt.
Entropy Level: ${entropy}% (${entropy < 30 ? "Subtle harmonic drift" : entropy < 70 ? "Moderate stylistic mutation" : "Radical avant-garde quantum divergence"})

MUTATION DIRECTIVES:
- Swap predictable adjectives for exotic optical, material, or biological descriptors.
- Modulate the lighting wavelength, camera lens geometry, and atmospheric viscosity.
- Keep the core semantic anchor recognizable if entropy < 60%.
- Strictly under ${targetChars - 40} characters (maximum total budget: ${targetChars} characters).
- Output ONLY the mutated prompt string.`;

  try {
    const res = await aiGenerateText({
      systemPrompt,
      userInput: basePrompt,
      taskType: "prompt_enhancement",
      temperature: Math.min(1.0, 0.3 + (entropy / 100) * 0.7),
    });
    return res.result?.trim() || basePrompt;
  } catch (err) {
    return basePrompt;
  }
};
