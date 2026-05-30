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

// OpenAI generateImage mock
const mockGenerateImage = vi.fn();
vi.mock("@/lib/openai", () => ({
  generateImage: (...args: unknown[]) => mockGenerateImage(...args),
}));

// Storage mock (route dynamically imports persistImage)
const mockPersistImage = vi.fn();
vi.mock("@/lib/storage", () => ({
  persistImage: (...args: unknown[]) => mockPersistImage(...args),
}));

// Subscription mock. textQuotaFor must be a real implementation here because
// the route uses it to compute the limit passed to reserveGeneration; the
// mock mirrors src/lib/subscription.ts (free 10 / pro 100). isProSubscription
// is a real implementation too so the Pro gate behaves as in production.
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
import { POST } from "@/app/api/generate-image/route";

// Helper to create a NextRequest with JSON body
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = createRequest({ prompt: "a cat" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 if rate limited", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, limit: 10 });

    const request = createRequest({ prompt: "a cat" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
    // Rate-limited requests never touch OpenAI or the quota RPC.
    expect(mockGenerateImage).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 if prompt is missing", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });

    const request = createRequest({});
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing required field");
  });

  it("returns 400 if prompt is too long", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });

    const request = createRequest({ prompt: "x".repeat(1001) });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Prompt too long");
  });

  it("returns 404 if profile is not found", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({ data: null });

    const request = createRequest({ prompt: "a cat" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Profile not found");
  });

  it("returns 403 if the user is not on a Pro subscription", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 0, subscription_status: "free" },
    });

    const request = createRequest({ prompt: "a cat" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Pro subscription");
    // Non-Pro requests never reserve or call OpenAI.
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it("returns 429 if the monthly limit is reached (reserve denied) without spending", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 100, subscription_status: "active" },
    });
    // reserve_generation returns false → over limit, no OpenAI call.
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const request = createRequest({ prompt: "a cat" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Monthly limit reached");
    // Reserve-before-spend: OpenAI is NOT called when the reserve fails.
    expect(mockGenerateImage).not.toHaveBeenCalled();
    expect(mockPersistImage).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
  });

  it("reserves before spending and returns the persisted image url on success", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 3, subscription_status: "active" },
    });
    // reserve_generation succeeds (returns true) BEFORE generateImage runs.
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGenerateImage.mockResolvedValueOnce("https://openai.example/tmp.png");
    mockPersistImage.mockResolvedValueOnce("https://storage.example/final.png");

    const request = createRequest({ prompt: "a cat", platform: "instagram" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.url).toBe("https://storage.example/final.png");
    // Reserve happens before the expensive OpenAI call.
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockGenerateImage).toHaveBeenCalledWith("a cat", "1024x1536");
    // The reserve RPC is the only quota mutation; no post-spend increment.
    expect(mockRpc).not.toHaveBeenCalledWith("increment_generation_count", expect.anything());
  });

  it("refunds the reserved slot when image generation fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 3, subscription_status: "active" },
    });
    // reserve succeeds, then generateImage throws → route must refund.
    mockRpc.mockResolvedValueOnce({ data: true, error: null }); // reserve_generation
    mockRpc.mockResolvedValueOnce({ data: null, error: null }); // refund_generation
    mockGenerateImage.mockRejectedValueOnce(new Error("OpenAI down"));

    const request = createRequest({ prompt: "a cat" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to generate image");
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).toHaveBeenCalledWith("refund_generation", expect.any(Object));
  });

  it("refunds the reserved slot when image persistence fails", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 3, subscription_status: "active" },
    });
    mockRpc.mockResolvedValueOnce({ data: true, error: null }); // reserve_generation
    mockRpc.mockResolvedValueOnce({ data: null, error: null }); // refund_generation
    mockGenerateImage.mockResolvedValueOnce("https://openai.example/tmp.png");
    mockPersistImage.mockRejectedValueOnce(new Error("storage down"));

    const request = createRequest({ prompt: "a cat" });
    const response = await POST(request);

    expect(response.status).toBe(500);
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).toHaveBeenCalledWith("refund_generation", expect.any(Object));
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected error"));

    const request = createRequest({ prompt: "a cat" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to generate image");
  });
});
