import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("resend", () => {
  class MockResend {
    emails = { send: vi.fn().mockResolvedValue({ error: null }) };
  }
  return { Resend: MockResend };
});

describe("email", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("skips sending when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendPostPublishedEmail } = await import("@/lib/email");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await sendPostPublishedEmail("test@test.com", "Hello world", "linkedin");
    expect(result).toBe(false);
    spy.mockRestore();
  });

  it("sends email when RESEND_API_KEY is set", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    const { sendPostPublishedEmail } = await import("@/lib/email");

    const result = await sendPostPublishedEmail("test@test.com", "Hello world", "linkedin");
    expect(result).toBe(true);
    delete process.env.RESEND_API_KEY;
  });

  it("skips sendLimitReachedEmail when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendLimitReachedEmail } = await import("@/lib/email");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await sendLimitReachedEmail("test@test.com", "free", 10);
    expect(result).toBe(false);
    spy.mockRestore();
  });

  it("skips sendPublishFailedEmail when RESEND_API_KEY is not set", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendPublishFailedEmail } = await import("@/lib/email");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = await sendPublishFailedEmail("test@test.com", "twitter", "Auth expired");
    expect(result).toBe(false);
    spy.mockRestore();
  });
});
