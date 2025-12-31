
import { Platform } from './types';

export const SMART_WORD_LIBRARY = {
  "Art Styles": {
    "Photorealism & Photography": ["Raw Photo", "Shot on iPhone", "Portrait Photography", "Candid Shot", "National Geographic Style", "Fujifilm Simulation", "Kodak Portra 400", "4k Texture", "Hyperrealistic"],
    "Cinematic & Movies": ["Cinematic Still", "Movie Scene", "Directed by Christopher Nolan", "Directed by Wes Anderson", "Directed by Denis Villeneuve", "Directed by Ridley Scott", "Directed by Quentin Tarantino", "IMAX", "Shot on 35mm", "Anamorphic Lens", "Blade Runner 2049 Style", "Dune Style", "Wes Anderson Style"],
    "Anime & Animation": ["Studio Ghibli", "Makoto Shinkai", "Ufotable", "Kyoto Animation", "90s Anime Aesthetic", "Cel Shaded", "Pixar Style", "Disney Style", "Spider-Verse Style", "Akira Toriyama"],
    "Painting & Traditional": ["Oil on Canvas", "Watercolor", "Impressionist", "Vincent van Gogh", "Claude Monet", "Salvador Dali", "Gustav Klimt", "Greg Rutkowski", "Concept Art", "Charcoal Sketch"],
    "Digital & 3D": ["Unreal Engine 5", "Octane Render", "Blender 3D", "Isometric", "Low Poly", "Cyberpunk 2077", "Vaporwave", "Voxel Art"]
  },
  "Lighting": {
    "Natural Light": ["Golden Hour", "Blue Hour", "Overcast", "Direct Sunlight", "God Rays", "Dappled Light", "Soft Morning Light"],
    "Artificial & Studio": ["Neon Lights", "Studio Lighting", "Softbox", "Rim Lighting", "Volumetric Lighting", "Rembrandt Lighting", "Ring Light", "Bioluminescence"]
  },
  "Camera & Lens": {
    "Angles & Framing": ["Wide Angle", "Low Angle", "High Angle", "Aerial View", "Dutch Angle", "Eye-Level", "POV", "Symmetrical Composition", "Rule of Thirds"],
    "Lenses & Effects": ["35mm Lens", "85mm Lens", "Macro Lens", "Fisheye Lens", "Telephoto Lens", "Depth of Field", "Bokeh", "Long Exposure", "Motion Blur"]
  },
  "Colors": {
    "Palettes": ["Vibrant", "Monochromatic", "Pastel", "Dark & Moody", "Teal and Orange", "Neon Hues", "Earthy Tones", "Black and White", "Muted Tones", "Color Graded"]
  },
  "Mood & Atmosphere": {
    "Emotion": ["Serene", "Melancholy", "Joyful", "Chaotic", "Mysterious", "Nostalgic", "Ethereal", "Gritty", "Whimsical", "Romantic", "Ominous"],
    "Environment": ["Foggy", "Rainy", "Cyberpunk City", "Post-Apocalyptic", "Utopian", "Medieval", "Futuristic"]
  },
  "Materials & Textures": {
    "Surfaces": ["Metallic", "Matte", "Glossy", "Wooden", "Marble", "Fabric", "Glass", "Rusty", "Translucent", "Iridescent"]
  }
};

export const DESCRIPTION_TYPES = [
  "Concise",
  "Artistic",
  "Photorealistic",
  "Cinematic",
  "Technical (Camera & Lighting)",
  "Poetic",
  "Midjourney v6 Style",
  "Anime/Manga",
  "Dark & Moody",
  "Abstract/Surreal",
  "Cyberpunk",
  "Oil Painting"
];

export const CELEBRITY_SMART_LIBRARY = {
  "Art Styles": {
    "Photorealism": ["Hyperrealistic", "Raw 8k Photo", "Editorial Vogue Style", "Paparazzi Shot", "Studio Headshot", "National Geographic Portrait"],
    "Fantasy & Ethereal": ["Elven Royalty", "Dark Fantasy RPG", "Celestial Goddess", "Cyberpunk Cyborg", "Steampunk Inventor", "Post-Apocalyptic Survivor"],
    "Illustration & Painting": ["Oil Painting style of John Singer Sargent", "Watercolor Art", "GTA Loading Screen Style", "Disney Pixar 3D Character", "Anime Style (Makoto Shinkai)", "Vintage Comic Book"]
  },
  "Cinematic Universe & Movies": {
    "Sci-Fi & Future": ["Dune (Arrakis aesthetic)", "Blade Runner 2049 (Neon/Rain)", "The Matrix (Green Tint/Latex)", "Star Wars (Jedi/Sith)", "Tron Legacy (Grid/Lightcycles)", "Mad Max (Desert/Chrome)"],
    "Drama & Period": ["The Great Gatsby (Roaring 20s)", "Bridgerton (Regency Era)", "Peaky Blinders (1920s Birmingham)", "The Godfather (Noir/Shadows)", "Pride and Prejudice (Soft/Pastel)"],
    "Pop Culture": ["Barbie Movie (Plastic/Pink)", "Oppenheimer (IMAX B&W)", "Wes Anderson (Symmetrical/Pastel)", "Stranger Things (80s/Neon)"]
  },
  "Famous Directors": {
    "The Auteurs": ["Directed by Christopher Nolan", "Directed by Wes Anderson", "Directed by Quentin Tarantino", "Directed by Stanley Kubrick", "Directed by Martin Scorsese", "Directed by Greta Gerwig"],
    "Visual Stylists": ["Directed by Zack Snyder (High Contrast)", "Directed by Tim Burton (Gothic)", "Directed by Guillermo del Toro (Dark Fairy Tale)", "Directed by Wong Kar-wai (Motion Blur/Color)", "Directed by David Fincher (Green/Yellow grading)"]
  },
  "Camera & Technical": {
    "Film Stocks": ["Kodak Portra 400", "CineStill 800T", "Fujifilm Pro 400H", "Ilford HP5 (Black & White)", "Kodachrome 64", "Polaroid 600"],
    "Lenses": ["85mm f/1.2 (Creamy Bokeh)", "35mm (Storytelling)", "50mm (Nifty Fifty)", "Anamorphic Lens (Cinematic Flares)", "Fisheye Lens (Distorted)", "Macro Lens (Eye Detail)"],
    "Angles": ["Low Angle (Heroic)", "High Angle (Vulnerable)", "Dutch Angle (Uneasy)", "Extreme Close-up (Intimate)", "Profile Shot"]
  },
  "Lighting & Atmosphere": {
    "Studio": ["Rembrandt Lighting", "Butterfly Lighting", "Split Lighting", "Ring Light", "Softbox", "Hard Flash (Terry Richardson style)"],
    "Environmental": ["Golden Hour", "Blue Hour", "Neon City Lights", "God Rays", "Volumetric Fog", "Candlelight", "Bioluminescent Glow"]
  },
  "Fashion & Wardrobe": {
    "Eras": ["1920s Flapper", "1950s Rockabilly", "1980s Power Suit", "1990s Grunge", "Y2K Aesthetic", "Victorian Goth"],
    "High Fashion": ["Met Gala Avant-Garde", "Haute Couture Runaway", "Techwear", "Minimalist Streetwear", "Luxury Evening Gown", "Sharp Tuxedo"]
  }
};

// Randomizer data for "Surprise Me" feature
export const RANDOM_SUBJECTS = [
  "A mystical forest guardian",
  "An ancient robot awakening",
  "A cosmic whale swimming through nebulae",
  "A cyberpunk street vendor",
  "A steampunk inventor's workshop",
  "A dragon made of crystals",
  "An underwater temple",
  "A floating island city",
  "A time-traveling explorer",
  "A phoenix rising from digital flames",
  "A samurai in a cherry blossom garden",
  "An astronaut discovering alien ruins",
  "A wizard's library filled with magical books",
  "A mechanical butterfly garden",
  "A giant tree house civilization",
];

export const RANDOM_SETTINGS = [
  "at golden hour",
  "during a thunderstorm",
  "in a neon-lit alley",
  "under the northern lights",
  "in a misty morning forest",
  "at the edge of a cliff overlooking the ocean",
  "inside an ancient temple",
  "floating among the clouds",
  "in a bustling marketplace",
  "surrounded by fireflies at dusk",
];

export const RANDOM_MOODS = [
  "mysterious and ethereal",
  "vibrant and energetic",
  "peaceful and serene",
  "dark and dramatic",
  "whimsical and playful",
  "epic and cinematic",
  "nostalgic and warm",
  "futuristic and sleek",
];

export const RANDOM_STYLES = [
  "hyperrealistic 8k photography",
  "Studio Ghibli anime style",
  "oil painting with visible brushstrokes",
  "cyberpunk neon aesthetic",
  "watercolor illustration",
  "3D rendered in Unreal Engine 5",
  "minimalist vector art",
  "dramatic cinematic lighting",
];

export const NEGATIVE_PROMPT_SUGGESTIONS = [
  "blurry",
  "low quality",
  "watermark",
  "text",
  "distorted",
  "oversaturated",
  "underexposed",
  "grainy",
  "cropped",
  "duplicate",
];

// Style Transfer Categories for Photo to Art conversion
export const STYLE_TRANSFER_CATEGORIES: Record<string, { id: string; title: string; icon: string; prompt: string }[]> = {
  "Anime & Manga": [
    { id: "ghibli", title: "Studio Ghibli", icon: "🌿", prompt: "Transform into Studio Ghibli anime style with soft watercolor textures, detailed lush backgrounds, whimsical atmosphere, and gentle lighting" },
    { id: "shinkai", title: "Makoto Shinkai", icon: "🌅", prompt: "Transform into Makoto Shinkai style with hyper-detailed dramatic skies, dreamy golden hour lighting, and photorealistic backgrounds with anime characters" },
    { id: "manga", title: "Manga", icon: "📖", prompt: "Convert to black and white manga style with screentones, dramatic expressions, speed lines, and comic panel aesthetics" },
    { id: "90s-anime", title: "90s Anime", icon: "📺", prompt: "Transform into 1990s anime aesthetic with cel shading, soft airbrush highlights, VHS grain, and nostalgic warm color palette" },
    { id: "chibi", title: "Chibi/Kawaii", icon: "🌸", prompt: "Convert to cute chibi style with oversized heads, big sparkly eyes, simplified body proportions, and adorable expressions" },
  ],
  "Cartoon & Illustration": [
    { id: "pixar", title: "Pixar/Disney", icon: "✨", prompt: "Transform into Pixar 3D animation style with expressive oversized eyes, vibrant saturated colors, subsurface scattering skin, and polished CGI rendering" },
    { id: "comic", title: "Comic Book", icon: "💥", prompt: "Convert to American comic book style with bold black outlines, halftone dots, dynamic action poses, and dramatic color blocking" },
    { id: "simpsons", title: "Simpsons", icon: "🟡", prompt: "Transform into The Simpsons cartoon style with yellow skin, overbite, bulging googly eyes, and flat simple coloring" },
    { id: "south-park", title: "South Park", icon: "🟩", prompt: "Convert to South Park paper cutout animation style with simple geometric shapes, flat colors, and construction paper texture" },
    { id: "looney", title: "Classic Cartoon", icon: "🐰", prompt: "Transform into classic Looney Tunes / Tex Avery style with exaggerated rubberhose animation, slapstick expressions, and vintage coloring" },
  ],
  "Artistic Styles": [
    { id: "oil-painting", title: "Oil Painting", icon: "🖼️", prompt: "Transform into a classic oil painting with visible thick brushstrokes, rich impasto textures, Renaissance chiaroscuro lighting, and canvas texture" },
    { id: "watercolor", title: "Watercolor", icon: "💧", prompt: "Convert to delicate watercolor painting with soft bleeding edges, translucent color washes, visible paper texture, and wet-on-wet effects" },
    { id: "impressionist", title: "Impressionist", icon: "🎨", prompt: "Transform into impressionist painting style like Claude Monet with visible dappled brushwork, emphasis on light and color, and dreamy atmospheric quality" },
    { id: "pop-art", title: "Pop Art", icon: "🔴", prompt: "Convert to Andy Warhol / Roy Lichtenstein pop art style with bold primary colors, Ben-Day dots, thick black outlines, and high contrast" },
    { id: "sketch", title: "Pencil Sketch", icon: "✏️", prompt: "Transform into detailed graphite pencil sketch with cross-hatching, subtle shading gradients, clean linework, and paper texture" },
  ],
  "Fantasy & Sci-Fi": [
    { id: "cyberpunk", title: "Cyberpunk", icon: "🤖", prompt: "Transform into cyberpunk aesthetic with neon pink and cyan lights, rain-slicked streets, holographic advertisements, and futuristic tech noir mood" },
    { id: "steampunk", title: "Steampunk", icon: "⚙️", prompt: "Convert to steampunk style with brass gears and cogs, Victorian Gothic elements, steam-powered machinery, sepia tones, and clockwork details" },
    { id: "fantasy", title: "Epic Fantasy", icon: "🗡️", prompt: "Transform into epic fantasy art style with dramatic god rays lighting, mystical glowing particles, heroic composition, and painterly details" },
    { id: "horror", title: "Dark Horror", icon: "🌑", prompt: "Convert to dark horror aesthetic with unsettling distorted shadows, desaturated cold tones, eerie fog, and nightmarish atmosphere" },
  ],
  "Photography Filters": [
    { id: "vintage", title: "Vintage Film", icon: "📷", prompt: "Apply vintage 35mm film look with warm orange tint, film grain, light leaks, faded blacks, and nostalgic Kodak Portra color grading" },
    { id: "noir", title: "Film Noir", icon: "🎬", prompt: "Convert to classic black and white film noir style with dramatic hard shadows, high contrast, venetian blind lighting, and moody atmosphere" },
    { id: "hdr", title: "HDR", icon: "🌈", prompt: "Apply HDR effect with enhanced shadow and highlight details, vivid punchy colors, and perfectly balanced exposure throughout the image" },
    { id: "miniature", title: "Tilt-Shift", icon: "🏠", prompt: "Apply tilt-shift miniature effect with selective focus blur at top and bottom, enhanced saturation, making the scene look like a tiny model" },
  ],
};

// Photo Editor Modes
export const EDIT_MODES = [
  {
    id: "style",
    icon: "🎨",
    label: "Style",
    description: "Apply art styles",
    promptLabel: "Instruction:",
    promptPlaceholder: "Describe style changes...",
    buttonLabel: "Apply Style",
    autoPrompt: null,
  },
  {
    id: "replace",
    icon: "🖌️",
    label: "Replace",
    description: "Paint & describe replacement",
    promptLabel: "Replace with:",
    promptPlaceholder: "Describe what should appear...",
    buttonLabel: "Replace Selection",
    autoPrompt: null,
  },
  {
    id: "erase",
    icon: "🧹",
    label: "Erase",
    description: "Remove objects cleanly",
    promptLabel: "Auto-remove",
    promptPlaceholder: "",
    buttonLabel: "Erase Object",
    autoPrompt: "Remove the selected object completely and fill the area naturally with the surrounding background, maintaining seamless texture and lighting",
  },
] as const;

export type EditModeId = typeof EDIT_MODES[number]["id"];
