import type { Metadata } from "next";
import Link from "next/link";
import { getSortedPosts } from "@/lib/blog-posts";
import { NewsletterSignup } from "@/components/newsletter-signup";

export const metadata: Metadata = {
  title: "Blog - SocialBoost",
  description:
    "Tips, strategies, and insights for social media marketing with AI-powered content creation.",
};

const posts = getSortedPosts();

export default function BlogPage() {
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

      <main className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-4xl font-bold">Blog</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Tips and strategies for social media marketing.
        </p>

        <div className="mt-12 space-y-8">
          {posts.map((post) => (
            <article key={post.slug} className="group">
              <Link
                href={`/blog/${post.slug}`}
                className="block rounded-xl border p-6 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {post.category}
                  </span>
                  <span>{post.date}</span>
                  <span>{post.readTime}</span>
                </div>
                <h2 className="mt-3 text-xl font-semibold group-hover:text-primary transition-colors">
                  {post.title}
                </h2>
                <p className="mt-2 text-muted-foreground">{post.excerpt}</p>
              </Link>
            </article>
          ))}
        </div>

        <NewsletterSignup />
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} SocialBoost. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
