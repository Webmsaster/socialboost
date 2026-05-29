import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

type MockWith<T> = import("vitest").Mock<(...args: unknown[]) => unknown> & T;

const mockAdminUpdate = vi.fn() as MockWith<{ _nextResult?: unknown }>;
const mockAdminSelectResult = vi.fn();
const mockAdminLteResult = vi.fn();
const mockAdminResetResult = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      update: (data: unknown) => {
        if (table === "profiles" && data && typeof data === "object" && "generation_count" in (data as Record<string, unknown>)) {
          return {
            lt: () => {
              mockAdminUpdate(table, "reset", data);
              return mockAdminResetResult() ?? { error: null };
            },
          };
        }
        return {
          eq: (...args: unknown[]) => {
            mockAdminUpdate(table, data, ...args);
            return mockAdminUpdate._nextResult ?? { error: null };
          },
        };
      },
      select: (..._args: unknown[]) => ({
        eq: (...eqArgs: unknown[]) => ({
          lte: () => ({
            order: () => ({
              limit: () => mockAdminLteResult(table, ...eqArgs),
            }),
          }),
          single: () => mockAdminSelectResult(table, ...eqArgs),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendPostPublishedEmail: vi.fn().mockResolvedValue(true),
  sendPublishFailedEmail: vi.fn().mockResolvedValue(true),
  sendScheduledReminderEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/platforms/registry", () => ({
  getPublisher: vi.fn(),
  ensureFreshToken: vi.fn(async (account: unknown) => ({ account, refreshed: false })),
}));

// Import after mocks
import { GET } from "@/app/api/cron/publish/route";

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/publish", {
    method: "GET",
    headers: { authorization: "Bearer test-cron-secret", ...headers },
  });
}

describe("GET /api/cron/publish", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.CRON_SECRET = "test-cron-secret";
    mockAdminResetResult.mockReturnValue({ error: null });
    (mockAdminUpdate as ReturnType<typeof vi.fn> & { _nextResult?: unknown })._nextResult = undefined;
  });

  it("returns 401 if CRON_SECRET not configured", async () => {
    delete process.env.CRON_SECRET;

    const response = await GET(
      new NextRequest("http://localhost:3000/api/cron/publish", { method: "GET" })
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toContain("Unauthorized");
  });

  it("returns 401 if CRON_SECRET set but wrong auth header", async () => {
    process.env.CRON_SECRET = "my-secret";

    const response = await GET(
      createRequest({ authorization: "Bearer wrong-secret" })
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toContain("Unauthorized");
  });

  it("returns { processed: 0 } when no scheduled posts", async () => {

    mockAdminLteResult.mockReturnValueOnce({ data: [], error: null });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(0);
  });

  it("sends a manual-publish reminder when the post has no connected account", async () => {
    // The pipeline switched in late 2026 from "silently mark as published"
    // to "email the user a copy-paste-ready reminder" for posts on platforms
    // the user hasn't OAuth-connected. They post manually, then confirm.
    const posts = [
      {
        id: "post-1",
        user_id: "user-1",
        platform: "linkedin",
        content: "Hello World",
        hashtags: [],
        connected_account_id: null,
        reminder_sent_at: null,
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });
    mockAdminSelectResult.mockReturnValueOnce({
      data: { email: "user@example.com" },
    });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(1);
    expect(json.published).toBe(0);
    expect(json.remindersSent).toBe(1);
    expect(json.failed).toBe(0);
    // The reminder cron updates only reminder_sent_at — it does NOT flip
    // status to "published" anymore (that's the user's job via the UI).
    expect(mockAdminUpdate).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ reminder_sent_at: expect.any(String) }),
      "id",
      "post-1"
    );
    const { sendScheduledReminderEmail } = await import("@/lib/email");
    expect(sendScheduledReminderEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.objectContaining({ id: "post-1", platform: "linkedin" }),
    );
  });

  it("returns 500 when fetching scheduled posts fails", async () => {

    mockAdminResetResult.mockReturnValueOnce({ error: null });
    mockAdminLteResult.mockReturnValueOnce({ data: null, error: { message: "db down" } });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to fetch posts");
  });

  it("marks post as failed when connected account is not found", async () => {

    const posts = [
      {
        id: "post-2",
        user_id: "user-1",
        platform: "linkedin",
        content: "Post with account",
        connected_account_id: "acc-1",
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });

    // First select→single call: connected_accounts lookup → not found
    // Second select→single call: profiles lookup for email notification
    mockAdminSelectResult
      .mockReturnValueOnce({ data: null })
      .mockReturnValueOnce({ data: { email: "user@example.com" } });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(1);
    expect(json.published).toBe(0);
    expect(json.failed).toBe(1);

    expect(mockAdminUpdate).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ status: "failed", error_message: "Connected account not found" }),
      "id",
      "post-2"
    );

    const { sendPublishFailedEmail } = await import("@/lib/email");
    expect(sendPublishFailedEmail).toHaveBeenCalledWith(
      "user@example.com",
      "linkedin",
      "Connected account not found"
    );
  });

  it("marks post as failed when no publisher exists for the platform", async () => {

    const posts = [
      {
        id: "post-3",
        user_id: "user-1",
        platform: "tiktok",
        content: "TikTok post",
        connected_account_id: "acc-2",
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });

    // connected_accounts lookup → found account
    // profiles lookup for email
    mockAdminSelectResult
      .mockReturnValueOnce({ data: { id: "acc-2", platform: "tiktok", access_token: "tok" } })
      .mockReturnValueOnce({ data: { email: "user@example.com" } });

    const { getPublisher } = await import("@/lib/platforms/registry");
    (getPublisher as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.failed).toBe(1);
    expect(json.published).toBe(0);

    expect(mockAdminUpdate).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ status: "failed", error_message: "Publishing to tiktok is not yet supported" }),
      "id",
      "post-3"
    );

    const { sendPublishFailedEmail } = await import("@/lib/email");
    expect(sendPublishFailedEmail).toHaveBeenCalledWith(
      "user@example.com",
      "tiktok",
      "Publishing to tiktok is not yet supported"
    );
  });

  it("publishes successfully via platform publisher", async () => {

    const posts = [
      {
        id: "post-4",
        user_id: "user-1",
        platform: "linkedin",
        content: "Publish me",
        connected_account_id: "acc-3",
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });

    const mockPublish = vi.fn().mockResolvedValueOnce({ success: true, platformPostId: "li-post-99" });

    // connected_accounts lookup → found account
    // profiles lookup for email
    mockAdminSelectResult
      .mockReturnValueOnce({ data: { id: "acc-3", platform: "linkedin", access_token: "tok" } })
      .mockReturnValueOnce({ data: { email: "user@example.com" } });

    const { getPublisher } = await import("@/lib/platforms/registry");
    (getPublisher as ReturnType<typeof vi.fn>).mockReturnValueOnce({ publish: mockPublish });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.published).toBe(1);
    expect(json.failed).toBe(0);

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ id: "acc-3", platform: "linkedin" }),
      "Publish me",
      undefined,
      expect.objectContaining({ mediaUrl: undefined })
    );

    expect(mockAdminUpdate).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ status: "published", platform_post_id: "li-post-99" }),
      "id",
      "post-4"
    );

    const { sendPostPublishedEmail } = await import("@/lib/email");
    expect(sendPostPublishedEmail).toHaveBeenCalledWith(
      "user@example.com",
      "Publish me",
      "linkedin"
    );
  });

  it("marks post as failed when platform publisher returns failure", async () => {

    const posts = [
      {
        id: "post-5",
        user_id: "user-1",
        platform: "facebook",
        content: "Fail post",
        connected_account_id: "acc-4",
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });

    const mockPublish = vi.fn().mockResolvedValueOnce({ success: false, error: "Rate limited" });

    mockAdminSelectResult
      .mockReturnValueOnce({ data: { id: "acc-4", platform: "facebook", access_token: "tok" } })
      .mockReturnValueOnce({ data: { email: "user@example.com" } });

    const { getPublisher } = await import("@/lib/platforms/registry");
    (getPublisher as ReturnType<typeof vi.fn>).mockReturnValueOnce({ publish: mockPublish });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.failed).toBe(1);
    expect(json.published).toBe(0);

    expect(mockAdminUpdate).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ status: "failed", error_message: "Rate limited" }),
      "id",
      "post-5"
    );

    const { sendPublishFailedEmail } = await import("@/lib/email");
    expect(sendPublishFailedEmail).toHaveBeenCalledWith(
      "user@example.com",
      "facebook",
      "Rate limited"
    );
  });

  it("skips email when profile has no email (account not found path)", async () => {

    const posts = [
      {
        id: "post-7",
        user_id: "user-1",
        platform: "linkedin",
        content: "No email",
        connected_account_id: "acc-5",
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });

    // connected_accounts lookup → not found
    // profiles lookup → no email
    mockAdminSelectResult
      .mockReturnValueOnce({ data: null })
      .mockReturnValueOnce({ data: null });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(json.failed).toBe(1);

    const { sendPublishFailedEmail } = await import("@/lib/email");
    expect(sendPublishFailedEmail).not.toHaveBeenCalled();
  });

  it("skips email when profile has no email (no publisher path)", async () => {

    const posts = [
      {
        id: "post-8",
        user_id: "user-1",
        platform: "tiktok",
        content: "No email no publisher",
        connected_account_id: "acc-6",
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });

    mockAdminSelectResult
      .mockReturnValueOnce({ data: { id: "acc-6", platform: "tiktok", access_token: "tok" } })
      .mockReturnValueOnce({ data: null });

    const { getPublisher } = await import("@/lib/platforms/registry");
    (getPublisher as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const response = await GET(createRequest());
    const json = await response.json();

    expect(json.failed).toBe(1);
    const { sendPublishFailedEmail } = await import("@/lib/email");
    expect(sendPublishFailedEmail).not.toHaveBeenCalled();
  });

  it("handles publish success with no platformPostId (null fallback)", async () => {

    const posts = [
      {
        id: "post-9",
        user_id: "user-1",
        platform: "linkedin",
        content: "No post id",
        connected_account_id: "acc-7",
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });

    const mockPublish = vi.fn().mockResolvedValueOnce({ success: true });

    mockAdminSelectResult
      .mockReturnValueOnce({ data: { id: "acc-7", platform: "linkedin", access_token: "tok" } })
      .mockReturnValueOnce({ data: null });

    const { getPublisher } = await import("@/lib/platforms/registry");
    (getPublisher as ReturnType<typeof vi.fn>).mockReturnValueOnce({ publish: mockPublish });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(json.published).toBe(1);
    expect(mockAdminUpdate).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ status: "published", platform_post_id: null }),
      "id",
      "post-9"
    );

    // No email sent since profile is null
    const { sendPostPublishedEmail } = await import("@/lib/email");
    expect(sendPostPublishedEmail).not.toHaveBeenCalled();
  });

  it("handles publish failure with no error message (fallback to defaults)", async () => {

    const posts = [
      {
        id: "post-10",
        user_id: "user-1",
        platform: "facebook",
        content: "No error msg",
        connected_account_id: "acc-8",
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });

    const mockPublish = vi.fn().mockResolvedValueOnce({ success: false });

    mockAdminSelectResult
      .mockReturnValueOnce({ data: { id: "acc-8", platform: "facebook", access_token: "tok" } })
      .mockReturnValueOnce({ data: null });

    const { getPublisher } = await import("@/lib/platforms/registry");
    (getPublisher as ReturnType<typeof vi.fn>).mockReturnValueOnce({ publish: mockPublish });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(json.failed).toBe(1);
    expect(mockAdminUpdate).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ status: "failed", error_message: "Publishing failed" }),
      "id",
      "post-10"
    );

    const { sendPublishFailedEmail } = await import("@/lib/email");
    expect(sendPublishFailedEmail).not.toHaveBeenCalled();
  });

  it("sends failure email with fallback message when result.error is undefined", async () => {

    const posts = [
      {
        id: "post-12",
        user_id: "user-1",
        platform: "facebook",
        content: "Fallback error msg",
        connected_account_id: "acc-9",
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });

    const mockPublish = vi.fn().mockResolvedValueOnce({ success: false });

    mockAdminSelectResult
      .mockReturnValueOnce({ data: { id: "acc-9", platform: "facebook", access_token: "tok" } })
      .mockReturnValueOnce({ data: { email: "fallback@example.com" } });

    const { getPublisher } = await import("@/lib/platforms/registry");
    (getPublisher as ReturnType<typeof vi.fn>).mockReturnValueOnce({ publish: mockPublish });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(json.failed).toBe(1);

    const { sendPublishFailedEmail } = await import("@/lib/email");
    expect(sendPublishFailedEmail).toHaveBeenCalledWith(
      "fallback@example.com",
      "facebook",
      "Publishing failed"
    );
  });

  it("does not send a reminder when the user has no email on file", async () => {
    const posts = [
      {
        id: "post-11",
        user_id: "user-1",
        platform: "linkedin",
        content: "Manual no email",
        hashtags: [],
        connected_account_id: null,
        reminder_sent_at: null,
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });
    // Profile lookup returns data: null — no email on file.
    mockAdminSelectResult.mockReturnValueOnce({ data: null });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(json.processed).toBe(1);
    expect(json.remindersSent).toBe(0);
    const { sendScheduledReminderEmail } = await import("@/lib/email");
    expect(sendScheduledReminderEmail).not.toHaveBeenCalled();
  });

  it("does not re-send the reminder if it was already sent for this post", async () => {
    const posts = [
      {
        id: "post-already-reminded",
        user_id: "user-1",
        platform: "linkedin",
        content: "Already nudged",
        hashtags: [],
        connected_account_id: null,
        reminder_sent_at: "2026-05-25T10:00:00Z",
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(json.remindersSent).toBe(0);
    const { sendScheduledReminderEmail } = await import("@/lib/email");
    expect(sendScheduledReminderEmail).not.toHaveBeenCalled();
  });

  it("counts a failure when the reminder email send fails", async () => {
    const posts = [
      {
        id: "post-6",
        user_id: "user-1",
        platform: "linkedin",
        content: "Reminder will fail",
        hashtags: [],
        connected_account_id: null,
        reminder_sent_at: null,
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });
    mockAdminSelectResult.mockReturnValueOnce({
      data: { email: "user@example.com" },
    });

    const { sendScheduledReminderEmail } = await import("@/lib/email");
    (sendScheduledReminderEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(1);
    expect(json.remindersSent).toBe(0);
    expect(json.failed).toBe(1);
  });
});
