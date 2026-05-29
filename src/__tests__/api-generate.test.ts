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

  it("returns 403 if free generation limit is reached", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 10, subscription_status: "free" },
    });

    const request = createRequest({
      platform: "linkedin",
      topic: "test topic",
      tone: "professional",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Monthly limit reached");
  });

  it("returns 403 if pro generation limit is reached", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 100, subscription_status: "active" },
    });
    mockIsProSubscription.mockReturnValueOnce(true);

    const request = createRequest({
      platform: "linkedin",
      topic: "test topic",
      tone: "professional",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Monthly limit reached");
  });

  it("returns generated post on success", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 3, subscription_status: "free" },
    });
    mockGeneratePost.mockResolvedValueOnce({
      content: "Great post!",
      hashtags: ["#test"],
    });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

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
    expect(mockGeneratePost).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "linkedin",
        topic: "test topic",
        tone: "professional",
        language: "English",
      })
    );
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
    mockGeneratePost.mockResolvedValueOnce({ content: "Pro post", hashtags: [] });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

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
    mockGeneratePost.mockResolvedValueOnce({
      content: "Pro post",
      hashtags: ["#pro"],
    });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

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
    mockGeneratePost.mockResolvedValueOnce({
      content: "Post",
      hashtags: [],
    });
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

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
