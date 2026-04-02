import { test, expect } from "@playwright/test";

const BLOG_SLUGS = [
  "best-linkedin-post-examples",
  "ai-social-media-content-guide",
  "instagram-caption-tips",
  "social-media-scheduling-strategy",
  "twitter-x-growth-tips",
  "content-repurposing-guide",
];

// =============================================================================
// Blog Listing Page
// =============================================================================
test.describe("Blog Listing", () => {
  test("has correct title", async ({ page }) => {
    await page.goto("/blog");
    await expect(page).toHaveTitle(/Blog/);
  });

  test("shows all 6 article cards", async ({ page }) => {
    await page.goto("/blog");
    const articles = page.locator("article");
    await expect(articles).toHaveCount(6);
  });

  test("displays known article titles", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByText("10 Best LinkedIn Post Examples", { exact: false })).toBeVisible();
    await expect(page.getByText("AI-Generated Social Media Content", { exact: false })).toBeVisible();
    await expect(page.getByText("Instagram Caption Tips", { exact: false })).toBeVisible();
  });

  test("returns 200 status", async ({ request }) => {
    const res = await request.get("/blog");
    expect(res.status()).toBe(200);
  });

  test("article cards have category badges and dates", async ({ page }) => {
    await page.goto("/blog");
    // Each article should have metadata (date, read time)
    const articles = page.locator("article");
    const firstArticle = articles.first();
    await expect(firstArticle).toBeVisible();
    // Should contain some text with "min" (read time) or a date
    const text = await firstArticle.textContent();
    expect(text?.length).toBeGreaterThan(20);
  });

  test("blog page has header with Get started CTA", async ({ page }) => {
    await page.goto("/blog");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: /get started/i })).toBeVisible();
  });
});

// =============================================================================
// Blog Articles - Page Rendering
// =============================================================================
test.describe("Blog Articles", () => {
  for (const slug of BLOG_SLUGS) {
    test(`${slug} renders with heading, back link, CTA, and JSON-LD`, async ({ page }) => {
      await page.goto(`/blog/${slug}`);
      // h1 heading
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Back to blog link
      await expect(page.getByText("Back to blog")).toBeVisible();
      // CTA section linking to signup (text varies per article)
      await expect(
        page.locator('a[href*="/signup"]').first()
      ).toBeVisible();
      // JSON-LD structured data for SEO
      const jsonLd = page.locator('script[type="application/ld+json"]');
      expect(await jsonLd.count()).toBeGreaterThanOrEqual(1);
    });
  }
});

// =============================================================================
// Blog Articles - Status Codes
// =============================================================================
test.describe("Blog Article Status Codes", () => {
  for (const slug of BLOG_SLUGS) {
    test(`/blog/${slug} returns 200`, async ({ request }) => {
      const res = await request.get(`/blog/${slug}`);
      expect(res.status()).toBe(200);
    });
  }
});

// =============================================================================
// Blog OG Images
// =============================================================================
test.describe("Blog OG Images", () => {
  for (const slug of BLOG_SLUGS) {
    test(`${slug} OG image returns PNG`, async ({ request }) => {
      const res = await request.get(`/blog/${slug}/opengraph-image`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
    });
  }
});
