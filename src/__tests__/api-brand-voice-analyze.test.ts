import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

// Supabase mock. A single `mockRpc` stands in for supabase.rpc(), which is how
// the route reaches reserve_generation / refund_generation via the quota.ts
// helpers. Asserting on the RPC name + order is the canonical way (mirrors
// api-generate.test.ts) to prove the reserve-before-spend contract.
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

// OpenAI mock — analyzeBrandVoice is the expensive call that must NOT run when
// the reserve fails, and whose failure must trigger a refund.
const mockAnalyzeBrandVoice = vi.fn();
const mockBrandVoiceProfileToText = vi.fn();
vi.mock("@/lib/openai", () => ({
  analyzeBrandVoice: (...args: unknown[]) => mockAnalyzeBrandVoice(...args),
  brandVoiceProfileToText: (...args: unknown[]) => mockBrandVoiceProfileToText(...args),
}));

// Subscription mock. isProSubscription gates the route (Pro-only); TEXT_QUOTA_PRO
// is the base limit the route adds bonus_generations to before reserving — kept
// as a real constant (100, mirrors src/lib/subscription.ts) so the limit is
// NEVER hardcoded in the test's assertions.
const mockIsProSubscription = vi.fn();
vi.mock("@/lib/subscription", () => ({
  isProSubscription: (...args: unknown[]) => mockIsProSubscription(...args),
  TEXT_QUOTA_PRO: 100,
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
import { POST } from "@/app/api/brand-voice/analyze/route";

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/brand-voice/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/brand-voice/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated Pro user, not rate limited. Individual tests
    // override what they care about.
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValue({ success: true });
    mockIsProSubscription.mockReturnValue(true);
  });

  it("returns 401 if no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST(createRequest({ examples: ["a post"] }));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(mockAnalyzeBrandVoice).not.toHaveBeenCalled();
  });

  it("returns 429 if rate limited", async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false });

    const response = await POST(createRequest({ examples: ["a post"] }));
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
    expect(mockAnalyzeBrandVoice).not.toHaveBeenCalled();
  });

  it("returns 403 if the user is not a Pro subscriber", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "free", preferred_model: null, generation_count: 0, bonus_generations: 0 },
    });
    mockIsProSubscription.mockReturnValueOnce(false);

    const response = await POST(createRequest({ examples: ["a post"] }));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Pro feature");
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockAnalyzeBrandVoice).not.toHaveBeenCalled();
  });

  it("returns 400 if `examples` is not an array", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "active", preferred_model: null, generation_count: 0, bonus_generations: 0 },
    });

    const response = await POST(createRequest({ examples: "not an array" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("must be an array");
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockAnalyzeBrandVoice).not.toHaveBeenCalled();
  });

  it("returns 400 if no usable examples are provided", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "active", preferred_model: null, generation_count: 0, bonus_generations: 0 },
    });

    const response = await POST(createRequest({ examples: ["   ", ""] }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("at least one example");
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockAnalyzeBrandVoice).not.toHaveBeenCalled();
  });

  it("returns 429 when the reserve is denied and does NOT call OpenAI", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "active", preferred_model: null, generation_count: 100, bonus_generations: 0 },
    });
    // reserve_generation returns false → at/over limit. The expensive
    // analyzeBrandVoice call must be skipped entirely.
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const response = await POST(createRequest({ examples: ["a real post body"] }));
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Monthly limit reached");
    // Reserve-before-spend: OpenAI is NOT called when the reserve fails.
    expect(mockAnalyzeBrandVoice).not.toHaveBeenCalled();
    // The only RPC was the reserve attempt — no refund (nothing was reserved).
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).not.toHaveBeenCalledWith("refund_generation", expect.anything());
  });

  it("reserves BEFORE calling OpenAI and returns the analyzed profile on success", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "active", preferred_model: null, generation_count: 3, bonus_generations: 0 },
    });
    // reserve_generation succeeds.
    mockRpc.mockResolvedValueOnce({ data: true, error: null });

    const analyzedProfile = {
      summary: "Punchy first-person stories.",
      toneTags: ["casual"],
      vocabulary: ["ship"],
      hookStyle: "Question hook.",
      ctaStyle: "Direct.",
      emojiUsage: "sparse",
      sentenceLength: "short",
    };
    // Record call order so we can prove reserve happened first.
    let reserveCalledAtAnalyze = false;
    mockAnalyzeBrandVoice.mockImplementationOnce(async () => {
      reserveCalledAtAnalyze = mockRpc.mock.calls.some(
        (c) => c[0] === "reserve_generation",
      );
      return analyzedProfile;
    });
    mockBrandVoiceProfileToText.mockReturnValueOnce("voice text block");

    const response = await POST(createRequest({ examples: ["post one body", "post two body"], source: "manual" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.profile).toEqual(analyzedProfile);
    expect(json.text).toBe("voice text block");
    // Order: reserve must have already run by the time analyze fires.
    expect(reserveCalledAtAnalyze).toBe(true);
    // The reserve RPC is the only quota mutation; no post-spend increment.
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).not.toHaveBeenCalledWith("increment_generation_count", expect.anything());
    expect(mockRpc).not.toHaveBeenCalledWith("refund_generation", expect.anything());
    expect(mockAnalyzeBrandVoice).toHaveBeenCalledWith(
      expect.objectContaining({ examples: ["post one body", "post two body"] }),
    );
  });

  it("passes the Pro user's preferred_model to analyzeBrandVoice", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "active", preferred_model: "gpt-4o", generation_count: 0, bonus_generations: 0 },
    });
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockAnalyzeBrandVoice.mockResolvedValueOnce({
      summary: "x", toneTags: [], vocabulary: [], hookStyle: "", ctaStyle: "", emojiUsage: "sparse", sentenceLength: "medium",
    });
    mockBrandVoiceProfileToText.mockReturnValueOnce("text");

    const response = await POST(createRequest({ examples: ["a post body"] }));

    expect(response.status).toBe(200);
    expect(mockAnalyzeBrandVoice).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o" }),
    );
  });

  it("refunds the reserved slot when analyzeBrandVoice fails", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "active", preferred_model: null, generation_count: 3, bonus_generations: 0 },
    });
    // reserve succeeds, then analyze throws → route must refund.
    mockRpc.mockResolvedValueOnce({ data: true, error: null }); // reserve_generation
    mockRpc.mockResolvedValueOnce({ data: null, error: null }); // refund_generation
    mockAnalyzeBrandVoice.mockRejectedValueOnce(new Error("OpenAI down"));

    const response = await POST(createRequest({ examples: ["a post body"] }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to analyze brand voice");
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).toHaveBeenCalledWith("refund_generation", expect.any(Object));
  });
});
