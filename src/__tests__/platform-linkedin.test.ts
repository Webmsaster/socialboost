import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { linkedinPublisher } from "@/lib/platforms/linkedin";
import type { ConnectedAccount } from "@/lib/platforms";

const mockAccount: ConnectedAccount = {
  id: "acc-1",
  platform: "linkedin",
  platform_user_id: "user-li-123",
  platform_username: "John Doe",
  access_token: "li-token-abc",
};

describe("linkedinPublisher", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.LINKEDIN_CLIENT_ID = "li-client-id";
    process.env.LINKEDIN_CLIENT_SECRET = "li-client-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;
  });

  describe("publish", () => {
    it("publishes a post successfully", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "urn:li:share:123" }),
      });

      const result = await linkedinPublisher.publish(mockAccount, "Hello LinkedIn!");
      expect(result).toEqual({ success: true, platformPostId: "urn:li:share:123" });
      expect(fetch).toHaveBeenCalledWith("https://api.linkedin.com/v2/ugcPosts", expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer li-token-abc",
        }),
      }));
    });

    it("appends hashtags to content", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "urn:li:share:456" }),
      });

      await linkedinPublisher.publish(mockAccount, "Content", ["ai", "tech"]);
      const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text)
        .toBe("Content\n\n#ai #tech");
    });

    it("returns error on API failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      const result = await linkedinPublisher.publish(mockAccount, "Content");
      expect(result.success).toBe(false);
      expect(result.error).toContain("LinkedIn API error: 401");
    });

    it("returns error on network failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

      const result = await linkedinPublisher.publish(mockAccount, "Content");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });
  });

  describe("getAuthUrl", () => {
    it("returns a LinkedIn authorization URL", () => {
      const url = linkedinPublisher.getAuthUrl("https://app.test/callback", "state-abc");
      expect(url).toContain("https://www.linkedin.com/oauth/v2/authorization");
      expect(url).toContain("client_id=li-client-id");
      expect(url).toContain("state=state-abc");
      expect(url).toContain("scope=openid+profile+w_member_social");
    });

    it("throws if LINKEDIN_CLIENT_ID is not set", () => {
      delete process.env.LINKEDIN_CLIENT_ID;
      expect(() => linkedinPublisher.getAuthUrl("https://cb", "state"))
        .toThrow("LINKEDIN_CLIENT_ID not configured");
    });
  });

  describe("exchangeCode", () => {
    it("exchanges code for tokens and returns user info", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "token-123", refresh_token: "refresh-456", expires_in: 3600 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ sub: "li-user-id", name: "John" }),
        });

      const result = await linkedinPublisher.exchangeCode("auth-code", "https://app/callback");
      expect(result.accessToken).toBe("token-123");
      expect(result.refreshToken).toBe("refresh-456");
      expect(result.platformUserId).toBe("li-user-id");
      expect(result.platformUsername).toBe("John");
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it("throws on token exchange failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 400 });

      await expect(linkedinPublisher.exchangeCode("bad-code", "https://cb"))
        .rejects.toThrow("LinkedIn token exchange failed: 400");
    });

    it("returns undefined expiresAt when expires_in is not present", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "token-no-exp" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ sub: "li-no-exp", name: "NoExpiry" }),
        });

      const result = await linkedinPublisher.exchangeCode("code-no-exp", "https://app/callback");
      expect(result.accessToken).toBe("token-no-exp");
      expect(result.expiresAt).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
    });
  });
});
