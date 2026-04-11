import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}));

const mockRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

import { POST } from "@/app/api/score/route";

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/score", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(createRequest({ content: "test", platform: "twitter" }));
    expect(res.status).toBe(401);
  });

  it("returns 429 if rate limited", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockRateLimit.mockResolvedValueOnce({ success: false });
    const res = await POST(createRequest({ content: "test", platform: "twitter" }));
    expect(res.status).toBe(429);
  });

  it("returns 400 if content is missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    const res = await POST(createRequest({ platform: "twitter" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 if platform is missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    const res = await POST(createRequest({ content: "test" }));
    expect(res.status).toBe(400);
  });

  it("returns a score between 10 and 100 for valid content", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    const res = await POST(createRequest({
      content: "This is a great post about AI and how it helps businesses grow. What do you think?",
      platform: "linkedin",
      hashtags: ["ai", "business", "growth"],
    }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.score).toBeGreaterThanOrEqual(10);
    expect(json.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(json.tips)).toBe(true);
    expect(json.metrics).toBeDefined();
    expect(json.metrics.length).toBeGreaterThan(0);
  });

  it("penalizes very short content", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    const res = await POST(createRequest({
      content: "Hi",
      platform: "linkedin",
    }));
    const json = await res.json();
    expect(json.score).toBeLessThan(70);
    expect(json.tips.length).toBeGreaterThan(0);
  });

  it("rewards posts with CTA", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    const res = await POST(createRequest({
      content: "Great tips for marketing! Comment below and share your experience with us!",
      platform: "twitter",
      hashtags: ["marketing"],
    }));
    const json = await res.json();
    // CTA should boost score
    expect(json.score).toBeGreaterThanOrEqual(60);
  });

  it("returns tips for posts exceeding platform limit", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    const longContent = "A".repeat(300);
    const res = await POST(createRequest({
      content: longContent,
      platform: "twitter",
    }));
    const json = await res.json();
    expect(json.tips.some((t: string) => t.includes("character limit"))).toBe(true);
  });
});
