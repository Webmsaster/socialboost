import type { Metadata } from "next";
import Link from "next/link";
import { BlogShare } from "@/components/blog-share";
import { RelatedPosts } from "@/components/related-posts";

export const metadata: Metadata = {
  title: "Hashtag Strategy in 2026: What Still Works, What Doesn't",
  description:
    "The 2026 hashtag playbook: platform-by-platform rules, how many to use, niche vs broad tags, and the mistakes that now hurt your reach.",
  openGraph: {
    title: "Hashtag Strategy in 2026: What Still Works, What Doesn't",
    description:
      "Platform-by-platform hashtag rules, counts, and mistakes to avoid in 2026.",
    type: "article",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Hashtag Strategy in 2026: What Still Works, What Doesn't",
  description:
    "The 2026 hashtag playbook: platform-by-platform rules, how many to use, niche vs broad tags, and the mistakes that now hurt your reach.",
  datePublished: "2026-04-09",
  dateModified: "2026-04-09",
  author: { "@type": "Organization", name: "SocialBoost" },
  publisher: { "@type": "Organization", name: "SocialBoost" },
};

export default function HashtagStrategyPage() {
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
        <Link
          href="/blog"
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          &larr; Back to blog
        </Link>

        <article className="mt-8 prose prose-neutral dark:prose-invert max-w-none">
          <div className="flex items-center gap-3 text-sm text-muted-foreground not-prose">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Strategy
            </span>
            <span>April 9, 2026</span>
            <span>6 min read</span>
          </div>

          <h1 className="mt-4">
            Hashtag Strategy in 2026: What Still Works, What Doesn&apos;t
          </h1>

          <BlogShare
            title="Hashtag Strategy in 2026"
            slug="hashtag-strategy-2026"
          />

          <p className="lead">
            Hashtags are not dead — but the advice around them is. Most of
            what worked in 2020 now either does nothing or actively hurts
            your reach. Here is the current, platform-by-platform playbook
            for 2026.
          </p>

          <h2>Instagram: 3-5 Niche Tags, Not 30</h2>

          <p>
            Instagram officially recommends 3-5 hashtags per post. More than
            that triggers spam signals and suppresses reach. Mix one broad
            tag, two mid-size tags, and two niche tags. Stuffing 30 tags
            into a comment is a 2019 tactic that now hurts you.
          </p>

          <h2>LinkedIn: 3 Tags, Positioned in Text</h2>

          <p>
            LinkedIn surfaces posts with 3 well-chosen hashtags more than
            posts with none or posts with 10+. Mix one broad professional
            tag (#Marketing) with two niche-specific ones. Place them at
            the end of the post, not sprinkled throughout.
          </p>

          <h2>TikTok: 3-5 Tags, Half Trend / Half Topic</h2>

          <p>
            TikTok&apos;s algorithm uses hashtags as topical signals. Use 3-5
            tags total. Half should be trending or broad (#ForYou, #fyp are
            overrated — pick real trending topics), half should describe
            your specific niche clearly. Avoid #viral — the algorithm
            ignores it.
          </p>

          <h2>X / Twitter: 1-2 Tags Maximum</h2>

          <p>
            X threads and tweets with 3+ hashtags get 17% less engagement
            on average. One or two is the sweet spot. Use hashtags to join
            existing conversations, not to categorize your post. If you
            cannot find an active conversation around a tag, do not use it.
          </p>

          <h2>Pinterest: 0 Hashtags</h2>

          <p>
            Pinterest officially deprecated hashtag search in 2024. They
            now do nothing. Instead, put your keywords into the Pin title
            and description naturally. Pinterest is a search engine now,
            not a social network — treat it like SEO, not social.
          </p>

          <h2>Facebook: Skip Them Entirely</h2>

          <p>
            Facebook hashtags have never been a ranking signal the way
            they are on Instagram or Twitter. They make posts look cluttered
            and do not meaningfully improve reach. Focus on conversational
            copy instead.
          </p>

          <h2>The Mistakes to Avoid</h2>

          <ul>
            <li>Using the same hashtag set on every post — algorithms detect and deprioritize repetition</li>
            <li>Broad-only tags (#love, #happy) — too competitive, zero ranking chance</li>
            <li>Banned or shadowbanned tags — Instagram silently hides posts with certain tags</li>
            <li>Hiding tags in comments — algorithms see them anyway, just uglier</li>
            <li>Copy-pasting viral tag sets from Reddit — obvious and often wrong for your niche</li>
          </ul>

          <h2>How to Research Tags Properly</h2>

          <p>
            For each target platform, use the native search bar. Type a
            seed term and note the auto-suggestions and post counts. Aim
            for tags with 10k-500k posts — too small and no one searches,
            too large and you&apos;ll get buried. Build a spreadsheet of 20-50
            candidate tags per niche and rotate through them.
          </p>

          <h2>Let AI Handle It</h2>

          <p>
            Researching and picking hashtags for every post is tedious.
            SocialBoost automatically generates platform-appropriate hashtag
            sets tuned to your topic and niche, so you skip the research and
            still ship optimized content. Focus on the work that actually
            matters.
          </p>
        </article>

        <RelatedPosts currentSlug="hashtag-strategy-2026" currentCategory="Strategy" />

        <div className="mt-16 rounded-xl border bg-muted/30 p-8 text-center">
          <h2 className="text-2xl font-bold">Stop Guessing Hashtags</h2>
          <p className="mt-3 text-muted-foreground">
            SocialBoost generates optimized hashtag sets for every platform
            in seconds. Try it free with 10 generations per month.
          </p>
          <Link
            href="/signup"
            className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start creating for free
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
