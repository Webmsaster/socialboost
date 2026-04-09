import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockUpsert = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      upsert: (...args: unknown[]) => mockUpsert(...args),
    }),
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

import { POST } from "@/app/api/newsletter/route";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/newsletter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/newsletter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(createRequest({ email: "not-an-email" }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("valid email");
  });

  it("returns 400 for missing email", async () => {
    const res = await POST(createRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 200 and lowercases email on success", async () => {
    mockUpsert.mockReturnValueOnce({ error: null });

    const res = await POST(createRequest({ email: "User@Example.COM" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      { email: "user@example.com" },
      { onConflict: "email" }
    );
  });

  it("returns 200 even when DB write fails (graceful degradation)", async () => {
    mockUpsert.mockReturnValueOnce({ error: { message: "table not found" } });

    const res = await POST(createRequest({ email: "test@example.com" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("returns 429 when rate-limited", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    vi.mocked(rateLimit).mockResolvedValueOnce({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const res = await POST(createRequest({ email: "test@example.com" }));
    expect(res.status).toBe(429);
  });

  it("returns 500 on unexpected error", async () => {
    mockUpsert.mockImplementationOnce(() => {
      throw new Error("Catastrophic");
    });

    const res = await POST(createRequest({ email: "test@example.com" }));
    expect(res.status).toBe(500);
  });
});
