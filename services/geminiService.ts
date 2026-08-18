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
): Promise<StructuredVisionPrompt> => {
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
      };
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
    };
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
