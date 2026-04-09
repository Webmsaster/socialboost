import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Use Cases",
  description:
    "See how founders, freelancers, agencies, and small businesses use SocialBoost to stay consistent on social media without burning out.",
};

const useCases = [
  {
    persona: "Founders",
    headline: "Build in public without burning out",
    pain: "You&apos;re building a product and customers expect you to post regularly, but every minute spent writing is a minute not building.",
    solution:
      "Batch-generate a week of posts in 30 minutes. Share milestones, lessons learned, and product updates across LinkedIn, Twitter, and Threads without context-switching.",
    features: [
      "Brand voice that matches your personal style",
      "Content repurposing to turn 1 post into 5 platform variants",
      "Bulk generation for weekly batches",
      "Calendar scheduling to post while you work",
    ],
  },
  {
    persona: "Freelancers & Coaches",
    headline: "Stay top-of-mind with your audience",
    pain: "Your business depends on visibility, but writing LinkedIn posts between client work is exhausting. Consistency drops and so do inquiries.",
    solution:
      "Generate authority-building content that positions you as an expert. Templates let you reuse your best-performing formats without starting from scratch every week.",
    features: [
      "LinkedIn-optimized post formats",
      "Save templates for recurring content series",
      "Multiple tones (professional, educational, inspirational)",
      "Hashtag suggestions per post",
    ],
  },
  {
    persona: "Agencies",
    headline: "Scale content production across clients",
    pain: "Your team is drowning in client work. Copywriters are expensive, generic AI tools produce inconsistent results, and every client has different brand voices.",
    solution:
      "Create brand voices per client, generate first drafts instantly, and have your team edit and approve instead of starting from zero. Team collaboration keeps everyone in sync.",
    features: [
      "Per-client brand voice customization",
      "Team collaboration with role-based access",
      "Template library for recurring client deliverables",
      "Export to CSV for client approval workflows",
    ],
  },
  {
    persona: "Small Businesses",
    headline: "Professional content without a marketing hire",
    pain: "You need a social media presence to compete, but you can&apos;t justify the cost of an agency or in-house marketer. DIY is inconsistent and takes time away from running the business.",
    solution:
      "Generate professional-quality posts in minutes per day. Schedule a month in advance and focus on what you actually do. Analytics show what resonates so you can do more of it.",
    features: [
      "Platform-optimized posts for Facebook, Instagram, Google Business",
      "Analytics dashboard to track what works",
      "Bulk generation for monthly content calendars",
      "Carousel generator for multi-slide Instagram content",
    ],
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "SocialBoost Use Cases",
  description:
    "How founders, freelancers, agencies, and small businesses use SocialBoost.",
};

export default function UseCasesPage() {
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

      <main className="mx-auto max-w-4xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Built for real operators
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            See how different people use SocialBoost to stay consistent on
            social media without burning out.
          </p>
        </div>

        <div className="mt-16 space-y-12">
          {useCases.map((uc) => (
            <section key={uc.persona} className="rounded-2xl border p-8">
              <div className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {uc.persona}
              </div>
              <h2 className="mt-3 text-2xl font-bold">{uc.headline}</h2>
              <p
                className="mt-4 text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: uc.pain }}
              />
              <p className="mt-3">{uc.solution}</p>
              <div className="mt-6">
                <h3 className="text-sm font-semibold">Key features</h3>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {uc.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <svg
                        className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start your free trial
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
