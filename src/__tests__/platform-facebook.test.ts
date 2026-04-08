import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { facebookPublisher } from "@/lib/platforms/facebook";
import type { ConnectedAccount } from "@/lib/platforms";

const mockAccount: ConnectedAccount = {
  id: "acc-fb",
  platform: "facebook",
  platform_user_id: "fb-page-123",
  platform_username: "TestPage",
  access_token: "fb-token-abc",
  refresh_token: null,
  token_expires_at: null,
  page_id: null,
};

describe("facebookPublisher", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.FACEBOOK_APP_ID = "fb-app-id";
    process.env.FACEBOOK_APP_SECRET = "fb-app-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
  });

  describe("publish", () => {
    it("publishes to Facebook page feed", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "post-123" }),
      });

      const result = await facebookPublisher.publish(mockAccount, "Hello Facebook!");
      expect(result).toEqual({ success: true, platformPostId: "post-123" });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("graph.facebook.com/v19.0/fb-page-123/feed"),
        expect.any(Object)
      );
    });

    it("uses page_id when available", async () => {
      const accountWithPageId = { ...mockAccount, page_id: "page-456" };
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "post-456" }),
      });

      await facebookPublisher.publish(accountWithPageId, "Content");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("page-456/feed"),
        expect.any(Object)
      );
    });

    it("appends hashtags", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "p-789" }),
      });

      await facebookPublisher.publish(mockAccount, "Content", ["social", "marketing"]);
      const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.message).toBe("Content\n\n#social #marketing");
    });

    it("returns error on API failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false, status: 400,
        text: () => Promise.resolve("Bad Request"),
      });

      const result = await facebookPublisher.publish(mockAccount, "Content");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Facebook API error: 400");
    });

    it("returns error on network failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection refused"));
      const result = await facebookPublisher.publish(mockAccount, "Content");
      expect(result.success).toBe(false);
    });
  });

  describe("getAuthUrl", () => {
    it("returns Facebook OAuth URL", () => {
      const url = facebookPublisher.getAuthUrl("https://app/callback", "state-123");
      expect(url).toContain("www.facebook.com/v19.0/dialog/oauth");
      expect(url).toContain("client_id=fb-app-id");
      expect(url).toContain("state=state-123");
    });

    it("throws if FACEBOOK_APP_ID is not set", () => {
      delete process.env.FACEBOOK_APP_ID;
      expect(() => facebookPublisher.getAuthUrl("https://cb", "s")).toThrow("FACEBOOK_APP_ID not configured");
    });
  });

  describe("exchangeCode", () => {
    it("exchanges code and returns user info", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "fb-at", expires_in: 5184000 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "fb-user-1", name: "Test User" }),
        });

      const result = await facebookPublisher.exchangeCode("code-abc", "https://app/cb");
      expect(result.accessToken).toBe("fb-at");
      expect(result.platformUserId).toBe("fb-user-1");
      expect(result.platformUsername).toBe("Test User");
    });

    it("throws on token exchange failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 400 });
      await expect(facebookPublisher.exchangeCode("bad", "https://cb"))
        .rejects.toThrow("Facebook token exchange failed: 400");
    });

    it("returns undefined expiresAt when expires_in is not present", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "fb-at" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "fb-user-2", name: "No Expiry" }),
        });

      const result = await facebookPublisher.exchangeCode("code-noexp", "https://app/cb");
      expect(result.accessToken).toBe("fb-at");
      expect(result.expiresAt).toBeUndefined();
    });
  });
});
