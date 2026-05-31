import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock state
let mockSeriesData: unknown[] = [];
let insertCalled = false;
let lastInsertedRow: Record<string, unknown> | null = null;
// Quota is now enforced by the reserve_generation RPC (reserve-before-spend),
// so the DB decides limit_reached, not a JS count check. Default: slot granted.
let mockReserveOk = true;

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "content_series") {
        return {
          select: () => ({
            eq: () => ({ data: mockSeriesData, error: null }),
          }),
          update: () => ({
            eq: () => ({ error: null }),
          }),
        };
      }
      if (table === "posts") {
        return {
          insert: (row: Record<string, unknown>) => {
            insertCalled = true;
            lastInsertedRow = row;
            return {
              select: () => ({
                single: () => ({ data: { id: "post-xyz" }, error: null }),
              }),
            };
          },
        };
      }
      return {
        update: () => ({
          eq: () => ({ error: null }),
        }),
      };
    },
    rpc: (fn: string) => {
      if (fn === "reserve_generation") return { data: mockReserveOk, error: null };
      return { data: null, error: null };
    },
  })),
}));

const mockGeneratePost = vi.fn();
const mockGenerateVideoScript = vi.fn();
vi.mock("@/lib/openai", () => ({
  generatePost: (...args: unknown[]) => mockGeneratePost(...args),
  generateVideoScript: (...args: unknown[]) => mockGenerateVideoScript(...args),
}));

vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

import { GET } from "@/app/api/cron/generate-series/route";

const CRON_SECRET = "test-secret";

function createRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/generate-series", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

describe("GET /api/cron/generate-series", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSeriesData = [];
    insertCalled = false;
    lastInsertedRow = null;
    mockReserveOk = true;
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("returns 401 without valid CRON_SECRET", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/generate-series", {
      headers: { authorization: "Bearer wrong" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 0 processed when no active series exist", async () => {
    mockSeriesData = [];
    const res = await GET(createRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.processed).toBe(0);
    expect(json.generated).toBe(0);
  });

  it("generates a post for a due daily series", async () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    mockSeriesData = [{
      id: "s1",
      user_id: "u1",
      name: "Daily Tips",
      platform: "linkedin",
      tone: "professional",
      topic_template: "Share a productivity tip",
      frequency: "daily",
      day_of_week: null,
      preferred_time: "09:00",
      is_active: true,
      last_generated_at: yesterday,
      profiles: {
        brand_voice: null,
        preferred_model: null,
        subscription_status: "active",
        generation_count: 5,
      },
    }];

    mockGeneratePost.mockResolvedValueOnce({
      content: "Here is a great productivity tip...",
      hashtags: ["productivity", "tips"],
      content_score: 8,
    });

    const res = await GET(createRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.generated).toBe(1);
    expect(insertCalled).toBe(true);
    expect(mockGeneratePost).toHaveBeenCalledTimes(1);
    expect(mockGeneratePost).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "linkedin",
        tone: "professional",
      })
    );
  });

  it("skips series when user has reached generation limit", async () => {
    // At/over the cap the reserve_generation RPC returns false (no slot).
    mockReserveOk = false;
    mockSeriesData = [{
      id: "s1",
      user_id: "u1",
      name: "Tips",
      platform: "twitter",
      tone: "casual",
      topic_template: "Tweet tip",
      frequency: "daily",
      day_of_week: null,
      preferred_time: "10:00",
      is_active: true,
      last_generated_at: null,
      profiles: {
        brand_voice: null,
        preferred_model: null,
        subscription_status: "inactive",
        generation_count: 10,
      },
    }];

    const res = await GET(createRequest());
    const json = await res.json();
    expect(json.generated).toBe(0);
    expect(json.skipped).toBe(1);
    expect(mockGeneratePost).not.toHaveBeenCalled();
  });

  it("generates a video script when post_type=video", async () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    mockSeriesData = [{
      id: "s-video",
      user_id: "u1",
      name: "Daily Reels",
      platform: "instagram",
      tone: "casual",
      topic_template: "Behind the scenes of our product",
      frequency: "daily",
      day_of_week: null,
      preferred_time: "12:00",
      is_active: true,
      last_generated_at: yesterday,
      post_type: "video",
      profiles: {
        brand_voice: null,
        preferred_model: null,
        subscription_status: "active",
        generation_count: 5,
      },
    }];

    mockGenerateVideoScript.mockResolvedValueOnce({
      hook: "Wait until you see this",
      scenes: [
        {
          sceneNumber: 1,
          duration: "5s",
          visual: "Factory floor pan",
          narration: "Every Reel starts with a hook.",
          textOverlay: "THE SECRET",
        },
      ],
      cta: "Follow for more",
      totalDuration: "20s",
      musicSuggestion: "Upbeat electronic",
    });

    const res = await GET(createRequest());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.generated).toBe(1);
    expect(mockGenerateVideoScript).toHaveBeenCalledTimes(1);
    expect(mockGeneratePost).not.toHaveBeenCalled();
    expect(insertCalled).toBe(true);
    const inserted = lastInsertedRow as Record<string, unknown> | null;
    expect(inserted).not.toBeNull();
    expect(typeof inserted!.content).toBe("string");
    const content = inserted!.content as string;
    expect(content).toContain("Wait until you see this");
    expect(content).toContain("CTA: Follow for more");
    expect(content).toContain("Music: Upbeat electronic");
  });

  it("skips series that was generated recently (weekly not due)", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    mockSeriesData = [{
      id: "s1",
      user_id: "u1",
      name: "Weekly",
      platform: "linkedin",
      tone: "professional",
      topic_template: "Weekly roundup",
      frequency: "weekly",
      day_of_week: new Date().getDay(), // today
      preferred_time: "09:00",
      is_active: true,
      last_generated_at: twoDaysAgo, // only 2 days ago, weekly needs 6.5+
      profiles: {
        brand_voice: null,
        preferred_model: null,
        subscription_status: "active",
        generation_count: 5,
      },
    }];

    const res = await GET(createRequest());
    const json = await res.json();
    expect(json.generated).toBe(0);
    expect(json.skipped).toBe(1);
  });
});
