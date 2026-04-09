import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { captureError, _setSentry } from "@/lib/logger";

describe("captureError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    _setSentry(undefined);
  });

  it("logs message and error to console", () => {
    const err = new Error("test error");
    captureError("something failed", err);
    expect(console.error).toHaveBeenCalledWith("something failed", err, "");
  });

  it("logs message only when no error provided", () => {
    captureError("just a message");
    expect(console.error).toHaveBeenCalledWith("just a message", "", "");
  });

  it("logs context when provided", () => {
    captureError("msg", undefined, { userId: "123" });
    expect(console.error).toHaveBeenCalledWith("msg", "", { userId: "123" });
  });

  it("does not call Sentry when DSN is not set", () => {
    captureError("msg", new Error("test"));
    // Should not throw, just logs
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("handles non-Error objects as error parameter", () => {
    captureError("msg", "string error");
    expect(console.error).toHaveBeenCalledWith("msg", "string error", "");
  });

  it("handles null error gracefully", () => {
    captureError("msg", null, { key: "val" });
    // captureError uses ?? so null becomes ""
    expect(console.error).toHaveBeenCalledWith("msg", "", { key: "val" });
  });

  describe("Sentry integration", () => {
    it("calls Sentry.captureException when DSN is set and error is an Error", () => {
      const mockCaptureException = vi.fn();
      _setSentry({
        captureException: mockCaptureException,
        captureMessage: vi.fn(),
      });

      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://example@sentry.io/123";
      const testError = new Error("sentry test");
      captureError("sentry error", testError, { userId: "u1" });

      expect(mockCaptureException).toHaveBeenCalledWith(testError, {
        extra: { userId: "u1", message: "sentry error" },
      });
    });

    it("calls Sentry.captureMessage when DSN is set and error is NOT an Error", () => {
      const mockCaptureMessage = vi.fn();
      _setSentry({
        captureException: vi.fn(),
        captureMessage: mockCaptureMessage,
      });

      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://example@sentry.io/123";
      captureError("non-error failure", "string error", { route: "/api" });

      expect(mockCaptureMessage).toHaveBeenCalledWith("non-error failure", {
        level: "error",
        extra: { route: "/api", originalError: "string error" },
      });
    });

    it("calls Sentry.captureMessage for undefined error with DSN set", () => {
      const mockCaptureMessage = vi.fn();
      _setSentry({
        captureException: vi.fn(),
        captureMessage: mockCaptureMessage,
      });

      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://example@sentry.io/123";
      captureError("undefined error msg", undefined, { extra: "data" });

      expect(mockCaptureMessage).toHaveBeenCalledWith("undefined error msg", {
        level: "error",
        extra: { extra: "data", originalError: "undefined" },
      });
    });

    it("catches gracefully when Sentry throws", () => {
      // Inject a mock that throws when captureException is called
      _setSentry({
        captureException: () => {
          throw new Error("Sentry init failed");
        },
        captureMessage: vi.fn(),
      });

      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://example@sentry.io/123";
      // Should not throw — the catch block handles the error
      expect(() => captureError("msg", new Error("fail"))).not.toThrow();
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("falls back to dynamic import when _sentryOverride is not set", () => {
      // Do NOT call _setSentry — leave override as undefined.
      // This forces the dynamic import("@sentry/nextjs") code path.
      // Since the real SDK loads async, the function returns immediately;
      // we only verify it does not throw and still logs to console.
      process.env.NEXT_PUBLIC_SENTRY_DSN = "https://example@sentry.io/123";
      expect(() => captureError("import fallback", new Error("test"))).not.toThrow();
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });
});
