import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

// Supabase mock
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

// OpenAI generateVideoAd mock
const mockGenerateVideoAd = vi.fn();
vi.mock("@/lib/openai", () => ({
  generateVideoAd: (...args: unknown[]) => mockGenerateVideoAd(...args),
}));

// Subscription mock. textQuotaFor must be a real implementation here because
// the route uses it to compute the limit passed to reserveGeneration; the
// mock mirrors src/lib/subscription.ts (free 10 / pro 100). isProSubscription
// is a real implementation too so the Pro-gate behaves like production.
vi.mock("@/lib/subscription", () => ({
  isProSubscription: (status: string | null | undefined) =>
    status === "active" || status === "past_due",
  TEXT_QUOTA_FREE: 10,
  TEXT_QUOTA_PRO: 100,
  textQuotaFor: (status: string | null | undefined) =>
    status === "active" || status === "past_due" ? 100 : 10,
}));

// Analytics mock
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

// Logger mock
vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { POST } from "@/app/api/generate-video-ad/route";

// Helper to create a NextRequest with JSON body
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/generate-video-ad", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate-video-ad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = createRequest({
      topic: "test",
      tone: "professional",
      product: "Widget",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 if rate limited", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: false });

    const request = createRequest({
      topic: "test",
      tone: "professional",
      product: "Widget",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
    expect(mockGenerateVideoAd).not.toHaveBeenCalled();
  });

  it("returns 400 if required fields are missing", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });

    // Missing tone and product
    const request = createRequest({ topic: "test" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing required fields");
  });

  it("returns 404 if profile is not found", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({ data: null });

    const request = createRequest({
      topic: "test topic",
      tone: "professional",
      product: "Widget",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Profile not found");
  });

  it("returns 403 if the user is not on a Pro subscription", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 0, subscription_status: "free" },
    });

    const request = createRequest({
      topic: "test topic",
      tone: "professional",
      product: "Widget",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Pro subscription");
    // Never reserve or spend for a non-Pro user.
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockGenerateVideoAd).not.toHaveBeenCalled();
  });

  it("returns 429 when the generation limit is reached (reserve denied, no spend)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 100, subscription_status: "active" },
    });
    // reserve_generation returns false → over limit, no OpenAI call.
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const request = createRequest({
      topic: "test topic",
      tone: "professional",
      product: "Widget",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Monthly limit reached");
    // Reserve-before-spend: OpenAI is NOT called when the reserve fails.
    expect(mockGenerateVideoAd).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
  });

  it("reserves before spending and returns the storyboard on success", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 3,
        subscription_status: "active",
        brand_voice: null,
        preferred_model: null,
      },
    });
    // reserve_generation succeeds (returns true) BEFORE generateVideoAd runs.
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGenerateVideoAd.mockResolvedValueOnce({
      scenes: [{ caption: "Hook", visual: "Product shot" }],
    });

    const request = createRequest({
      topic: "test topic",
      tone: "professional",
      language: "English",
      product: "Widget",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.scenes).toEqual([{ caption: "Hook", visual: "Product shot" }]);
    // The reserve RPC is the only quota mutation; no post-spend increment.
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).not.toHaveBeenCalledWith(
      "increment_generation_count",
      expect.anything()
    );
    expect(mockGenerateVideoAd).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "test topic",
        tone: "professional",
        language: "English",
        product: "Widget",
      })
    );
  });

  it("passes the Pro limit (100) to reserveGeneration", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 0,
        subscription_status: "active",
        brand_voice: null,
        preferred_model: null,
      },
    });
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGenerateVideoAd.mockResolvedValueOnce({ scenes: [] });

    const request = createRequest({
      topic: "test topic",
      tone: "professional",
      product: "Widget",
    });
    await POST(request);

    // Limit is derived from subscription.ts (Pro = 100), never hardcoded.
    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_generation",
      expect.objectContaining({ p_user_id: "user-123", p_limit: 100 })
    );
  });

  it("refunds the reserved slot when generation fails", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 3,
        subscription_status: "active",
        brand_voice: null,
        preferred_model: null,
      },
    });
    // reserve succeeds, then generateVideoAd throws → route must refund.
    mockRpc.mockResolvedValueOnce({ data: true, error: null }); // reserve_generation
    mockRpc.mockResolvedValueOnce({ data: null, error: null }); // refund_generation
    mockGenerateVideoAd.mockRejectedValueOnce(new Error("OpenAI down"));

    const request = createRequest({
      topic: "test topic",
      tone: "professional",
      product: "Widget",
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).toHaveBeenCalledWith("refund_generation", expect.any(Object));
  });

  it("uses preferred_model for Pro users", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 0,
        subscription_status: "active",
        brand_voice: "Friendly and warm",
        preferred_model: "gpt-4o",
      },
    });
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGenerateVideoAd.mockResolvedValueOnce({ scenes: [] });

    const request = createRequest({
      topic: "test topic",
      tone: "professional",
      product: "Widget",
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockGenerateVideoAd).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        brandVoice: "Friendly and warm",
      })
    );
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected error"));

    const request = createRequest({
      topic: "test",
      tone: "professional",
      product: "Widget",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to generate video ad storyboard");
  });
});
