import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

// Supabase admin client mock (the v1 route uses createClient from
// @supabase/supabase-js with the service-role key, not the SSR helper).
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockRpc = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
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
  })),
}));

// API key validation mock
const mockValidateApiKey = vi.fn();
vi.mock("@/lib/api-keys", () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
}));

// Rate limit mock
const mockRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

// OpenAI generatePost mock — this is the expensive call that must only run
// AFTER a successful reserve.
const mockGeneratePost = vi.fn();
vi.mock("@/lib/openai", () => ({
  generatePost: (...args: unknown[]) => mockGeneratePost(...args),
  // The route now derives its allow-lists from these shared constants.
  PLATFORMS: ["linkedin", "facebook", "instagram", "pinterest", "twitter"],
  TONES: ["professional", "casual", "inspirational", "humorous", "educational"],
}));

// Subscription mock. textQuotaFor must be a real implementation here because
// the route uses it to compute the limit passed to reserveGeneration; the
// mock mirrors src/lib/subscription.ts (free 10 / pro 100). It derives from
// the status string directly so it doesn't depend on the isProSubscription
// mock, which the route also reads to pick the model.
const mockIsProSubscription = vi.fn();
vi.mock("@/lib/subscription", () => ({
  isProSubscription: (...args: unknown[]) => mockIsProSubscription(...args),
  textQuotaFor: (status: string | null | undefined) =>
    status === "active" || status === "past_due" ? 100 : 10,
}));

// Logger mock
vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { POST } from "@/app/api/v1/generate/route";

// Helper to create a NextRequest with JSON body and Bearer API key.
function createRequest(
  body: Record<string, unknown>,
  apiKey: string | null = "sb_test_key"
): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey !== null) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return new NextRequest("http://localhost:3000/api/v1/generate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if the Authorization header is missing", async () => {
    const request = createRequest(
      { platform: "linkedin", topic: "test" },
      null
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toContain("Missing API key");
  });

  it("returns 401 if the API key is invalid", async () => {
    mockValidateApiKey.mockResolvedValueOnce(null);

    const request = createRequest({ platform: "linkedin", topic: "test" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toContain("Invalid or revoked API key");
  });

  it("returns 429 if rate limited", async () => {
    mockValidateApiKey.mockResolvedValueOnce("user-123");
    mockRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, limit: 10 });

    const request = createRequest({ platform: "linkedin", topic: "test" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
  });

  it("returns 400 if platform or topic is missing", async () => {
    mockValidateApiKey.mockResolvedValueOnce("user-123");
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5, limit: 10 });

    const request = createRequest({ platform: "linkedin" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing platform or topic");
  });

  it("returns 400 for an invalid platform", async () => {
    mockValidateApiKey.mockResolvedValueOnce("user-123");
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5, limit: 10 });

    const request = createRequest({ platform: "myspace", topic: "test topic" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Invalid platform");
  });

  it("returns 400 for an invalid tone", async () => {
    mockValidateApiKey.mockResolvedValueOnce("user-123");
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5, limit: 10 });

    const request = createRequest({ platform: "linkedin", topic: "test topic", tone: "sarcastic" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Invalid tone");
    // Tone is rejected before any quota work.
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 404 if the profile is not found", async () => {
    mockValidateApiKey.mockResolvedValueOnce("user-123");
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5, limit: 10 });
    mockSingle.mockResolvedValueOnce({ data: null });

    const request = createRequest({ platform: "linkedin", topic: "test topic" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Profile not found");
  });

  it("returns 429 if the free generation limit is reached (reserve denied)", async () => {
    mockValidateApiKey.mockResolvedValueOnce("user-123");
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5, limit: 10 });
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "free", generation_count: 10 },
    });
    // reserve_generation returns false → over limit, no OpenAI call.
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const request = createRequest({ platform: "linkedin", topic: "test topic" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Monthly limit reached");
    // Reserve-before-spend: OpenAI is NOT called when the reserve fails.
    expect(mockGeneratePost).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
  });

  it("returns 429 if the pro generation limit is reached (reserve denied)", async () => {
    mockValidateApiKey.mockResolvedValueOnce("user-123");
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5, limit: 10 });
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "active", generation_count: 100 },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const request = createRequest({ platform: "linkedin", topic: "test topic" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Monthly limit reached");
    expect(mockGeneratePost).not.toHaveBeenCalled();
  });

  it("reserves before spending and returns the generated post on success", async () => {
    mockValidateApiKey.mockResolvedValueOnce("user-123");
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5, limit: 10 });
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "free", generation_count: 3 },
    });
    // reserve_generation must resolve BEFORE generatePost runs. Assert ordering
    // by having generatePost throw if it is somehow called before reserve.
    let reserved = false;
    mockRpc.mockImplementationOnce(async (fn: string) => {
      expect(fn).toBe("reserve_generation");
      reserved = true;
      return { data: true, error: null };
    });
    mockGeneratePost.mockImplementationOnce(async () => {
      // Reserve must already have happened by the time we spend.
      expect(reserved).toBe(true);
      return { content: "Great post!", hashtags: ["#test"] };
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
    expect(json.platform).toBe("linkedin");
    // The reserve RPC is the only quota mutation; no post-spend increment.
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).not.toHaveBeenCalledWith(
      "increment_generation_count",
      expect.anything()
    );
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
    mockValidateApiKey.mockResolvedValueOnce("user-123");
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5, limit: 10 });
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "free", generation_count: 3 },
    });
    // reserve succeeds, then generatePost throws → route must refund.
    mockRpc.mockResolvedValueOnce({ data: true, error: null }); // reserve_generation
    mockRpc.mockResolvedValueOnce({ data: null, error: null }); // refund_generation
    mockGeneratePost.mockRejectedValueOnce(new Error("OpenAI down"));

    const request = createRequest({ platform: "linkedin", topic: "test topic" });
    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).toHaveBeenCalledWith("refund_generation", expect.any(Object));
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockValidateApiKey.mockRejectedValueOnce(new Error("Unexpected error"));

    const request = createRequest({ platform: "linkedin", topic: "test" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Generation failed");
  });
});
