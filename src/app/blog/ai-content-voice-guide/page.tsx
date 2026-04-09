import type { Metadata } from "next";
import Link from "next/link";
import { BlogShare } from "@/components/blog-share";
import { RelatedPosts } from "@/components/related-posts";

export const metadata: Metadata = {
  title: "How to Make AI-Generated Content Sound Like You",
  description:
    "AI content is a tool, not a replacement. Here is how to prompt, edit, and direct AI so the output sounds unmistakably like your brand voice.",
  openGraph: {
    title: "How to Make AI-Generated Content Sound Like You",
    description:
      "Prompt, edit, and direct AI so output sounds like your brand — not like every other AI post.",
    type: "article",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How to Make AI-Generated Content Sound Like You",
  description:
    "AI content is a tool, not a replacement. Here is how to prompt, edit, and direct AI so the output sounds unmistakably like your brand voice.",
  datePublished: "2026-04-09",
  dateModified: "2026-04-09",
  author: { "@type": "Organization", name: "SocialBoost" },
  publisher: { "@type": "Organization", name: "SocialBoost" },
};

export default function AIVoiceGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

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
        <Link href="/blog" className="text-sm text-muted-foreground hover:text-primary transition-colors">
          &larr; Back to blog
        </Link>

        <article className="mt-8 prose prose-neutral dark:prose-invert max-w-none">
          <div className="flex items-center gap-3 text-sm text-muted-foreground not-prose">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              AI
            </span>
            <span>April 9, 2026</span>
            <span>7 min read</span>
          </div>

          <h1 className="mt-4">How to Make AI-Generated Content Sound Like You</h1>

          <BlogShare title="How to Make AI-Generated Content Sound Like You" slug="ai-content-voice-guide" />

          <p className="lead">
            Most AI-generated social posts read the same: vague, hedging,
            overusing words like &quot;leverage,&quot; &quot;elevate,&quot; and
            &quot;game-changer.&quot; That is not AI&apos;s fault — that is a
            prompting problem. Here is how to get output that sounds like
            you and nobody else.
          </p>

          <h2>1. Give the AI a Voice Document</h2>

          <p>
            Before prompting, write a one-page voice doc: 5 adjectives that
            describe your tone, 10 words you use often, 10 words you never
            use, and 3 sample posts you are proud of. Paste this doc into
            every prompt as context. Without it, AI defaults to generic
            corporate-friendly prose.
          </p>

          <h2>2. Specify What You Hate</h2>

          <p>
            Negative examples teach faster than positive ones. Tell the AI:
            &quot;Do not use: leverage, synergy, elevate, game-changer,
            dive deep, in today&apos;s fast-paced world, the truth is.&quot;
            This single instruction cuts 60% of the AI-ness out of any
            output immediately.
          </p>

          <h2>3. Write the First Sentence Yourself</h2>

          <p>
            The opening line sets the rhythm for everything that follows.
            Write it yourself, then ask the AI to continue in the same
            voice. AI is excellent at pattern-matching — give it a strong
            pattern to match and it will follow. Give it a blank page and
            it reverts to its training average.
          </p>

          <h2>4. Ask for 5 Versions, Pick the Best</h2>

          <p>
            Never use the first AI output. Generate 5 variations with the
            same prompt. You will notice one or two feel genuinely yours
            and three feel generic. Pick the best and regenerate around
            that direction. This takes 30 extra seconds and doubles the
            quality.
          </p>

          <h2>5. Edit Aggressively — Not Just Proofread</h2>

          <p>
            The final step matters most: rewrite 20-40% of every AI output.
            Cut a word per sentence. Replace abstractions with specifics.
            Add one personal detail. A post that is 70% AI and 30% you
            beats a post that is 100% either one. The edit is where the
            voice actually shows up.
          </p>

          <h2>6. Use Platform-Specific Prompts</h2>

          <p>
            A LinkedIn post is not a tweet is not an Instagram caption.
            Do not write one prompt and expect it to work across platforms.
            Instead, maintain one prompt template per platform with
            length, tone, formatting rules, and platform-specific norms.
            SocialBoost does this automatically under the hood.
          </p>

          <h2>7. Feed It Your Past Posts</h2>

          <p>
            Copy 5-10 of your best-performing past posts into the prompt
            as examples. The AI will match the voice, cadence, and
            structure much better than from a voice doc alone. Update this
            set every quarter as your voice evolves.
          </p>

          <h2>8. Treat AI as a Drafting Partner, Not a Writer</h2>

          <p>
            The mental shift matters: AI is a faster way to generate
            drafts, not a replacement for thinking. You still decide what
            to say. AI just helps you say it faster. Writers who hand over
            the whole job to AI produce the forgettable posts everyone is
            tired of scrolling past.
          </p>

          <h2>Ship More, Sound Like Yourself</h2>

          <p>
            Good AI-assisted content has a tell: it reads like the writer
            had more time than usual. That is the bar. If your posts feel
            generic, your prompts and editing are too passive — not the
            AI&apos;s fault. Tighten the loop and ship weekly.
          </p>
        </article>

        <RelatedPosts currentSlug="ai-content-voice-guide" currentCategory="AI" />

        <div className="mt-16 rounded-xl border bg-muted/30 p-8 text-center">
          <h2 className="text-2xl font-bold">Ship Content That Sounds Like You</h2>
          <p className="mt-3 text-muted-foreground">
            SocialBoost tailors output to your tone, platform, and audience.
            Try it free with 10 generations per month.
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
