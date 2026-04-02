import { test, expect } from "@playwright/test";

// =============================================================================
// Page Load Performance
// =============================================================================
test.describe("Page Load Performance", () => {
  test("landing page loads within 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });

  test("features page loads within 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/features", { waitUntil: "domcontentloaded" });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });

  test("pricing page loads within 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/pricing", { waitUntil: "domcontentloaded" });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });

  test("blog listing loads within 5 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/blog", { waitUntil: "domcontentloaded" });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });

  test("login page loads within 3 seconds", async ({ page }) => {
    const start = Date.now();
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(3000);
  });
});

// =============================================================================
// API Response Times
// =============================================================================
test.describe("API Response Times", () => {
  test("sitemap.xml responds within 2 seconds", async ({ request }) => {
    const start = Date.now();
    const res = await request.get("/sitemap.xml");
    const duration = Date.now() - start;
    expect(res.status()).toBe(200);
    expect(duration).toBeLessThan(2000);
  });

  test("robots.txt responds within 1 second", async ({ request }) => {
    const start = Date.now();
    const res = await request.get("/robots.txt");
    const duration = Date.now() - start;
    expect(res.status()).toBe(200);
    expect(duration).toBeLessThan(1000);
  });

  test("manifest.json responds within 1 second", async ({ request }) => {
    const start = Date.now();
    const res = await request.get("/manifest.json");
    const duration = Date.now() - start;
    expect(res.status()).toBe(200);
    expect(duration).toBeLessThan(1000);
  });
});

// =============================================================================
// Resource Loading
// =============================================================================
test.describe("Resource Loading", () => {
  test("landing page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Filter out known non-critical errors (e.g. analytics, third-party)
    const criticalErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("analytics") && !e.includes("third-party")
    );
    expect(criticalErrors.length).toBe(0);
  });

  test("no broken images on landing page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const images = page.locator("img");
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      const src = await img.getAttribute("src");
      // SVG data URIs and placeholders may have 0 naturalWidth
      if (src && !src.startsWith("data:")) {
        expect(naturalWidth, `Broken image: ${src}`).toBeGreaterThan(0);
      }
    }
  });
});
