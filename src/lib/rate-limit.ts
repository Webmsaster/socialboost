import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { captureError } from "@/lib/logger";

const MAX_REQUESTS = 10;
const WINDOW = "60 s";

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
      limiter: Ratelimit.slidingWindow(MAX_REQUESTS, WINDOW),
      prefix: "ratelimit:socialboost",
    });
  }
  return ratelimit;
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
    if (process.env.NODE_ENV === "production") {
      captureError("Rate limiting unavailable: Redis not configured", new Error("Missing KV_REST_API_URL/UPSTASH_REDIS_REST_URL"));
      return { success: false, remaining: 0, limit: MAX_REQUESTS, reset: 0 };
    }
    // Allow in development without Redis
    return { success: true, remaining: MAX_REQUESTS, limit: MAX_REQUESTS, reset: 0 };
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
    // Fail open in dev, fail closed in prod
    if (process.env.NODE_ENV === "production") {
      return { success: false, remaining: 0, limit: MAX_REQUESTS, reset: 0 };
    }
    return { success: true, remaining: MAX_REQUESTS, limit: MAX_REQUESTS, reset: 0 };
  }
}
