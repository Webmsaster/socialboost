import { describe, it, expect } from "vitest";
import { scoreContent } from "@/lib/content-score";

describe("scoreContent", () => {
  it("clamps the score to [10, 100]", () => {
    const out = scoreContent({ content: "x", platform: "twitter" });
    expect(out.score).toBeGreaterThanOrEqual(10);
    expect(out.score).toBeLessThanOrEqual(100);
  });

  it("rewards an ideal-length LinkedIn post with hook + CTA + line breaks", () => {
    const content = `Why are solopreneurs winning in 2026?\n\nThree reasons. First, they move fast. Second, they own their audience. Third, they stack AI tools.\n\nDM me if you want the full breakdown.`;
    const out = scoreContent({
      content,
      platform: "linkedin",
      hashtags: ["solopreneur", "ai", "growth"],
    });
    expect(out.score).toBeGreaterThanOrEqual(80);
    expect(out.tips.some((t) => t.toLowerCase().includes("great post"))).toBe(true);
  });

  it("penalizes Twitter posts over the character limit", () => {
    const out = scoreContent({
      content: "x".repeat(400),
      platform: "twitter",
    });
    expect(out.tips.some((t) => t.includes("character limit"))).toBe(true);
    expect(out.score).toBeLessThan(70);
  });

  it("flags Instagram posts with too few hashtags", () => {
    const out = scoreContent({
      content: "A short caption that introduces my new product launch event.",
      platform: "instagram",
      hashtags: ["launch"],
    });
    expect(out.tips.some((t) => t.toLowerCase().includes("5-15 relevant hashtags"))).toBe(
      true,
    );
  });

  it("falls back to facebook limits for unknown platforms", () => {
    const out = scoreContent({
      content: "Solid post about a new product release for the upcoming season.",
      platform: "tiktok",
    });
    expect(out.metrics.idealLength).toBe(400); // facebook ideal
    expect(out.metrics.maxLength).toBe(2000); // facebook max
  });
});
