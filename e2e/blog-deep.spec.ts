import { test, expect } from "@playwright/test";

const BLOG_ARTICLES = [
  { slug: "best-linkedin-post-examples", title: "10 Best LinkedIn Post Examples", category: "LinkedIn" },
  { slug: "ai-social-media-content-guide", title: "Complete Guide to AI-Generated", category: "Strategy" },
  { slug: "instagram-caption-tips", title: "15 Instagram Caption Tips", category: "Instagram" },
  { slug: "social-media-scheduling-strategy", title: "Social Media Scheduling Strategy", category: "Strategy" },
  { slug: "twitter-x-growth-tips", title: "Twitter/X Growth Tips", category: "Twitter" },
  { slug: "content-repurposing-guide", title: "Content Repurposing", category: "Strategy" },
];

// =============================================================================
// Blog Article Deep Tests — Individual Navigation & Content
// =============================================================================
test.describe("Blog Article Deep Tests", () => {
  for (const article of BLOG_ARTICLES) {
    test.describe(`Article: ${article.slug}`, () => {
      test("navigate from listing, verify heading", async ({ page }) => {
        await page.goto("/blog");
        // Click the article link in the listing
        await page.locator(`a[href="/blog/${article.slug}"]`).click();
        await expect(page).toHaveURL(new RegExp(`/blog/${article.slug}`));
        // h1 should contain expected title (partial match)
        const h1 = page.getByRole("heading", { level: 1 });
        await expect(h1).toBeVisible();
        await expect(h1).toContainText(article.title);
      });

      test("has Back to blog link that works", async ({ page }) => {
        await page.goto(`/blog/${article.slug}`);
        const backLink = page.getByText("Back to blog");
        await expect(backLink).toBeVisible();
        await backLink.click();
        await expect(page).toHaveURL(/\/blog$/);
      });

      test("has signup CTA link", async ({ page }) => {
        await page.goto(`/blog/${article.slug}`);
        await expect(page.locator('a[href*="/signup"]').first()).toBeVisible();
      });

      test("has category badge", async ({ page }) => {
        await page.goto(`/blog/${article.slug}`);
        await expect(page.getByText(article.category, { exact: true }).first()).toBeVisible();
      });

      test("has read time text", async ({ page }) => {
        await page.goto(`/blog/${article.slug}`);
        await expect(page.getByText(/\d+ min read/).first()).toBeVisible();
      });

      test("has footer with copyright", async ({ page }) => {
        await page.goto(`/blog/${article.slug}`);
        const footer = page.locator("footer");
        await expect(footer).toBeVisible();
        await expect(footer.getByText(/SocialBoost/)).toBeVisible();
      });
    });
  }
});

// =============================================================================
// Blog Listing — Category Badges & Links
// =============================================================================
test.describe("Blog Listing - Categories & Links", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/blog");
  });

  test("shows correct category badges for each article", async ({ page }) => {
    for (const article of BLOG_ARTICLES) {
      const articleLink = page.locator(`a[href="/blog/${article.slug}"]`);
      await expect(articleLink).toBeVisible();
      // Category badge within the article link
      await expect(articleLink.getByText(article.category, { exact: true })).toBeVisible();
    }
  });

  test("all articles are clickable links", async ({ page }) => {
    for (const article of BLOG_ARTICLES) {
      const link = page.locator(`a[href="/blog/${article.slug}"]`);
      await expect(link).toBeVisible();
    }
  });

  test("header logo links to home page", async ({ page }) => {
    const logo = page.locator("header").getByText("SocialBoost");
    await expect(logo).toBeVisible();
    // The logo is inside a link to /
    const logoLink = page.locator('header a[href="/"]');
    await expect(logoLink).toBeVisible();
    await logoLink.click();
    await expect(page).toHaveURL(/\/$/);
  });
});
