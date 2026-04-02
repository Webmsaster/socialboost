import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pinterestPublisher } from "@/lib/platforms/pinterest";
import type { ConnectedAccount } from "@/lib/platforms";

const mockAccount: ConnectedAccount = {
  id: "acc-pin",
  platform: "pinterest",
  platform_user_id: "pin-user-1",
  platform_username: "pinner",
  access_token: "pin-token-abc",
};

describe("pinterestPublisher", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.PINTEREST_CLIENT_ID = "pin-client-id";
    process.env.PINTEREST_CLIENT_SECRET = "pin-client-secret";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.PINTEREST_CLIENT_ID;
    delete process.env.PINTEREST_CLIENT_SECRET;
  });

  describe("publish", () => {
    it("fetches boards and creates a pin", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [{ id: "board-1" }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "pin-123" }),
        });

      const result = await pinterestPublisher.publish(mockAccount, "Beautiful pin!");
      expect(result).toEqual({ success: true, platformPostId: "pin-123" });
    });

    it("uses page_id as board ID when available", async () => {
      const accountWithBoard = { ...mockAccount, page_id: "board-preset" };
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "pin-456" }),
      });

      await pinterestPublisher.publish(accountWithBoard, "Content");
      // Should only call pins endpoint, not boards
      expect(fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.board_id).toBe("board-preset");
    });

    it("truncates title to 100 characters", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ items: [{ id: "b-1" }] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: "pin-789" }) });

      const longContent = "a".repeat(150);
      await pinterestPublisher.publish(mockAccount, longContent);
      const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1].body);
      expect(body.title.length).toBe(100);
    });

    it("returns error when no boards found", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      const result = await pinterestPublisher.publish(mockAccount, "Content");
      expect(result.success).toBe(false);
      expect(result.error).toContain("No Pinterest boards found");
    });

    it("returns error on boards API failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false, status: 401,
      });

      const result = await pinterestPublisher.publish(mockAccount, "Content");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Pinterest boards error");
    });

    it("returns error on pin creation failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ items: [{ id: "b-1" }] }) })
        .mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve("Bad request") });

      const result = await pinterestPublisher.publish(mockAccount, "Content");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Pinterest API error");
    });

    it("returns error on network failure (catch branch)", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
      const result = await pinterestPublisher.publish(mockAccount, "Content");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("appends hashtags to description", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ items: [{ id: "b-1" }] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: "pin-h" }) });

      await pinterestPublisher.publish(mockAccount, "Content", ["diy", "craft"]);
      const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1].body);
      expect(body.description).toBe("Content\n\n#diy #craft");
    });
  });

  describe("getAuthUrl", () => {
    it("returns Pinterest OAuth URL", () => {
      const url = pinterestPublisher.getAuthUrl("https://app/callback", "state-pin");
      expect(url).toContain("www.pinterest.com/oauth");
      expect(url).toContain("client_id=pin-client-id");
      expect(url).toContain("state=state-pin");
    });

    it("throws if PINTEREST_CLIENT_ID is not set", () => {
      delete process.env.PINTEREST_CLIENT_ID;
      expect(() => pinterestPublisher.getAuthUrl("https://cb", "s"))
        .toThrow("PINTEREST_CLIENT_ID not configured");
    });
  });

  describe("exchangeCode", () => {
    it("exchanges code and returns user info", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "pin-at", refresh_token: "pin-rt", expires_in: 86400 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ username: "pinner123", id: "pin-uid" }),
        });

      const result = await pinterestPublisher.exchangeCode("code-pin", "https://app/cb");
      expect(result.accessToken).toBe("pin-at");
      expect(result.refreshToken).toBe("pin-rt");
      expect(result.platformUsername).toBe("pinner123");
    });

    it("throws on token exchange failure", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 400 });
      await expect(pinterestPublisher.exchangeCode("bad", "https://cb"))
        .rejects.toThrow("Pinterest token exchange failed");
    });

    it("falls back to user.id when username is not present", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "pin-at2", refresh_token: "pin-rt2" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "pin-uid-fallback" }),
        });

      const result = await pinterestPublisher.exchangeCode("code-pin2", "https://app/cb");
      expect(result.platformUserId).toBe("pin-uid-fallback");
      expect(result.platformUsername).toBeUndefined();
    });

    it("returns undefined expiresAt when expires_in is not present", async () => {
      (fetch as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: "pin-at3" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ username: "pinner456", id: "pin-uid3" }),
        });

      const result = await pinterestPublisher.exchangeCode("code-pin3", "https://app/cb");
      expect(result.expiresAt).toBeUndefined();
    });
  });
});
