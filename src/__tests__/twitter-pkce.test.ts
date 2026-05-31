import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deriveCodeChallenge,
  generateCodeVerifier,
  twitterPublisher,
} from "@/lib/platforms/twitter";

describe("Twitter S256 PKCE", () => {
  const originalClientId = process.env.TWITTER_CLIENT_ID;

  beforeEach(() => {
    process.env.TWITTER_CLIENT_ID = "test-client-id";
  });

  afterEach(() => {
    if (originalClientId === undefined) {
      delete process.env.TWITTER_CLIENT_ID;
    } else {
      process.env.TWITTER_CLIENT_ID = originalClientId;
    }
  });

  it("derives challenge as base64url(sha256(verifier))", () => {
    const verifier = "known-test-verifier-1234567890";
    const expected = createHash("sha256").update(verifier).digest("base64url");
    expect(deriveCodeChallenge(verifier)).toBe(expected);
  });

  it("getAuthUrl uses S256 with code_challenge == base64url(sha256(verifier))", () => {
    const verifier = "known-test-verifier-abcdefghijklmnop";
    const challenge = deriveCodeChallenge(verifier);

    const url = twitterPublisher.getAuthUrl(
      "https://app.example.com/api/auth/oauth/callback",
      "state-value",
      challenge
    );

    const params = new URL(url).searchParams;
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("code_challenge")).toBe(challenge);
    expect(params.get("code_challenge")).toBe(
      createHash("sha256").update(verifier).digest("base64url")
    );
    // Sanity: the constant placeholder is gone.
    expect(params.get("code_challenge")).not.toBe("challenge");
  });

  it("getAuthUrl throws when no PKCE challenge is provided", () => {
    expect(() =>
      twitterPublisher.getAuthUrl(
        "https://app.example.com/api/auth/oauth/callback",
        "state-value"
      )
    ).toThrow(/PKCE code challenge/);
  });

  it("generateCodeVerifier produces a base64url 32-byte (43 char) verifier", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // round-trips through challenge derivation deterministically
    expect(deriveCodeChallenge(verifier)).toBe(deriveCodeChallenge(verifier));
  });
});
