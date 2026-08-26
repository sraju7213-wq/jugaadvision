import type {
  CanvasEdge,
  CanvasNode,
  CanvasNodeKind,
} from "../components/prompt-builder/InteractiveCanvas";

export type PresetAudience = "professional" | "casual";

export interface NodeCanvasPreset {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  audience: PresetAudience;
  icon: string;
  description: string;
  time: string;
  complexity: "Starter" | "Focused" | "Advanced";
  tags: string[];
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

interface Seed {
  id: string;
  title: string;
  category: string;
  subcategory: string;
  audience: PresetAudience;
  icon: string;
  description: string;
  time: string;
  complexity: NodeCanvasPreset["complexity"];
  tags: string[];
  parts: Array<{
    kind: CanvasNodeKind;
    label: string;
    text: string;
    weight?: number;
  }>;
}

function buildGraph(id: string, parts: Seed["parts"]): Pick<NodeCanvasPreset, "nodes" | "edges"> {
  const nodes: CanvasNode[] = parts.map((part, index) => ({
    id: `${id}-n${index + 1}`,
    kind: part.kind,
    x: 60 + Math.floor(index / 2) * 300,
    y: 65 + (index % 2) * 150,
    label: part.label,
    text: part.text,
    weight: part.weight ?? 1,
  }));

  const output: CanvasNode = {
    id: `${id}-output`,
    kind: "output",
    x: 60 + Math.max(2, Math.ceil(parts.length / 2)) * 300,
    y: 140,
    label: "Output Merge",
    text: "",
  };
  nodes.push(output);

  const edges: CanvasEdge[] = [];
  for (let index = 0; index < parts.length - 1; index += 1) {
    edges.push({
      id: `${id}-e${index + 1}`,
      from: nodes[index].id,
      to: nodes[index + 1].id,
      style: "solid",
    });
  }
  if (parts.length) {
    edges.push({
      id: `${id}-e${parts.length + 1}`,
      from: nodes[parts.length - 1].id,
      to: output.id,
      style: "solid",
    });
  }

  return { nodes, edges };
}

function createPreset(seed: Seed): NodeCanvasPreset {
  return { ...seed, ...buildGraph(seed.id, seed.parts) };
}

const SEEDS: Seed[] = [
  // Visual storytelling
  {
    id: "cinematic-hero-shot",
    title: "Cinematic Hero Shot",
    category: "Visual Storytelling",
    subcategory: "Cinema & Drama",
    audience: "professional",
    icon: "🎬",
    description: "A dependable widescreen hero pipeline for mood, scale, and narrative focus.",
    time: "2 min",
    complexity: "Focused",
    tags: ["cinema", "hero", "anamorphic"],
    parts: [
      { kind: "prompt", label: "Subject", text: "a solitary cybernetic explorer in weathered field gear" },
      { kind: "prompt", label: "Scene", text: "rain-drenched neon alley with distant city lights" },
      { kind: "lighting", label: "Lighting", text: "volumetric mist, teal and amber rim light, deep chiaroscuro" },
      { kind: "camera", label: "Optics", text: "ARRI Alexa LF, 50mm anamorphic lens, low-angle hero framing", weight: 1.2 },
      { kind: "modifier", label: "Finish", text: "cinematic film grain, subtle halation, controlled highlights" },
    ],
  },
  {
    id: "commercial-film-still",
    title: "Commercial Film Still",
    category: "Visual Storytelling",
    subcategory: "Cinema & Drama",
    audience: "professional",
    icon: "📽️",
    description: "Brand-safe cinematic composition with clear subject hierarchy and polished finish.",
    time: "3 min",
    complexity: "Advanced",
    tags: ["campaign", "commercial", "storyboard"],
    parts: [
      { kind: "prompt", label: "Hero Product", text: "a premium electric vehicle parked on a windswept coastal road" },
      { kind: "style", label: "Campaign Tone", text: "confident premium automotive advertising, restrained visual language" },
      { kind: "lighting", label: "Light Direction", text: "sunset backlight, soft fill, crisp rim on metal edges" },
      { kind: "camera", label: "Camera", text: "35mm cinema lens, wide environmental framing, precise leading lines" },
      { kind: "modifier", label: "Post Finish", text: "teal and warm-gold grade, clean reflections, production-ready detail" },
    ],
  },
  {
    id: "cozy-story-moment",
    title: "Cozy Story Moment",
    category: "Visual Storytelling",
    subcategory: "Everyday Scenes",
    audience: "casual",
    icon: "☕",
    description: "A quick, warm setup for personal scenes, moodboards, and everyday storytelling.",
    time: "30 sec",
    complexity: "Starter",
    tags: ["cozy", "daily", "warm"],
    parts: [
      { kind: "prompt", label: "Moment", text: "a person reading beside a rainy window with a mug of tea" },
      { kind: "style", label: "Vibe", text: "soft lifestyle photography, candid and comforting" },
      { kind: "lighting", label: "Light", text: "gentle window light, warm practical lamp glow" },
      { kind: "camera", label: "Framing", text: "35mm lens, intimate medium shot, shallow focus" },
    ],
  },
  {
    id: "travel-postcard",
    title: "Travel Postcard",
    category: "Visual Storytelling",
    subcategory: "Everyday Scenes",
    audience: "casual",
    icon: "🗺️",
    description: "Turn any destination idea into an instantly shareable postcard composition.",
    time: "45 sec",
    complexity: "Starter",
    tags: ["travel", "postcard", "wanderlust"],
    parts: [
      { kind: "prompt", label: "Destination", text: "a colorful hillside village above a bright Mediterranean harbor" },
      { kind: "style", label: "Postcard Style", text: "vibrant travel editorial, optimistic and inviting" },
      { kind: "lighting", label: "Weather", text: "clear late-afternoon sun, sparkling atmosphere" },
      { kind: "camera", label: "View", text: "wide-angle elevated viewpoint, layered depth" },
    ],
  },
  // Brand and commercial
  {
    id: "product-hero-studio",
    title: "Product Hero Studio",
    category: "Brand & Commercial",
    subcategory: "Product & E-commerce",
    audience: "professional",
    icon: "✦",
    description: "Clean product photography starter with repeatable studio lighting and material control.",
    time: "2 min",
    complexity: "Focused",
    tags: ["product", "studio", "ecommerce"],
    parts: [
      { kind: "prompt", label: "Product", text: "a sculptural matte-black fragrance bottle with brushed metal cap" },
      { kind: "prompt", label: "Set", text: "minimal seamless studio sweep with a subtle architectural plinth" },
      { kind: "lighting", label: "Lighting", text: "large diffused key, controlled edge strip, soft grounding shadow" },
      { kind: "camera", label: "Lens", text: "Hasselblad medium format, 100mm macro, centered packshot framing" },
      { kind: "modifier", label: "Retouch", text: "accurate label geometry, premium micro-texture, clean commercial finish" },
    ],
  },
  {
    id: "fashion-editorial-cover",
    title: "Fashion Editorial Cover",
    category: "Brand & Commercial",
    subcategory: "Fashion & Editorial",
    audience: "professional",
    icon: "📸",
    description: "High-fashion portrait graph built for art direction, styling, and campaign consistency.",
    time: "3 min",
    complexity: "Advanced",
    tags: ["fashion", "editorial", "portrait"],
    parts: [
      { kind: "prompt", label: "Model", text: "striking high-fashion model in an architectural silk and glass gown" },
      { kind: "style", label: "Direction", text: "contemporary magazine cover, sculptural pose, elegant restraint" },
      { kind: "lighting", label: "Studio Light", text: "butterfly key light, crisp rim, controlled neutral fill" },
      { kind: "camera", label: "Portrait Lens", text: "85mm portrait prime, eye-level crop, precise facial detail" },
      { kind: "modifier", label: "Finish", text: "natural skin texture, couture fabric detail, sophisticated color grade" },
    ],
  },
  {
    id: "social-drop-launch",
    title: "Social Drop Launch",
    category: "Brand & Commercial",
    subcategory: "Marketing & Social",
    audience: "professional",
    icon: "📣",
    description: "Fast campaign visual structure for launches, announcements, and social cutdowns.",
    time: "90 sec",
    complexity: "Focused",
    tags: ["launch", "social", "campaign"],
    parts: [
      { kind: "prompt", label: "Hero Message", text: "a new limited-edition sneaker floating above a kinetic color field" },
      { kind: "style", label: "Brand Energy", text: "bold streetwear campaign, punchy graphic composition" },
      { kind: "lighting", label: "Light", text: "hard directional flash with colored bounce and dramatic shadow" },
      { kind: "camera", label: "Crop", text: "dynamic 24mm perspective, vertical 4:5 social framing" },
    ],
  },
  {
    id: "weekend-market-flyer",
    title: "Weekend Market Flyer",
    category: "Brand & Commercial",
    subcategory: "Marketing & Social",
    audience: "casual",
    icon: "🛍️",
    description: "A playful, low-friction graph for community events, pop-ups, and personal flyers.",
    time: "45 sec",
    complexity: "Starter",
    tags: ["flyer", "event", "playful"],
    parts: [
      { kind: "prompt", label: "Event", text: "a lively weekend makers market with handmade goods and fresh flowers" },
      { kind: "style", label: "Graphic Style", text: "friendly illustrated poster, hand-lettered energy, cheerful shapes" },
      { kind: "lighting", label: "Palette", text: "sunny warm light, coral, butter yellow, and leafy green" },
      { kind: "modifier", label: "Output", text: "clear negative space for title and date, print-ready poster balance" },
    ],
  },
  // Character and world
  {
    id: "fantasy-character-sheet",
    title: "Fantasy Character Sheet",
    category: "Characters & Worlds",
    subcategory: "Character Design",
    audience: "professional",
    icon: "⚔️",
    description: "Consistent character concept workflow for games, film development, and visual bibles.",
    time: "3 min",
    complexity: "Advanced",
    tags: ["character", "fantasy", "concept"],
    parts: [
      { kind: "prompt", label: "Character", text: "a battle-worn sky pirate captain with a mechanical falcon companion" },
      { kind: "style", label: "Design Language", text: "AAA game concept art, readable silhouette, production-minded details" },
      { kind: "lighting", label: "Key Light", text: "cool overcast sky light with warm reflected brass highlights" },
      { kind: "camera", label: "Presentation", text: "three-quarter full-body character sheet, neutral pose, 50mm lens" },
      { kind: "modifier", label: "Design Notes", text: "turnaround-friendly costume layers, material callouts, clean background" },
    ],
  },
  {
    id: "anime-keyframe",
    title: "Anime Film Keyframe",
    category: "Characters & Worlds",
    subcategory: "Anime & Animation",
    audience: "professional",
    icon: "🌅",
    description: "Emotional animated-film frame with luminous skies, clear staging, and controlled color.",
    time: "2 min",
    complexity: "Focused",
    tags: ["anime", "keyframe", "emotion"],
    parts: [
      { kind: "prompt", label: "Characters", text: "two students meeting beside a wind turbine above a coastal town" },
      { kind: "style", label: "Animation", text: "cinematic hand-painted anime, expressive faces, delicate linework" },
      { kind: "lighting", label: "Sky Light", text: "radiant sunset, peach and violet clouds, soft atmospheric haze" },
      { kind: "camera", label: "Framing", text: "wide cinematic landscape, gentle perspective, emotional distance" },
    ],
  },
  {
    id: "cozy-avatar-maker",
    title: "Cozy Avatar Maker",
    category: "Characters & Worlds",
    subcategory: "Anime & Animation",
    audience: "casual",
    icon: "🧸",
    description: "Friendly avatar setup for profiles, group chats, and personal creative experiments.",
    time: "30 sec",
    complexity: "Starter",
    tags: ["avatar", "cute", "profile"],
    parts: [
      { kind: "prompt", label: "Avatar", text: "a cheerful little fox wearing an oversized mustard sweater and round glasses" },
      { kind: "style", label: "Look", text: "soft illustrated mascot, rounded shapes, charming expression" },
      { kind: "lighting", label: "Light", text: "gentle pastel glow with a tiny warm highlight" },
      { kind: "camera", label: "Crop", text: "centered head-and-shoulders portrait, clean circular-profile composition" },
    ],
  },
  {
    id: "sci-fi-world-establishing",
    title: "Sci-fi World Establishing Shot",
    category: "Characters & Worlds",
    subcategory: "Worldbuilding",
    audience: "professional",
    icon: "🚀",
    description: "Large-scale worldbuilding graph for environments, matte paintings, and pitch decks.",
    time: "4 min",
    complexity: "Advanced",
    tags: ["sci-fi", "worldbuilding", "matte-painting"],
    parts: [
      { kind: "prompt", label: "Landmark", text: "a colossal derelict alien dreadnought fused into a crystalline canyon" },
      { kind: "prompt", label: "World", text: "desolate exoplanet with ringed moons, distant settlements, and dust storms" },
      { kind: "lighting", label: "Atmosphere", text: "bioluminescent crystal glow, hard star backlight, layered haze" },
      { kind: "camera", label: "Scale", text: "extreme wide-angle aerial composition, monumental depth and scale" },
      { kind: "modifier", label: "Render", text: "cinematic matte painting, Unreal Engine environment detail, no text" },
    ],
  },
  // Photography and lifestyle
  {
    id: "portrait-session-pro",
    title: "Portrait Session Pro",
    category: "Photography & Lifestyle",
    subcategory: "Portraits",
    audience: "professional",
    icon: "🪞",
    description: "Reliable portrait direction with flattering light, skin detail, and lens discipline.",
    time: "2 min",
    complexity: "Focused",
    tags: ["portrait", "studio", "headshot"],
    parts: [
      { kind: "prompt", label: "Subject", text: "confident creative director with expressive eyes and natural textured skin" },
      { kind: "style", label: "Portrait Style", text: "editorial portrait photography, authentic and quietly powerful" },
      { kind: "lighting", label: "Key", text: "large softbox at 45 degrees, gentle fill, subtle hair light" },
      { kind: "camera", label: "Lens", text: "85mm f/1.4 portrait prime, eye-level close-up, soft background falloff" },
    ],
  },
  {
    id: "street-photo-observer",
    title: "Street Photo Observer",
    category: "Photography & Lifestyle",
    subcategory: "Documentary & Travel",
    audience: "professional",
    icon: "🚶",
    description: "Documentary-first setup that keeps moments candid, grounded, and observational.",
    time: "90 sec",
    complexity: "Focused",
    tags: ["street", "documentary", "candid"],
    parts: [
      { kind: "prompt", label: "Moment", text: "a cyclist weaving through a crowded dawn market, unaware of the camera" },
      { kind: "style", label: "Documentary", text: "observational street photography, honest gestures, lived-in detail" },
      { kind: "lighting", label: "Natural Light", text: "overcast morning softness with small pools of shop light" },
      { kind: "camera", label: "Capture", text: "35mm rangefinder, candid medium-wide framing, slight motion blur" },
    ],
  },
  {
    id: "food-menu-hero",
    title: "Food Menu Hero",
    category: "Photography & Lifestyle",
    subcategory: "Food & Hospitality",
    audience: "professional",
    icon: "🍽️",
    description: "Appetite-forward food image pipeline with clean styling and intentional negative space.",
    time: "2 min",
    complexity: "Focused",
    tags: ["food", "menu", "hospitality"],
    parts: [
      { kind: "prompt", label: "Dish", text: "handmade truffle pasta with shaved parmesan, herbs, and glossy sauce" },
      { kind: "style", label: "Styling", text: "premium restaurant menu photography, tactile and abundant but refined" },
      { kind: "lighting", label: "Light", text: "large side window light, soft bounce, appetizing specular highlights" },
      { kind: "camera", label: "Angle", text: "50mm lens, three-quarter table angle, crisp focal dish" },
      { kind: "modifier", label: "Set Detail", text: "natural crumbs and steam, linen texture, deliberate copy space" },
    ],
  },
  {
    id: "weekend-brunch-flatlay",
    title: "Weekend Brunch Flatlay",
    category: "Photography & Lifestyle",
    subcategory: "Food & Hospitality",
    audience: "casual",
    icon: "🥐",
    description: "Instant flatlay recipe for sharing relaxed food moments without overthinking the setup.",
    time: "30 sec",
    complexity: "Starter",
    tags: ["brunch", "flatlay", "lifestyle"],
    parts: [
      { kind: "prompt", label: "Spread", text: "weekend brunch table with pancakes, berries, coffee, and a handwritten note" },
      { kind: "style", label: "Vibe", text: "bright lifestyle flatlay, relaxed, colorful, and inviting" },
      { kind: "lighting", label: "Light", text: "soft morning window light with gentle shadows" },
      { kind: "camera", label: "View", text: "top-down overhead composition, balanced casual arrangement" },
    ],
  },
  // Design and 3D
  {
    id: "isometric-diorama",
    title: "Isometric 3D Diorama",
    category: "Design & 3D",
    subcategory: "3D & Illustration",
    audience: "professional",
    icon: "🧊",
    description: "A production-friendly miniature world setup for explainers, icons, and product stories.",
    time: "2 min",
    complexity: "Focused",
    tags: ["3d", "isometric", "diorama"],
    parts: [
      { kind: "prompt", label: "Subject", text: "a cozy ramen shop with glowing paper lanterns and rising steam" },
      { kind: "prompt", label: "World", text: "floating isometric cube island with cherry blossoms and cobblestone path" },
      { kind: "lighting", label: "Light", text: "warm interior glow, soft dusk ambient light, gentle occlusion" },
      { kind: "camera", label: "Projection", text: "orthographic isometric view, 45-degree angle, tilt-shift miniature effect" },
      { kind: "modifier", label: "Render", text: "clean low-poly geometry, Blender Cycles, smooth matte materials" },
    ],
  },
  {
    id: "app-ui-mockup",
    title: "App UI Mockup Scene",
    category: "Design & 3D",
    subcategory: "Product Design",
    audience: "professional",
    icon: "▦",
    description: "Fast visual direction for polished product mockups, launch decks, and interface explorations.",
    time: "2 min",
    complexity: "Focused",
    tags: ["ui", "mockup", "product-design"],
    parts: [
      { kind: "prompt", label: "Interface", text: "a refined mobile finance app dashboard with clear charts and calm hierarchy" },
      { kind: "style", label: "Design System", text: "minimal editorial UI, precise spacing, premium neutral palette" },
      { kind: "lighting", label: "Scene Light", text: "soft studio gradient with a controlled shadow under the device" },
      { kind: "camera", label: "Presentation", text: "three-quarter product angle, 50mm lens, generous negative space" },
      { kind: "modifier", label: "Detail", text: "sharp screen readability, realistic glass reflections, clean presentation" },
    ],
  },
  {
    id: "poster-collage-playground",
    title: "Poster Collage Playground",
    category: "Design & 3D",
    subcategory: "Graphic Experiments",
    audience: "casual",
    icon: "✂️",
    description: "An energetic playground for personal posters, playlists, wallpapers, and visual experiments.",
    time: "45 sec",
    complexity: "Starter",
    tags: ["poster", "collage", "experimental"],
    parts: [
      { kind: "prompt", label: "Theme", text: "a dreamy late-night city collage with a floating cassette and handwritten notes" },
      { kind: "style", label: "Texture", text: "cut-paper collage, photocopy grain, imperfect analog edges" },
      { kind: "lighting", label: "Color", text: "electric magenta and cobalt blue with flashes of warm yellow" },
      { kind: "modifier", label: "Layout", text: "layered poster composition with open space for a custom title" },
    ],
  },
  {
    id: "luxury-packaging-render",
    title: "Luxury Packaging Render",
    category: "Design & 3D",
    subcategory: "Product Design",
    audience: "professional",
    icon: "◇",
    description: "Material-first packaging setup for concept approval and premium product visualization.",
    time: "3 min",
    complexity: "Advanced",
    tags: ["packaging", "luxury", "render"],
    parts: [
      { kind: "prompt", label: "Pack", text: "minimalist embossed skincare bottle and rigid paper box in ivory and champagne" },
      { kind: "style", label: "Art Direction", text: "quiet luxury product render, precise typography zones, tactile materials" },
      { kind: "lighting", label: "Light", text: "large soft source, thin rim highlights, subtle grounding gradient" },
      { kind: "camera", label: "Lens", text: "70mm product lens, front three-quarter hero angle, macro detail" },
      { kind: "modifier", label: "Materials", text: "accurate paper grain, foil stamping, believable glass and liquid refraction" },
    ],
  },
  // Video and motion
  {
    id: "cinematic-camera-move",
    title: "Cinematic Camera Move",
    category: "Video & Motion",
    subcategory: "Camera Direction",
    audience: "professional",
    icon: "🎥",
    description: "Motion-ready graph with explicit camera language for video generators and storyboards.",
    time: "2 min",
    complexity: "Focused",
    tags: ["video", "camera", "runway"],
    parts: [
      { kind: "prompt", label: "Subject", text: "an astronaut floating inside an ancient greenhouse orbital habitat" },
      { kind: "prompt", label: "Action", text: "water droplets and tropical leaves drifting slowly in zero gravity" },
      { kind: "lighting", label: "Light", text: "hard sunlight through orbital windows with moving geometric beams" },
      { kind: "camera", label: "Motion", text: "slow continuous orbit, steady forward drift, 35mm cinema lens" },
      { kind: "modifier", label: "Temporal", text: "stable geometry, coherent motion vectors, no temporal flicker" },
    ],
  },
  {
    id: "vertical-reel-beat",
    title: "Vertical Reel Beat",
    category: "Video & Motion",
    subcategory: "Social Video",
    audience: "professional",
    icon: "▮",
    description: "Quick vertical-first setup for product reveals, creator reels, and social cutdowns.",
    time: "60 sec",
    complexity: "Focused",
    tags: ["reel", "vertical", "social-video"],
    parts: [
      { kind: "prompt", label: "Hero", text: "a colorful iced drink sliding onto a sunlit cafe counter" },
      { kind: "style", label: "Social Tone", text: "punchy creator content, crisp textures, satisfying visual rhythm" },
      { kind: "lighting", label: "Light", text: "bright directional daylight with sparkling condensation highlights" },
      { kind: "camera", label: "Move", text: "fast push-in followed by a smooth half-orbit, vertical 9:16 framing" },
    ],
  },
  {
    id: "dreamy-loop",
    title: "Dreamy Seamless Loop",
    category: "Video & Motion",
    subcategory: "Effects & Loops",
    audience: "casual",
    icon: "∞",
    description: "A low-pressure motion recipe for ambient wallpapers, music loops, and mood clips.",
    time: "45 sec",
    complexity: "Starter",
    tags: ["loop", "ambient", "dreamy"],
    parts: [
      { kind: "prompt", label: "World", text: "floating translucent clouds around a tiny moonlit room" },
      { kind: "style", label: "Mood", text: "dreamy pastel surrealism, soft gradients, meditative calm" },
      { kind: "lighting", label: "Glow", text: "slow pulsing moonlight with tiny floating particles" },
      { kind: "camera", label: "Motion", text: "locked-off camera with gentle parallax drift and seamless loop timing" },
    ],
  },
  {
    id: "action-trailer-impact",
    title: "Action Trailer Impact",
    category: "Video & Motion",
    subcategory: "Camera Direction",
    audience: "professional",
    icon: "⚡",
    description: "High-energy trailer block for controlled impact, readable action, and dramatic escalation.",
    time: "3 min",
    complexity: "Advanced",
    tags: ["trailer", "action", "impact"],
    parts: [
      { kind: "prompt", label: "Beat", text: "a stunt motorcycle bursts through a collapsing industrial tunnel" },
      { kind: "prompt", label: "Debris", text: "sparks, dust, shattered concrete, and directional fragments" },
      { kind: "lighting", label: "Impact Light", text: "strobing practicals, hot orange sparks, deep blue shadow" },
      { kind: "camera", label: "Motion", text: "handheld tracking chase, rapid whip-pan into a controlled slow motion reveal" },
      { kind: "modifier", label: "Safety", text: "clear subject silhouette, physically coherent debris, no frame tearing" },
    ],
  },
  // Practical / casual utility
  {
    id: "profile-picture-refresh",
    title: "Profile Picture Refresh",
    category: "Practical & Casual",
    subcategory: "Personal Branding",
    audience: "casual",
    icon: "🙂",
    description: "A simple portrait recipe for a polished profile image without a full art-direction pass.",
    time: "30 sec",
    complexity: "Starter",
    tags: ["profile", "headshot", "personal"],
    parts: [
      { kind: "prompt", label: "Person", text: "friendly confident person wearing a favorite everyday outfit" },
      { kind: "style", label: "Look", text: "natural modern headshot, approachable and authentic" },
      { kind: "lighting", label: "Light", text: "soft open shade, flattering catchlights, gentle background separation" },
      { kind: "camera", label: "Crop", text: "85mm lens, shoulders-up crop, clean uncluttered background" },
    ],
  },
  {
    id: "moodboard-starter",
    title: "Moodboard Starter",
    category: "Practical & Casual",
    subcategory: "Ideas & Inspiration",
    audience: "casual",
    icon: "▤",
    description: "Quickly set a shared visual direction before a personal project or creative session.",
    time: "45 sec",
    complexity: "Starter",
    tags: ["moodboard", "ideas", "direction"],
    parts: [
      { kind: "prompt", label: "Theme", text: "quiet coastal mornings, linen textures, handwritten journals, and sea glass" },
      { kind: "style", label: "Aesthetic", text: "editorial moodboard, tactile collage, understated and airy" },
      { kind: "lighting", label: "Atmosphere", text: "hazy morning light, soft shadows, muted ocean-blue palette" },
      { kind: "modifier", label: "Board", text: "varied close-ups and wide details, balanced negative space, no readable text" },
    ],
  },
  {
    id: "funny-meme-poster",
    title: "Funny Meme Poster",
    category: "Practical & Casual",
    subcategory: "Ideas & Inspiration",
    audience: "casual",
    icon: "✹",
    description: "A playful setup for visual jokes, reaction posters, and intentionally unserious ideas.",
    time: "20 sec",
    complexity: "Starter",
    tags: ["meme", "fun", "poster"],
    parts: [
      { kind: "prompt", label: "Premise", text: "an overly serious cat in a tiny office presenting a completely absurd chart" },
      { kind: "style", label: "Tone", text: "deadpan internet humor, exaggerated expression, intentionally dramatic" },
      { kind: "lighting", label: "Drama", text: "single theatrical spotlight with an oversized shadow" },
      { kind: "modifier", label: "Format", text: "bold centered composition with open space for a short caption" },
    ],
  },
  {
    id: "pet-adventure-cover",
    title: "Pet Adventure Cover",
    category: "Practical & Casual",
    subcategory: "Personal Projects",
    audience: "casual",
    icon: "🐾",
    description: "Turn a favorite pet into the hero of a playful cover, sticker, or keepsake image.",
    time: "30 sec",
    complexity: "Starter",
    tags: ["pet", "keepsake", "cute"],
    parts: [
      { kind: "prompt", label: "Hero", text: "a curious golden retriever wearing a tiny explorer backpack on a mossy trail" },
      { kind: "style", label: "Adventure", text: "wholesome illustrated storybook cover, bright and expressive" },
      { kind: "lighting", label: "Light", text: "dappled forest sunlight, glowing dust motes, cheerful color" },
      { kind: "camera", label: "View", text: "low-angle medium shot at the pet's eye level" },
    ],
  },
  {
    id: "creator-shot-list",
    title: "Creator Shot List",
    category: "Practical & Casual",
    subcategory: "Personal Branding",
    audience: "professional",
    icon: "▣",
    description: "A compact production setup for creators who need a repeatable batch of on-brand images.",
    time: "90 sec",
    complexity: "Focused",
    tags: ["creator", "content", "batch"],
    parts: [
      { kind: "prompt", label: "Subject", text: "independent creator working at a bright desk with camera gear and a notebook" },
      { kind: "style", label: "Brand Look", text: "authentic creator editorial, clean, warm, and consistent across a series" },
      { kind: "lighting", label: "Light", text: "soft key light, practical desk lamp, gentle window fill" },
      { kind: "camera", label: "Coverage", text: "35mm and 85mm editorial coverage, mix of portrait and environmental frames" },
      { kind: "modifier", label: "Batch Notes", text: "repeatable wardrobe palette, uncluttered surfaces, room for captions" },
    ],
  },
];

export const NODE_CANVAS_PRESETS: NodeCanvasPreset[] = SEEDS.map(createPreset);

export const NODE_CANVAS_CATEGORIES = Array.from(
  new Set(NODE_CANVAS_PRESETS.map((preset) => preset.category)),
);

export const NODE_CANVAS_SUBCATEGORIES = Array.from(
  new Set(NODE_CANVAS_PRESETS.map((preset) => preset.subcategory)),
);

export const NODE_CANVAS_AUDIENCE_LABELS: Record<PresetAudience | "all", string> = {
  all: "All setups",
  professional: "Professional",
  casual: "Casual / experimental",
};
