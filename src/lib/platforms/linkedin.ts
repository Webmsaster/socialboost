import type { ConnectedAccount, PlatformPublisher, PublishResult } from "./index";

export const linkedinPublisher: PlatformPublisher = {
  async publish(account: ConnectedAccount, content: string, hashtags?: string[]): Promise<PublishResult> {
    const fullText = hashtags?.length
      ? `${content}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
      : content;

    try {
      const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author: `urn:li:person:${account.platform_user_id}`,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: fullText },
              shareMediaCategory: "NONE",
            },
          },
          visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        return { success: false, error: `LinkedIn API error: ${res.status} ${error}` };
      }

      const data = await res.json();
      return { success: true, platformPostId: data.id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) throw new Error("LINKEDIN_CLIENT_ID not configured");

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: "openid profile w_member_social",
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  },

  async exchangeCode(code: string, redirectUri: string) {
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${res.status}`);
    const tokens = await res.json();

    // Get user profile
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) throw new Error(`LinkedIn profile fetch failed: ${profileRes.status}`);
    const profile = await profileRes.json();
    if (!profile?.sub) throw new Error("LinkedIn profile response missing sub");

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
      platformUserId: profile.sub,
      platformUsername: profile.name,
    };
  },

  async fetchMetrics(account, platformPostId) {
    // LinkedIn requires socialActions endpoint for basic engagement stats
    try {
      const encoded = encodeURIComponent(platformPostId);
      const res = await fetch(
        `https://api.linkedin.com/v2/socialActions/${encoded}`,
        { headers: { Authorization: `Bearer ${account.access_token}` } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return {
        likes: data.likesSummary?.totalLikes ?? 0,
        shares: 0,
        comments: data.commentsSummary?.aggregatedTotalComments ?? 0,
        impressions: 0,
      };
    } catch {
      return null;
    }
  },

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });
    if (!res.ok) throw new Error(`LinkedIn token refresh failed: ${res.status}`);
    const tokens = await res.json();
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
    };
  },
};
