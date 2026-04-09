import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/feed.xml/route";
import { blogPosts } from "@/lib/blog-posts";

describe("GET /feed.xml", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://socialboost.test";
  });

  it("returns 200 with RSS content type", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/rss+xml");
  });

  it("includes all blog posts as items", async () => {
    const res = await GET();
    const xml = await res.text();
    for (const post of blogPosts) {
      expect(xml).toContain(`https://socialboost.test/blog/${post.slug}`);
    }
  });

  it("contains valid RSS channel metadata", async () => {
    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<title>SocialBoost Blog</title>");
    expect(xml).toContain("<link>https://socialboost.test/blog</link>");
    expect(xml).toContain("<language>en-us</language>");
  });

  it("escapes XML special characters in post content", async () => {
    const res = await GET();
    const xml = await res.text();
    // Make sure raw apostrophes in titles (e.g. "Meta's") are escaped
    expect(xml).not.toMatch(/Meta's/);
    expect(xml).toContain("Meta&apos;s");
  });

  it("falls back to default site URL when env is unset", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain("https://socialboost.app/blog");
  });

  it("sets a public cache header", async () => {
    const res = await GET();
    expect(res.headers.get("cache-control")).toContain("public");
  });

  it("includes atom:link self-reference", async () => {
    const res = await GET();
    const xml = await res.text();
    expect(xml).toContain('rel="self"');
    expect(xml).toContain("/feed.xml");
  });
});
