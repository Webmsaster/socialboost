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
      content: "Great LinkedIn post about AI",
      targetPlatforms: ["twitter", "facebook"],
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
      content: "Great LinkedIn post about AI",
      targetPlatforms: ["twitter", "facebook"],
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
  });

  it("returns 400 if content is missing", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });

    const request = createRequest({
      targetPlatforms: ["twitter"],
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing");
  });

  it("returns 400 if targetPlatforms is missing", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });

    const request = createRequest({
      content: "Great LinkedIn post about AI",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing");
  });

  it("returns 404 if profile is not found", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({ data: null });

    const request = createRequest({
      content: "Great LinkedIn post about AI",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter", "facebook"],
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Profile not found");
  });

  it("returns 403 if generation limit reached", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 10, subscription_status: "free" },
    });

    const request = createRequest({
      content: "Great LinkedIn post about AI",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter", "facebook"],
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Monthly limit reached");
  });

  it("skips sourcePlatform in targetPlatforms (continue branch)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 3,
        subscription_status: "active",
        brand_voice: "Bold",
        preferred_model: "gpt-4o",
      },
    });
    mockIsProSubscription.mockReturnValue(true);
    mockGeneratePost.mockResolvedValueOnce({ content: "Twitter version", hashtags: ["#ai"] });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const request = createRequest({
      content: "Great LinkedIn post about AI",
      sourcePlatform: "linkedin",
      targetPlatforms: ["linkedin", "twitter"],
      tone: "casual",
      language: "English",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    // linkedin was skipped (same as sourcePlatform), only twitter was generated
    expect(json.results.twitter.content).toBe("Twitter version");
    expect(json.results.linkedin).toBeUndefined();
    expect(mockGeneratePost).toHaveBeenCalledTimes(1);
    expect(mockGeneratePost).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o", brandVoice: "Bold" })
    );
  });

  it("uses default model for Pro users without preferred_model", async () => {
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
    mockIsProSubscription.mockReturnValue(true);
    mockGeneratePost.mockResolvedValueOnce({ content: "Twitter ver", hashtags: [] });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const request = createRequest({
      content: "AI post",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter"],
      tone: "casual",
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockGeneratePost).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o-mini" })
    );
  });

  it("defaults tone to professional and language to English when not provided", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 3,
        subscription_status: "free",
        brand_voice: "Bold voice",
        preferred_model: null,
      },
    });
    mockIsProSubscription.mockReturnValue(false);
    mockGeneratePost.mockResolvedValueOnce({ content: "Twitter ver", hashtags: [] });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const request = createRequest({
      content: "AI post",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter"],
      // No tone, no language provided
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockGeneratePost).toHaveBeenCalledWith(
      expect.objectContaining({
        tone: "professional",
        language: "English",
        brandVoice: "Bold voice",
      })
    );
  });

  it("returns repurposed content on success", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        generation_count: 3,
        subscription_status: "free",
        brand_voice: null,
        preferred_model: null,
      },
    });
    mockIsProSubscription.mockReturnValue(false);
    mockGeneratePost
      .mockResolvedValueOnce({ content: "Twitter version", hashtags: ["#ai"] })
      .mockResolvedValueOnce({ content: "Facebook version", hashtags: ["#tech"] });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const request = createRequest({
      content: "Great LinkedIn post about AI",
      sourcePlatform: "linkedin",
      targetPlatforms: ["twitter", "facebook"],
      tone: "casual",
      language: "English",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.results.twitter.content).toBe("Twitter version");
    expect(json.results.facebook.content).toBe("Facebook version");
    expect(mockGeneratePost).toHaveBeenCalledTimes(2);
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected error"));

    const request = createRequest({
      content: "Great LinkedIn post about AI",
      targetPlatforms: ["twitter", "facebook"],
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to repurpose content");
  });
});
