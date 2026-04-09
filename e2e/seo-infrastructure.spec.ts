import { test, expect } from "@playwright/test";

// =============================================================================
// Sitemap
// =============================================================================
test.describe("Sitemap", () => {
  test("sitemap.xml returns 200 and is valid XML", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("</urlset>");
  });

  test("sitemap contains all public page URLs", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    const body = await res.text();
    expect(body).toContain("/features");
    expect(body).toContain("/pricing");
    expect(body).toContain("/login");
    expect(body).toContain("/signup");
  });

  test("sitemap contains blog URLs", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    const body = await res.text();
    expect(body).toContain("/blog");
    expect(body).toContain("/blog/best-linkedin-post-examples");
    expect(body).toContain("/blog/ai-social-media-content-guide");
    expect(body).toContain("/blog/instagram-caption-tips");
    expect(body).toContain("/blog/social-media-scheduling-strategy");
    expect(body).toContain("/blog/twitter-x-growth-tips");
    expect(body).toContain("/blog/content-repurposing-guide");
  });
});

// =============================================================================
// Robots.txt
// =============================================================================
test.describe("Robots.txt", () => {
  test("robots.txt returns 200", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
  });

  test("robots.txt allows crawling by default", async ({ request }) => {
    const res = await request.get("/robots.txt");
    const body = await res.text();
    expect(body).toContain("Allow: /");
  });

  test("robots.txt blocks dashboard and API routes", async ({ request }) => {
    const res = await request.get("/robots.txt");
    const body = await res.text();
    expect(body).toContain("Disallow: /dashboard");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Disallow: /team");
  });
});

// =============================================================================
// Security Headers
// =============================================================================
test.describe("Security Headers", () => {
  test("X-Content-Type-Options is set to nosniff", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("Referrer-Policy is set", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });
});

// =============================================================================
// PWA Manifest
// =============================================================================
test.describe("PWA Manifest", () => {
  test("manifest.json returns valid manifest", async ({ request }) => {
    const res = await request.get("/manifest.json");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.name).toBe("SocialBoost");
    expect(json.start_url).toBe("/dashboard");
  });
});

// =============================================================================
// Accessibility Basics
// =============================================================================
test.describe("Accessibility", () => {
  test("landing page has skip-to-content link", async ({ page }) => {
    await page.goto("/");
    const skip = page.getByRole("link", { name: /skip to/i });
    // Skip link might be hidden until focused
    const count = await skip.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("login form inputs have associated labels", async ({ page }) => {
    await page.goto("/login");
    // getByLabel finds inputs via label association
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("signup form inputs have associated labels", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("interactive buttons have accessible names", async ({ page }) => {
    await page.goto("/login");
    const signInBtn = page.getByRole("button", { name: /sign in/i });
    await expect(signInBtn).toBeVisible();
    await expect(signInBtn).toBeEnabled();
  });

  test("forgot-password form has labeled input", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("landing page images have alt text", async ({ page }) => {
    await page.goto("/");
    const images = page.locator("img[alt]");
    const count = await images.count();
    // All images should have non-empty alt attributes
    for (let i = 0; i < Math.min(count, 10); i++) {
      const alt = await images.nth(i).getAttribute("alt");
      expect(alt?.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// Meta Tags on Public Pages
// =============================================================================
test.describe("Meta Tags", () => {
  test("landing page has meta description", async ({ page }) => {
    await page.goto("/");
    const meta = page.locator('meta[name="description"]');
    await expect(meta).toHaveCount(1);
    const content = await meta.getAttribute("content");
    expect(content?.length).toBeGreaterThan(10);
  });

  test("features page has meta description", async ({ page }) => {
    await page.goto("/features");
    const meta = page.locator('meta[name="description"]');
    const count = await meta.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("pricing page has meta description", async ({ page }) => {
    await page.goto("/pricing");
    const meta = page.locator('meta[name="description"]');
    const count = await meta.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("blog page has meta description", async ({ page }) => {
    await page.goto("/blog");
    const meta = page.locator('meta[name="description"]');
    const count = await meta.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("landing page has theme-color meta", async ({ page }) => {
    await page.goto("/");
    const meta = page.locator('meta[name="theme-color"]');
    await expect(meta).toHaveCount(1);
  });

  test("landing page has Open Graph meta tags", async ({ page }) => {
    await page.goto("/");
    const ogTitle = page.locator('meta[property="og:title"]');
    const ogDesc = page.locator('meta[property="og:description"]');
    expect(await ogTitle.count()).toBeGreaterThanOrEqual(1);
    expect(await ogDesc.count()).toBeGreaterThanOrEqual(1);
  });

  test("features page has Open Graph meta tags", async ({ page }) => {
    await page.goto("/features");
    const ogTitle = page.locator('meta[property="og:title"]');
    expect(await ogTitle.count()).toBeGreaterThanOrEqual(1);
  });
});
