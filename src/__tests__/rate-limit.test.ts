import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock upstash modules
vi.mock("@upstash/ratelimit", () => ({ Ratelimit: vi.fn() }));
vi.mock("@upstash/redis", () => ({ Redis: vi.fn() }));
vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

describe("rateLimit", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.KV_REST_API_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
  });

  it("allows requests with in-memory fallback when Redis not configured", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const result = await rateLimit("user-1");
    expect(result.success).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.limit).toBe(10);
  });

  it("blocks after exceeding limit with in-memory fallback", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    // Make 10 requests to exhaust the limit
    for (let i = 0; i < 10; i++) {
      await rateLimit("user-flood");
    }
    // 11th request should be blocked
    const result = await rateLimit("user-flood");
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different users independently", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const r1 = await rateLimit("user-a");
    const r2 = await rateLimit("user-b");
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it("returns reset value of 0 for in-memory fallback", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const result = await rateLimit("user-reset");
    expect(result.reset).toBe(0);
  });

  it("decrements remaining count with each request", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    const r1 = await rateLimit("user-dec");
    const r2 = await rateLimit("user-dec");
    expect(r2.remaining).toBeLessThan(r1.remaining);
  });
});
