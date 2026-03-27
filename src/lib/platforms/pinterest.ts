import type { ConnectedAccount, PlatformPublisher, PublishResult } from "./index";

/**
 * Pinterest Publishing via Pinterest API v5.
 * Requires a Pinterest App with pins:read, pins:write, boards:read scopes.
 * Posts are created as Pins on the user's first board (or page_id if set as board ID).
 */
export const pinterestPublisher: PlatformPublisher = {
  async publish(account: ConnectedAccount, content: string, hashtags?: string[]): Promise<PublishResult> {
    const description = hashtags?.length
      ? `${content}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
      : content;

    try {
      // Get a board to pin to (use stored board ID or fetch first board)
      let boardId = account.page_id;

      if (!boardId) {
        const boardsRes = await fetch("https://api.pinterest.com/v5/boards", {
          headers: { Authorization: `Bearer ${account.access_token}` },
        });
        if (!boardsRes.ok) {
          return { success: false, error: `Pinterest boards error: ${boardsRes.status}` };
        }
        const boards = await boardsRes.json();
        boardId = boards.items?.[0]?.id;
        if (!boardId) {
          return { success: false, error: "No Pinterest boards found. Create a board first." };
        }
      }

      // Create a pin (text-only pin with link)
      const res = await fetch("https://api.pinterest.com/v5/pins", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          board_id: boardId,
          description,
          title: content.slice(0, 100),
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        return { success: false, error: `Pinterest API error: ${res.status} ${error}` };
      }

      const data = await res.json();
      return { success: true, platformPostId: data.id };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  getAuthUrl(redirectUri: string, state: string): string {
    const clientId = process.env.PINTEREST_CLIENT_ID;
    if (!clientId) throw new Error("PINTEREST_CLIENT_ID not configured");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "boards:read,pins:read,pins:write",
      state,
    });
    return `https://www.pinterest.com/oauth/?${params}`;
  },

  async exchangeCode(code: string, redirectUri: string) {
    const credentials = Buffer.from(
      `${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`
    ).toString("base64");

    const res = await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) throw new Error(`Pinterest token exchange failed: ${res.status}`);
    const tokens = await res.json();

    // Get user profile
    const userRes = await fetch("https://api.pinterest.com/v5/user_account", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userRes.json();

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
      platformUserId: user.username || user.id,
      platformUsername: user.username,
    };
  },
};
