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

// OpenAI TTS mock — this is the expensive call that reserve-before-spend
// must guard. Track call order against the reserve RPC.
const mockGenerateVoiceover = vi.fn();
vi.mock("@/lib/openai-tts", () => ({
  generateVoiceover: (...args: unknown[]) => mockGenerateVoiceover(...args),
}));

// Subscription mock. TEXT_QUOTA_PRO is a real value (mirrors
// src/lib/subscription.ts: pro = 100) because the route derives the limit
// passed to reserveGeneration from it — limits are NEVER hardcoded in the
// route. isProSubscription is a fn-mock the Pro gate reads.
const mockIsProSubscription = vi.fn();
vi.mock("@/lib/subscription", () => ({
  isProSubscription: (...args: unknown[]) => mockIsProSubscription(...args),
  TEXT_QUOTA_PRO: 100,
}));

// Logger mock
vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { POST } from "@/app/api/generate-voiceover/route";

// Helper to create a NextRequest with JSON body
function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/generate-voiceover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate-voiceover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user is authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = createRequest({ text: "Hello world" });
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

    const request = createRequest({ text: "Hello world" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
  });

  it("returns 403 if not a Pro subscription", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "free", generation_count: 0, bonus_generations: 0 },
    });
    mockIsProSubscription.mockReturnValueOnce(false);

    const request = createRequest({ text: "Hello world" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Pro feature");
    // No quota reserved and no TTS call for non-Pro.
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockGenerateVoiceover).not.toHaveBeenCalled();
  });

  it("returns 400 if text is missing", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "active", generation_count: 0, bonus_generations: 0 },
    });
    mockIsProSubscription.mockReturnValueOnce(true);

    const request = createRequest({ text: "   " });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Missing text");
    // Validation runs before reserve — no quota burned on a bad request.
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockGenerateVoiceover).not.toHaveBeenCalled();
  });

  it("returns 400 if text exceeds 4000 chars", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "active", generation_count: 0, bonus_generations: 0 },
    });
    mockIsProSubscription.mockReturnValueOnce(true);

    const request = createRequest({ text: "a".repeat(4001) });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Text too long");
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockGenerateVoiceover).not.toHaveBeenCalled();
  });

  it("returns 429 when reserve denies (over limit) without calling OpenAI", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "active", generation_count: 100, bonus_generations: 0 },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    // reserve_generation returns false → at/over limit, no TTS call.
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    const request = createRequest({ text: "Hello world" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Monthly limit reached");
    // Reserve-before-spend: the expensive OpenAI call must NOT run.
    expect(mockGenerateVoiceover).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    // No post-spend increment RPC in the new contract.
    expect(mockRpc).not.toHaveBeenCalledWith(
      "increment_generation_count",
      expect.anything()
    );
  });

  it("reserves the limit from TEXT_QUOTA_PRO + bonus_generations (not hardcoded)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "active", generation_count: 0, bonus_generations: 25 },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    mockGenerateVoiceover.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));

    const request = createRequest({ text: "Hello world" });
    const response = await POST(request);

    expect(response.status).toBe(200);
    // limit = TEXT_QUOTA_PRO (100) + bonus_generations (25) = 125
    expect(mockRpc).toHaveBeenCalledWith(
      "reserve_generation",
      expect.objectContaining({ p_user_id: "user-123", p_limit: 125 })
    );
  });

  it("reserves before spending and returns audio on success", async () => {
    const callOrder: string[] = [];
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "active", generation_count: 0, bonus_generations: 0 },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    // reserve_generation succeeds (true) and is recorded BEFORE generateVoiceover.
    mockRpc.mockImplementationOnce((fn: string) => {
      callOrder.push(fn);
      return Promise.resolve({ data: true, error: null });
    });
    mockGenerateVoiceover.mockImplementationOnce(() => {
      callOrder.push("generateVoiceover");
      return Promise.resolve(new Uint8Array([1, 2, 3]));
    });

    const request = createRequest({ text: "Hello world", voice: "nova" });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    // Reserve happens strictly BEFORE the expensive OpenAI call.
    expect(callOrder).toEqual(["reserve_generation", "generateVoiceover"]);
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    // Reserve is the only quota mutation; no post-spend increment.
    expect(mockRpc).not.toHaveBeenCalledWith(
      "increment_generation_count",
      expect.anything()
    );
    expect(mockGenerateVoiceover).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Hello world", voice: "nova" })
    );
  });

  it("refunds the reserved slot when the OpenAI call fails", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockSingle.mockResolvedValueOnce({
      data: { subscription_status: "active", generation_count: 0, bonus_generations: 0 },
    });
    mockIsProSubscription.mockReturnValueOnce(true);
    // reserve succeeds, then generateVoiceover throws → route must refund.
    mockRpc.mockResolvedValueOnce({ data: true, error: null }); // reserve_generation
    mockRpc.mockResolvedValueOnce({ data: null, error: null }); // refund_generation
    mockGenerateVoiceover.mockRejectedValueOnce(new Error("OpenAI down"));

    const request = createRequest({ text: "Hello world" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to generate voiceover");
    expect(mockRpc).toHaveBeenCalledWith("reserve_generation", expect.any(Object));
    expect(mockRpc).toHaveBeenCalledWith("refund_generation", expect.any(Object));
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected error"));

    const request = createRequest({ text: "Hello world" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to generate voiceover");
  });
});
