import type { ConnectedAccount, PlatformPublisher, PublishOptions, PublishResult } from "./index";

export const facebookPublisher: PlatformPublisher = {
  async publish(
    account: ConnectedAccount,
    content: string,
    hashtags?: string[],
    options?: PublishOptions
  ): Promise<PublishResult> {
    const fullText = hashtags?.length
      ? `${content}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
      : content;

    const pageId = account.page_id || account.platform_user_id;

    try {
      // With media: use /photos endpoint. Without: /feed for text-only posts.
      const endpoint = options?.mediaUrl
        ? `https://graph.facebook.com/v19.0/${pageId}/photos`
        : `https://graph.facebook.com/v19.0/${pageId}/feed`;
      const body: Record<string, string> = {
        access_token: account.access_token,
      };
      if (options?.mediaUrl) {
        body.url = options.mediaUrl;
        body.caption = fullText;
      } else {
        body.message = fullText;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    if (!userRes.ok) throw new Error(`Facebook profile fetch failed: ${userRes.status}`);
    const user = await userRes.json();
    if (!user?.id) throw new Error("Facebook profile response missing id");

    return {
      accessToken: tokens.access_token,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
      platformUserId: user.id,
      platformUsername: user.name,
    };
  },

  async fetchMetrics(account, platformPostId) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${platformPostId}/insights?metric=post_impressions,post_reactions_like_total&access_token=${account.access_token}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      const findMetric = (name: string): number =>
        data.data?.find((d: { name: string; values: { value: number }[] }) => d.name === name)?.values?.[0]?.value ?? 0;
      return {
        likes: findMetric("post_reactions_like_total"),
        shares: 0,
        comments: 0,
        impressions: findMetric("post_impressions"),
      };
    } catch {
      return null;
    }
  },
};
