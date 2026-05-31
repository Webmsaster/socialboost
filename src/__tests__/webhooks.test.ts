import { describe, it, expect, vi } from "vitest";
import { fireWebhook } from "@/lib/webhooks";

vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

// safeFetch now resolve-and-pins (real DNS + undici Agent) before connecting —
// that's the SSRF/DNS-rebinding layer with its own coverage in ssrf.test.ts.
// fireWebhook's unit boundary ends at safeFetch, so delegate straight to the
// spied global fetch here (keep the real, synchronous parseSafeUrl).
vi.mock("@/lib/ssrf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ssrf")>();
  return {
    ...actual,
    safeFetch: (url: string, init?: RequestInit) => fetch(url, init),
  };
});

describe("fireWebhook", () => {
  it("does nothing when webhookUrl is null", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    await fireWebhook(null, "test", {});
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("does nothing when webhookUrl is undefined", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    await fireWebhook(undefined, "test", {});
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("sends POST to webhook URL with correct payload", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));

    await fireWebhook("https://hooks.example.com/test", "post.published", { postId: "123" });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/test");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body as string);
    expect(body.event).toBe("post.published");
    expect(body.data.postId).toBe("123");
    expect(body.timestamp).toBeDefined();

    fetchSpy.mockRestore();
  });

  it("includes correct headers", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));

    await fireWebhook("https://hooks.example.com/test", "post.created", {});

    const [, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["User-Agent"]).toBe("SocialBoost-Webhook/1.0");

    fetchSpy.mockRestore();
  });

  it("does not throw on fetch failure", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

    // Should not throw
    await expect(fireWebhook("https://hooks.example.com/fail", "test", {})).resolves.toBeUndefined();

    fetchSpy.mockRestore();
  });

  it("calls captureError when response is not ok", async () => {
    const { captureError } = await import("@/lib/logger");
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("Server Error", { status: 500 })
    );

    await fireWebhook("https://hooks.example.com/bad", "test.event", { key: "val" });

    expect(captureError).toHaveBeenCalledWith(
      "Webhook delivery failed",
      expect.any(Error),
      expect.objectContaining({ webhookUrl: "https://hooks.example.com/bad", event: "test.event" })
    );

    fetchSpy.mockRestore();
  });
});
