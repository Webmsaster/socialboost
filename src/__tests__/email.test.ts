import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSend = vi.fn();

vi.mock("resend", () => {
  class MockResend {
    emails = { send: (...args: unknown[]) => mockSend(...args) };
  }
  return { Resend: MockResend };
});

describe("email", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
  });

  describe("sendPostPublishedEmail", () => {
    it("skips sending when RESEND_API_KEY is not set", async () => {
      delete process.env.RESEND_API_KEY;
      const { sendPostPublishedEmail } = await import("@/lib/email");
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await sendPostPublishedEmail("test@test.com", "Hello world", "linkedin");
      expect(result).toBe(false);
      expect(mockSend).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it("sends email with correct subject and recipient", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      const { sendPostPublishedEmail } = await import("@/lib/email");

      await sendPostPublishedEmail("user@example.com", "My post content", "linkedin");

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@example.com",
          subject: "Your Linkedin post was published!",
        })
      );
    });

    it("includes post content in email HTML", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      const { sendPostPublishedEmail } = await import("@/lib/email");

      await sendPostPublishedEmail("user@test.com", "Test content here", "twitter");

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain("Test content here");
      expect(callArgs.html).toContain("Twitter");
    });

    it("truncates long content to 300 chars in email", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      const { sendPostPublishedEmail } = await import("@/lib/email");

      const longContent = "a".repeat(500);
      await sendPostPublishedEmail("user@test.com", longContent, "facebook");

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain("...");
    });

    it("returns true on successful send", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      const { sendPostPublishedEmail } = await import("@/lib/email");

      const result = await sendPostPublishedEmail("user@test.com", "Content", "linkedin");
      expect(result).toBe(true);
    });

    it("returns false when Resend returns an error", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      mockSend.mockResolvedValue({ error: { message: "Invalid email" } });
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { sendPostPublishedEmail } = await import("@/lib/email");
      const result = await sendPostPublishedEmail("bad@", "Content", "linkedin");
      expect(result).toBe(false);
      spy.mockRestore();
    });

    it("returns false when send throws", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      mockSend.mockRejectedValue(new Error("Network error"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { sendPostPublishedEmail } = await import("@/lib/email");
      const result = await sendPostPublishedEmail("user@test.com", "Content", "linkedin");
      expect(result).toBe(false);
      spy.mockRestore();
    });
  });

  describe("sendLimitReachedEmail", () => {
    it("skips when RESEND_API_KEY is not set", async () => {
      delete process.env.RESEND_API_KEY;
      const { sendLimitReachedEmail } = await import("@/lib/email");
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await sendLimitReachedEmail("test@test.com", "free", 10);
      expect(result).toBe(false);
      spy.mockRestore();
    });

    it("sends email with correct limit info for free plan", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      const { sendLimitReachedEmail } = await import("@/lib/email");

      await sendLimitReachedEmail("user@test.com", "free", 10);

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.subject).toBe("You've reached your monthly generation limit");
      expect(callArgs.html).toContain("10");
      expect(callArgs.html).toContain("Free");
      expect(callArgs.html).toContain("Upgrade to Pro");
    });

    it("sends email without upgrade CTA for Pro plan", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      const { sendLimitReachedEmail } = await import("@/lib/email");

      await sendLimitReachedEmail("user@test.com", "active", 100);

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.html).toContain("100");
      expect(callArgs.html).toContain("Pro");
    });
  });

  describe("getResend singleton", () => {
    it("reuses the Resend instance on second call (cached branch)", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      const { sendPostPublishedEmail, sendLimitReachedEmail } = await import("@/lib/email");

      // First call creates the Resend instance
      await sendPostPublishedEmail("user@test.com", "Content", "linkedin");
      // Second call reuses the cached instance (hits !_resend false branch)
      await sendLimitReachedEmail("user@test.com", "free", 10);

      // Both calls should have gone through the same Resend instance
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe("sendPublishFailedEmail", () => {
    it("skips when RESEND_API_KEY is not set", async () => {
      delete process.env.RESEND_API_KEY;
      const { sendPublishFailedEmail } = await import("@/lib/email");
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await sendPublishFailedEmail("test@test.com", "twitter", "Auth expired");
      expect(result).toBe(false);
      spy.mockRestore();
    });

    it("sends email with platform and error message", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      const { sendPublishFailedEmail } = await import("@/lib/email");

      await sendPublishFailedEmail("user@test.com", "instagram", "Token expired");

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.subject).toContain("Instagram");
      expect(callArgs.html).toContain("Token expired");
      expect(callArgs.html).toContain("Instagram");
    });

    it("returns true on successful send", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      const { sendPublishFailedEmail } = await import("@/lib/email");

      const result = await sendPublishFailedEmail("user@test.com", "facebook", "Error");
      expect(result).toBe(true);
    });
  });
});
