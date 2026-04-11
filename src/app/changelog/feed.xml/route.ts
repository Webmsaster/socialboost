import { NextResponse } from "next/server";

// Inline releases data (mirrors changelog page)
const releases = [
  { version: "1.7.0", date: "2026-04-11", title: "Content Intelligence & Automation", changes: ["Content Series", "Repurposing UI", "AI Content Score", "Performance Insights", "Auto-Schedule", "Dashboard quick actions"] },
  { version: "1.6.0", date: "2026-04-11", title: "Team Management & Admin", changes: ["Team member list", "Pending invites", "Remove members", "Admin user management", "Server-side notifications", "16 features page"] },
  { version: "1.5.0", date: "2026-04-01", title: "Team Collaboration & Referrals", changes: ["Team workspaces", "Referral program", "Keyboard shortcuts", "Cookie consent"] },
  { version: "1.4.0", date: "2026-03-27", title: "Video & Carousel Generation", changes: ["Video script generator", "Video ad storyboard", "Carousel generator", "A/B variants"] },
  { version: "1.3.0", date: "2026-03-20", title: "Analytics & Performance", changes: ["Analytics dashboard", "Performance tracking", "Weekly activity charts", "Content score"] },
  { version: "1.2.0", date: "2026-03-15", title: "AI Images & Templates", changes: ["DALL-E 3 images", "Post templates", "Bulk generation", "Content repurposing"] },
  { version: "1.1.0", date: "2026-03-10", title: "Calendar & Scheduling", changes: ["Content calendar", "Platform connections", "Cron publishing", "Post history"] },
  { version: "1.0.0", date: "2026-03-01", title: "Initial Launch", changes: ["AI post generation", "5 tones", "Free & Pro plans", "Stripe billing", "Dark mode", "i18n"] },
];

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://socialboost.app";

export async function GET() {
  const items = releases.map((r) => `
    <item>
      <title>v${r.version} — ${r.title}</title>
      <link>${baseUrl}/changelog</link>
      <guid isPermaLink="false">socialboost-${r.version}</guid>
      <pubDate>${new Date(r.date).toUTCString()}</pubDate>
      <description><![CDATA[<ul>${r.changes.map((c) => `<li>${c}</li>`).join("")}</ul>]]></description>
    </item>`).join("");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>SocialBoost Changelog</title>
    <link>${baseUrl}/changelog</link>
    <description>New features, improvements, and fixes in SocialBoost.</description>
    <language>en</language>
    <atom:link href="${baseUrl}/changelog/feed.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new NextResponse(rss, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
