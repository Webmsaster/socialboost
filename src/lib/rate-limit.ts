import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { captureError } from "@/lib/logger";

const MAX_REQUESTS = 10;
const WINDOW_MS = 60_000; // 60 seconds

let ratelimit: Ratelimit | null = null;

function getRatelimit() {
  if (!ratelimit) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      return null;
    }
    ratelimit = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(MAX_REQUESTS, "60 s"),
      prefix: "ratelimit:socialboost",
    });
  }
  return ratelimit;
}

// In-memory fallback for when Redis is not configured
const memoryStore = new Map<string, number[]>();

function memoryRateLimit(key: string): { success: boolean; remaining: number } {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const timestamps = (memoryStore.get(key) ?? []).filter((t) => t > windowStart);
  timestamps.push(now);
  memoryStore.set(key, timestamps);

  // Clean up old keys periodically (every 100th call)
  if (Math.random() < 0.01) {
    for (const [k, v] of memoryStore) {
      const active = v.filter((t) => t > windowStart);
      if (active.length === 0) memoryStore.delete(k);
      else memoryStore.set(k, active);
    }
  }

  const success = timestamps.length <= MAX_REQUESTS;
  return { success, remaining: Math.max(0, MAX_REQUESTS - timestamps.length) };
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  limit: number;
  reset: number;
}

export async function rateLimit(
  key: string,
  endpoint = "/api/generate"
): Promise<RateLimitResult> {
  const limiter = getRatelimit();

  if (!limiter) {
    // Use in-memory fallback (works in both dev and prod)
    if (process.env.NODE_ENV === "production") {
      captureError("Rate limiting: Redis not configured, using in-memory fallback", new Error("Missing KV_REST_API_URL/UPSTASH_REDIS_REST_URL"));
    }
    const result = memoryRateLimit(`${endpoint}:${key}`);
    return { ...result, limit: MAX_REQUESTS, reset: 0 };
  }

  try {
    const result = await limiter.limit(`${endpoint}:${key}`);
    return {
      success: result.success,
      remaining: result.remaining,
      limit: result.limit,
      reset: result.reset,
    };
  } catch (error) {
    captureError(`Rate limit check failed for ${endpoint}`, error);
    // Fall back to in-memory on Redis errors
    const result = memoryRateLimit(`${endpoint}:${key}`);
    return { ...result, limit: MAX_REQUESTS, reset: 0 };
  }
}
