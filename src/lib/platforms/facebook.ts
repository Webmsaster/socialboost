import type { ConnectedAccount, PlatformPublisher, PublishResult } from "./index";

export const facebookPublisher: PlatformPublisher = {
  async publish(account: ConnectedAccount, content: string, hashtags?: string[]): Promise<PublishResult> {
    const fullText = hashtags?.length
      ? `${content}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
      : content;

    const pageId = account.page_id || account.platform_user_id;

    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: fullText,
          access_token: account.access_token,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        return { success: false, error: `Facebook API error: ${res.status} ${error}` };
      }

      const data = await res.json();
      return { success: true, platformPostId: data.id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env.FACEBOOK_APP_ID;
    if (!clientId) throw new Error("FACEBOOK_APP_ID not configured");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: "pages_manage_posts,pages_read_engagement",
      response_type: "code",
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
  },

  async exchangeCode(code: string, redirectUri: string) {
    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", process.env.FACEBOOK_APP_ID!);
    tokenUrl.searchParams.set("client_secret", process.env.FACEBOOK_APP_SECRET!);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl);
    if (!tokenRes.ok) throw new Error(`Facebook token exchange failed: ${tokenRes.status}`);
    const tokens = await tokenRes.json();

    const userRes = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${tokens.access_token}`);
    const user = await userRes.json();

    return {
      accessToken: tokens.access_token,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
      platformUserId: user.id,
      platformUsername: user.name,
    };
  },
};
