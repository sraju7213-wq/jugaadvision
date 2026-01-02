import { serverExecuteWithRetry } from "@/lib/serverApiKeyManager";

export const maxDuration = 60; // Allow 60 seconds

export async function POST(req: Request) {
    try {
        const { prompt, style, mood } = await req.json();

        const systemInstruction = `You are a creative director. Rewrite this prompt to be professional.
    Original: ${prompt}
    Style: ${style}
    Mood: ${mood}
    Output ONLY the enhanced prompt.`;

        const enhancedText = await serverExecuteWithRetry(systemInstruction);

        return new Response(JSON.stringify({ result: enhancedText }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Server Error:", error);
        return new Response(JSON.stringify({ error: "Server busy, please try again." }), { status: 500 });
    }
}

