import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "See what is new in SocialBoost. Latest features, improvements, and bug fixes.",
};

const releases = [
  {
    version: "1.7.0",
    date: "2026-04-11",
    title: "Content Intelligence & Automation",
    changes: [
      "Content Series: set up recurring posts (daily, weekly, biweekly, monthly) with custom schedules",
      "Content Repurposing UI: adapt posts for different platforms with one click",
      "AI Content Score: instant 1-100 scoring with platform-specific optimization tips",
      "Performance Insights: discover best platform, tone, posting day, and top hashtags",
      "Auto-Schedule: distribute drafts to optimal time slots based on engagement data",
      "Dashboard quick actions for fast navigation to key features",
    ],
  },
  {
    version: "1.6.0",
    date: "2026-04-11",
    title: "Team Management & Admin",
    changes: [
      "Team member list with avatars, roles, and join dates",
      "Pending invites view with revoke option",
      "Remove team members (admin/owner only)",
      "Admin user management: search, browse, and view user details",
      "Server-side notification preferences (no more localStorage dependency)",
      "Updated features page with 16 features",
    ],
  },
  {
    version: "1.5.0",
    date: "2026-04-01",
    title: "Team Collaboration & Referrals",
    changes: [
      "Team workspaces with invite system and role management",
      "Referral program: earn 10 bonus generations per referral",
      "Keyboard shortcuts for power users (press ? to view)",
      "Cookie consent banner for GDPR compliance",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-03-27",
    title: "Video & Carousel Generation",
    changes: [
      "Video script generator for Reels, TikTok, and Shorts",
      "Video ad storyboard creator with frame-by-frame output",
      "Carousel generator for LinkedIn and Instagram",
      "A/B variant generation to test different approaches",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-03-20",
    title: "Analytics & Performance",
    changes: [
      "Analytics dashboard with post metrics and trends",
      "Performance tracking: likes, shares, comments, impressions",
      "Weekly activity charts and platform breakdowns",
      "Content score calculation for published posts",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-03-15",
    title: "AI Images & Templates",
    changes: [
      "AI image generation powered by DALL-E 3",
      "Post templates: save, reuse, and manage your best prompts",
      "Bulk generation: create a full week of content in one click",
      "Content repurposing across platforms",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-03-10",
    title: "Calendar & Scheduling",
    changes: [
      "Visual content calendar with drag-and-drop scheduling",
      "Platform account connections (LinkedIn, Facebook, Instagram, Pinterest, X)",
      "Scheduled post publishing via cron",
      "Post history with search, filter, and CSV/TXT export",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-03-01",
    title: "Initial Launch",
    changes: [
      "AI-powered post generation for 5 platforms",
      "5 tone options: professional, casual, inspirational, humorous, educational",
      "Free plan (10 generations/month) and Pro plan ($9/month)",
      "Stripe payment integration with billing portal",
      "Dark/light mode and bilingual UI (English/German)",
      "Blog with 6 SEO-optimized articles",
    ],
  },
];

export default function ChangelogPage() {
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
        <h1 className="text-3xl font-bold">Changelog</h1>
        <p className="mt-4 text-muted-foreground">
          New features, improvements, and fixes. We ship updates regularly.
        </p>

        <div className="mt-12 space-y-12">
          {releases.map((release) => (
            <article key={release.version} className="relative pl-8 border-l-2 border-muted">
              <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-primary bg-background" />
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary">
                  v{release.version}
                </span>
                <time className="text-sm text-muted-foreground">{release.date}</time>
              </div>
              <h2 className="mt-2 text-xl font-semibold">{release.title}</h2>
              <ul className="mt-3 space-y-1.5">
                {release.changes.map((change) => (
                  <li key={change} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    {change}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} SocialBoost. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
