import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SeriesRow, ProfileRow } from "@/lib/series-runner";

// --- Mocks --------------------------------------------------------------
const mockReserve = vi.fn();
const mockRefund = vi.fn();
vi.mock("@/lib/quota", () => ({
  reserveGeneration: (...a: unknown[]) => mockReserve(...a),
  refundGeneration: (...a: unknown[]) => mockRefund(...a),
  reserveVideoGeneration: vi.fn(),
  refundVideoGeneration: vi.fn(),
}));

const mockGeneratePost = vi.fn();
const mockGenerateVideoScript = vi.fn();
vi.mock("@/lib/openai", () => ({
  generatePost: (...a: unknown[]) => mockGeneratePost(...a),
  generateVideoScript: (...a: unknown[]) => mockGenerateVideoScript(...a),
}));

vi.mock("@/lib/website-scraper", () => ({
  scrapeWebsite: vi.fn(),
  buildPromptBlockFromContext: vi.fn(() => "CTX"),
}));

vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

import { runSeriesOnce } from "@/lib/series-runner";

// --- Helpers ------------------------------------------------------------
type InsertResult = { data: { id: string } | null; error: { message: string } | null };

function makeSupabase(insertResult: InsertResult) {
  const rpc = vi.fn(() => Promise.resolve({ data: null, error: null }));
  return {
    rpc,
    from: (table: string) => {
      if (table === "posts") {
        return {
          insert: () => ({
            select: () => ({ single: () => Promise.resolve(insertResult) }),
          }),
        };
      }
      // content_series.update(...).eq(...)
      return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) };
    },
  };
}

const series: SeriesRow = {
  id: "s1",
  user_id: "u1",
  name: "Daily Tips",
  platform: "linkedin",
  tone: "professional",
  topic_template: "Share a productivity tip",
  preferred_time: "09:00",
  website_url: null,
  website_context: null,
  website_scraped_at: null,
  post_type: "text",
};

const profile: ProfileRow = {
  brand_voice: null,
  preferred_model: null,
  subscription_status: "active",
  generation_count: 0,
  bonus_generations: 0,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asClient = (s: ReturnType<typeof makeSupabase>) => s as any;

describe("runSeriesOnce (reserve-before-spend)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReserve.mockResolvedValue(true);
    mockRefund.mockResolvedValue(undefined);
    mockGeneratePost.mockResolvedValue({ content: "A tip", hashtags: ["tips"] });
  });

  it("returns limit_reached and does NOT generate when reserve fails", async () => {
    mockReserve.mockResolvedValueOnce(false);
    const sb = makeSupabase({ data: { id: "p1" }, error: null });
    const res = await runSeriesOnce(asClient(sb), series, profile);
    expect(res).toEqual({ ok: false, reason: "limit_reached" });
    expect(mockGeneratePost).not.toHaveBeenCalled();
    expect(mockRefund).not.toHaveBeenCalled();
  });

  it("reserves a slot before generating and returns ok with the post id on success", async () => {
    const sb = makeSupabase({ data: { id: "p1" }, error: null });
    const res = await runSeriesOnce(asClient(sb), series, profile);
    expect(res).toEqual({ ok: true, postId: "p1" });
    // Pro plan => 100 text quota; reserve must be called with the user id + limit.
    expect(mockReserve).toHaveBeenCalledWith(sb, "u1", 100);
    expect(mockGeneratePost).toHaveBeenCalledTimes(1);
    // Slot already reserved up front — no legacy increment, no refund on success.
    expect(mockRefund).not.toHaveBeenCalled();
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it("refunds the reserved slot when generation throws", async () => {
    mockGeneratePost.mockRejectedValueOnce(new Error("openai down"));
    const sb = makeSupabase({ data: { id: "p1" }, error: null });
    const res = await runSeriesOnce(asClient(sb), series, profile);
    expect(res.ok).toBe(false);
    expect((res as { reason: string }).reason).toBe("generation_failed");
    expect(mockRefund).toHaveBeenCalledWith(sb, "u1");
  });

  it("refunds the reserved slot when the post insert fails", async () => {
    const sb = makeSupabase({ data: null, error: { message: "insert boom" } });
    const res = await runSeriesOnce(asClient(sb), series, profile);
    expect(res.ok).toBe(false);
    expect((res as { reason: string }).reason).toBe("insert_failed");
    expect(mockRefund).toHaveBeenCalledWith(sb, "u1");
  });

  it("includes referral bonus_generations in the reserved limit", async () => {
    const sb = makeSupabase({ data: { id: "p1" }, error: null });
    await runSeriesOnce(asClient(sb), series, { ...profile, bonus_generations: 15 });
    expect(mockReserve).toHaveBeenCalledWith(sb, "u1", 115);
  });
});
