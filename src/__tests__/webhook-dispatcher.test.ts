import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

// safeFetch is mocked so we can capture the signed headers + body the
// dispatcher sends, without real DNS/undici/network. parseSafeUrl mirrors the
// real (synchronous) signature: string -> URL | null.
const safeFetch = vi.fn(
  async (_url: string, _init?: RequestInit) => new Response(null, { status: 200 }),
);

vi.mock("@/lib/ssrf", () => ({
  parseSafeUrl: (raw: string) => new URL(raw),
  safeFetch: (url: string, init?: RequestInit) => safeFetch(url, init),
}));
vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

import { dispatchWebhook } from "@/lib/webhook-dispatcher";

describe("dispatchWebhook HMAC signing", () => {
  beforeEach(() => {
    safeFetch.mockClear();
  });

  it("signs the exact raw body with the endpoint secret (sha256=<hex>)", async () => {
    const secret = "whsec_testsecret_abc123";
    const event = "post.published";
    const timestamp = "2026-05-30T00:00:00.000Z";
    const rawBody = JSON.stringify({ event, timestamp, data: { postId: "p1" } });

    await dispatchWebhook(
      { id: "wh_1", url: "https://example.com/hook", secret },
      rawBody,
      event,
      timestamp,
    );

    expect(safeFetch).toHaveBeenCalledTimes(1);
    const [url, init] = safeFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/hook");

    const headers = init.headers as Record<string, string>;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

    expect(headers["X-SocialBoost-Signature"]).toBe(`sha256=${expected}`);
    expect(headers["X-SocialBoost-Event"]).toBe(event);
    expect(headers["X-SocialBoost-Timestamp"]).toBe(timestamp);
    // The SAME string is used for signing and the request body.
    expect(init.body).toBe(rawBody);
  });

  it("produces a different signature for a different secret", async () => {
    const event = "post.approved";
    const timestamp = "2026-05-30T00:00:00.000Z";
    const rawBody = JSON.stringify({ event, timestamp, data: {} });

    await dispatchWebhook(
      { id: "a", url: "https://a.example/hook", secret: "secret-a" },
      rawBody,
      event,
      timestamp,
    );
    await dispatchWebhook(
      { id: "b", url: "https://b.example/hook", secret: "secret-b" },
      rawBody,
      event,
      timestamp,
    );

    const sigA = (safeFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    const sigB = (safeFetch.mock.calls[1][1] as RequestInit).headers as Record<string, string>;
    expect(sigA["X-SocialBoost-Signature"]).not.toBe(sigB["X-SocialBoost-Signature"]);
  });
});
