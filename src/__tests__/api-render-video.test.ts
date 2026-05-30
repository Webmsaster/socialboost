import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

// Supabase mock. A single mockRpc backs the quota.ts reserve/refund helpers
// (reserve_generation / refund_generation) so we can assert ordering and args.
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              single: () => mockSingle(),
            };
          },
        };
      },
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

// Rate limit mock
const mockRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

// Subscription mock. isProSubscription must reflect the status string and
// TEXT_QUOTA_PRO mirrors src/lib/subscription.ts (100) — the route passes it
// as the reserve limit, so the limit is never hardcoded in the test either.
vi.mock("@/lib/subscription", () => ({
  isProSubscription: (status: string | null | undefined) =>
    status === "active" || status === "past_due",
  TEXT_QUOTA_PRO: 100,
}));

// SSRF mock: treat any https URL as safe, reject others (mirrors the real
// guard's contract closely enough for the route's filter logic).
vi.mock("@/lib/ssrf", () => ({
  parseSafeUrl: (url: string) =>
    typeof url === "string" && url.startsWith("https://") ? new URL(url) : null,
}));

// Logger mock
vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { POST } from "@/app/api/render-video/route";
import { TEXT_QUOTA_PRO } from "@/lib/subscription";

// Helper to create a NextRequest with JSON body
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/render-video", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// The render worker is reached via global fetch — mock it so we can assert it
// is (or is NOT) called and control its response.
const mockFetch = vi.fn();

const VALID_SCENES = [{ imageUrl: "https://cdn.example.com/scene1.png" }];

describe("POST /api/render-video", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VIDEO_RENDER_URL = "https://render.example.com";
    process.env.VIDEO_RENDER_TOKEN = "render-token";
    vi.stubGlobal("fetch", mockFetch);
    // Default happy-path auth + rate-limit + Pro profile so individual tests
    // only override what they care about.
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValue({ success: true });
    mockSingle.mockResolvedValue({
      data: { subscription_status: "active", generation_count: 0 },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.VIDEO_RENDER_URL;
    delete process.env.VIDEO_RENDER_TOKEN;
  });

  it("returns 503 if video rendering is not configured", async () => {
    delete process.env.VIDEO_RENDER_URL;

    const response = await POST(createRequest({ scenes: VALID_SCENES }));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error).toContain("not configured");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 401 if no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST(createRequest({ scenes: VALID_SCENES }));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 429 if rate limited", async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false });

    const response = await POST(createRequest({ scenes: VALID_SCENES }));
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 403 if the user is not on a Pro subscription", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "free", generation_count: 0 },
    });

    const response = await POST(createRequest({ scenes: VALID_SCENES }));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Pro subscription");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 if scenes are missing", async () => {
    const response = await POST(createRequest({}));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing scenes");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 if no scene image survives the SSRF filter", async () => {
    const response = await POST(
      createRequest({ scenes: [{ imageUrl: "http://169.254.169.254/meta" }] })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("No valid scene images");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 429 when reserve denies (over limit) and does NOT call the render worker", async () => {
    // reserve_generation returns false → at/over limit.
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const response = await POST(createRequest({ scenes: VALID_SCENES }));
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Monthly limit reached");
    // Reserve-before-spend: the limit comes from subscription.ts, never hardcoded.
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", {
      p_user_id: "user-123",
      p_limit: TEXT_QUOTA_PRO,
    });
    // The expensive render worker must NOT be invoked when reserve fails.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("reserves BEFORE calling the render worker and returns the video URL on success", async () => {
    const callOrder: string[] = [];
    mockRpc.mockImplementationOnce(async (fn: string) => {
      callOrder.push(`rpc:${fn}`);
      return { data: true, error: null };
    });
    mockFetch.mockImplementationOnce(async () => {
      callOrder.push("fetch");
      return {
        ok: true,
        json: async () => ({ videoUrl: "https://cdn.example.com/out.mp4" }),
      };
    });

    const response = await POST(createRequest({ scenes: VALID_SCENES }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.videoUrl).toBe("https://cdn.example.com/out.mp4");
    // Reserve is the only quota mutation; no post-spend increment RPC.
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", {
      p_user_id: "user-123",
      p_limit: TEXT_QUOTA_PRO,
    });
    expect(mockRpc).not.toHaveBeenCalledWith(
      "increment_generation_count",
      expect.anything()
    );
    expect(mockRpc).not.toHaveBeenCalledWith(
      "increment_video_generation_count",
      expect.anything()
    );
    // Ordering: reserve happened before the render worker fetch.
    expect(callOrder).toEqual(["rpc:reserve_generation", "fetch"]);
  });

  it("refunds the reserved slot when the render worker fails (non-OK response)", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation
      .mockResolvedValueOnce({ data: null, error: null }); // refund_generation
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "worker exploded",
    });

    const response = await POST(createRequest({ scenes: VALID_SCENES }));
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json.error).toContain("Render failed");
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", {
      p_user_id: "user-123",
      p_limit: TEXT_QUOTA_PRO,
    });
    // A failed render must not burn quota → refund.
    expect(mockRpc).toHaveBeenCalledWith("refund_generation", {
      p_user_id: "user-123",
    });
  });

  it("refunds the reserved slot when the worker returns 200 but no usable videoUrl", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation
      .mockResolvedValueOnce({ data: null, error: null }); // refund_generation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ videoUrl: null }),
    });

    const response = await POST(createRequest({ scenes: VALID_SCENES }));
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json.error).toContain("Render failed");
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", {
      p_user_id: "user-123",
      p_limit: TEXT_QUOTA_PRO,
    });
    expect(mockRpc).toHaveBeenCalledWith("refund_generation", {
      p_user_id: "user-123",
    });
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("boom"));

    const response = await POST(createRequest({ scenes: VALID_SCENES }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to render video");
  });
});
