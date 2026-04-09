import Link from "next/link";
import type { Metadata } from "next";
import { getSortedPosts } from "@/lib/blog-posts";

export const metadata: Metadata = {
  title: "Page Not Found - SocialBoost",
};

const popularPages = [
  { href: "/", title: "Home", description: "Back to the landing page" },
  { href: "/features", title: "Features", description: "What SocialBoost can do" },
  { href: "/pricing", title: "Pricing", description: "Simple, transparent plans" },
  { href: "/blog", title: "Blog", description: "Social media strategy articles" },
  { href: "/faq", title: "FAQ", description: "Answers to common questions" },
  { href: "/contact", title: "Contact", description: "Get in touch" },
];

export default function NotFound() {
  const recentPosts = getSortedPosts().slice(0, 3);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary text-4xl font-bold">
            ?
          </div>
          <h1 className="mt-6 text-4xl font-bold">404</h1>
          <p className="mt-2 text-lg text-muted-foreground">
            This page doesn&apos;t exist or has been moved.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/"
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go home
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border px-6 py-2.5 text-sm font-medium hover:bg-muted"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-center text-lg font-semibold">Popular pages</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {popularPages.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                className="rounded-xl border p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="font-medium">{page.title}</div>
                <div className="text-sm text-muted-foreground">
                  {page.description}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-center text-lg font-semibold">
            Recent blog posts
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {recentPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group rounded-xl border p-4 transition-colors hover:bg-muted/50"
              >
                <span className="w-fit rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {post.category}
                </span>
                <div className="mt-2 font-medium leading-snug group-hover:text-primary transition-colors">
                  {post.title}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} SocialBoost. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
