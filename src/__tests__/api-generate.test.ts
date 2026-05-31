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

// OpenAI generatePost mock
const mockGeneratePost = vi.fn();
vi.mock("@/lib/openai", () => ({
  generatePost: (...args: unknown[]) => mockGeneratePost(...args),
}));

// Subscription mock. textQuotaFor must be a real implementation here because
// the route uses it to compute the limit passed to reserveGeneration; the
// mock mirrors src/lib/subscription.ts (free 10 / pro 100). It derives from
// the status string directly (NOT the mockIsProSubscription once-mock) so it
// doesn't consume the mockReturnValueOnce the route also reads via
// isProSubscription.
const mockIsProSubscription = vi.fn();
vi.mock("@/lib/subscription", () => ({
  isProSubscription: (...args: unknown[]) => mockIsProSubscription(...args),
  TEXT_QUOTA_FREE: 10,
  TEXT_QUOTA_PRO: 100,
  textQuotaFor: (status: string | null | undefined) =>
    status === "active" || status === "past_due" ? 100 : 10,
}));

// Email mock
vi.mock("@/lib/email", () => ({
  sendLimitReachedEmail: vi.fn().mockResolvedValue(true),
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
import { POST } from "@/app/api/generate/route";

// Helper to create a NextRequest with JSON body
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = createRequest({
      platform: "linkedin",
      topic: "test",
      tone: "professional",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 if rate limited (without reset header)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, limit: 10 });

    const request = createRequest({
      platform: "linkedin",
      topic: "test",
      tone: "professional",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
    expect(response.headers.get("X-RateLimit-Reset")).toBeNull();
  });

  it("returns 429 if rate limited (with reset header)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, limit: 10, reset: 1234567890 });

    const request = createRequest({
      platform: "linkedin",
      topic: "test",
      tone: "professional",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
    expect(response.headers.get("X-RateLimit-Reset")).toBe("1234567890");
  });

  it("returns 400 if required fields are missing", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });

    // Missing topic and tone
    const request = createRequest({ platform: "linkedin" });
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
      platform: "linkedin",
      topic: "test topic",
      tone: "professional",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Profile not found");
  });

  it("returns 429 if free generation limit is reached (reserve denied)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 10, subscription_status: "free" },
    });
    // reserve_generation returns false → over limit, no OpenAI call.
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const request = createRequest({
      platform: "linkedin",
      topic: "test topic",
      tone: "professional",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Monthly limit reached");
    // Reserve-before-spend: OpenAI is NOT called when the reserve fails.
    expect(mockGeneratePost).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
  });

  it("returns 429 if pro generation limit is reached (reserve denied)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 100, subscription_status: "active" },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const request = createRequest({
      platform: "linkedin",
      topic: "test topic",
      tone: "professional",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Monthly limit reached");
    expect(mockGeneratePost).not.toHaveBeenCalled();
  });

  it("reserves before spending and returns generated post on success", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 3, subscription_status: "free" },
    });
    // reserve_generation succeeds (returns true) BEFORE generatePost runs.
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGeneratePost.mockResolvedValueOnce({
      content: "Great post!",
      hashtags: ["#test"],
    });

    const request = createRequest({
      platform: "linkedin",
      topic: "test topic",
      tone: "professional",
      language: "English",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.content).toBe("Great post!");
    expect(json.hashtags).toEqual(["#test"]);
    // The reserve RPC is the only quota mutation; no post-spend increment.
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).not.toHaveBeenCalledWith("increment_generation_count", expect.anything());
    expect(mockGeneratePost).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "linkedin",
        topic: "test topic",
        tone: "professional",
        language: "English",
      })
    );
  });

  it("refunds the reserved slot when generation fails", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 3, subscription_status: "free" },
    });
    // reserve succeeds, then generatePost throws → route must refund.
    mockRpc.mockResolvedValueOnce({ data: true, error: null }); // reserve_generation
    mockRpc.mockResolvedValueOnce({ data: null, error: null }); // refund_generation
    mockGeneratePost.mockRejectedValueOnce(new Error("OpenAI down"));

    const request = createRequest({
      platform: "linkedin",
      topic: "test topic",
      tone: "professional",
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).toHaveBeenCalledWith("refund_generation", expect.any(Object));
  });

  it("uses default model for Pro users without preferred_model", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "test@test.com" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5, limit: 10 });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 0,
        subscription_status: "active",
        email: "test@test.com",
        brand_voice: null,
        preferred_model: null,
      },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGeneratePost.mockResolvedValueOnce({ content: "Pro post", hashtags: [] });

    const request = createRequest({
      platform: "linkedin",
      topic: "test topic",
      tone: "professional",
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockGeneratePost).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o-mini" })
    );
  });

  it("uses preferred_model for Pro users", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123", email: "test@test.com" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5, limit: 10 });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 0,
        subscription_status: "active",
        email: "test@test.com",
        brand_voice: "Friendly and warm",
        preferred_model: "gpt-4o",
      },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGeneratePost.mockResolvedValueOnce({
      content: "Pro post",
      hashtags: ["#pro"],
    });

    const request = createRequest({
      platform: "linkedin",
      topic: "test topic",
      tone: "professional",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.content).toBe("Pro post");
    expect(mockGeneratePost).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        brandVoice: "Friendly and warm",
      })
    );
  });

  it("defaults language to English if not provided", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 0, subscription_status: "free" },
    });
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGeneratePost.mockResolvedValueOnce({
      content: "Post",
      hashtags: [],
    });

    const request = createRequest({
      platform: "twitter",
      topic: "topic",
      tone: "casual",
    });
    await POST(request);

    expect(mockGeneratePost).toHaveBeenCalledWith(
      expect.objectContaining({ language: "English" })
    );
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected error"));

    const request = createRequest({
      platform: "linkedin",
      topic: "test",
      tone: "professional",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to generate post");
  });
});
