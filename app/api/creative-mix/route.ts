import { handleAIRequest } from "@/server/ai/serverHandler";

export const maxDuration = 60;

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const response = await handleAIRequest('/api/creative-mix', 'POST', body);

        return new Response(JSON.stringify(response.data), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error("Server Error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message || "Server busy, please try again." }), { status: 500 });
    }
}
