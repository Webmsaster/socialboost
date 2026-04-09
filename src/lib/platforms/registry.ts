import type { ConnectedAccount, PlatformId, PlatformPublisher } from "./index";
import { linkedinPublisher } from "./linkedin";
import { twitterPublisher } from "./twitter";
import { facebookPublisher } from "./facebook";
import { instagramPublisher } from "./instagram";
import { pinterestPublisher } from "./pinterest";

const publishers: Partial<Record<PlatformId, PlatformPublisher>> = {
  linkedin: linkedinPublisher,
  twitter: twitterPublisher,
  facebook: facebookPublisher,
  instagram: instagramPublisher,
  pinterest: pinterestPublisher,
};

export function getPublisher(platform: PlatformId): PlatformPublisher | null {
  return publishers[platform] ?? null;
}

export function isPublishingSupported(platform: PlatformId): boolean {
  return platform in publishers;
}

/** Token is considered expiring if it expires within 5 minutes. */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

/**
 * Refresh the access token if it is expiring soon. Returns the (possibly
 * updated) account. Caller is responsible for persisting changes.
 */
export async function ensureFreshToken(
  account: ConnectedAccount
): Promise<{ account: ConnectedAccount; refreshed: boolean }> {
  if (!account.token_expires_at || !account.refresh_token) {
    return { account, refreshed: false };
  }
  const expiresAt = new Date(account.token_expires_at).getTime();
  if (Number.isNaN(expiresAt)) return { account, refreshed: false };
  if (expiresAt - Date.now() > EXPIRY_BUFFER_MS) {
    return { account, refreshed: false };
  }

  const publisher = getPublisher(account.platform);
  if (!publisher?.refreshAccessToken) return { account, refreshed: false };

  const fresh = await publisher.refreshAccessToken(account.refresh_token);
  const updated: ConnectedAccount = {
    ...account,
    access_token: fresh.accessToken,
    refresh_token: fresh.refreshToken ?? account.refresh_token,
    token_expires_at: fresh.expiresAt?.toISOString() ?? account.token_expires_at,
  };
  return { account: updated, refreshed: true };
}
