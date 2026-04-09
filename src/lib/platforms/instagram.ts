import type { ConnectedAccount, PlatformPublisher, PublishOptions, PublishResult } from "./index";

/**
 * Instagram Publishing via Facebook Graph API.
 * Requires a Facebook App with instagram_basic + instagram_content_publish permissions.
 * The connected account's platform_user_id should be the Instagram Business Account ID.
 * The access_token is a Facebook Page token with IG permissions.
 */
export const instagramPublisher: PlatformPublisher = {
  async publish(
    account: ConnectedAccount,
    content: string,
    hashtags?: string[],
    options?: PublishOptions
  ): Promise<PublishResult> {
    const caption = hashtags?.length
      ? `${content}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
      : content;

    const igAccountId = account.platform_user_id;

    if (!options?.mediaUrl) {
      return {
        success: false,
        error: "Instagram requires an image. Attach media_url to the post before publishing.",
      };
    }

    try {
      // Step 1: Create a media container with the image URL
      const containerRes = await fetch(
        `https://graph.facebook.com/v19.0/${igAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caption,
            image_url: options.mediaUrl,
            access_token: account.access_token,
          }),
        }
      );

      if (!containerRes.ok) {
        const error = await containerRes.text();
        return { success: false, error: `Instagram container error: ${containerRes.status} ${error}` };
      }

      const container = await containerRes.json();

      // Step 2: Publish the container
      const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: container.id,
            access_token: account.access_token,
          }),
        }
      );

      if (!publishRes.ok) {
        const error = await publishRes.text();
        return { success: false, error: `Instagram publish error: ${publishRes.status} ${error}` };
      }

      const data = await publishRes.json();
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
      scope: "instagram_basic,instagram_content_publish,pages_show_list",
      response_type: "code",
    });
    return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
  },

  async exchangeCode(code: string, redirectUri: string) {
    // Step 1: Exchange code for short-lived token (same as Facebook)
    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", process.env.FACEBOOK_APP_ID!);
    tokenUrl.searchParams.set("client_secret", process.env.FACEBOOK_APP_SECRET!);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl);
    if (!tokenRes.ok) throw new Error(`Instagram token exchange failed: ${tokenRes.status}`);
    const tokens = await tokenRes.json();

    // Step 2: Get user's Facebook pages
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${tokens.access_token}`
    );
    const pages = await pagesRes.json();
    const page = pages.data?.[0];

    if (!page) throw new Error("No Facebook Page found. Instagram Business requires a linked Facebook Page.");

    // Step 3: Get Instagram Business Account ID from the page
    const igRes = await fetch(
      `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
    );
    const igData = await igRes.json();
    const igAccountId = igData.instagram_business_account?.id;

    if (!igAccountId) throw new Error("No Instagram Business Account linked to this Facebook Page.");

    // Step 4: Get IG username
    const igProfileRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}?fields=username&access_token=${page.access_token}`
    );
    const igProfile = await igProfileRes.json();

    return {
      accessToken: page.access_token,
      platformUserId: igAccountId,
      platformUsername: igProfile.username,
    };
  },
};
