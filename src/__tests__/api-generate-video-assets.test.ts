import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---
//
// This is the highest-cost OpenAI route (gpt-image-1 × scenes + TTS) with
// reserve-before-spend + partial-failure refunds. We mock at the Supabase
// rpc() level (same style as api-generate-video-ad.test.ts) so we can assert
// the EXACT reserve_*/refund_* call counts the route performs through the
// quota helpers in @/lib/quota.

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

// OpenAI image-generation mock
const mockGenerateImage = vi.fn();
vi.mock("@/lib/openai", () => ({
  generateImage: (...args: unknown[]) => mockGenerateImage(...args),
}));

// OpenAI TTS mock
const mockGenerateVoiceover = vi.fn();
vi.mock("@/lib/openai-tts", () => ({
  generateVoiceover: (...args: unknown[]) => mockGenerateVoiceover(...args),
}));

// Storage mock: persistImage returns a persisted URL (or the route falls back
// to the temporary URL on rejection — handled inside the route).
const mockPersistImage = vi.fn();
vi.mock("@/lib/storage", () => ({
  persistImage: (...args: unknown[]) => mockPersistImage(...args),
}));

// Subscription mock. isProSubscription / videoQuotaFor mirror the real
// src/lib/subscription.ts (Pro video cap = 5, text cap = 100) so the Pro-gate
// and the limits passed to the quota helpers behave like production.
vi.mock("@/lib/subscription", () => ({
  isProSubscription: (status: string | null | undefined) =>
    status === "active" || status === "past_due",
  videoQuotaFor: (status: string | null | undefined) =>
    status === "active" || status === "past_due" ? 5 : 0,
  TEXT_QUOTA_PRO: 100,
}));

// Logger mock
vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { POST } from "@/app/api/generate-video-assets/route";

// Helper to create a NextRequest with JSON body
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/generate-video-assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Build N scene inputs (sceneNumber 1..N).
function makeScenes(n: number): Array<Record<string, unknown>> {
  return Array.from({ length: n }, (_, i) => ({
    sceneNumber: i + 1,
    visual: `visual ${i + 1}`,
    narration: `narration ${i + 1}`,
  }));
}

// Count how many times a given rpc fn was invoked.
function rpcCalls(fn: string): number {
  return mockRpc.mock.calls.filter((c) => c[0] === fn).length;
}

describe("POST /api/generate-video-assets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 if the user is not on a Pro subscription", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        subscription_status: "free",
        generation_count: 0,
        video_generation_count: 0,
        bonus_generations: 0,
      },
    });

    const request = createRequest({ scenes: makeScenes(2) });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Pro feature");
    // Non-Pro: never reserve, never spend.
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockGenerateImage).not.toHaveBeenCalled();
    expect(mockGenerateVoiceover).not.toHaveBeenCalled();
  });

  it("returns 429 with NO OpenAI calls when the video cap is reached (reserve_video_generation denied)", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        subscription_status: "active",
        generation_count: 0,
        video_generation_count: 5,
        bonus_generations: 0,
      },
    });
    // reserve_video_generation returns false → at video cap.
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const request = createRequest({ scenes: makeScenes(3) });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("video limit");
    // The video reserve is attempted exactly once and denied; no text reserve,
    // no refunds, no OpenAI work.
    expect(rpcCalls("reserve_video_generation")).toBe(1);
    expect(rpcCalls("reserve_generation")).toBe(0);
    expect(rpcCalls("refund_generation")).toBe(0);
    expect(rpcCalls("refund_video_generation")).toBe(0);
    expect(mockGenerateImage).not.toHaveBeenCalled();
    expect(mockGenerateVoiceover).not.toHaveBeenCalled();
  });

  it("returns 400 when no scenes are provided (after video reserve is refunded? no — bail before reserve)", async () => {
    // scenes.length === 0 is checked BEFORE any reserve, so nothing is reserved.
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        subscription_status: "active",
        generation_count: 0,
        video_generation_count: 0,
        bonus_generations: 0,
      },
    });

    const request = createRequest({ scenes: [] });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Missing scenes");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("partial text-quota bail: refunds all reserved text slots + the video slot, returns 429, no OpenAI calls", async () => {
    // 2 scenes → estimatedCost = 3 text slots needed. Video reserve OK, then
    // only 2 of 3 text reserves succeed → must refund those 2 text slots AND
    // the 1 video slot, then 429 without ever calling OpenAI.
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        subscription_status: "active",
        generation_count: 98,
        video_generation_count: 0,
        bonus_generations: 0,
      },
    });
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_video_generation
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation #1
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation #2
      .mockResolvedValueOnce({ data: false, error: null }) // reserve_generation #3 → over limit
      .mockResolvedValueOnce({ data: null, error: null }) // refund_generation #1
      .mockResolvedValueOnce({ data: null, error: null }) // refund_generation #2
      .mockResolvedValueOnce({ data: null, error: null }); // refund_video_generation

    const request = createRequest({ scenes: makeScenes(2) });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Not enough monthly quota");
    // estimatedCost = scenes(2) + 1 = 3.
    expect(json.error).toContain("Need 3");

    // Video reserved once; 3 text reserve attempts (last denied).
    expect(rpcCalls("reserve_video_generation")).toBe(1);
    expect(rpcCalls("reserve_generation")).toBe(3);
    // Refund exactly the 2 text slots we actually got + the 1 video slot.
    expect(rpcCalls("refund_generation")).toBe(2);
    expect(rpcCalls("refund_video_generation")).toBe(1);

    // Reserve-before-spend: no OpenAI work on the bail path.
    expect(mockGenerateImage).not.toHaveBeenCalled();
    expect(mockGenerateVoiceover).not.toHaveBeenCalled();
  });

  it("full success: returns assets and performs NO refunds", async () => {
    // 2 scenes → estimatedCost = 3. Video reserve + 3 text reserves all OK.
    // Both images + voiceover succeed → successful = 3 = estimatedCost, so
    // textToRefund = 0 and successfulImages > 0 → no video refund either.
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        subscription_status: "active",
        generation_count: 0,
        video_generation_count: 0,
        bonus_generations: 0,
      },
    });
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_video_generation
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation #1
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation #2
      .mockResolvedValueOnce({ data: true, error: null }); // reserve_generation #3

    mockGenerateImage.mockResolvedValue("https://openai.example/temp.png");
    mockPersistImage.mockResolvedValue("https://storage.example/persisted.png");
    mockGenerateVoiceover.mockResolvedValue(
      new Uint8Array([1, 2, 3, 4]),
    );

    const request = createRequest({
      hook: "Big hook",
      cta: "Buy now",
      scenes: makeScenes(2),
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.images).toHaveLength(2);
    expect(json.images.every((i: { url: string | null }) => i.url)).toBe(true);
    expect(json.voiceover.dataUrl).toMatch(/^data:audio\/mpeg;base64,/);
    expect(json.narration).toContain("Big hook");
    expect(json.narration).toContain("Buy now");

    // One image generation per scene + one voiceover.
    expect(mockGenerateImage).toHaveBeenCalledTimes(2);
    expect(mockGenerateVoiceover).toHaveBeenCalledTimes(1);

    // Reserve exactly: 1 video + 3 text. ZERO refunds on full success.
    expect(rpcCalls("reserve_video_generation")).toBe(1);
    expect(rpcCalls("reserve_generation")).toBe(3);
    expect(rpcCalls("refund_generation")).toBe(0);
    expect(rpcCalls("refund_video_generation")).toBe(0);
  });

  it("passes the Pro video cap (5) and Pro text limit (100 + bonus) to the reserve helpers", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        subscription_status: "active",
        generation_count: 0,
        video_generation_count: 0,
        bonus_generations: 7, // limit becomes 100 + 7 = 107
      },
    });
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_video_generation
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation #1
      .mockResolvedValueOnce({ data: true, error: null }); // reserve_generation #2

    mockGenerateImage.mockResolvedValue("https://openai.example/temp.png");
    mockPersistImage.mockResolvedValue("https://storage.example/persisted.png");
    mockGenerateVoiceover.mockResolvedValue(new Uint8Array([1, 2, 3]));

    // 1 scene → estimatedCost = 2.
    const request = createRequest({ scenes: makeScenes(1) });
    await POST(request);

    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_video_generation",
      expect.objectContaining({ p_user_id: "user-123", p_limit: 5 }),
    );
    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_generation",
      expect.objectContaining({ p_user_id: "user-123", p_limit: 107 }),
    );
  });

  it("partial image failure: refund count equals the number of failed images", async () => {
    // 3 scenes → estimatedCost = 4 (3 images + 1 voiceover). All reserves OK.
    // 1 image fails, 2 succeed, voiceover succeeds → successful = 3,
    // textToRefund = 4 - 3 = 1. successfulImages = 2 > 0 → no video refund.
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        subscription_status: "active",
        generation_count: 0,
        video_generation_count: 0,
        bonus_generations: 0,
      },
    });
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_video_generation
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation #1
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation #2
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation #3
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation #4
      .mockResolvedValueOnce({ data: null, error: null }); // refund_generation (1 failed image)

    // First image call fails, the rest succeed.
    mockGenerateImage
      .mockRejectedValueOnce(new Error("image gen down"))
      .mockResolvedValue("https://openai.example/temp.png");
    mockPersistImage.mockResolvedValue("https://storage.example/persisted.png");
    mockGenerateVoiceover.mockResolvedValue(new Uint8Array([1, 2, 3]));

    const request = createRequest({ scenes: makeScenes(3) });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    // One image carries an error, two carry urls.
    const withError = json.images.filter(
      (i: { error: string | null }) => i.error,
    );
    const withUrl = json.images.filter((i: { url: string | null }) => i.url);
    expect(withError).toHaveLength(1);
    expect(withUrl).toHaveLength(2);

    // Refund exactly one text slot (the single failed image). Voiceover
    // succeeded so it is NOT refunded. Video slot kept (2 images succeeded).
    expect(rpcCalls("reserve_video_generation")).toBe(1);
    expect(rpcCalls("reserve_generation")).toBe(4);
    expect(rpcCalls("refund_generation")).toBe(1);
    expect(rpcCalls("refund_video_generation")).toBe(0);
  });

  it("all images fail: refunds the video slot exactly once (plus every failed text slot)", async () => {
    // 2 scenes → estimatedCost = 3 (2 images + 1 voiceover). All reserves OK.
    // Both images fail, voiceover succeeds → successful = 1, textToRefund = 2.
    // successfulImages = 0 → video slot is refunded exactly once.
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: {
        subscription_status: "active",
        generation_count: 0,
        video_generation_count: 0,
        bonus_generations: 0,
      },
    });
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_video_generation
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation #1
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation #2
      .mockResolvedValueOnce({ data: true, error: null }) // reserve_generation #3
      .mockResolvedValueOnce({ data: null, error: null }) // refund_generation #1 (failed image)
      .mockResolvedValueOnce({ data: null, error: null }) // refund_generation #2 (failed image)
      .mockResolvedValueOnce({ data: null, error: null }); // refund_video_generation

    mockGenerateImage.mockRejectedValue(new Error("image gen down"));
    mockGenerateVoiceover.mockResolvedValue(new Uint8Array([9, 9, 9]));

    const request = createRequest({ scenes: makeScenes(2) });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    // Both images carry errors, none carry a url.
    expect(json.images.every((i: { url: string | null }) => i.url === null)).toBe(true);
    // Voiceover still succeeded.
    expect(json.voiceover.dataUrl).toMatch(/^data:audio\/mpeg;base64,/);

    // 2 failed images → 2 text refunds; voiceover ok so not refunded.
    expect(rpcCalls("reserve_generation")).toBe(3);
    expect(rpcCalls("refund_generation")).toBe(2);
    // Zero usable images → the single video slot is refunded exactly once.
    expect(rpcCalls("reserve_video_generation")).toBe(1);
    expect(rpcCalls("refund_video_generation")).toBe(1);
  });

  it("returns 401 if no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = createRequest({ scenes: makeScenes(1) });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("boom"));

    const request = createRequest({ scenes: makeScenes(1) });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to generate video assets");
  });
});
