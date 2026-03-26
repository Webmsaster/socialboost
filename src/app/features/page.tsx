import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Discover SocialBoost features: AI post generation, image creation, video scripts, carousels, bulk generation, analytics, and more.",
};

const features = [
  {
    title: "AI Post Generation",
    description:
      "Generate engaging social media posts for LinkedIn, Facebook, Instagram, Pinterest, and X with a single click. Choose from 5 tones and multiple languages.",
  },
  {
    title: "AI Image Generation",
    description:
      "Create stunning visuals with DALL-E 3 to accompany your posts. Professional, on-brand images generated in seconds.",
  },
  {
    title: "Video Script Generator",
    description:
      "Plan your Reels, TikToks, and Shorts with AI-generated scene-by-scene scripts including hooks, narration, and text overlays.",
  },
  {
    title: "Carousel Generator",
    description:
      "Design swipeable carousel content for LinkedIn and Instagram with slide headings, body text, and visual suggestions.",
  },
  {
    title: "Bulk Generation",
    description:
      "Generate posts for multiple platforms at once. Pick your platforms, set the tone, and create up to 15 posts in one batch.",
  },
  {
    title: "A/B Variants",
    description:
      "Test different approaches to the same topic. Generate multiple variants with different angles to find what resonates.",
  },
  {
    title: "Content Calendar",
    description:
      "Drag and drop posts onto your calendar to schedule them. Visual overview of your entire content plan.",
  },
  {
    title: "Post Templates",
    description:
      "Save your favorite platform, tone, and topic combinations as templates. One-click generation from saved presets.",
  },
  {
    title: "Analytics Dashboard",
    description:
      "Track your content performance with breakdowns by platform, tone, and status. Weekly activity charts and insights.",
  },
  {
    title: "Dark Mode",
    description:
      "Full dark mode support throughout the app. Easy on the eyes during late-night content creation sessions.",
  },
];

export default function FeaturesPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-24">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Everything you need for social media
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          SocialBoost combines AI-powered content generation with scheduling and
          analytics to streamline your social media workflow.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {features.map((feature) => (
          <div key={feature.title} className="rounded-xl border p-6 space-y-2">
            <h2 className="text-xl font-semibold">{feature.title}</h2>
            <p className="text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Get started for free
        </Link>
      </div>
    </main>
  );
}
