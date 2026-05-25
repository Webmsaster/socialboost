/**
 * Premium feature gating. Routes that require a Pro subscription
 * should call requirePro() before processing the request.
 */

const PRO_ONLY_FEATURES = new Set([
  "/api/generate-image",
  "/api/generate-carousel",
  "/api/generate-video-script",
  "/api/generate-video-ad",
  "/api/generate-variants",
]);

export function isProFeature(endpoint: string): boolean {
  return PRO_ONLY_FEATURES.has(endpoint);
}

export function isProSubscription(status: string | null | undefined): boolean {
  return status === "active";
}

// Video quotas live separately from text-generation quota because a video
// costs ~$0.30 of OpenAI (gpt-image-1 × scenes + TTS) vs ~$0.001 for a text
// post. Without a separate cap a single Pro user can burn through more than
// the subscription revenue ($9/mo) in a few days of heavy video usage.
export const VIDEO_QUOTA_FREE = 0;
export const VIDEO_QUOTA_PRO = 5;

export function videoQuotaFor(status: string | null | undefined): number {
  return isProSubscription(status) ? VIDEO_QUOTA_PRO : VIDEO_QUOTA_FREE;
}
