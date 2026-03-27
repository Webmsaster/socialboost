export type PlatformId = "linkedin" | "facebook" | "instagram" | "pinterest" | "twitter";

export interface PublishResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

export interface ConnectedAccount {
  id: string;
  platform: PlatformId;
  platform_user_id: string;
  platform_username: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  page_id: string | null;
}

export interface PlatformPublisher {
  publish(account: ConnectedAccount, content: string, hashtags?: string[]): Promise<PublishResult>;
  getAuthUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    platformUserId: string;
    platformUsername?: string;
  }>;
}

export const platformConfigs: Record<PlatformId, {
  name: string;
  color: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  scopes: string;
}> = {
  linkedin: {
    name: "LinkedIn",
    color: "bg-blue-600",
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    scopes: "openid profile w_member_social",
  },
  facebook: {
    name: "Facebook",
    color: "bg-blue-500",
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_APP_SECRET",
    scopes: "pages_manage_posts,pages_read_engagement",
  },
  instagram: {
    name: "Instagram",
    color: "bg-pink-500",
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_APP_SECRET",
    scopes: "instagram_basic,instagram_content_publish",
  },
  pinterest: {
    name: "Pinterest",
    color: "bg-red-500",
    clientIdEnv: "PINTEREST_CLIENT_ID",
    clientSecretEnv: "PINTEREST_CLIENT_SECRET",
    scopes: "boards:read,pins:read,pins:write",
  },
  twitter: {
    name: "Twitter / X",
    color: "bg-neutral-800",
    clientIdEnv: "TWITTER_CLIENT_ID",
    clientSecretEnv: "TWITTER_CLIENT_SECRET",
    scopes: "tweet.read tweet.write users.read offline.access",
  },
};
