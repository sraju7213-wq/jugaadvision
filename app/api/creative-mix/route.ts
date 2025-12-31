import { GoogleGenAI } from "@google/genai";
import { getRandomKey, FREE_KEYS, PREMIUM_KEYS } from "@/lib/api-keys";

export const maxDuration = 60; // Allow 60 seconds

async function generateWithRetry(prompt: string, retries = 5): Promise<string> {
    const ALL_KEYS = [...FREE_KEYS, ...PREMIUM_KEYS];
    // Randomize start index to avoid hot-spotting the first keys
    let keyIndex = Math.floor(Math.random() * ALL_KEYS.length);

    for (let i = 0; i < retries; i++) {
        const apiKey = ALL_KEYS[keyIndex];
        // Move to next key for next retry, wrapping around
        keyIndex = (keyIndex + 1) % ALL_KEYS.length;

        const ai = new GoogleGenAI({ apiKey });

        try {
            const result = await ai.models.generateContent({
                model: 'gemini-1.5-flash',
                contents: prompt
            });

            const text = result.text;
            if (!text) throw new Error("Empty response");
            return text;
        } catch (error: any) {
            console.warn(`Attempt ${i + 1} failed with key ...${apiKey.slice(-4)}. Retrying.`);

            // If it's a rate limit, wait a bit
            if (error.message?.includes('429') || error.message?.includes('quota')) {
                await new Promise(res => setTimeout(res, 1000));
            }

            // If it's the last retry, throw the error
            if (i === retries - 1) throw error;
        }
    }
    throw new Error("All retries failed");
}

export async function POST(req: Request) {
    try {
        const { prompt, style, mood } = await req.json();

        const systemInstruction = `You are a creative director. Rewrite this prompt to be professional.
    Original: ${prompt}
    Style: ${style}
    Mood: ${mood}
    Output ONLY the enhanced prompt.`;

        const enhancedText = await generateWithRetry(systemInstruction);

        return new Response(JSON.stringify({ result: enhancedText }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Server Error:", error);
        return new Response(JSON.stringify({ error: "Server busy, please try again." }), { status: 500 });
    }
}
