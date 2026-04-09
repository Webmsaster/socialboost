import Link from "next/link";
import { blogPosts, type BlogPost } from "@/lib/blog-posts";

interface RelatedPostsProps {
  currentSlug: string;
  currentCategory: string;
  limit?: number;
}

/**
 * Picks up to `limit` related posts:
 * 1. Same category first (excluding current post)
 * 2. Fill remaining slots with newest posts from other categories
 */
function pickRelated(
  currentSlug: string,
  currentCategory: string,
  limit: number,
): BlogPost[] {
  const others = blogPosts.filter((p) => p.slug !== currentSlug);
  const sameCategory = others.filter((p) => p.category === currentCategory);
  const otherCategory = others.filter((p) => p.category !== currentCategory);
  const byDateDesc = (a: BlogPost, b: BlogPost) =>
    b.date.localeCompare(a.date);
  return [...sameCategory.sort(byDateDesc), ...otherCategory.sort(byDateDesc)]
    .slice(0, limit);
}

export function RelatedPosts({
  currentSlug,
  currentCategory,
  limit = 3,
}: RelatedPostsProps) {
  const related = pickRelated(currentSlug, currentCategory, limit);
  if (related.length === 0) return null;

  return (
    <section className="not-prose mt-16 border-t pt-12">
      <h2 className="text-2xl font-bold">Keep reading</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        More posts you might find useful.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col rounded-xl border p-5 transition-colors hover:bg-muted/50"
          >
            <span className="w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {post.category}
            </span>
            <h3 className="mt-3 font-semibold leading-snug group-hover:text-primary transition-colors">
              {post.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {post.excerpt}
            </p>
            <span className="mt-3 text-xs text-muted-foreground">
              {post.readTime}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
