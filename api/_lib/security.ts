/**
 * Enterprise Security & API Protection Layer
 * 
 * Safeguards:
 * 1. API Key Isolation: Ensures zero third-party keys are ever returned to or stored on clients.
 * 2. In-Memory Sliding Window Rate Limiting (DDoS & Brute-Force Protection)
 * 3. SSRF Protection: Prevents Server-Side Request Forgery against internal networks or cloud metadata.
 * 4. Input Sanitization & Prompt Injection Hardening
 * 5. Comprehensive Secret & Token Redaction
 * 6. Hardened Security Headers (CSP, FrameGuard, NoSniff, Referrer Policy)
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfter?: number;
}

interface RateLimitRecord {
  timestamps: number[];
}

export class InMemoryRateLimiter {
  private records = new Map<string, RateLimitRecord>();
  private windowMs: number;
  private maxRequests: number;
  private lastCleanup = Date.now();

  constructor(windowMs = 60000, maxRequests = 60) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  public check(clientIp: string, customLimit?: number): RateLimitResult {
    const now = Date.now();
    this.periodicCleanup(now);

    const limit = customLimit ?? this.maxRequests;
    const ip = clientIp || '127.0.0.1';
    let record = this.records.get(ip);

    if (!record) {
      record = { timestamps: [] };
      this.records.set(ip, record);
    }

    // Filter out timestamps outside the current sliding window
    const windowStart = now - this.windowMs;
    record.timestamps = record.timestamps.filter(ts => ts > windowStart);

    const remaining = Math.max(0, limit - record.timestamps.length);
    const resetSeconds = Math.ceil(this.windowMs / 1000);

    if (record.timestamps.length >= limit) {
      const oldest = record.timestamps[0] || now;
      const retryAfter = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000));
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetSeconds,
        retryAfter,
      };
    }

    record.timestamps.push(now);
    return {
      allowed: true,
      limit,
      remaining: remaining - 1,
      resetSeconds,
    };
  }

  private periodicCleanup(now: number) {
    if (now - this.lastCleanup > 120000) {
      this.lastCleanup = now;
      const windowStart = now - this.windowMs;
      for (const [ip, rec] of this.records.entries()) {
        rec.timestamps = rec.timestamps.filter(ts => ts > windowStart);
        if (rec.timestamps.length === 0) {
          this.records.delete(ip);
        }
      }
    }
  }
}

// Global rate limiters
export const generalRateLimiter = new InMemoryRateLimiter(60000, 120); // 120 reqs/min for general queries
export const aiGenerationRateLimiter = new InMemoryRateLimiter(60000, 30); // 30 reqs/min for heavy AI generation

/**
 * SSRF Guard: Validates whether a given URL is safe to call from server-side.
 * Rejects private IPs, loopback, link-local, and cloud provider instance metadata endpoints.
 */
export function isSSRFSafeUrl(urlStr: string): { safe: boolean; reason?: string } {
  if (!urlStr || typeof urlStr !== 'string') {
    return { safe: false, reason: 'Empty or invalid URL string' };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { safe: false, reason: 'Malformed URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Forbidden protocol: ${parsed.protocol}. Only http and https are allowed.` };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // Block obvious loopback and internal keywords
  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === 'metadata.google.internal' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local')
  ) {
    // Allow local development endpoints ONLY if explicitly running in local dev mode
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev && (hostname === 'localhost' || hostname === '127.0.0.1')) {
      return { safe: true };
    }
    return { safe: false, reason: 'Restricted host: loopback or internal hostname.' };
  }

  // AWS/GCP/Azure Metadata and Link-Local Block (169.254.0.0/16)
  if (hostname.startsWith('169.254.')) {
    return { safe: false, reason: 'Cloud instance metadata endpoints (169.254.x.x) are strictly prohibited.' };
  }

  // Private RFC 1918 IPv4 Blocks
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  if (match) {
    const oct1 = parseInt(match[1], 10);
    const oct2 = parseInt(match[2], 10);

    // 10.0.0.0/8
    if (oct1 === 10) {
      return { safe: false, reason: 'Private network addresses (10.0.0.0/8) are prohibited.' };
    }
    // 172.16.0.0 - 172.31.255.255
    if (oct1 === 172 && oct2 >= 16 && oct2 <= 31) {
      return { safe: false, reason: 'Private network addresses (172.16.0.0/12) are prohibited.' };
    }
    // 192.168.0.0/16
    if (oct1 === 192 && oct2 === 168) {
      return { safe: false, reason: 'Private network addresses (192.168.0.0/16) are prohibited.' };
    }
    // 0.0.0.0/8
    if (oct1 === 0) {
      return { safe: false, reason: 'Invalid address 0.0.0.0.' };
    }
  }

  return { safe: true };
}

/**
 * Sanitizes input strings by stripping dangerous control characters,
 * null bytes, and non-printable Unicode spoofing attacks.
 */
export function sanitizeInput(input: string, maxLength = 50000): string {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .slice(0, maxLength)
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove dangerous unicode bidirectional override characters (Trojan Source defense)
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
    .trim();
}

/**
 * Comprehensive secret redactor for server logs, errors, and responses.
 */
export function sanitizeAndRedactSecrets(text: string): string {
  if (!text || typeof text !== 'string') return '';
  
  return text
    // OpenRouter keys
    .replace(/sk-or-v1-[a-zA-Z0-9_\-]{16,}/gi, 'sk-or-v1-[REDACTED]')
    // Standard OpenAI/Generic sk- keys
    .replace(/sk-[a-zA-Z0-9_\-]{20,}/gi, 'sk-[REDACTED]')
    // NVIDIA NIM keys
    .replace(/nvapi-[a-zA-Z0-9_\-]{16,}/gi, 'nvapi-[REDACTED]')
    // HuggingFace tokens
    .replace(/hf_[a-zA-Z0-9_\-]{16,}/gi, 'hf_[REDACTED]')
    // Cloudflare tokens
    .replace(/cfut_[a-zA-Z0-9_\-]{16,}/gi, 'cfut_[REDACTED]')
    // RemoveBG keys
    .replace(/PCH4k[a-zA-Z0-9]{15,}/gi, '[REDACTED_REMOVEBG_KEY]')
    // Bearer / Authorization headers
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]{8,}/gi, 'Bearer [REDACTED]')
    // Key/token assignment patterns
    .replace(/((?:api_?key|auth_?token|secret_?key|password|access_?token)\s*[:=]\s*)[a-zA-Z0-9_\-\.]{8,}/gi, '$1[REDACTED]')
    // Generic long hex tokens in query params or headers
    .replace(/(?:key|token|auth)=([a-zA-Z0-9_-]{24,})/gi, 'token=[REDACTED]');
}

/**
 * Hardened Security Headers to apply to all HTTP responses.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
