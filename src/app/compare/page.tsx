import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SocialBoost vs. Alternatives: Feature Comparison",
  description:
    "Compare SocialBoost with Buffer, Hootsuite, and Later. See why solopreneurs and small teams choose SocialBoost for AI-powered content generation and scheduling.",
};

const features = [
  {
    category: "AI Generation",
    rows: [
      { feature: "AI post generation", socialBoost: true, buffer: "Limited", hootsuite: "Limited", later: false },
      { feature: "Brand voice customization", socialBoost: true, buffer: false, hootsuite: false, later: false },
      { feature: "Carousel generator", socialBoost: true, buffer: false, hootsuite: false, later: false },
      { feature: "Video script generator", socialBoost: true, buffer: false, hootsuite: false, later: false },
      { feature: "Video ad storyboard", socialBoost: true, buffer: false, hootsuite: false, later: false },
      { feature: "Content repurposing", socialBoost: true, buffer: false, hootsuite: false, later: false },
      { feature: "AI image generation (DALL-E)", socialBoost: true, buffer: false, hootsuite: false, later: false },
    ],
  },
  {
    category: "Scheduling & Publishing",
    rows: [
      { feature: "5 platform support", socialBoost: true, buffer: true, hootsuite: true, later: true },
      { feature: "Drag-and-drop calendar", socialBoost: true, buffer: true, hootsuite: true, later: true },
      { feature: "Bulk scheduling", socialBoost: true, buffer: "Pro", hootsuite: "Pro", later: "Pro" },
      { feature: "OAuth connections", socialBoost: true, buffer: true, hootsuite: true, later: true },
    ],
  },
  {
    category: "Collaboration",
    rows: [
      { feature: "Team workspaces", socialBoost: true, buffer: "Pro", hootsuite: "Pro", later: "Pro" },
      { feature: "Role-based access", socialBoost: true, buffer: "Pro", hootsuite: "Pro", later: "Pro" },
      { feature: "Templates library", socialBoost: true, buffer: false, hootsuite: "Pro", later: false },
    ],
  },
  {
    category: "Pricing",
    rows: [
      { feature: "Free plan", socialBoost: "10 posts/mo", buffer: "3 accounts", hootsuite: false, later: "30 posts" },
      { feature: "Entry Pro price", socialBoost: "$9/mo", buffer: "$15/mo", hootsuite: "$99/mo", later: "$25/mo" },
      { feature: "Annual discount", socialBoost: "27%", buffer: "20%", hootsuite: "15%", later: "20%" },
    ],
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "SocialBoost vs. Alternatives",
  description:
    "Feature comparison between SocialBoost and competing social media management tools.",
};

function Cell({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (value === false) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="text-sm text-muted-foreground">{value}</span>;
}

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            How does SocialBoost compare?
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            We&apos;re not trying to be the biggest — we&apos;re trying to be
            the best value for solo operators and small teams. Here&apos;s
            how we stack up.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="p-4 text-left text-sm font-semibold">Feature</th>
                <th className="p-4 text-center text-sm font-semibold text-primary">
                  SocialBoost
                </th>
                <th className="p-4 text-center text-sm font-semibold text-muted-foreground">
                  Buffer
                </th>
                <th className="p-4 text-center text-sm font-semibold text-muted-foreground">
                  Hootsuite
                </th>
                <th className="p-4 text-center text-sm font-semibold text-muted-foreground">
                  Later
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((category) => (
                <Fragment key={category.category}>
                  <tr className="bg-muted/10">
                    <td colSpan={5} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {category.category}
                    </td>
                  </tr>
                  {category.rows.map((row) => (
                    <tr
                      key={`${category.category}-${row.feature}`}
                      className="border-t"
                    >
                      <td className="p-4 text-sm">{row.feature}</td>
                      <td className="p-4 text-center">
                        <Cell value={row.socialBoost} />
                      </td>
                      <td className="p-4 text-center">
                        <Cell value={row.buffer} />
                      </td>
                      <td className="p-4 text-center">
                        <Cell value={row.hootsuite} />
                      </td>
                      <td className="p-4 text-center">
                        <Cell value={row.later} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Comparison data based on publicly available pricing and feature
          lists as of April 2026. Competitor features change frequently —
          check their sites for current information.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border p-6">
            <h2 className="text-xl font-bold">Why SocialBoost wins on AI</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We built SocialBoost around AI generation from day one. Buffer
              and Hootsuite added AI features as afterthoughts — limited
              templates and generic output. SocialBoost generates
              platform-optimized drafts with your brand voice, plus
              specialized formats like carousels, video scripts, and video
              ad storyboards that competitors don&apos;t offer at all.
            </p>
          </div>
          <div className="rounded-xl border p-6">
            <h2 className="text-xl font-bold">Why SocialBoost wins on price</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Hootsuite starts at $99/month. Buffer&apos;s Essentials plan
              is $15. SocialBoost Pro is $9/month with more AI features
              than either, and our annual plan saves 27% — more than any
              competitor offers. We keep prices low because we run lean
              and reinvest customer revenue into shipping faster.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-xl border bg-muted/30 p-8 text-center">
          <h2 className="text-2xl font-bold">See it for yourself</h2>
          <p className="mt-3 text-muted-foreground">
            Start with 10 free generations per month. No credit card
            required. Cancel any paid plan anytime.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Try SocialBoost free
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
