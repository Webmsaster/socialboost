import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

// Supabase mock
const mockGetUser = vi.fn();
const mockProfileSingle = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({ select: () => ({ eq: () => ({ single: () => mockProfileSingle() }) }) }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

// Rate limit mock
const mockRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

// OpenAI class mock
const mockCreate = vi.fn();
vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: (...args: unknown[]) => mockCreate(...args),
        },
      };
    },
  };
});

// Mock sanitizeInput from openai lib
vi.mock("@/lib/openai", () => ({
  sanitizeInput: (input: string) => input,
}));

// Logger mock
vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { POST } from "@/app/api/hashtags/route";

// Helper to create a NextRequest with JSON body
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/hashtags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/hashtags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileSingle.mockResolvedValue({
      data: { generation_count: 0, subscription_status: "active", bonus_generations: 0 },
    });
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it("returns 401 if no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = createRequest({ topic: "AI trends" });
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

    const request = createRequest({ topic: "AI trends" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
  });

  it("returns 400 if topic is missing", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });

    const request = createRequest({});
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing topic");
  });

  it("returns hashtag categories on success", async () => {
    const hashtagResult = {
      trending: ["#AI", "#MachineLearning", "#Tech", "#Innovation", "#Future"],
      niche: ["#AIethics", "#NeuralNetworks", "#DeepLearning", "#NLP", "#ComputerVision"],
      broad: ["#Technology", "#Digital", "#Science", "#Data", "#Automation"],
    };

    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(hashtagResult),
          },
        },
      ],
    });

    const request = createRequest({ topic: "AI trends", platform: "linkedin" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.trending).toHaveLength(5);
    expect(json.niche).toHaveLength(5);
    expect(json.broad).toHaveLength(5);
    expect(json.trending[0]).toBe("#AI");
  });

  it("uses 'general' when platform is falsy (empty string)", async () => {
    const hashtagResult = {
      trending: ["#AI", "#Tech", "#ML", "#Data", "#Future"],
      niche: ["#AIethics", "#NLP", "#CV", "#DL", "#RL"],
      broad: ["#Technology", "#Digital", "#Science", "#Innovation", "#Auto"],
    };

    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(hashtagResult),
          },
        },
      ],
    });

    const request = createRequest({ topic: "AI trends", platform: "" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.trending).toHaveLength(5);
    // Verify the OpenAI call used "general" as the platform fallback
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Platform: general"),
          }),
        ]),
      })
    );
  });

  it("uses 'general' when platform is not provided", async () => {
    const hashtagResult = {
      trending: ["#AI", "#Tech", "#ML", "#Data", "#Future"],
      niche: ["#AIethics", "#NLP", "#CV", "#DL", "#RL"],
      broad: ["#Technology", "#Digital", "#Science", "#Innovation", "#Auto"],
    };

    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(hashtagResult),
          },
        },
      ],
    });

    const request = createRequest({ topic: "AI trends" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.trending).toHaveLength(5);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Platform: general"),
          }),
        ]),
      })
    );
  });

  it("returns 500 when OpenAI returns empty content", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    });

    const request = createRequest({ topic: "AI trends", platform: "linkedin" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to research hashtags");
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected error"));

    const request = createRequest({ topic: "AI trends" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to research hashtags");
  });
});
