import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock state
let mockSeriesData: unknown[] = [];
let insertCalled = false;

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
          insert: () => { insertCalled = true; return { error: null }; },
        };
      }
      return {
        update: () => ({
          eq: () => ({ error: null }),
        }),
      };
    },
    rpc: () => ({ data: null, error: null }),
  })),
}));

const mockGeneratePost = vi.fn();
vi.mock("@/lib/openai", () => ({
  generatePost: (...args: unknown[]) => mockGeneratePost(...args),
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
