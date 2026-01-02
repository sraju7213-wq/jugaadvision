/**
 * Smart API Key Manager for Gemini v2.0
 * 
 * Features:
 * - Merged key pools (30 keys for text tasks, 20 for image tasks)
 * - "Least-used first" key selection for even distribution
 * - Per-key request tracking with localStorage persistence
 * - Intelligent rate-limit handling with suggested delays
 * - Model fallback support (2.5-flash → 1.5-flash)
 * - Automatic daily usage reset
 * - **NEW:** Centralized Request Queue to prevent "thundering herd"
 */

import { GoogleGenAI } from "@google/genai";
import { FREE_KEYS, PREMIUM_KEYS } from "../lib/api-keys";

// === TYPES ===

type TaskType = 'image_generation' | 'prompt_enhancement' | 'text_generation' | 'structured_json';

interface KeyState {
    key: string;
    errorCount: number;
    lastError: number;
    backoffUntil: number;
    requestCount: number;      // Total requests today
    lastRequestTime: number;   // Last request timestamp
}

interface PersistedKeyStats {
    date: string;  // YYYY-MM-DD for daily reset
    keys: Record<string, { requestCount: number; backoffUntil: number; errorCount: number }>;
}

// === CONSTANTS ===

const STORAGE_KEY = 'gemini_key_stats_v2';
const ERROR_BACKOFF_MS = 60000;  // 1 minute backoff for errors
const MAX_BACKOFF_MS = 300000;   // Max 5 minutes backoff
const RATE_LIMIT_BACKOFF_MS = 10000; // Reduced to 10 seconds for rate limits (we have many keys)

// Queue Constants
const MAX_CONCURRENT_TEXT = 8;   // High concurrency for text (fast)
const MAX_CONCURRENT_IMAGE = 3;  // Low concurrency for images (slow/expensive)

// Models with fallback
// Use flash 1.5 as it's the most stable/fastest for high volume
export const PRIMARY_MODEL = 'gemini-2.0-flash';
// structured model
export const STRUCTURED_MODEL = 'gemini-2.0-flash';
export const FALLBACK_MODEL = 'gemini-1.5-pro';
// Low-cost model for simple text tasks (prompt generation, enhancement)
export const LOW_COST_MODEL = 'gemini-2.0-flash-lite';

/**
 * Get the appropriate model for a task type
 * Uses low-cost models for simple text tasks, premium for complex/image tasks
 */
export function getModelForTask(taskType: TaskType): string {
    switch (taskType) {
        case 'prompt_enhancement':
        case 'text_generation':
            return LOW_COST_MODEL;
        case 'structured_json':
            return STRUCTURED_MODEL;
        case 'image_generation':
            return PRIMARY_MODEL;
        default:
            return LOW_COST_MODEL;
    }
}

// === KEY POOLS ===

// Combined pool for text-based tasks (all keys)
// We merge them all to have a massive pool for text generation
const ALL_KEYS = [...FREE_KEYS, ...PREMIUM_KEYS];

// Premium-only pool for image generation (20 keys)
const IMAGE_KEYS = PREMIUM_KEYS;

// === STATE MANAGEMENT ===

// Initialize states for both pools
let allKeyStates: KeyState[] = [];
let imageKeyStates: KeyState[] = [];

/**
 * Get today's date string for daily reset
 */
function getTodayString(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Load persisted stats from localStorage
 */
function loadPersistedStats(): PersistedKeyStats | null {
    if (typeof localStorage === 'undefined') return null;

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;

        const parsed: PersistedKeyStats = JSON.parse(stored);

        // Check if it's from today
        if (parsed.date !== getTodayString()) {
            console.log('📅 New day detected - resetting API key usage stats');
            return null; // Will trigger fresh initialization
        }

        return parsed;
    } catch {
        return null;
    }
}

/**
 * Save stats to localStorage
 */
function savePersistedStats(): void {
    if (typeof localStorage === 'undefined') return;

    try {
        const stats: PersistedKeyStats = {
            date: getTodayString(),
            keys: {}
        };

        // Save all key states
        [...allKeyStates, ...imageKeyStates].forEach(state => {
            stats.keys[state.key] = {
                requestCount: state.requestCount,
                backoffUntil: state.backoffUntil,
                errorCount: state.errorCount
            };
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch {
        // Ignore storage errors
    }
}

/**
 * Initialize key states with optional persistence loading
 */
function initializeKeyStates(): void {
    const persisted = loadPersistedStats();

    const createState = (key: string): KeyState => {
        const saved = persisted?.keys[key];
        return {
            key,
            errorCount: saved?.errorCount || 0,
            lastError: 0,
            backoffUntil: saved?.backoffUntil || 0,
            requestCount: saved?.requestCount || 0,
            lastRequestTime: 0
        };
    };

    // De-duplicate keys just in case
    const uniqueAllKeys = Array.from(new Set(ALL_KEYS));
    const uniqueImageKeys = Array.from(new Set(IMAGE_KEYS));

    allKeyStates = uniqueAllKeys.map(createState);
    imageKeyStates = uniqueImageKeys.map(createState);

    // Log initialization
    const totalRequests = allKeyStates.reduce((sum, s) => sum + s.requestCount, 0);
    console.log(`🔑 API Key Manager initialized: ${allKeyStates.length} text keys, ${imageKeyStates.length} image keys`);
    if (totalRequests > 0) {
        console.log(`📊 Loaded ${totalRequests} requests from today's session`);
    }
}

// Initialize on module load
initializeKeyStates();

// === REQUEST QUEUE IMPLEMENTATION ===

class RequestQueue {
    private queue: { resolve: (val: any) => void; reject: (err: any) => void; task: () => Promise<any> }[] = [];
    private activeCount = 0;
    private maxConcurrent: number;
    private paused = false;
    private pausedUntil = 0;
    private label: string;

    constructor(maxConcurrent: number, label: string) {
        this.maxConcurrent = maxConcurrent;
        this.label = label;
    }

    /**
     * Add a task to the queue and return a promise that resolves when the task completes
     */
    add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ resolve, reject, task });
            this.process();
        });
    }

    /**
     * Pause the queue for a specific duration (e.g., when rate limited)
     */
    pause(durationMs: number) {
        if (this.paused) return; // Already paused

        console.log(`⏸️ Pausing ${this.label} queue for ${Math.ceil(durationMs / 1000)}s`);
        this.paused = true;
        this.pausedUntil = Date.now() + durationMs;

        setTimeout(() => {
            this.paused = false;
            console.log(`▶️ Resuming ${this.label} queue`);
            this.process();
        }, durationMs);
    }

    /**
     * Process items in the queue
     */
    private async process() {
        if (this.paused || this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
            return;
        }

        const item = this.queue.shift();
        if (!item) return;

        this.activeCount++;
        // console.log(`🚀 Processing ${this.label} task. Active: ${this.activeCount}, Pending: ${this.queue.length}`);

        try {
            const result = await item.task();
            item.resolve(result);
        } catch (error) {
            item.reject(error);
        } finally {
            this.activeCount--;
            // Recursively try to process next item
            this.process();
        }
    }

    getStats() {
        return {
            label: this.label,
            active: this.activeCount,
            pending: this.queue.length,
            paused: this.paused
        };
    }
}

// Instantiate Queues
const textQueue = new RequestQueue(MAX_CONCURRENT_TEXT, 'Text');
const imageQueue = new RequestQueue(MAX_CONCURRENT_IMAGE, 'Image');

// === HELPER FUNCTIONS ===

function getKeyPool(taskType: TaskType): KeyState[] {
    // Image generation uses premium-only pool
    // Everything else uses the combined pool (30 keys!)
    return taskType === 'image_generation' ? imageKeyStates : allKeyStates;
}

function getQueue(taskType: TaskType): RequestQueue {
    return taskType === 'image_generation' ? imageQueue : textQueue;
}

function isKeyUsable(state: KeyState): boolean {
    return Date.now() > state.backoffUntil;
}

function markKeyError(state: KeyState, isRateLimit: boolean): void {
    const now = Date.now();
    state.lastError = now;
    state.errorCount++;

    // Calculate backoff
    let backoffTime: number;

    if (isRateLimit) {
        // Rate limits: 30s, then 60s max
        backoffTime = RATE_LIMIT_BACKOFF_MS * Math.min(state.errorCount, 2);
    } else {
        // Other errors (timeouts/network): Short 5s backoff to keep key in rotation
        // blocked keys shouldn't be penalty boxed for long
        backoffTime = 5000;
    }

    state.backoffUntil = now + Math.min(backoffTime, MAX_BACKOFF_MS);

    console.warn(`🔴 Key ...${state.key.slice(-4)} in backoff until ${new Date(state.backoffUntil).toLocaleTimeString()} (${isRateLimit ? 'rate limit' : 'error'})`);

    savePersistedStats();
}

function markKeySuccess(state: KeyState): void {
    state.requestCount++;
    state.lastRequestTime = Date.now();

    // Clear error state on success
    if (state.errorCount > 0) {
        state.errorCount = 0;
        state.backoffUntil = 0;
    }

    savePersistedStats();
}

// === MAIN API ===

/**
 * Get the next available API key using "Least-Used First" selection
 * This ensures even distribution across all available keys
 */
export function getApiKey(taskType: TaskType): string {
    const pool = getKeyPool(taskType);

    // 1. Filter usable keys (not in backoff)
    const usableKeys = pool.filter(isKeyUsable);

    if (usableKeys.length > 0) {
        // 2. Sort by request count (ascending) - pick least used
        usableKeys.sort((a, b) => a.requestCount - b.requestCount);

        const selected = usableKeys[0];
        // console.log(`🔑 Selected key ...${selected.key.slice(-4)} (${selected.requestCount} requests today)`);
        return selected.key;
    }

    // 3. All keys are in backoff - find one with shortest wait
    let bestKey = pool[0];
    let minWait = Infinity;
    const now = Date.now();

    for (const state of pool) {
        const wait = state.backoffUntil - now;
        if (wait < minWait) {
            minWait = wait;
            bestKey = state;
        }
    }

    console.warn(`⚠️ All keys in backoff. Using ...${bestKey.key.slice(-4)} (wait: ${Math.ceil(minWait / 1000)}s)`);
    return bestKey.key;
}

/**
 * Report key success to clear error states and increment usage
 */
export function reportKeySuccess(key: string, taskType: TaskType): void {
    const pool = getKeyPool(taskType);
    const state = pool.find(s => s.key === key);
    if (state) {
        markKeySuccess(state);
    }
}

/**
 * Report key error to trigger backoff
 */
export function reportKeyError(key: string, taskType: TaskType, error?: any): void {
    const pool = getKeyPool(taskType);
    const state = pool.find(s => s.key === key);
    if (state) {
        const msg = error?.message?.toLowerCase() || '';
        const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted');
        markKeyError(state, isRateLimit);

        // Critical: If it's a rate limit, pause the queue briefly to let things cool down
        if (isRateLimit) {
            getQueue(taskType).pause(2000); // 2 second global pause on this queue
        }
    }
}

/**
 * Create a simple AI client (single use)
 */
export function createAIClient(taskType: TaskType): GoogleGenAI {
    const apiKey = getApiKey(taskType);
    return new GoogleGenAI({ apiKey });
}

/**
 * Parse retry delay from error message (handles Gemini's error format)
 */
function parseRetryDelay(errorMessage: string): number {
    const patterns = [
        /retry in (\d+(?:\.\d+)?)s/i,
        /retryDelay['":\s]+(\d+(?:\.\d+)?)s?/i,
        /please retry in (\d+(?:\.\d+)?)/i
    ];

    for (const pattern of patterns) {
        const match = errorMessage.match(pattern);
        if (match && match[1]) {
            const seconds = parseFloat(match[1]);
            if (seconds > 0 && seconds < 120) { // Cap at 2 minutes
                return Math.ceil(seconds * 1000);
            }
        }
    }
    return 0;
}

/**
 * Smart delay function
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Execute a function with automatic retry on different API keys
 * Enhanced with smart rate-limit handling and even distribution
 */
export function executeWithRetry<T>(
    taskType: TaskType,
    fn: (client: GoogleGenAI, apiKey: string) => Promise<T>,
    maxRetries: number = 5  // More retries since we have 30 keys
): Promise<T> {
    const queue = getQueue(taskType);

    // Wrap the retry logic in a queuing mechanism
    return queue.add(async () => {
        let lastError: Error | null = null;
        let attempt = 0;
        const triedKeys = new Set<string>();
        let consecutiveRateLimits = 0;
        const pool = getKeyPool(taskType);
        let consecutiveTimeouts = 0;

        while (attempt < maxRetries) {
            let apiKey = getApiKey(taskType);

            // Try to get a different key if we've already tried this one
            let keyAttempts = 0;
            while (triedKeys.has(apiKey) && keyAttempts < 3 && triedKeys.size < pool.length) {
                apiKey = getApiKey(taskType);
                keyAttempts++;
            }

            triedKeys.add(apiKey);
            const client = new GoogleGenAI({ apiKey });

            try {
                const result = await fn(client, apiKey);
                reportKeySuccess(apiKey, taskType);
                consecutiveRateLimits = 0; // Reset on success
                return result;
            } catch (error: any) {
                lastError = error;
                const errorMsg = error.message || '';

                console.warn(`❌ Attempt ${attempt + 1}/${maxRetries} with key ...${apiKey.slice(-4)}: ${errorMsg.slice(0, 100)}`);
                reportKeyError(apiKey, taskType, error);

                const msg = errorMsg.toLowerCase();
                const isRateLimit = msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted') || msg.includes('403');
                const isTimeout = msg.includes('timeout') || msg.includes('network') || msg.includes('fetch failed');

                const isRetryable = isRateLimit ||
                    msg.includes('503') ||
                    msg.includes('server error') ||
                    isTimeout;

                if (isRateLimit) {
                    consecutiveRateLimits++;

                    // Parse suggested delay
                    const suggestedDelay = parseRetryDelay(errorMsg);

                    if (suggestedDelay > 0 && suggestedDelay <= 30000) {
                        // Short delay suggested - wait and retry
                        console.log(`⏳ Rate limited. Waiting ${Math.ceil(suggestedDelay / 1000)}s...`);
                        await delay(suggestedDelay + 500);
                    } else if (consecutiveRateLimits >= 3) {
                        // Multiple rate limits - wait longer before trying more
                        const backoffDelay = Math.min(10000 * consecutiveRateLimits, 60000);
                        console.log(`⏳ Multiple rate limits. Waiting ${Math.ceil(backoffDelay / 1000)}s...`);
                        await delay(backoffDelay);
                    }
                    // Otherwise, just try next key immediately
                }

                // Handle timeouts - stop assuming 5 retries is good. 
                // If it times out twice, fail to avoid hanging the UI.
                if (isTimeout) {
                    consecutiveTimeouts++;
                    if (consecutiveTimeouts >= 2) {
                        console.warn("⚠️ Too many timeouts, aborting retries.");
                        throw new Error("Request timed out repeatedly. Check connection.");
                    }
                }

                // Don't retry non-retryable errors
                if (!isRetryable) {
                    if (msg.includes('safety') || msg.includes('blocked')) {
                        throw error; // Safety blocks won't be helped by retries
                    }
                }

                attempt++;
            }
        }

        // Enhanced error message
        const poolSize = pool.length;
        if (lastError?.message?.toLowerCase().includes('quota')) {
            throw new Error(
                `⚠️ API Quota Exceeded: Tried ${triedKeys.size}/${poolSize} keys. ` +
                `All keys have hit their rate limits. ` +
                `Wait a few minutes and try again, or upgrade at https://aistudio.google.com/`
            );
        }

        throw lastError || new Error(`All ${attempt} API attempts failed`);
    });
}

/**
 * Get stats for debugging - now with more detail
 */
export function getKeyPoolStats() {
    const now = Date.now();

    const getPoolStats = (pool: KeyState[], name: string) => ({
        name,
        total: pool.length,
        usable: pool.filter(isKeyUsable).length,
        inBackoff: pool.filter(s => !isKeyUsable(s)).length,
        totalRequests: pool.reduce((sum, s) => sum + s.requestCount, 0),
        leastUsed: Math.min(...pool.map(s => s.requestCount)),
        mostUsed: Math.max(...pool.map(s => s.requestCount)),
        keys: pool.map(s => ({
            suffix: `...${s.key.slice(-4)}`,
            requests: s.requestCount,
            usable: isKeyUsable(s),
            backoffRemaining: s.backoffUntil > now ? Math.ceil((s.backoffUntil - now) / 1000) : 0
        }))
    });

    return {
        textPool: getPoolStats(allKeyStates, 'Text/JSON (All Keys)'),
        imagePool: getPoolStats(imageKeyStates, 'Image Generation (Premium)'),
        queues: {
            text: textQueue.getStats(),
            image: imageQueue.getStats()
        },
        date: getTodayString()
    };
}

/**
 * Reset all key stats (useful for testing)
 */
export function resetKeyStats(): void {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
    }
    initializeKeyStates();
    console.log('🔄 Key stats reset');
}
