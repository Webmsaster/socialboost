import { describe, it, expect, beforeEach, vi } from "vitest";

// Controllable behavior for the mocked Supabase + Redis probes.
const state = vi.hoisted(() => ({
  dbResult: { error: null } as { error: unknown },
  dbThrows: false,
  redisResult: "PONG" as string,
  redisThrows: false,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        limit: () => {
          if (state.dbThrows) return Promise.reject(new Error("connection refused"));
          return Promise.resolve(state.dbResult);
        },
      }),
    }),
  })),
}));

vi.mock("@upstash/redis", () => ({
  // A class (not vi.fn) so `new Redis(...)` in the route is a valid constructor.
  Redis: class {
    ping() {
      if (state.redisThrows) return Promise.reject(new Error("redis down"));
      return Promise.resolve(state.redisResult);
    }
  },
}));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    state.dbResult = { error: null };
    state.dbThrows = false;
    state.redisResult = "PONG";
    state.redisThrows = false;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.KV_REST_API_URL = "https://test.upstash.io";
    process.env.KV_REST_API_TOKEN = "redis-token";
  });

  it("returns ok + 200 when all dependencies are healthy", async () => {
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.checks).toEqual({ database: "ok", redis: "ok" });
    expect(data.version).toBeDefined();
  });

  it("returns valid ISO timestamp", async () => {
    const res = await GET();
    const data = await res.json();
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });

  it("returns error + 503 when the database query errors", async () => {
    state.dbResult = { error: { message: "relation does not exist" } };
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(503);
    expect(data.status).toBe("error");
    expect(data.checks.database).toBe("error");
  });

  it("returns error + 503 when the database connection throws (e.g. NXDOMAIN)", async () => {
    state.dbThrows = true;
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(503);
    expect(data.checks.database).toBe("error");
  });

  it("returns degraded + 200 when Redis fails but the DB is healthy", async () => {
    state.redisThrows = true;
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("degraded");
    expect(data.checks.redis).toBe("error");
  });

  it("treats unconfigured Redis as healthy (in-memory fallback)", async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.checks.redis).toBe("not_configured");
  });

  it("treats an unconfigured database as healthy rather than falsely red", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.checks.database).toBe("not_configured");
  });

  it("falls back to 1.0.0 when npm_package_version is unset", async () => {
    const original = process.env.npm_package_version;
    delete process.env.npm_package_version;
    try {
      const res = await GET();
      const data = await res.json();
      expect(data.version).toBe("1.0.0");
    } finally {
      if (original !== undefined) process.env.npm_package_version = original;
    }
  });
});
