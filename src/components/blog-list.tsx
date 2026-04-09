"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { BlogPost } from "@/lib/blog-posts";

interface BlogListProps {
  posts: BlogPost[];
}

export function BlogList({ posts }: BlogListProps) {
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const categories = useMemo(() => {
    const unique = new Set(posts.map((p) => p.category));
    return ["All", ...Array.from(unique).sort()];
  }, [posts]);

  const filtered = useMemo(() => {
    if (activeCategory === "All") return posts;
    return posts.filter((p) => p.category === activeCategory);
  }, [posts, activeCategory]);

  return (
    <>
      <div
        className="mt-8 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter posts by category"
      >
        {categories.map((cat) => {
          const active = cat === activeCategory;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveCategory(cat)}
              className={
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                (active
                  ? "bg-primary text-primary-foreground"
                  : "border bg-background text-muted-foreground hover:bg-muted hover:text-foreground")
              }
            >
              {cat}
            </button>
          );
        })}
      </div>

      <div className="mt-8 space-y-8">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No posts in this category yet.
          </p>
        ) : (
          filtered.map((post) => (
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
          ))
        )}
      </div>
    </>
  );
}
