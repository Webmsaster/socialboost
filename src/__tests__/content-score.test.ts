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

  describe("cliché word-boundary matching", () => {
    const hasClicheTip = (tips: string[], phrase: string) =>
      tips.some((t) => t.includes(`Replace "${phrase}"`));

    it.each(["elevated", "transformation", "empowering"])(
      "does NOT flag %s (cliché only as a substring)",
      (word) => {
        const out = scoreContent({
          content: `Our team ${word} the whole onboarding flow for new customers last quarter.`,
          platform: "facebook",
        });
        const anyClicheTip = out.tips.some((t) => t.includes("Sounds less AI-generated"));
        expect(anyClicheTip).toBe(false);
      },
    );

    it("flags a standalone 'elevate'", () => {
      const out = scoreContent({
        content: "We elevate your brand with content that actually converts readers.",
        platform: "facebook",
      });
      expect(hasClicheTip(out.tips, "elevate")).toBe(true);
    });

    it("flags a standalone 'leverage'", () => {
      const out = scoreContent({
        content: "We leverage data to ship features that customers genuinely want.",
        platform: "facebook",
      });
      expect(hasClicheTip(out.tips, "leverage")).toBe(true);
    });

    it("still flags multi-word 'in today's fast-paced world'", () => {
      const out = scoreContent({
        content:
          "In today's fast-paced world, your customers expect answers in seconds, not days.",
        platform: "facebook",
      });
      expect(hasClicheTip(out.tips, "in today's fast-paced world")).toBe(true);
    });

    it("still flags hyphenated 'game-changer'", () => {
      const out = scoreContent({
        content: "This new workflow has been a real game-changer for our small support team.",
        platform: "facebook",
      });
      expect(hasClicheTip(out.tips, "game-changer")).toBe(true);
    });
  });
});
