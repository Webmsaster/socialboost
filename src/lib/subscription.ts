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
