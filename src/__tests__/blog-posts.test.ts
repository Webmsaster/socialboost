import { describe, it, expect } from "vitest";
import { blogPosts, getSortedPosts } from "@/lib/blog-posts";

describe("blog-posts", () => {
  it("all posts have required fields", () => {
    for (const post of blogPosts) {
      expect(post.slug).toBeTruthy();
      expect(post.title).toBeTruthy();
      expect(post.excerpt).toBeTruthy();
      expect(post.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(post.readTime).toBeTruthy();
      expect(post.category).toBeTruthy();
    }
  });

  it("slugs are unique", () => {
    const slugs = blogPosts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("getSortedPosts returns newest first", () => {
    const sorted = getSortedPosts();
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].date >= sorted[i + 1].date).toBe(true);
    }
  });

  it("getSortedPosts returns all posts", () => {
    expect(getSortedPosts()).toHaveLength(blogPosts.length);
  });

  it("getSortedPosts does not mutate the original array", () => {
    const original = [...blogPosts];
    getSortedPosts();
    expect(blogPosts).toEqual(original);
  });
});
