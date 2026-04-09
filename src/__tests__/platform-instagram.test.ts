import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { instagramPublisher } from "@/lib/platforms/instagram";
import type { ConnectedAccount } from "@/lib/platforms";

const mockAccount: ConnectedAccount = {
  id: "acc-ig",
  platform: "instagram",
  platform_user_id: "ig-biz-123",
  platform_username: "testinsta",
  access_token: "ig-token-abc",
  refresh_token: null,
  token_expires_at: null,
  page_id: null,
};

describe("instagramPublisher", () => {
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
    const media = { mediaUrl: "https://example.com/image.jpg" };

    it("creates media container then publishes", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "container-123" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "media-456" }),
        });

      const result = await instagramPublisher.publish(mockAccount, "Hello IG!", undefined, media);
      expect(result).toEqual({ success: true, platformPostId: "media-456" });
      expect(fetch).toHaveBeenCalledTimes(2);
      const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.image_url).toBe(media.mediaUrl);
    });

    it("returns error when no mediaUrl provided", async () => {
      const result = await instagramPublisher.publish(mockAccount, "Content");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Instagram requires an image");
      expect(fetch).not.toHaveBeenCalled();
    });

    it("appends hashtags to caption", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: "c-1" }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: "m-1" }) });

      await instagramPublisher.publish(mockAccount, "Caption", ["insta", "photo"], media);
      const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.caption).toBe("Caption\n\n#insta #photo");
    });

    it("returns error if container creation fails", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false, status: 400,
        text: () => Promise.resolve("Image required"),
      });

      const result = await instagramPublisher.publish(mockAccount, "Content", undefined, media);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Instagram container error");
    });

    it("returns error if publish step fails", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: "c-1" }) })
        .mockResolvedValueOnce({
          ok: false, status: 500,
          text: () => Promise.resolve("Internal error"),
        });

      const result = await instagramPublisher.publish(mockAccount, "Content", undefined, media);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Instagram publish error");
    });

    it("returns error on network failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Timeout"));
      const result = await instagramPublisher.publish(mockAccount, "Content", undefined, media);
      expect(result.success).toBe(false);
    });
  });

  describe("getAuthUrl", () => {
    it("returns Facebook OAuth URL with Instagram scopes", () => {
      const url = instagramPublisher.getAuthUrl("https://app/callback", "state-ig");
      expect(url).toContain("www.facebook.com/v19.0/dialog/oauth");
      expect(url).toContain("instagram_basic");
      expect(url).toContain("instagram_content_publish");
    });

    it("throws if FACEBOOK_APP_ID is not set", () => {
      delete process.env.FACEBOOK_APP_ID;
      expect(() => instagramPublisher.getAuthUrl("https://cb", "s")).toThrow("FACEBOOK_APP_ID not configured");
    });
  });

  describe("exchangeCode", () => {
    it("exchanges code, gets page, IG account, and profile", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        // Token exchange
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "short-token" }),
        })
        // Pages
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: "page-1", access_token: "page-token" }] }),
        })
        // IG business account
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ instagram_business_account: { id: "ig-biz-1" } }),
        })
        // IG profile
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ username: "cooluser" }),
        });

      const result = await instagramPublisher.exchangeCode("code-123", "https://app/cb");
      expect(result.accessToken).toBe("page-token");
      expect(result.platformUserId).toBe("ig-biz-1");
      expect(result.platformUsername).toBe("cooluser");
    });

    it("throws if no Facebook page found", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: "t" }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) });

      await expect(instagramPublisher.exchangeCode("code", "https://cb"))
        .rejects.toThrow("No Facebook Page found");
    });

    it("throws if no IG business account linked", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: "t" }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [{ id: "p1", access_token: "pt" }] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

      await expect(instagramPublisher.exchangeCode("code", "https://cb"))
        .rejects.toThrow("No Instagram Business Account");
    });

    it("throws on token exchange failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 401 });
      await expect(instagramPublisher.exchangeCode("bad", "https://cb"))
        .rejects.toThrow("Instagram token exchange failed");
    });
  });
});
