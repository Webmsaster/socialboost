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

// OpenAI repurposePost mock
const mockRepurposePost = vi.fn();
vi.mock("@/lib/openai", () => ({
  repurposePost: (...args: unknown[]) => mockRepurposePost(...args),
}));

// Subscription mock. textQuotaFor must be a real implementation here because
// the route uses it to compute the limit passed to reserveGeneration; the
// mock mirrors src/lib/subscription.ts (free 10 / pro 100). It derives from
// the status string directly so it doesn't consume the mockIsProSubscription
// once-mock the route also reads via isProSubscription.
const mockIsProSubscription = vi.fn();
vi.mock("@/lib/subscription", () => ({
  isProSubscription: (...args: unknown[]) => mockIsProSubscription(...args),
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
import { POST } from "@/app/api/repurpose/route";

// Helper to create a NextRequest with JSON body
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/repurpose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/repurpose", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = createRequest({
      content: "Hello world",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter"],
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
      content: "Hello world",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter"],
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
    expect(mockRepurposePost).not.toHaveBeenCalled();
  });

  it("returns 400 if content or targetPlatforms are missing", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });

    const request = createRequest({ sourcePlatform: "linkedin" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing content or targetPlatforms");
  });

  it("returns 400 if content is too long", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });

    const request = createRequest({
      content: "x".repeat(5001),
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter"],
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Content too long");
  });

  it("returns 400 if too many target platforms", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });

    const request = createRequest({
      content: "Hello",
      sourcePlatform: "linkedin",
      targetPlatforms: ["a", "b", "c", "d", "e", "f"],
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Too many target platforms");
  });

  it("returns 404 if profile is not found", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({ data: null });

    const request = createRequest({
      content: "Hello world",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter"],
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Profile not found");
  });

  it("returns 429 if free generation limit is reached (reserve denied) without spending", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 10, subscription_status: "free" },
    });
    // reserve_generation returns false → over limit, no OpenAI call.
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const request = createRequest({
      content: "Hello world",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter"],
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Monthly limit reached");
    // Reserve-before-spend: OpenAI is NOT called when the reserve fails.
    expect(mockRepurposePost).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    // The old post-spend increment must be gone.
    expect(mockRpc).not.toHaveBeenCalledWith(
      "increment_generation_count",
      expect.anything()
    );
  });

  it("returns 429 if pro generation limit is reached (reserve denied)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 100, subscription_status: "active" },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const request = createRequest({
      content: "Hello world",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter"],
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Monthly limit reached");
    expect(mockRepurposePost).not.toHaveBeenCalled();
  });

  it("reserves before spending and returns repurposed results on success", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 3, subscription_status: "free" },
    });
    // reserve_generation succeeds (returns true) BEFORE repurposePost runs.
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockRepurposePost.mockResolvedValueOnce({
      content: "Repurposed!",
      hashtags: ["#test"],
    });

    const request = createRequest({
      content: "Hello world",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter"],
      language: "English",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.results.twitter.content).toBe("Repurposed!");
    expect(json.results.twitter.hashtags).toEqual(["#test"]);
    // The reserve RPC is the only quota mutation; no post-spend increment.
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).not.toHaveBeenCalledWith(
      "increment_generation_count",
      expect.anything()
    );
    expect(mockRepurposePost).toHaveBeenCalledWith(
      expect.objectContaining({
        original: "Hello world",
        sourcePlatform: "linkedin",
        targetPlatform: "twitter",
        language: "English",
      })
    );
  });

  it("skips the source platform when it appears in targets", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 0, subscription_status: "free" },
    });
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockRepurposePost.mockResolvedValueOnce({
      content: "For FB",
      hashtags: [],
    });

    const request = createRequest({
      content: "Hello world",
      sourcePlatform: "linkedin",
      targetPlatforms: ["linkedin", "facebook"],
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.results.linkedin).toBeUndefined();
    expect(json.results.facebook.content).toBe("For FB");
    expect(mockRepurposePost).toHaveBeenCalledTimes(1);
  });

  it("refunds the reserved slot when repurpose generation fails", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 3, subscription_status: "free" },
    });
    // reserve succeeds, then repurposePost throws → route must refund.
    mockRpc.mockResolvedValueOnce({ data: true, error: null }); // reserve_generation
    mockRpc.mockResolvedValueOnce({ data: null, error: null }); // refund_generation
    mockRepurposePost.mockRejectedValueOnce(new Error("OpenAI down"));

    const request = createRequest({
      content: "Hello world",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter"],
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).toHaveBeenCalledWith("refund_generation", expect.any(Object));
  });

  it("defaults language to English if not provided", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 0, subscription_status: "free" },
    });
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockRepurposePost.mockResolvedValueOnce({ content: "Post", hashtags: [] });

    const request = createRequest({
      content: "Hello world",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter"],
    });
    await POST(request);

    expect(mockRepurposePost).toHaveBeenCalledWith(
      expect.objectContaining({ language: "English" })
    );
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected error"));

    const request = createRequest({
      content: "Hello world",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter"],
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to repurpose content");
  });
});
