import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockAdminUpdate = vi.fn();
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
      select: (...args: unknown[]) => ({
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
  sendPostPublishedEmail: vi.fn(),
  sendPublishFailedEmail: vi.fn(),
}));

vi.mock("@/lib/platforms/registry", () => ({
  getPublisher: vi.fn(),
}));

// Import after mocks
import { GET } from "@/app/api/cron/publish/route";

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/publish", {
    method: "GET",
    headers,
  });
}

describe("GET /api/cron/publish", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    mockAdminResetResult.mockReturnValue({ error: null });
    (mockAdminUpdate as ReturnType<typeof vi.fn> & { _nextResult?: unknown })._nextResult = undefined;
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
    delete process.env.CRON_SECRET;

    mockAdminLteResult.mockReturnValueOnce({ data: [], error: null });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(0);
  });

  it("processes and publishes scheduled posts", async () => {
    delete process.env.CRON_SECRET;

    const posts = [
      {
        id: "post-1",
        user_id: "user-1",
        platform: "linkedin",
        content: "Hello World",
        connected_account_id: null,
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });

    // Profile email lookup for notification
    mockAdminSelectResult.mockReturnValueOnce({
      data: { email: "user@example.com" },
    });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(1);
    expect(json.published).toBe(1);
    expect(json.failed).toBe(0);
    // Verify update was called for marking published
    expect(mockAdminUpdate).toHaveBeenCalledWith(
      "posts",
      expect.objectContaining({ status: "published" }),
      "id",
      "post-1"
    );
  });

  it("logs error when generation count reset fails", async () => {
    delete process.env.CRON_SECRET;

    mockAdminResetResult.mockReturnValueOnce({ error: { message: "reset failed" } });
    mockAdminLteResult.mockReturnValueOnce({ data: [], error: null });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(0);

    const { captureError } = await import("@/lib/logger");
    expect(captureError).toHaveBeenCalledWith(
      "Cron: failed to reset generation counts",
      expect.objectContaining({ message: "reset failed" })
    );
  });

  it("returns 500 when fetching scheduled posts fails", async () => {
    delete process.env.CRON_SECRET;

    mockAdminResetResult.mockReturnValueOnce({ error: null });
    mockAdminLteResult.mockReturnValueOnce({ data: null, error: { message: "db down" } });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to fetch posts");
  });

  it("marks post as failed when connected account is not found", async () => {
    delete process.env.CRON_SECRET;

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
    delete process.env.CRON_SECRET;

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
    delete process.env.CRON_SECRET;

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
      "Publish me"
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
    delete process.env.CRON_SECRET;

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
    delete process.env.CRON_SECRET;

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
    delete process.env.CRON_SECRET;

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
    delete process.env.CRON_SECRET;

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
    delete process.env.CRON_SECRET;

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
    delete process.env.CRON_SECRET;

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

  it("skips email when profile has no email (manual publish success path)", async () => {
    delete process.env.CRON_SECRET;

    const posts = [
      {
        id: "post-11",
        user_id: "user-1",
        platform: "linkedin",
        content: "Manual no email",
        connected_account_id: null,
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });

    // Profile has no email
    mockAdminSelectResult.mockReturnValueOnce({ data: null });

    const response = await GET(createRequest());
    const json = await response.json();

    expect(json.published).toBe(1);
    const { sendPostPublishedEmail } = await import("@/lib/email");
    expect(sendPostPublishedEmail).not.toHaveBeenCalled();
  });

  it("counts failure when update to mark post as published fails", async () => {
    delete process.env.CRON_SECRET;

    const posts = [
      {
        id: "post-6",
        user_id: "user-1",
        platform: "linkedin",
        content: "Update will fail",
        connected_account_id: null,
      },
    ];
    mockAdminLteResult.mockReturnValueOnce({ data: posts, error: null });

    // Make the update call return an error
    (mockAdminUpdate as ReturnType<typeof vi.fn> & { _nextResult?: unknown })._nextResult = {
      error: { message: "update failed" },
    };

    const response = await GET(createRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processed).toBe(1);
    expect(json.published).toBe(0);
    expect(json.failed).toBe(1);

    const { captureError } = await import("@/lib/logger");
    expect(captureError).toHaveBeenCalledWith(
      "Cron: failed to mark post as published",
      expect.objectContaining({ message: "update failed" }),
      expect.objectContaining({ postId: "post-6" })
    );
  });
});
