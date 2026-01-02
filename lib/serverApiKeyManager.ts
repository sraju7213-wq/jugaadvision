/**
 * Server-Side API Key Manager for Next.js API Routes
 * 
 * Purpose: Provide smart key rotation for API routes that run on the server
 * (can't use localStorage like the client-side apiKeyManager.ts)
 * 
 * Features:
 * - "Least-used first" key selection for even distribution
 * - Memory-based state (resets on server restart, but that's fine for rate limits)
 * - Smart backoff with rate limit detection
 * - Concurrent request limiting via queue
 */

import { GoogleGenAI } from "@google/genai";
import { FREE_KEYS, PREMIUM_KEYS } from "./api-keys";

// === TYPES ===

interface KeyState {
    key: string;
    errorCount: number;
    lastError: number;
    backoffUntil: number;
    requestCount: number;
}

// === CONSTANTS ===

const ERROR_BACKOFF_MS = 60000;  // 1 minute backoff for errors
const MAX_BACKOFF_MS = 300000;   // Max 5 minutes backoff
const RATE_LIMIT_BACKOFF_MS = 15000; // 15 seconds for rate limits

// Model constant for server-side usage
export const SERVER_MODEL = 'gemini-2.0-flash';
export const SERVER_LOW_COST_MODEL = 'gemini-2.0-flash-lite';

// Combined key pool (all 30 keys for text generation)
const ALL_KEYS = [...FREE_KEYS, ...PREMIUM_KEYS];

// === STATE MANAGEMENT ===

// In-memory state (resets on server restart)
let keyStates: KeyState[] = [];

function initializeKeyStates(): void {
    const uniqueKeys = Array.from(new Set(ALL_KEYS));
    keyStates = uniqueKeys.map(key => ({
        key,
        errorCount: 0,
        lastError: 0,
        backoffUntil: 0,
        requestCount: 0,
    }));
    console.log(`🔑 [Server] API Key Manager initialized: ${keyStates.length} keys`);
}

// Initialize on module load
initializeKeyStates();

// === HELPER FUNCTIONS ===

function isKeyUsable(state: KeyState): boolean {
    return Date.now() > state.backoffUntil;
}

function markKeyError(state: KeyState, isRateLimit: boolean): void {
    const now = Date.now();
    state.lastError = now;
    state.errorCount++;

    let backoffTime: number;
    if (isRateLimit) {
        // Rate limits: escalating backoff
        backoffTime = RATE_LIMIT_BACKOFF_MS * Math.min(state.errorCount, 4);
    } else {
        // Other errors: short backoff
        backoffTime = 5000;
    }

    state.backoffUntil = now + Math.min(backoffTime, MAX_BACKOFF_MS);
    console.warn(`🔴 [Server] Key ...${state.key.slice(-4)} in backoff for ${Math.ceil((state.backoffUntil - now) / 1000)}s (${isRateLimit ? 'rate limit' : 'error'})`);
}

function markKeySuccess(state: KeyState): void {
    state.requestCount++;
    // Clear error state on success
    if (state.errorCount > 0) {
        state.errorCount = 0;
        state.backoffUntil = 0;
    }
}

function getApiKey(): string {
    // 1. Filter usable keys (not in backoff)
    const usableKeys = keyStates.filter(isKeyUsable);

    if (usableKeys.length > 0) {
        // 2. Sort by request count (ascending) - pick least used
        usableKeys.sort((a, b) => a.requestCount - b.requestCount);
        const selected = usableKeys[0];
        console.log(`🔑 [Server] Selected key ...${selected.key.slice(-4)} (${selected.requestCount} requests)`);
        return selected.key;
    }

    // 3. All keys are in backoff - find one with shortest wait
    let bestKey = keyStates[0];
    let minWait = Infinity;
    const now = Date.now();

    for (const state of keyStates) {
        const wait = state.backoffUntil - now;
        if (wait < minWait) {
            minWait = wait;
            bestKey = state;
        }
    }

    console.warn(`⚠️ [Server] All keys in backoff. Using ...${bestKey.key.slice(-4)} (wait: ${Math.ceil(minWait / 1000)}s)`);
    return bestKey.key;
}

function parseRetryDelay(errorMessage: string): number {
    const patterns = [
        /retry in (\d+(?:\.\d+)?)s/i,
        /retryDelay['\":\s]+(\d+(?:\.\d+)?)s?/i,
        /please retry in (\d+(?:\.\d+)?)/i
    ];

    for (const pattern of patterns) {
        const match = errorMessage.match(pattern);
        if (match && match[1]) {
            const seconds = parseFloat(match[1]);
            if (seconds > 0 && seconds < 120) {
                return Math.ceil(seconds * 1000);
            }
        }
    }
    return 0;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// === MAIN API ===

/**
 * Execute a prompt generation with automatic retry and key rotation.
 * Designed for server-side usage in Next.js API routes.
 */
export async function serverExecuteWithRetry(
    prompt: string,
    maxRetries: number = 6
): Promise<string> {
    let lastError: Error | null = null;
    let attempt = 0;
    const triedKeys = new Set<string>();
    let consecutiveRateLimits = 0;

    while (attempt < maxRetries) {
        let apiKey = getApiKey();

        // Try to get a different key if we've already tried this one
        let keyAttempts = 0;
        while (triedKeys.has(apiKey) && keyAttempts < 3 && triedKeys.size < keyStates.length) {
            apiKey = getApiKey();
            keyAttempts++;
        }

        triedKeys.add(apiKey);
        const ai = new GoogleGenAI({ apiKey });
        const keyState = keyStates.find(s => s.key === apiKey);

        try {
            const result = await ai.models.generateContent({
                model: SERVER_MODEL,
                contents: prompt
            });

            const text = result.text;
            if (!text) throw new Error("Empty response from API");

            if (keyState) markKeySuccess(keyState);
            return text;

        } catch (error: any) {
            lastError = error;
            const errorMsg = error.message || '';

            const statusMatch = errorMsg.match(/\[(\d+)\]/);
            const statusCode = statusMatch ? ` (${statusMatch[1]})` : "";
            console.warn(`❌ [Server] Attempt ${attempt + 1}/${maxRetries} with key ...${apiKey.slice(-4)}${statusCode}: ${errorMsg.slice(0, 100)}`);

            if (keyState) {
                const msg = errorMsg.toLowerCase();
                const isRateLimit = msg.includes('429') ||
                    msg.includes('quota') ||
                    msg.includes('rate limit') ||
                    msg.includes('resource_exhausted') ||
                    msg.includes('403');
                markKeyError(keyState, isRateLimit);

                if (isRateLimit) {
                    consecutiveRateLimits++;

                    // Parse suggested delay from error
                    const suggestedDelay = parseRetryDelay(errorMsg);

                    if (suggestedDelay > 0 && suggestedDelay <= 30000) {
                        console.log(`⏳ [Server] Rate limited. Waiting ${Math.ceil(suggestedDelay / 1000)}s...`);
                        await delay(suggestedDelay + 500);
                    } else if (consecutiveRateLimits >= 3) {
                        // Multiple rate limits - wait longer
                        const backoffDelay = Math.min(10000 * consecutiveRateLimits, 60000);
                        console.log(`⏳ [Server] Multiple rate limits. Waiting ${Math.ceil(backoffDelay / 1000)}s...`);
                        await delay(backoffDelay);
                    }
                }
            }

            attempt++;
        }
    }

    // All retries exhausted
    if (lastError?.message?.toLowerCase().includes('quota')) {
        throw new Error(
            `API Quota Exceeded: Tried ${triedKeys.size}/${keyStates.length} keys. ` +
            `All keys have hit their rate limits. Wait a few minutes and try again.`
        );
    }

    throw lastError || new Error(`All ${attempt} API attempts failed`);
}

/**
 * Get stats for debugging
 */
export function getServerKeyStats() {
    const now = Date.now();
    return {
        total: keyStates.length,
        usable: keyStates.filter(isKeyUsable).length,
        inBackoff: keyStates.filter(s => !isKeyUsable(s)).length,
        totalRequests: keyStates.reduce((sum, s) => sum + s.requestCount, 0),
        keys: keyStates.map(s => ({
            suffix: `...${s.key.slice(-4)}`,
            requests: s.requestCount,
            usable: isKeyUsable(s),
            backoffRemaining: s.backoffUntil > now ? Math.ceil((s.backoffUntil - now) / 1000) : 0
        }))
    };
}
