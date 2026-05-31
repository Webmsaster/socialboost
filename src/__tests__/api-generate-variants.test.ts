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

// OpenAI generateVariants mock
const mockGenerateVariants = vi.fn();
vi.mock("@/lib/openai", () => ({
  generateVariants: (...args: unknown[]) => mockGenerateVariants(...args),
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

// Analytics mock
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

// Logger mock
vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { POST } from "@/app/api/generate-variants/route";

// Helper to create a NextRequest with JSON body
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/generate-variants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate-variants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST(
      createRequest({ platform: "linkedin", topic: "t", tone: "professional" })
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 if rate limited", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: false });

    const response = await POST(
      createRequest({ platform: "linkedin", topic: "t", tone: "professional" })
    );
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
    expect(mockGenerateVariants).not.toHaveBeenCalled();
  });

  it("returns 400 if required fields are missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });

    const response = await POST(createRequest({ platform: "linkedin" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing required fields");
  });

  it("returns 404 if profile is not found", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({ data: null });

    const response = await POST(
      createRequest({ platform: "linkedin", topic: "test topic", tone: "professional" })
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Profile not found");
  });

  it("returns 403 if user is not Pro", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 0, subscription_status: "free" },
    });
    mockIsProSubscription.mockReturnValueOnce(false);

    const response = await POST(
      createRequest({ platform: "linkedin", topic: "test topic", tone: "professional" })
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Pro subscription");
    // Gated before any reserve/spend.
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockGenerateVariants).not.toHaveBeenCalled();
  });

  it("returns 429 when over the monthly limit without spending (reserve denied)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 100, subscription_status: "active" },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    // reserve_generation returns false → over limit, no OpenAI call.
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const response = await POST(
      createRequest({ platform: "linkedin", topic: "test topic", tone: "professional" })
    );
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Monthly limit reached");
    // Reserve-before-spend: OpenAI is NOT called when the reserve fails.
    expect(mockGenerateVariants).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
  });

  it("reserves before spending and returns variants on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 3, subscription_status: "active" },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    // reserve_generation succeeds (returns true) BEFORE generateVariants runs.
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGenerateVariants.mockResolvedValueOnce(["a", "b", "c"]);

    const response = await POST(
      createRequest({
        platform: "linkedin",
        topic: "test topic",
        tone: "professional",
        language: "English",
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.variants).toEqual(["a", "b", "c"]);
    // The reserve RPC is the only quota mutation; no post-spend increment.
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).not.toHaveBeenCalledWith(
      "increment_generation_count",
      expect.anything()
    );
    expect(mockGenerateVariants).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "linkedin",
        topic: "test topic",
        tone: "professional",
        language: "English",
      })
    );
  });

  it("refunds the reserved slot when generation fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 3, subscription_status: "active" },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    // reserve succeeds, then generateVariants throws → route must refund.
    mockRpc.mockResolvedValueOnce({ data: true, error: null }); // reserve_generation
    mockRpc.mockResolvedValueOnce({ data: null, error: null }); // refund_generation
    mockGenerateVariants.mockRejectedValueOnce(new Error("OpenAI down"));

    const response = await POST(
      createRequest({ platform: "linkedin", topic: "test topic", tone: "professional" })
    );

    expect(response.status).toBe(500);
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).toHaveBeenCalledWith("refund_generation", expect.any(Object));
  });

  it("uses preferred_model for Pro users", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 0,
        subscription_status: "active",
        brand_voice: "Friendly and warm",
        preferred_model: "gpt-4o",
      },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGenerateVariants.mockResolvedValueOnce(["a", "b"]);

    const response = await POST(
      createRequest({ platform: "linkedin", topic: "test topic", tone: "professional" })
    );

    expect(response.status).toBe(200);
    expect(mockGenerateVariants).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        brandVoice: "Friendly and warm",
      })
    );
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected error"));

    const response = await POST(
      createRequest({ platform: "linkedin", topic: "test", tone: "professional" })
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to generate variants");
  });
});
