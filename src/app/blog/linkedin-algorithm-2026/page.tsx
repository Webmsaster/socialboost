import type { Metadata } from "next";
import Link from "next/link";
import { BlogShare } from "@/components/blog-share";
import { RelatedPosts } from "@/components/related-posts";

export const metadata: Metadata = {
  title: "LinkedIn Algorithm in 2026: What Actually Drives Reach",
  description:
    "Deep dive into how the LinkedIn algorithm works in 2026. Dwell time, creator mode, content formats, and the signals that determine whether your post reaches 500 or 50,000 people.",
  openGraph: {
    title: "LinkedIn Algorithm in 2026: What Actually Drives Reach",
    description: "How the LinkedIn algorithm works in 2026 and what drives reach.",
    type: "article",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "LinkedIn Algorithm in 2026: What Actually Drives Reach",
  datePublished: "2026-04-11",
  author: { "@type": "Organization", name: "SocialBoost" },
  publisher: { "@type": "Organization", name: "SocialBoost", url: "https://socialboost.app" },
};

export default function LinkedInAlgorithmPage() {
  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">S</div>
            <span className="text-xl font-bold">SocialBoost</span>
          </Link>
          <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground">&larr; Back to Blog</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>LinkedIn Algorithm in 2026: What Actually Drives Reach</h1>
          <p className="lead text-lg text-muted-foreground">
            LinkedIn&apos;s algorithm has changed significantly. Here&apos;s what matters now — and what doesn&apos;t.
          </p>
          <h2>The 3-Phase Distribution Model</h2>
          <p>Every LinkedIn post goes through three phases: Initial Test (shown to ~5% of your network), Early Signals (algorithm reads engagement in the first 60-90 minutes), and Extended Distribution (if signals are strong, the post goes viral to 2nd and 3rd degree connections).</p>
          <h2>The 5 Signals That Matter Most</h2>
          <h3>1. Dwell Time</h3>
          <p>How long people spend reading your post is the #1 signal in 2026. Long-form posts with line breaks, stories, and numbered lists keep people scrolling. Posts under 50 words rarely get distribution.</p>
          <h3>2. Early Comments (First 60 Minutes)</h3>
          <p>Comments in the first hour are worth 5x more than likes. Ending with a question or controversial take drives comments. Avoid engagement bait (&quot;Like if you agree&quot;) — the algorithm penalizes it.</p>
          <h3>3. Content Originality</h3>
          <p>LinkedIn now detects reposted/recycled content. AI-generated posts that sound generic get suppressed. Brand voice customization and personal anecdotes are critical to differentiate.</p>
          <h3>4. Profile Authority</h3>
          <p>Accounts that post consistently (3-5x/week) get a baseline distribution boost. New posters start with a &quot;new creator bonus&quot; for their first 30 days.</p>
          <h3>5. Content Format</h3>
          <p>In 2026: Text posts still dominate. Document carousels get 2-3x the engagement of image posts. Video performs well but requires subtitles. Polls are down — LinkedIn deprioritized them.</p>
          <h2>Optimal Posting Strategy</h2>
          <ul>
            <li><strong>Frequency:</strong> 3-5 posts per week, consistent schedule</li>
            <li><strong>Timing:</strong> Tuesday-Thursday, 9 AM or 12 PM</li>
            <li><strong>Length:</strong> 1,000-1,500 characters sweet spot</li>
            <li><strong>Hashtags:</strong> 3-5 targeted industry tags</li>
            <li><strong>Hook:</strong> First line must stop the scroll — question, stat, or bold claim</li>
          </ul>
          <h2>What to Avoid</h2>
          <ul>
            <li>External links in the post body (put them in comments)</li>
            <li>Engagement bait phrases</li>
            <li>Posting more than once per day</li>
            <li>Generic AI content without personalization</li>
            <li>Tagging people who won&apos;t engage</li>
          </ul>
          <h2>Using AI for LinkedIn Content</h2>
          <p>AI-generated LinkedIn posts work best when you add your personal experience. Use AI to generate the structure and talking points, then inject your own stories, data, and opinions. SocialBoost&apos;s brand voice feature helps maintain your tone across all generated posts.</p>
        </article>
        <BlogShare title="LinkedIn Algorithm in 2026: What Actually Drives Reach" slug="linkedin-algorithm-2026" />
        <RelatedPosts currentSlug="linkedin-algorithm-2026" currentCategory="LinkedIn" />
      </main>
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">&copy; {new Date().getFullYear()} SocialBoost.</div>
      </footer>
    </div>
  );
}
