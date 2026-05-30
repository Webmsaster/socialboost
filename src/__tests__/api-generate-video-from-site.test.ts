import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---
// Mock handles are declared via vi.hoisted so the (hoisted) vi.mock factories
// can safely reference them when the route module is loaded.
const {
  mockGetUser,
  mockSelect,
  mockEq,
  mockSingle,
  mockRpc,
  mockRateLimit,
  mockGenerateVideoScript,
  mockGenerateImage,
  mockGenerateVoiceover,
  mockScrapeWebsite,
  mockPersistImage,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockSingle: vi.fn(),
  mockRpc: vi.fn(),
  mockRateLimit: vi.fn(),
  mockGenerateVideoScript: vi.fn(),
  mockGenerateImage: vi.fn(),
  mockGenerateVoiceover: vi.fn(),
  mockScrapeWebsite: vi.fn(),
  mockPersistImage: vi.fn(),
}));

// Supabase mock. createClient is async in the real module, so resolve it.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return { single: () => mockSingle() };
          },
        };
      },
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

// Rate limit mock
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

// OpenAI mock — the route imports generateVideoScript + generateImage from here.
vi.mock("@/lib/openai", () => ({
  generateVideoScript: (...args: unknown[]) => mockGenerateVideoScript(...args),
  generateImage: (...args: unknown[]) => mockGenerateImage(...args),
}));

// TTS mock
vi.mock("@/lib/openai-tts", () => ({
  generateVoiceover: (...args: unknown[]) => mockGenerateVoiceover(...args),
}));

// Website scraper mock
vi.mock("@/lib/website-scraper", () => ({
  scrapeWebsite: (...args: unknown[]) => mockScrapeWebsite(...args),
  buildPromptBlockFromContext: () => "PROMPT BLOCK",
}));

// Storage mock
vi.mock("@/lib/storage", () => ({
  persistImage: (...args: unknown[]) => mockPersistImage(...args),
}));

// Subscription mock. videoQuotaFor / TEXT_QUOTA_PRO are real implementations
// here (mirrors src/lib/subscription.ts: pro video quota 5, text quota 100) so
// the route derives the reserve limit from subscription.ts, never a hardcoded
// number. isProSubscription derives directly from the status string.
vi.mock("@/lib/subscription", () => ({
  isProSubscription: (status: string | null | undefined) =>
    status === "active" || status === "past_due",
  videoQuotaFor: (status: string | null | undefined) =>
    status === "active" || status === "past_due" ? 5 : 0,
  TEXT_QUOTA_PRO: 100,
}));

// Analytics + logger mocks
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

// Import after mocks
import { POST } from "@/app/api/generate-video-from-site/route";

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/generate-video-from-site", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const PRO_PROFILE = {
  generation_count: 0,
  video_generation_count: 0,
  subscription_status: "active",
  brand_voice: null,
  preferred_model: null,
};

const VALID_BODY = {
  websiteUrl: "https://example.com",
  tone: "professional",
  platform: "linkedin",
};

const SCRIPT = {
  hook: "Hook",
  scenes: [
    { sceneNumber: 1, visual: "A", narration: "n1" },
    { sceneNumber: 2, visual: "B", narration: "n2" },
  ],
  cta: "Visit us",
};

describe("POST /api/generate-video-from-site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValue({ success: true, remaining: 5 });
    mockSingle.mockResolvedValue({ data: PRO_PROFILE });
    // Default: every reserve_* RPC succeeds (within quota). refund_* resolves.
    mockRpc.mockResolvedValue({ data: true, error: null });
    mockScrapeWebsite.mockResolvedValue({
      title: "Example",
      description: "desc",
      headings: [],
      url: "https://example.com",
    });
    mockGenerateVideoScript.mockResolvedValue(SCRIPT);
    mockGenerateImage.mockResolvedValue("https://img/temp.png");
    mockPersistImage.mockResolvedValue("https://img/persisted.png");
    mockGenerateVoiceover.mockResolvedValue(Buffer.from("audio"));
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(createRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing required fields", async () => {
    // Missing platform
    const res = await POST(
      createRequest({ websiteUrl: "https://example.com", tone: "professional" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 for non-Pro users", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { ...PRO_PROFILE, subscription_status: "free" },
    });
    const res = await POST(createRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("generates a video and reserves video quota before the OpenAI call", async () => {
    const res = await POST(createRequest(VALID_BODY));
    expect(res.status).toBe(200);
    // The dedicated video slot is reserved up front via the quota helper.
    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_video_generation",
      expect.any(Object)
    );
    // It also reserves the text slot for the script (reserve-before-spend).
    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_generation",
      expect.any(Object)
    );
    // No legacy post-spend increment RPCs.
    expect(mockRpc).not.toHaveBeenCalledWith(
      "increment_video_generation_count",
      expect.anything()
    );
    expect(mockRpc).not.toHaveBeenCalledWith(
      "increment_generation_count",
      expect.anything()
    );
    expect(mockGenerateVideoScript).toHaveBeenCalled();
  });

  it("reserves video quota BEFORE scraping / calling OpenAI (call order)", async () => {
    const order: string[] = [];
    mockRpc.mockImplementation((fn: string) => {
      order.push(`rpc:${fn}`);
      return Promise.resolve({ data: true, error: null });
    });
    mockScrapeWebsite.mockImplementation(() => {
      order.push("scrape");
      return Promise.resolve({
        title: "Example",
        description: "desc",
        headings: [],
        url: "https://example.com",
      });
    });
    mockGenerateVideoScript.mockImplementation(() => {
      order.push("openai");
      return Promise.resolve(SCRIPT);
    });

    await POST(createRequest(VALID_BODY));

    const reserveVideoIdx = order.indexOf("rpc:reserve_video_generation");
    const scrapeIdx = order.indexOf("scrape");
    const openaiIdx = order.indexOf("openai");
    expect(reserveVideoIdx).toBeGreaterThanOrEqual(0);
    // Reserve happens before any expensive/external work.
    expect(scrapeIdx).toBeGreaterThan(reserveVideoIdx);
    expect(openaiIdx).toBeGreaterThan(reserveVideoIdx);
  });

  it("returns 429 when the video reserve is denied, without doing expensive work", async () => {
    // reserve_video_generation returns false → at/over the video limit.
    mockRpc.mockImplementation((fn: string) =>
      fn === "reserve_video_generation"
        ? Promise.resolve({ data: false, error: null })
        : Promise.resolve({ data: true, error: null })
    );

    const res = await POST(createRequest(VALID_BODY));
    expect(res.status).toBe(429);
    // Reserve was attempted...
    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_video_generation",
      expect.any(Object)
    );
    // ...but no expensive work ran and no text slot was reserved.
    expect(mockScrapeWebsite).not.toHaveBeenCalled();
    expect(mockGenerateVideoScript).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalledWith(
      "reserve_generation",
      expect.any(Object)
    );
  });

  it("returns 429 and refunds the video slot when no text quota is left", async () => {
    // Video reserve OK, but the script text reserve is denied.
    mockRpc.mockImplementation((fn: string) => {
      if (fn === "reserve_video_generation")
        return Promise.resolve({ data: true, error: null });
      if (fn === "reserve_generation")
        return Promise.resolve({ data: false, error: null });
      return Promise.resolve({ data: null, error: null }); // refund_*
    });

    const res = await POST(createRequest(VALID_BODY));
    expect(res.status).toBe(429);
    // The reserved video slot is refunded because the request can't proceed.
    expect(mockRpc).toHaveBeenCalledWith(
      "refund_video_generation",
      expect.any(Object)
    );
    // OpenAI must not have been called.
    expect(mockGenerateVideoScript).not.toHaveBeenCalled();
  });

  it("refunds reserved quota when the OpenAI script call fails", async () => {
    mockGenerateVideoScript.mockRejectedValueOnce(new Error("OpenAI down"));

    const res = await POST(createRequest(VALID_BODY));
    expect(res.status).toBe(500);
    // Both the text and video reservations are refunded on a failed generation.
    expect(mockRpc).toHaveBeenCalledWith(
      "refund_generation",
      expect.any(Object)
    );
    expect(mockRpc).toHaveBeenCalledWith(
      "refund_video_generation",
      expect.any(Object)
    );
  });

  it("returns 400 and refunds both reservations when the scrape fails", async () => {
    // scrapeWebsite returns null → cannot fetch content; spend nothing on OpenAI.
    mockScrapeWebsite.mockResolvedValueOnce(null);

    const res = await POST(createRequest(VALID_BODY));
    expect(res.status).toBe(400);
    expect(mockGenerateVideoScript).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith(
      "refund_generation",
      expect.any(Object)
    );
    expect(mockRpc).toHaveBeenCalledWith(
      "refund_video_generation",
      expect.any(Object)
    );
  });

  it("returns 500 when an unexpected error is thrown", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected error"));
    const res = await POST(createRequest(VALID_BODY));
    expect(res.status).toBe(500);
  });
});
