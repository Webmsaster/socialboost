import { describe, it, expect } from "vitest";
import { isProFeature, isProSubscription } from "@/lib/subscription";

describe("isProFeature", () => {
  it("returns true for pro-only endpoints", () => {
    expect(isProFeature("/api/generate-image")).toBe(true);
    expect(isProFeature("/api/generate-carousel")).toBe(true);
    expect(isProFeature("/api/generate-video-script")).toBe(true);
    expect(isProFeature("/api/generate-video-ad")).toBe(true);
    expect(isProFeature("/api/generate-variants")).toBe(true);
  });

  it("returns false for non-pro endpoints", () => {
    expect(isProFeature("/api/generate")).toBe(false);
    expect(isProFeature("/api/templates")).toBe(false);
    expect(isProFeature("/api/hashtags")).toBe(false);
    expect(isProFeature("/api/repurpose")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isProFeature("")).toBe(false);
  });
});

describe("isProSubscription", () => {
  it("returns true for active status", () => {
    expect(isProSubscription("active")).toBe(true);
  });

  it("returns false for other statuses", () => {
    expect(isProSubscription("canceled")).toBe(false);
    expect(isProSubscription("trialing")).toBe(false);
    expect(isProSubscription("past_due")).toBe(false);
    expect(isProSubscription("unpaid")).toBe(false);
    expect(isProSubscription("incomplete")).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(isProSubscription(null)).toBe(false);
    expect(isProSubscription(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isProSubscription("")).toBe(false);
  });
});
