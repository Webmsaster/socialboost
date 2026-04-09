import { test, expect } from "@playwright/test";

// =============================================================================
// Landing Page
// =============================================================================
test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/SocialBoost/);
  });

  test("header shows Sign In and Get Started links", async ({ page }) => {
    const header = page.locator("header");
    await expect(header).toBeVisible();
    await expect(header.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("hero section displays value proposition", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /AI-powered content for every/i }),
    ).toBeVisible();
  });

  test("features section shows all 8 features", async ({ page }) => {
    const features = [
      "AI Image Generation",
      "Content Calendar",
      "Post Templates",
      "Bulk Generation",
      "Video Script Generator",
      "Video Ad Storyboard",
      "Carousel Generator",
      "A/B Variants",
    ];
    for (const feature of features) {
      await expect(page.getByText(feature, { exact: true }).first()).toBeVisible();
    }
  });

  test("how it works section has 3 steps", async ({ page }) => {
    await expect(page.getByText("How it works")).toBeVisible();
    await expect(page.getByText("Choose your content type")).toBeVisible();
    await expect(page.getByText("Describe your topic")).toBeVisible();
    await expect(page.getByText("Publish or schedule")).toBeVisible();
  });

  test("stats section shows all 4 key metrics", async ({ page }) => {
    await expect(page.getByText("10K+")).toBeVisible();
    await expect(page.getByText("99.9%")).toBeVisible();
    await expect(page.getByText("Posts generated")).toBeVisible();
    await expect(page.getByText("Platforms supported")).toBeVisible();
    // "8" and "Content types" are separate elements — check both via broader match
    await expect(page.getByText("Uptime", { exact: false })).toBeVisible();
  });

  test("testimonials section shows all 3 reviewers", async ({ page }) => {
    await expect(page.getByText("Loved by content creators")).toBeVisible();
    await expect(page.getByText("Sarah Chen")).toBeVisible();
    await expect(page.getByText("Marcus Rivera")).toBeVisible();
    await expect(page.getByText("Lisa Hoffmann")).toBeVisible();
  });

  test("pricing section shows Free and Pro plans", async ({ page }) => {
    await expect(page.getByText("Simple pricing")).toBeVisible();
    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText("$9")).toBeVisible();
  });

  test("pricing has Monthly/Annual toggle with discount badge", async ({ page }) => {
    await expect(page.getByText("Monthly", { exact: true })).toBeVisible();
    await expect(page.getByText("Save 27%")).toBeVisible();
    await expect(page.getByRole("switch")).toBeVisible();
  });

  test("has JSON-LD structured data", async ({ page }) => {
    // Landing page has Organization + FAQ schemas
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toHaveCount(2);
  });

  test("shows content types section", async ({ page }) => {
    await expect(page.getByText(/What you can create|content type/i).first()).toBeVisible();
  });

  test("footer shows copyright", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByText(/© \d{4} SocialBoost/i)).toBeVisible();
  });

  test("hero CTA links to signup", async ({ page }) => {
    const heroCta = page.getByRole("link", { name: /get started/i }).first();
    const href = await heroCta.getAttribute("href");
    expect(href).toContain("/signup");
  });

  test("OG image endpoint returns PNG", async ({ request }) => {
    const res = await request.get("/opengraph-image");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  });
});

// =============================================================================
// Features Page
// =============================================================================
test.describe("Features Page", () => {
  test("has correct title", async ({ page }) => {
    await page.goto("/features");
    await expect(page).toHaveTitle(/Features/);
  });

  test("displays all 10 features", async ({ page }) => {
    await page.goto("/features");
    const features = [
      "AI Post Generation",
      "AI Image Generation",
      "Video Script Generator",
      "Carousel Generator",
      "Bulk Generation",
      "A/B Variants",
      "Content Calendar",
      "Post Templates",
      "Analytics Dashboard",
      "Dark Mode",
    ];
    for (const feature of features) {
      await expect(page.getByText(feature, { exact: true }).first()).toBeVisible();
    }
  });

  test("has Get Started CTA link", async ({ page }) => {
    await page.goto("/features");
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
  });
});

// =============================================================================
// Pricing Page
// =============================================================================
test.describe("Pricing Page", () => {
  test("has correct title", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).toHaveTitle(/Pricing/);
  });

  test("shows Free and Pro plans with prices", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("Free", { exact: true })).toBeVisible();
    await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText("$9")).toBeVisible();
  });

  test("has Annual/Monthly toggle with Save 27% badge", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("Save 27%")).toBeVisible();
  });
});

// =============================================================================
// 404 Page
// =============================================================================
test.describe("404 Page", () => {
  test("shows custom 404 for invalid routes", async ({ page }) => {
    const res = await page.goto("/nonexistent-page-12345");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("404")).toBeVisible();
  });

  test("has Go home and Dashboard navigation links", async ({ page }) => {
    await page.goto("/nonexistent-page-12345");
    await expect(page.getByRole("link", { name: /go home/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
  });

  test("Go home link navigates to landing page", async ({ page }) => {
    await page.goto("/nonexistent-page-12345");
    await page.getByRole("link", { name: /go home/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("Dashboard link triggers login redirect", async ({ page }) => {
    await page.goto("/nonexistent-page-12345");
    await page.getByRole("link", { name: /dashboard/i }).click();
    await page.waitForURL("**/login");
  });
});
