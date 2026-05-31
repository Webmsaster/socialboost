import { createHash, randomBytes } from "node:crypto";
import type { ConnectedAccount, PlatformPublisher, PublishResult } from "./index";

/**
 * Generate a PKCE code verifier: 32 random bytes encoded as base64url
 * (RFC 7636 allows 43-128 chars; 32 bytes -> 43 base64url chars).
 */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Derive the S256 PKCE code challenge from a verifier:
 * challenge = base64url(sha256(verifier)).
 */
export function deriveCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export const twitterPublisher: PlatformPublisher = {
  async publish(account: ConnectedAccount, content: string, hashtags?: string[]): Promise<PublishResult> {
    const fullText = hashtags?.length
      ? `${content} ${hashtags.map((h) => `#${h}`).join(" ")}`.slice(0, 280)
      : content.slice(0, 280);

    try {
      const res = await fetch("https://api.twitter.com/2/tweets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: fullText }),
      });

      if (!res.ok) {
        const error = await res.text();
        return { success: false, error: `Twitter API error: ${res.status} ${error}` };
      }

      const data = await res.json();
      return { success: true, platformPostId: data.data?.id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getAuthUrl(redirectUri: string, state: string, codeChallenge?: string): string {
    const clientId = process.env.TWITTER_CLIENT_ID;
    if (!clientId) throw new Error("TWITTER_CLIENT_ID not configured");
    if (!codeChallenge) throw new Error("Twitter OAuth requires a PKCE code challenge");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: "tweet.read tweet.write users.read offline.access",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    return `https://twitter.com/i/oauth2/authorize?${params}`;
  },

  async exchangeCode(code: string, redirectUri: string, codeVerifier?: string) {
    if (!codeVerifier) throw new Error("Twitter OAuth requires a PKCE code verifier");

    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!res.ok) throw new Error(`Twitter token exchange failed: ${res.status}`);
    const tokens = await res.json();

    const userRes = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userRes.ok) throw new Error(`Twitter profile fetch failed: ${userRes.status}`);
    const user = await userRes.json();
    if (!user?.data?.id) throw new Error("Twitter profile response missing data.id");

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
      platformUserId: user.data.id,
      platformUsername: user.data.username,
    };
  },

  async fetchMetrics(account, platformPostId) {
    try {
      const res = await fetch(
        `https://api.twitter.com/2/tweets/${platformPostId}?tweet.fields=public_metrics`,
        { headers: { Authorization: `Bearer ${account.access_token}` } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const m = data.data?.public_metrics;
      if (!m) return null;
      return {
        likes: m.like_count ?? 0,
        shares: m.retweet_count ?? 0,
        comments: m.reply_count ?? 0,
        impressions: m.impression_count ?? 0,
      };
    } catch {
      return null;
    }
  },

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) throw new Error(`Twitter token refresh failed: ${res.status}`);
    const tokens = await res.json();
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
    };
  },
};
