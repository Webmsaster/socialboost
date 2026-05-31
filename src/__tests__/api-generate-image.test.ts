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

// Storage mock
const mockPersistImage = vi.fn();
vi.mock("@/lib/storage", () => ({
  persistImage: (...args: unknown[]) => mockPersistImage(...args),
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

    const request = createRequest({ prompt: "a sunset" });
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

    const request = createRequest({ prompt: "a sunset" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
  });

  it("returns 400 if prompt is missing", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });

    const request = createRequest({});
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing required field: prompt");
  });

  it("returns 404 if profile is not found", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({ data: null });

    const request = createRequest({ prompt: "a sunset over mountains" });
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

    const request = createRequest({ prompt: "a sunset over mountains" });
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

    const request = createRequest({ prompt: "a sunset over mountains" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Monthly limit reached");
  });

  it("returns generated image URL on success", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true, remaining: 5 });
    mockSingle.mockResolvedValueOnce({
      data: { generation_count: 3, subscription_status: "active" },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    mockGenerateImage.mockResolvedValueOnce("https://openai.com/temp-image.png");
    mockPersistImage.mockResolvedValueOnce("https://storage.supabase.co/image.png");
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    const request = createRequest({ prompt: "a sunset over mountains" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.url).toBe("https://storage.supabase.co/image.png");
    // The route now passes a platform-derived size as the second arg.
    // Without a platform in the body we fall back to 1024x1024 (square).
    expect(mockGenerateImage).toHaveBeenCalledWith("a sunset over mountains", "1024x1024");
    expect(mockPersistImage).toHaveBeenCalledWith(
      "https://openai.com/temp-image.png",
      "user-123"
    );
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected error"));

    const request = createRequest({ prompt: "a sunset" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to generate image");
  });
});
