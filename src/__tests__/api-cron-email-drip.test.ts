import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Supabase mock state ---------------------------------------------------
// The route fetches `profiles` once per stage (5 stages). To keep tests focused
// on a single stage, `profilesByStage` keys the rows returned by the age-window
// `days` value; any unspecified stage returns an empty list.
type ProfileRow = {
  id: string;
  email: string | null;
  full_name?: string | null;
  generation_count?: number | null;
  subscription_status?: string | null;
  brand_voice?: string | null;
};

let profilesByStage: Record<number, ProfileRow[]> = {};
let profilesError: { code?: string } | null = null;

// Controls what the per-(user,stage) claim insert returns. `null` = success
// (claim acquired). A code string simulates a Postgres error (23505/42P01/etc).
let claimInsertError: { code?: string } | null = null;

// Spies so tests can assert on the atomic claim guard behaviour.
const insertSpy = vi.fn();
const deleteSpy = vi.fn();
let deleteError: { code?: string } | null = null;

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "profiles") {
        // Mirror the route's chain: select().gt(start).lte(end) is awaited.
        // The age-window `end` (older bound) is `now - days*dayMs`, so we recover
        // the stage's `days` from how far back `end` is to pick the right rows.
        return {
          select: () => ({
            // Route calls .gt("created_at", start).lte("created_at", end);
            // the older bound `end` is the second arg of .lte().
            gt: () => ({
              lte: (_col: string, end: string) => {
                const dayMs = 24 * 60 * 60 * 1000;
                const days = Math.round((Date.now() - new Date(end).getTime()) / dayMs);
                return {
                  data: profilesError ? null : profilesByStage[days] ?? [],
                  error: profilesError,
                };
              },
            }),
          }),
        };
      }
      if (table === "drip_emails") {
        return {
          insert: (row: Record<string, unknown>) => {
            insertSpy(row);
            return { error: claimInsertError };
          },
          delete: () => ({
            eq: (_col: string, _val: unknown) => ({
              // second .eq() resolves the awaited delete
              eq: (col2: string, val2: unknown) => {
                deleteSpy({ col2, val2 });
                return { error: deleteError };
              },
            }),
          }),
        };
      }
      return {};
    },
  })),
}));

// --- Email lib mock --------------------------------------------------------
const mockSendWelcome = vi.fn();
const mockSendDay3 = vi.fn();
const mockSendBrandVoice = vi.fn();
const mockSendDay7 = vi.fn();
const mockSendVideo = vi.fn();

vi.mock("@/lib/email", () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcome(...args),
  sendDay3ReminderEmail: (...args: unknown[]) => mockSendDay3(...args),
  sendBrandVoiceNudgeEmail: (...args: unknown[]) => mockSendBrandVoice(...args),
  sendDay7UpgradeEmail: (...args: unknown[]) => mockSendDay7(...args),
  sendVideoFeatureEmail: (...args: unknown[]) => mockSendVideo(...args),
}));

vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

import { GET } from "@/app/api/cron/email-drip/route";

const CRON_SECRET = "test-secret";

function createRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/email-drip", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

describe("GET /api/cron/email-drip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profilesByStage = {};
    profilesError = null;
    claimInsertError = null;
    deleteError = null;
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";

    // Default: all email sends succeed.
    mockSendWelcome.mockResolvedValue(true);
    mockSendDay3.mockResolvedValue(true);
    mockSendBrandVoice.mockResolvedValue(true);
    mockSendDay7.mockResolvedValue(true);
    mockSendVideo.mockResolvedValue(true);
  });

  it("returns 401 with a wrong CRON_SECRET", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/email-drip", {
      headers: { authorization: "Bearer wrong" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("returns 401 when the authorization header is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/email-drip");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET is unset on the server", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(createRequest());
    expect(res.status).toBe(401);
  });

  it("sends the welcome email and counts it on the happy path (day 1)", async () => {
    profilesByStage[1] = [
      { id: "u1", email: "alice@example.com", full_name: "Alice" },
    ];

    const res = await GET(createRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sent.welcome).toBe(1);
    expect(json.failed.welcome).toBe(0);
    // Claim is acquired before the send.
    expect(insertSpy).toHaveBeenCalledWith({ user_id: "u1", stage: "welcome" });
    expect(mockSendWelcome).toHaveBeenCalledTimes(1);
    expect(mockSendWelcome).toHaveBeenCalledWith("alice@example.com", "Alice");
    // Success → claim is NOT released.
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("returns all zero counts when no profiles fall in any window", async () => {
    const res = await GET(createRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.sent).toEqual({ welcome: 0, day3: 0, brandVoice: 0, day7: 0, video: 0 });
    expect(json.failed).toEqual({ welcome: 0, day3: 0, brandVoice: 0, day7: 0, video: 0 });
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("targets the correct stage by account age (day 3 reminder)", async () => {
    profilesByStage[3] = [{ id: "u3", email: "carol@example.com" }];

    const res = await GET(createRequest());
    const json = await res.json();

    expect(json.sent.day3).toBe(1);
    expect(mockSendDay3).toHaveBeenCalledWith("carol@example.com");
    // No cross-stage bleed.
    expect(mockSendWelcome).not.toHaveBeenCalled();
    expect(mockSendBrandVoice).not.toHaveBeenCalled();
  });

  it("skips users without an email address", async () => {
    profilesByStage[1] = [{ id: "u-noemail", email: null, full_name: "Nobody" }];

    const res = await GET(createRequest());
    const json = await res.json();

    expect(json.sent.welcome).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
    expect(mockSendWelcome).not.toHaveBeenCalled();
  });

  it("skips the brand-voice nudge for users who already trained a voice", async () => {
    profilesByStage[5] = [
      { id: "trained", email: "trained@example.com", brand_voice: "Friendly and bold" },
      { id: "untrained", email: "untrained@example.com", brand_voice: "  ", generation_count: 7 },
    ];

    const res = await GET(createRequest());
    const json = await res.json();

    // Only the untrained user (whitespace-only brand_voice counts as empty) is sent.
    expect(json.sent.brandVoice).toBe(1);
    expect(mockSendBrandVoice).toHaveBeenCalledTimes(1);
    expect(mockSendBrandVoice).toHaveBeenCalledWith("untrained@example.com", 7);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith({ user_id: "untrained", stage: "brandVoice" });
  });

  it("skips the video-feature email for paying (Pro) users", async () => {
    profilesByStage[10] = [
      { id: "pro", email: "pro@example.com", subscription_status: "active" },
      { id: "free", email: "free@example.com", subscription_status: null },
    ];

    const res = await GET(createRequest());
    const json = await res.json();

    expect(json.sent.video).toBe(1);
    expect(mockSendVideo).toHaveBeenCalledTimes(1);
    expect(mockSendVideo).toHaveBeenCalledWith("free@example.com");
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith({ user_id: "free", stage: "video" });
  });

  it("skips a user whose claim insert hits a 23505 unique violation (dedup)", async () => {
    profilesByStage[1] = [{ id: "u1", email: "alice@example.com" }];
    claimInsertError = { code: "23505" };

    const res = await GET(createRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    // Claim attempted but lost → no send, not counted, not released.
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(mockSendWelcome).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(json.sent.welcome).toBe(0);
    expect(json.failed.welcome).toBe(0);
  });

  it("fails loud with 500 when the claim insert returns 42P01 (table missing)", async () => {
    profilesByStage[1] = [{ id: "u1", email: "alice@example.com" }];
    claimInsertError = { code: "42P01" };

    const res = await GET(createRequest());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("drip_emails table missing");
    // No email is sent, and no later stages run.
    expect(mockSendWelcome).not.toHaveBeenCalled();
    expect(mockSendDay3).not.toHaveBeenCalled();
  });

  it("releases the claim and counts a failure when the send fails", async () => {
    profilesByStage[1] = [{ id: "u1", email: "alice@example.com" }];
    mockSendWelcome.mockResolvedValueOnce(false);

    const res = await GET(createRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledTimes(1);
    // Claim released for retry within the grace window.
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(json.sent.welcome).toBe(0);
    expect(json.failed.welcome).toBe(1);
  });

  it("releases the claim and counts a failure when the send throws", async () => {
    profilesByStage[1] = [{ id: "u1", email: "alice@example.com" }];
    mockSendWelcome.mockRejectedValueOnce(new Error("Resend down"));

    const res = await GET(createRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(json.failed.welcome).toBe(1);
  });

  it("continues to the next stage when a profiles fetch errors", async () => {
    profilesError = { code: "08006" };

    const res = await GET(createRequest());
    const json = await res.json();

    // Fetch error per stage is logged + skipped, never throws, returns 200.
    expect(res.status).toBe(200);
    expect(json.sent.welcome).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
