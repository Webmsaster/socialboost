import type { Metadata } from "next";
import Link from "next/link";
import { testimonials } from "@/lib/testimonials";

export const metadata: Metadata = {
  title: "Testimonials — What Our Customers Say",
  description:
    "Real stories from founders, freelancers, and small businesses using SocialBoost to stay consistent on social media.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "SocialBoost",
  description: "AI-powered social media content generation and scheduling platform.",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: testimonials.length.toString(),
    bestRating: "5",
  },
  review: testimonials.map((t) => ({
    "@type": "Review",
    reviewRating: {
      "@type": "Rating",
      ratingValue: "5",
      bestRating: "5",
    },
    author: {
      "@type": "Person",
      name: t.name,
    },
    reviewBody: t.quote,
  })),
};

export default function TestimonialsPage() {
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
            Loved by content creators
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Real stories from the people who use SocialBoost every day to
            stay consistent on social media.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {testimonials.map((t, i) => (
            <figure key={i} className="rounded-2xl border bg-background p-6">
              <div className="flex gap-0.5 text-primary" aria-label="5 stars">
                {[0, 1, 2, 3, 4].map((n) => (
                  <svg
                    key={n}
                    className="h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.171c.969 0 1.371 1.24.588 1.81l-3.37 2.45a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.539 1.118l-3.37-2.45a1 1 0 00-1.175 0l-3.37 2.45c-.783.57-1.838-.197-1.539-1.118l1.287-3.966a1 1 0 00-.364-1.118l-3.37-2.45c-.784-.57-.38-1.81.588-1.81h4.17a1 1 0 00.951-.69l1.286-3.967z" />
                  </svg>
                ))}
              </div>
              <blockquote className="mt-4 text-sm leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 border-t pt-4">
                <div className="font-semibold">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  {t.role} &middot; {t.company}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-16 rounded-xl border bg-muted/30 p-8 text-center">
          <h2 className="text-2xl font-bold">Join them</h2>
          <p className="mt-3 text-muted-foreground">
            Start with 10 free generations per month. No credit card
            required.
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
