import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { twitterPublisher } from "@/lib/platforms/twitter";
import type { ConnectedAccount } from "@/lib/platforms";

const mockAccount: ConnectedAccount = {
  id: "acc-tw",
  platform: "twitter",
  platform_user_id: "tw-user-1",
  platform_username: "testuser",
  access_token: "tw-token-abc",
  refresh_token: null,
  token_expires_at: null,
  page_id: null,
};

describe("twitterPublisher", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.TWITTER_CLIENT_ID = "tw-client-id";
    process.env.TWITTER_CLIENT_SECRET = "tw-client-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.TWITTER_CLIENT_ID;
    delete process.env.TWITTER_CLIENT_SECRET;
  });

  describe("publish", () => {
    it("publishes a tweet successfully", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: "tweet-123" } }),
      });

      const result = await twitterPublisher.publish(mockAccount, "Hello Twitter!");
      expect(result).toEqual({ success: true, platformPostId: "tweet-123" });
    });

    it("truncates content to 280 characters", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: "tweet-456" } }),
      });

      const longContent = "a".repeat(300);
      await twitterPublisher.publish(mockAccount, longContent);
      const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.text.length).toBeLessThanOrEqual(280);
    });

    it("appends hashtags and truncates", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { id: "t-789" } }),
      });

      await twitterPublisher.publish(mockAccount, "Content", ["ai", "tech"]);
      const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.text).toContain("#ai #tech");
      expect(body.text.length).toBeLessThanOrEqual(280);
    });

    it("returns error on API failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false, status: 403,
        text: () => Promise.resolve("Forbidden"),
      });

      const result = await twitterPublisher.publish(mockAccount, "Content");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Twitter API error: 403");
    });

    it("returns error on network failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Timeout"));

      const result = await twitterPublisher.publish(mockAccount, "Content");
      expect(result.success).toBe(false);
    });
  });

  describe("getAuthUrl", () => {
    it("returns a Twitter authorization URL with S256 PKCE", () => {
      const url = twitterPublisher.getAuthUrl("https://app/callback", "state-abc", "test-challenge");
      expect(url).toContain("https://twitter.com/i/oauth2/authorize");
      expect(url).toContain("client_id=tw-client-id");
      expect(url).toContain("code_challenge=test-challenge");
      expect(url).toContain("code_challenge_method=S256");
    });

    it("throws if TWITTER_CLIENT_ID is not set", () => {
      delete process.env.TWITTER_CLIENT_ID;
      expect(() => twitterPublisher.getAuthUrl("https://cb", "state", "test-challenge"))
        .toThrow("TWITTER_CLIENT_ID not configured");
    });
  });

  describe("exchangeCode", () => {
    it("exchanges code and returns user info", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "at-123", refresh_token: "rt-456", expires_in: 7200 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: { id: "tw-id", username: "testuser" } }),
        });

      const result = await twitterPublisher.exchangeCode("code-123", "https://app/callback", "test-verifier");
      expect(result.accessToken).toBe("at-123");
      expect(result.refreshToken).toBe("rt-456");
      expect(result.platformUserId).toBe("tw-id");
      expect(result.platformUsername).toBe("testuser");
    });

    it("throws on token exchange failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 401 });
      await expect(twitterPublisher.exchangeCode("bad", "https://cb", "test-verifier"))
        .rejects.toThrow("Twitter token exchange failed: 401");
    });

    it("returns undefined expiresAt when expires_in is not present", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "at-noexp" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: { id: "tw-noexp", username: "noexp" } }),
        });

      const result = await twitterPublisher.exchangeCode("code-noexp", "https://app/callback", "test-verifier");
      expect(result.accessToken).toBe("at-noexp");
      expect(result.expiresAt).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
    });
  });
});
