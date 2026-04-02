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

// Subscription mock
const mockIsProSubscription = vi.fn();
vi.mock("@/lib/subscription", () => ({
  isProSubscription: (...args: unknown[]) => mockIsProSubscription(...args),
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

  it("returns 403 if not Pro subscription", async () => {
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
  });

  it("returns 403 if generation limit reached", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 100, subscription_status: "active" },
    });
    mockIsProSubscription.mockReturnValueOnce(true);

    const request = createRequest({
      topic: "product launch",
      tone: "professional",
      platform: "youtube",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Monthly limit reached");
  });

  it("returns video script on success", async () => {
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
    mockIsProSubscription.mockReturnValueOnce(true);
    mockGenerateVideoScript.mockResolvedValueOnce(scriptResult);
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

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
    mockIsProSubscription.mockReturnValueOnce(true);
    mockGenerateVideoScript.mockResolvedValueOnce({ hook: "Test", scenes: [], cta: "Sub" });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

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
    mockIsProSubscription.mockReturnValueOnce(true);
    mockGenerateVideoScript.mockResolvedValueOnce({ hook: "Test", scenes: [], cta: "Sub" });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

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
    mockIsProSubscription.mockReturnValueOnce(true);
    mockGenerateVideoScript.mockResolvedValueOnce({ hook: "Test", scenes: [], cta: "Sub" });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

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
