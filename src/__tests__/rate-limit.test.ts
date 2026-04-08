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

  it("runs memory cleanup and keeps active keys", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");

    // Make requests to populate the memory store with active timestamps
    await rateLimit("cleanup-active-1");
    await rateLimit("cleanup-active-2");

    // Force Math.random to trigger cleanup
    const originalRandom = Math.random;
    Math.random = () => 0.005;

    try {
      // This request triggers cleanup — all keys have recent timestamps, so they stay (else branch)
      const result = await rateLimit("cleanup-trigger");
      expect(result.success).toBe(true);
    } finally {
      Math.random = originalRandom;
    }
  });

  it("runs memory cleanup and removes expired keys", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");

    // Step 1: Create entries at current time
    const realNow = Date.now;
    const baseTime = realNow.call(Date);
    vi.spyOn(Date, "now").mockReturnValue(baseTime);

    await rateLimit("cleanup-expired-1");
    await rateLimit("cleanup-expired-2");

    // Step 2: Advance time past the 60s window so all existing timestamps become stale
    vi.spyOn(Date, "now").mockReturnValue(baseTime + 120_000);

    // Force cleanup
    const originalRandom = Math.random;
    Math.random = () => 0.005;

    try {
      // This triggers cleanup — expired keys have active.length === 0 and get deleted
      const result = await rateLimit("cleanup-fresh");
      expect(result.success).toBe(true);
    } finally {
      Math.random = originalRandom;
      vi.spyOn(Date, "now").mockRestore();
    }
  });

  it("logs captureError in production when Redis is not configured", async () => {
    const { captureError } = await import("@/lib/logger");
    const originalNodeEnv = process.env.NODE_ENV;

    // Set production environment
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    try {
      const { rateLimit } = await import("@/lib/rate-limit");
      await rateLimit("prod-user");

      expect(captureError).toHaveBeenCalledWith(
        "Rate limiting: Redis not configured, using in-memory fallback",
        expect.any(Error)
      );
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    }
  });
});

describe("rateLimit with Redis configured", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("uses Redis Ratelimit when KV_REST_API_URL and token are set", async () => {
    const mockLimitResult = {
      success: true,
      remaining: 8,
      limit: 10,
      reset: 1234567890,
    };
    const mockLimit = vi.fn().mockResolvedValue(mockLimitResult);

    vi.doMock("@upstash/ratelimit", () => {
      class MockRatelimit {
        limit = mockLimit;
        static slidingWindow = vi.fn().mockReturnValue("sliding-window-config");
      }
      return { Ratelimit: MockRatelimit };
    });
    vi.doMock("@upstash/redis", () => {
      class MockRedis {}
      return { Redis: MockRedis };
    });
    vi.doMock("@/lib/logger", () => ({ captureError: vi.fn() }));

    process.env.KV_REST_API_URL = "https://fake-redis.upstash.io";
    process.env.KV_REST_API_TOKEN = "fake-token-123";

    try {
      const { rateLimit } = await import("@/lib/rate-limit");
      const result = await rateLimit("redis-user");

      expect(mockLimit).toHaveBeenCalledWith("/api/generate:redis-user");
      expect(result).toEqual({
        success: true,
        remaining: 8,
        limit: 10,
        reset: 1234567890,
      });

      // Second call reuses cached Ratelimit instance (covers !ratelimit false branch)
      const result2 = await rateLimit("redis-user-2");
      expect(mockLimit).toHaveBeenCalledTimes(2);
      expect(result2.success).toBe(true);
    } finally {
      delete process.env.KV_REST_API_URL;
      delete process.env.KV_REST_API_TOKEN;
    }
  });

  it("falls back to in-memory when Redis throws an error", async () => {
    const mockLimit = vi.fn().mockRejectedValue(new Error("Redis connection failed"));
    const mockCaptureError = vi.fn();

    vi.doMock("@upstash/ratelimit", () => {
      class MockRatelimit {
        limit = mockLimit;
        static slidingWindow = vi.fn().mockReturnValue("sliding-window-config");
      }
      return { Ratelimit: MockRatelimit };
    });
    vi.doMock("@upstash/redis", () => {
      class MockRedis {}
      return { Redis: MockRedis };
    });
    vi.doMock("@/lib/logger", () => ({ captureError: mockCaptureError }));

    process.env.KV_REST_API_URL = "https://fake-redis.upstash.io";
    process.env.KV_REST_API_TOKEN = "fake-token-123";

    try {
      const { rateLimit } = await import("@/lib/rate-limit");
      const result = await rateLimit("error-user");

      // Should fall back to in-memory
      expect(result.success).toBe(true);
      expect(result.limit).toBe(10);
      expect(result.reset).toBe(0);

      // Should have logged the error
      expect(mockCaptureError).toHaveBeenCalledWith(
        "Rate limit check failed for /api/generate",
        expect.any(Error)
      );
    } finally {
      delete process.env.KV_REST_API_URL;
      delete process.env.KV_REST_API_TOKEN;
    }
  });
});
