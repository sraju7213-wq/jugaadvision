// server/ai/security.ts
var InMemoryRateLimiter = class {
  constructor(windowMs = 6e4, maxRequests = 60) {
    this.records = /* @__PURE__ */ new Map();
    this.lastCleanup = Date.now();
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }
  check(clientIp, customLimit) {
    const now = Date.now();
    this.periodicCleanup(now);
    const limit = customLimit ?? this.maxRequests;
    const ip = clientIp || "127.0.0.1";
    let record = this.records.get(ip);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(ip, record);
    }
    const windowStart = now - this.windowMs;
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
    const remaining = Math.max(0, limit - record.timestamps.length);
    const resetSeconds = Math.ceil(this.windowMs / 1e3);
    if (record.timestamps.length >= limit) {
      const oldest = record.timestamps[0] || now;
      const retryAfter = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1e3));
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetSeconds,
        retryAfter
      };
    }
    record.timestamps.push(now);
    return {
      allowed: true,
      limit,
      remaining: remaining - 1,
      resetSeconds
    };
  }
  periodicCleanup(now) {
    if (now - this.lastCleanup > 12e4) {
      this.lastCleanup = now;
      const windowStart = now - this.windowMs;
      for (const [ip, rec] of this.records.entries()) {
        rec.timestamps = rec.timestamps.filter((ts) => ts > windowStart);
        if (rec.timestamps.length === 0) {
          this.records.delete(ip);
        }
      }
    }
  }
};
var generalRateLimiter = new InMemoryRateLimiter(6e4, 120);
var aiGenerationRateLimiter = new InMemoryRateLimiter(6e4, 30);
function isSSRFSafeUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") {
    return { safe: false, reason: "Empty or invalid URL string" };
  }
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { safe: false, reason: "Malformed URL format" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `Forbidden protocol: ${parsed.protocol}. Only http and https are allowed.` };
  }
  const hostname = parsed.hostname.toLowerCase().trim();
  if (hostname === "localhost" || hostname === "0.0.0.0" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "metadata.google.internal" || hostname.endsWith(".localhost") || hostname.endsWith(".internal") || hostname.endsWith(".local")) {
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev && (hostname === "localhost" || hostname === "127.0.0.1")) {
      return { safe: true };
    }
    return { safe: false, reason: "Restricted host: loopback or internal hostname." };
  }
  if (hostname.startsWith("169.254.")) {
    return { safe: false, reason: "Cloud instance metadata endpoints (169.254.x.x) are strictly prohibited." };
  }
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  if (match) {
    const oct1 = parseInt(match[1], 10);
    const oct2 = parseInt(match[2], 10);
    if (oct1 === 10) {
      return { safe: false, reason: "Private network addresses (10.0.0.0/8) are prohibited." };
    }
    if (oct1 === 172 && oct2 >= 16 && oct2 <= 31) {
      return { safe: false, reason: "Private network addresses (172.16.0.0/12) are prohibited." };
    }
    if (oct1 === 192 && oct2 === 168) {
      return { safe: false, reason: "Private network addresses (192.168.0.0/16) are prohibited." };
    }
    if (oct1 === 0) {
      return { safe: false, reason: "Invalid address 0.0.0.0." };
    }
  }
  return { safe: true };
}

// api-src/ping.ts
function handler(req, res) {
  res.status(200).json({
    pong: true,
    safe: isSSRFSafeUrl("https://api.openai.com"),
    timestamp: Date.now()
  });
}
export {
  handler as default
};
