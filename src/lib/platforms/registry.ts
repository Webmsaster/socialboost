import type { PlatformId, PlatformPublisher } from "./index";
import { linkedinPublisher } from "./linkedin";
import { twitterPublisher } from "./twitter";
import { facebookPublisher } from "./facebook";

const publishers: Partial<Record<PlatformId, PlatformPublisher>> = {
  linkedin: linkedinPublisher,
  twitter: twitterPublisher,
  facebook: facebookPublisher,
};

export function getPublisher(platform: PlatformId): PlatformPublisher | null {
  return publishers[platform] ?? null;
}

export function isPublishingSupported(platform: PlatformId): boolean {
  return platform in publishers;
}
