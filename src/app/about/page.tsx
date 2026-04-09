import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About SocialBoost",
  description:
    "Learn about SocialBoost's mission to make great social media content accessible to everyone with AI-powered tools built for creators, marketers, and small businesses.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About SocialBoost",
  description:
    "SocialBoost makes great social media content accessible to everyone with AI-powered tools built for creators, marketers, and small businesses.",
  publisher: {
    "@type": "Organization",
    name: "SocialBoost",
    url: "https://socialboost.app",
  },
};

const values = [
  {
    title: "Authentic, not automated",
    description:
      "AI should amplify your voice, not replace it. Every feature is designed to help you say what you actually want to say, faster.",
  },
  {
    title: "Built for solo operators",
    description:
      "We optimize for the person running everything themselves — the founder, freelancer, or small team without a content department.",
  },
  {
    title: "Privacy by default",
    description:
      "Your content is yours. We never use customer data to train models, and all data is encrypted at rest and in transit.",
  },
  {
    title: "Ship weekly, iterate fast",
    description:
      "We release improvements every week based on direct customer feedback. You can see everything in our public changelog.",
  },
];

export default function AboutPage() {
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

      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Our mission
          </h1>
          <p className="mt-4 text-xl text-muted-foreground">
            Make great social media content accessible to everyone.
          </p>
        </div>

        <div className="prose prose-neutral dark:prose-invert mt-16 max-w-none">
          <h2>Why we built SocialBoost</h2>
          <p>
            Most social media tools are built for enterprise marketing teams
            with dedicated copywriters, designers, and strategists. That is not
            how most businesses actually operate. The average founder,
            freelancer, or small business owner is doing marketing on the side
            of their real job — and great content often gets sacrificed to the
            urgent.
          </p>
          <p>
            SocialBoost exists because we felt that gap ourselves. We wanted
            to post consistently across platforms without hiring an agency or
            spending hours staring at a blank compose box. Existing AI tools
            produced bland, generic content that felt nothing like us.
            Scheduling tools assumed you already had the content. Nothing
            connected the dots.
          </p>
          <p>
            So we built a tool that starts with the hardest part — figuring
            out what to say — and gives you platform-optimized drafts in
            seconds. You still edit and approve every post, but the blank-
            page problem disappears.
          </p>

          <h2>Who SocialBoost is for</h2>
          <p>
            We built SocialBoost for the solo operators and small teams:
            founders building in public, freelancers who need to look busy on
            LinkedIn, coaches who want to stay top-of-mind with their
            audience, agencies managing multiple clients, and small businesses
            that need a social presence without a dedicated marketing hire.
          </p>
          <p>
            If you have ever put off posting because you did not know what to
            write, SocialBoost is for you.
          </p>

          <h2>How we work</h2>
          <p>
            SocialBoost is built by a small team that uses the product every
            day. We ship updates weekly and publish everything in our public
            changelog. Every feature starts from a real customer pain point,
            and we measure success in time saved, not features shipped.
          </p>
          <p>
            We also believe in a sustainable business. SocialBoost is funded
            entirely by subscription revenue — no venture capital, no
            advertising, no selling your data. If you love the product and
            upgrade to Pro, you are directly funding its continued
            development.
          </p>
        </div>

        <div className="not-prose mt-16">
          <h2 className="text-2xl font-bold">What we value</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {values.map((v) => (
              <div key={v.title} className="rounded-xl border p-5">
                <h3 className="font-semibold">{v.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {v.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 rounded-xl border bg-muted/30 p-8 text-center">
          <h2 className="text-2xl font-bold">Ready to create better content?</h2>
          <p className="mt-3 text-muted-foreground">
            Start with 10 free generations per month. No credit card required.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get started for free
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
