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

// OpenAI generateVideoScript mock
const mockGenerateVideoScript = vi.fn();
vi.mock("@/lib/openai", () => ({
  generateVideoScript: (...args: unknown[]) => mockGenerateVideoScript(...args),
}));

// Subscription mock. textQuotaFor must be a real implementation here because
// the route uses it to compute the limit passed to reserveGeneration; the
// mock mirrors src/lib/subscription.ts (free 10 / pro 100). isProSubscription
// is a separate spy so the Pro-gate (403) and the limit derivation stay
// independently controllable from each test.
const mockIsProSubscription = vi.fn();
vi.mock("@/lib/subscription", () => ({
  isProSubscription: (...args: unknown[]) => mockIsProSubscription(...args),
  TEXT_QUOTA_FREE: 10,
  TEXT_QUOTA_PRO: 100,
  textQuotaFor: (status: string | null | undefined) =>
    status === "active" || status === "past_due" ? 100 : 10,
}));

// Logger mock
vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Analytics mock
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

// Import after mocks
import { POST } from "@/app/api/generate-video-script/route";

// Helper to create a NextRequest with JSON body
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/generate-video-script", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate-video-script", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = createRequest({
      topic: "product launch",
      tone: "professional",
      platform: "youtube",
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
    mockRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const request = createRequest({
      topic: "product launch",
      tone: "professional",
      platform: "youtube",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
  });

  it("returns 400 if required fields are missing", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });

    // Missing tone and platform
    const request = createRequest({ topic: "product launch" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing required fields");
  });

  it("returns 404 if profile is not found", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({ data: null });

    const request = createRequest({
      topic: "product launch",
      tone: "professional",
      platform: "youtube",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Profile not found");
  });

  it("returns 403 if not Pro subscription (does not reserve or call OpenAI)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 3, subscription_status: "free" },
    });
    mockIsProSubscription.mockReturnValueOnce(false);

    const request = createRequest({
      topic: "product launch",
      tone: "professional",
      platform: "youtube",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Pro subscription");
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockGenerateVideoScript).not.toHaveBeenCalled();
  });

  it("returns 429 when over the limit (reserve denied) without calling OpenAI", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 100, subscription_status: "active" },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    // reserve_generation returns false → at/over limit, no OpenAI call.
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const request = createRequest({
      topic: "product launch",
      tone: "professional",
      platform: "youtube",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Monthly limit reached");
    // Reserve-before-spend: OpenAI is NOT called when the reserve fails.
    expect(mockGenerateVideoScript).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
  });

  it("reserves before spending and returns the video script on success", async () => {
    const scriptResult = {
      hook: "Did you know...",
      scenes: [
        { visual: "Product shot", narration: "Introducing our product", duration: "5s" },
      ],
      cta: "Subscribe now",
    };

    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 3,
        subscription_status: "active",
        brand_voice: null,
        preferred_model: null,
      },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    // reserve_generation succeeds (returns true) BEFORE generateVideoScript runs.
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGenerateVideoScript.mockResolvedValueOnce(scriptResult);

    const request = createRequest({
      topic: "product launch",
      tone: "professional",
      platform: "youtube",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.hook).toBe("Did you know...");
    expect(json.scenes).toHaveLength(1);
    expect(json.cta).toBe("Subscribe now");
    // The reserve RPC is the only quota mutation; no post-spend increment.
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", {
      p_user_id: "user-123",
      p_limit: 100,
    });
    expect(mockRpc).not.toHaveBeenCalledWith(
      "increment_generation_count",
      expect.anything()
    );
    expect(mockGenerateVideoScript).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "product launch",
        tone: "professional",
        platform: "youtube",
        language: "English",
      })
    );
  });

  it("uses default model for Pro users without preferred_model", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 3,
        subscription_status: "active",
        brand_voice: null,
        preferred_model: null,
      },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGenerateVideoScript.mockResolvedValueOnce({ hook: "Test", scenes: [], cta: "Sub" });

    const request = createRequest({
      topic: "product launch",
      tone: "professional",
      platform: "youtube",
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockGenerateVideoScript).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o-mini" })
    );
  });

  it("uses preferred_model when set for Pro users", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 3,
        subscription_status: "active",
        brand_voice: "Bold",
        preferred_model: "gpt-4o",
      },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGenerateVideoScript.mockResolvedValueOnce({ hook: "Test", scenes: [], cta: "Sub" });

    const request = createRequest({
      topic: "product launch",
      tone: "professional",
      platform: "youtube",
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockGenerateVideoScript).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o", brandVoice: "Bold" })
    );
  });

  it("falls back to gpt-4o-mini when Pro user has empty string preferred_model", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 3,
        subscription_status: "active",
        brand_voice: null,
        preferred_model: "",
      },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGenerateVideoScript.mockResolvedValueOnce({ hook: "Test", scenes: [], cta: "Sub" });

    const request = createRequest({
      topic: "product launch",
      tone: "professional",
      platform: "youtube",
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockGenerateVideoScript).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o-mini" })
    );
  });

  it("refunds the reserved slot when generation fails", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 3,
        subscription_status: "active",
        brand_voice: null,
        preferred_model: null,
      },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    // reserve succeeds, then generateVideoScript throws → route must refund.
    mockRpc.mockResolvedValueOnce({ data: true, error: null }); // reserve_generation
    mockRpc.mockResolvedValueOnce({ data: null, error: null }); // refund_generation
    mockGenerateVideoScript.mockRejectedValueOnce(new Error("OpenAI down"));

    const request = createRequest({
      topic: "product launch",
      tone: "professional",
      platform: "youtube",
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).toHaveBeenCalledWith("refund_generation", { p_user_id: "user-123" });
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected error"));

    const request = createRequest({
      topic: "product launch",
      tone: "professional",
      platform: "youtube",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to generate video script");
  });
});
