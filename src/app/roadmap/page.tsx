import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "What's shipped, what we're building, and what's next on the SocialBoost roadmap. Public and transparent — we ship weekly.",
};

interface RoadmapItem {
  title: string;
  description: string;
}

const shipped: RoadmapItem[] = [
  { title: "AI post generation for 5 platforms", description: "LinkedIn, Facebook, Instagram, Pinterest, Twitter/X with 5 tones and multi-language." },
  { title: "Brand voice customization", description: "Save a brand voice description that every generation uses as context." },
  { title: "Carousel generator", description: "Multi-slide Instagram carousel posts with consistent design and narrative." },
  { title: "Video script generator", description: "Short-form video scripts optimized for TikTok, Reels, and Shorts." },
  { title: "Video ad storyboard", description: "Scene-by-scene video ad storyboards with voiceover and visual directions." },
  { title: "Bulk generation", description: "Batch-generate posts from a topic list to plan weeks of content at once." },
  { title: "Post templates", description: "Save and reuse your best-performing content formats." },
  { title: "Content repurposing", description: "Turn one post into 5 platform-ready variants automatically." },
  { title: "A/B variants", description: "Generate multiple versions of the same post to test what works." },
  { title: "Calendar with drag-and-drop scheduling", description: "Visual calendar to schedule and reorder posts across platforms." },
  { title: "OAuth platform publishers", description: "Connect LinkedIn, Facebook, Instagram, Pinterest, and Twitter/X to publish directly." },
  { title: "Analytics dashboard", description: "Track post performance with visual breakdowns per platform and status." },
  { title: "Team collaboration", description: "Invite colleagues to organizations with role-based access." },
  { title: "Referral program", description: "Earn bonus generations for every friend you bring to SocialBoost." },
  { title: "Stripe billing", description: "Monthly and annual Pro plans with billing portal, checkout, and webhooks." },
  { title: "Blog with SEO articles", description: "14 in-depth posts on social media strategy with JSON-LD and OG images." },
  { title: "RSS feed", description: "Subscribe to blog updates via any RSS reader." },
  { title: "Admin dashboard", description: "Internal admin view with MRR, user counts, activity metrics, and user management." },
  { title: "Cookie consent + GDPR data export", description: "Full GDPR compliance with opt-in analytics and data portability." },
  { title: "Dark mode, i18n (EN/DE), keyboard shortcuts", description: "Polished UX for power users." },
  { title: "Content Series", description: "Set up recurring content themes (daily, weekly, biweekly, monthly) that generate automatically." },
  { title: "Content Repurposing UI", description: "Full dashboard page for adapting posts to multiple platforms with AI." },
  { title: "AI Content Score", description: "Instant 1-100 scoring with platform-specific tips after every generation." },
  { title: "Performance Insights", description: "Best platform, tone, day, top hashtags, and content length analysis from your data." },
  { title: "Auto-Scheduling", description: "One-click distribution of drafts to optimal time slots per platform." },
  { title: "Team member management", description: "Member list, pending invites, remove/revoke, role badges." },
  { title: "Server-side notification preferences", description: "Preferences sync across devices, no more localStorage dependency." },
];

const inProgress: RoadmapItem[] = [
  { title: "Newsletter subscription", description: "Capture emails on the blog — backend shipped, migration pending." },
  { title: "Content pillars suggester", description: "AI-suggested content pillars based on your brand and audience." },
];

const planned: RoadmapItem[] = [
  { title: "Thumbnail/cover image generator", description: "DALL-E-powered blog and YouTube thumbnails with brand consistency." },
  { title: "Team approval workflow", description: "Draft → review → approve → publish with role-based checkpoints." },
  { title: "Chrome extension", description: "Generate content directly from any webpage — highlight text to post about it." },
  { title: "Slack and Notion integrations", description: "Push generated posts to Slack for team review or Notion for planning." },
  { title: "Custom GPT fine-tuning", description: "Train a personal model on your past posts for ultra-consistent voice." },
  { title: "Competitor tracking", description: "Monitor competitor posts and auto-generate response content." },
  { title: "Multi-language UI expansion", description: "French, Spanish, Italian, and Portuguese interface translations." },
];

interface RoadmapSectionProps {
  title: string;
  description: string;
  items: RoadmapItem[];
  badgeColor: string;
  badgeLabel: string;
}

function RoadmapSection({
  title,
  description,
  items,
  badgeColor,
  badgeLabel,
}: RoadmapSectionProps) {
  return (
    <section className="mt-12">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">{title}</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}
        >
          {badgeLabel}
        </span>
      </div>
      <p className="mt-2 text-muted-foreground">{description}</p>
      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li key={item.title} className="rounded-xl border p-4">
            <h3 className="font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              S
            </div>
            <span className="text-xl font-bold">SocialBoost</span>
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Get started free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Public Roadmap
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            What&apos;s shipped, what we&apos;re building, what&apos;s next.
            We ship weekly.
          </p>
        </div>

        <RoadmapSection
          title="Shipped"
          description="Features live in production and available to all users."
          items={shipped}
          badgeColor="bg-green-500/10 text-green-600 dark:text-green-400"
          badgeLabel={`${shipped.length} shipped`}
        />

        <RoadmapSection
          title="In Progress"
          description="Currently in development — expect these in the next few weeks."
          items={inProgress}
          badgeColor="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
          badgeLabel={`${inProgress.length} in progress`}
        />

        <RoadmapSection
          title="Planned"
          description="On the horizon. Priorities shift based on customer feedback — reach out if something is important to you."
          items={planned}
          badgeColor="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          badgeLabel={`${planned.length} planned`}
        />

        <div className="mt-16 rounded-xl border bg-muted/30 p-8 text-center">
          <h2 className="text-2xl font-bold">
            Want to influence what&apos;s next?
          </h2>
          <p className="mt-3 text-muted-foreground">
            We build what our customers ask for. Reach out and let us know
            what would make SocialBoost more valuable to you.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Share your feedback
          </Link>
        </div>
      </main>

      <footer className="mt-16 border-t py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} SocialBoost. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
