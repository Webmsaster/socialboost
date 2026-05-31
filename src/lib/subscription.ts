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

// "past_due" is intentionally treated as entitled. When a renewal payment
// fails, Stripe keeps the subscription in `past_due` and runs Smart Retries
// (often over several days). Cutting off Pro access the instant a payment
// blips — when the card will likely succeed on retry — causes avoidable churn
// and support load. Access is only revoked once Stripe gives up and the
// subscription becomes `canceled`/`unpaid` (the webhook maps both to
// "canceled"). Keep this the single source of truth for entitlement.
export function isProSubscription(status: string | null | undefined): boolean {
  return status === "active" || status === "past_due";
}

// Monthly text-generation quota (base plan allowance, before referral
// bonus_generations are added). Single source of truth so routes never
// hardcode 10/100 — see src/app/api/*/route.ts.
export const TEXT_QUOTA_FREE = 10;
export const TEXT_QUOTA_PRO = 100;

export function textQuotaFor(status: string | null | undefined): number {
  return isProSubscription(status) ? TEXT_QUOTA_PRO : TEXT_QUOTA_FREE;
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
