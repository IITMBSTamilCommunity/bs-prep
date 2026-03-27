import redis from "@upstash/redis";

// Rate limiting store using in-memory fallback (install @upstash/redis for cloud version)
const store = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // in milliseconds
  keyPrefix?: string;
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const now = Date.now();
  const storeKey = `${config.keyPrefix || ""}:${key}`;

  let record = store.get(storeKey);

  // If no record or window expired, create new one
  if (!record || now > record.resetTime) {
    record = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    store.set(storeKey, record);
  }

  record.count++;
  const allowed = record.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - record.count);

  return {
    allowed,
    remaining,
    resetTime: record.resetTime,
  };
}

export function getRateLimitHeaders(
  result: Awaited<ReturnType<typeof checkRateLimit>>
): Record<string, string> {
  return {
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetTime / 1000).toString(),
  };
}
