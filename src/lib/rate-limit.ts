import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { captureError } from "@/lib/logger";

const MAX_REQUESTS = 10;
const WINDOW = "60 s";

let ratelimit: Ratelimit | null = null;
let warnedMissing = false;

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

export async function rateLimit(
  key: string,
  endpoint = "/api/generate"
): Promise<{ success: boolean; remaining: number }> {
  const limiter = getRatelimit();

  if (!limiter) {
    if (process.env.NODE_ENV === "production" && !warnedMissing) {
      warnedMissing = true;
      captureError("Rate limiting disabled: Redis not configured", new Error("Missing KV_REST_API_URL/UPSTASH_REDIS_REST_URL"));
    }
    return { success: true, remaining: MAX_REQUESTS };
  }

  try {
    const result = await limiter.limit(`${endpoint}:${key}`);
    return {
      success: result.success,
      remaining: result.remaining,
    };
  } catch (error) {
    captureError(`Rate limit check failed for ${endpoint}`, error);
    return { success: true, remaining: MAX_REQUESTS };
  }
}
