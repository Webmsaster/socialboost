import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Answers to common questions about SocialBoost: pricing, generation limits, supported platforms, AI quality, and account management.",
};

const faqs = [
  {
    q: "What is SocialBoost?",
    a: "SocialBoost is an AI-powered social media content platform that generates engaging posts, carousels, video scripts, and more for LinkedIn, Facebook, Instagram, Pinterest, and Twitter/X. It helps creators, marketers, and small businesses produce platform-optimized content in seconds.",
  },
  {
    q: "How does the free plan work?",
    a: "The free plan includes 10 AI generations per month — enough to try the product and create content for a light posting schedule. No credit card required to sign up, and no time limit.",
  },
  {
    q: "What does the Pro plan include?",
    a: "The Pro plan is $9/month (or $79/year — save 27%) and includes 100 generations per month, access to premium features like carousel generation, video scripts, video ad storyboards, brand voice customization, and the higher-quality gpt-4o model.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. You can cancel your subscription directly from the billing portal in your settings at any time. You'll retain access to Pro features until the end of your current billing period.",
  },
  {
    q: "Which social media platforms are supported?",
    a: "SocialBoost generates content optimized for LinkedIn, Facebook, Instagram, Pinterest, and Twitter/X. Each generation is tuned to the platform's length limits, tone, and best practices.",
  },
  {
    q: "Can I post directly from SocialBoost?",
    a: "Yes. Once you connect your platform accounts via OAuth in the Accounts page, you can schedule or immediately publish posts directly from SocialBoost's calendar.",
  },
  {
    q: "How is the AI quality?",
    a: "SocialBoost uses OpenAI's latest models (gpt-4o-mini for the free plan, gpt-4o for Pro). You can customize tone, language, and brand voice so the output matches your style. Most users find the first draft is 80-90% ready with minor edits.",
  },
  {
    q: "What languages are supported?",
    a: "The interface is available in English and German. Content generation supports English, German, French, and Spanish today, with more languages in development.",
  },
  {
    q: "Can I save my brand voice?",
    a: "Yes. In your settings you can define a brand voice description that every generation uses as context. This lets you maintain a consistent tone across all platforms and posts.",
  },
  {
    q: "How do I export my data?",
    a: "You can export all of your posts, templates, and profile data as a JSON file from the Settings page. This includes GDPR-compliant data portability.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. SocialBoost uses Supabase with row-level security, encrypted at rest and in transit. Payment data is handled exclusively by Stripe (PCI compliant). We never share your content with third parties.",
  },
  {
    q: "Do you offer team plans?",
    a: "Yes. The Team feature lets you invite colleagues to collaborate on content under a shared organization. Team billing is managed through the team owner's Pro subscription.",
  },
  {
    q: "Can I use SocialBoost for client work?",
    a: "Yes. Agencies and freelancers use SocialBoost to streamline content production for multiple clients. You can create templates per client and switch brand voices between generations.",
  },
  {
    q: "What if I need help?",
    a: "Reach out via the Contact page or email support@socialboost.app. We typically respond within 24 hours on business days.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.a,
    },
  })),
};

export default function FAQPage() {
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
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to know about SocialBoost.
          </p>
        </div>

        <div className="mt-16 space-y-6">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-xl border bg-background p-5 open:bg-muted/30"
            >
              <summary className="cursor-pointer list-none font-semibold flex items-center justify-between gap-4">
                <span>{faq.q}</span>
                <span className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-16 rounded-xl border bg-muted/30 p-8 text-center">
          <h2 className="text-2xl font-bold">Still have questions?</h2>
          <p className="mt-3 text-muted-foreground">
            Reach out and we&apos;ll get back to you within 24 hours.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Contact us
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
