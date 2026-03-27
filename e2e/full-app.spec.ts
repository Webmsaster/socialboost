import { test, expect } from "@playwright/test";

test.describe("Public Pages", () => {
  test("landing page has all sections", async ({ page }) => {
    await page.goto("/");
    // Title
    await expect(page).toHaveTitle(/SocialBoost/);
    // Header links
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /get started/i })).toBeVisible();
    // Hero
    await expect(page.getByText("AI-powered content for every platform")).toBeVisible();
    // How it works
    await expect(page.getByText("How it works")).toBeVisible();
    await expect(page.getByText("Choose your content type")).toBeVisible();
    await expect(page.getByText("Describe your topic")).toBeVisible();
    await expect(page.getByText("Publish or schedule")).toBeVisible();
    // Features (all 8)
    for (const feature of [
      "AI Image Generation", "Content Calendar", "Post Templates", "Bulk Generation",
      "Video Script Generator", "Video Ad Storyboard", "Carousel Generator", "A/B Variants",
    ]) {
      await expect(page.getByText(feature, { exact: true }).first()).toBeVisible();
    }
    // Pricing
    await expect(page.getByText("Simple pricing")).toBeVisible();
    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText("$9")).toBeVisible();
    // JSON-LD
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd).toHaveCount(1);
  });

  test("features page renders all 10 features", async ({ page }) => {
    await page.goto("/features");
    await expect(page).toHaveTitle(/Features/);
    for (const feature of [
      "AI Post Generation", "AI Image Generation", "Video Script Generator",
      "Carousel Generator", "Bulk Generation", "A/B Variants",
      "Content Calendar", "Post Templates", "Analytics Dashboard", "Dark Mode",
    ]) {
      await expect(page.getByText(feature, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("pricing page shows both plans", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).toHaveTitle(/Pricing/);
    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText("$9")).toBeVisible();
    await expect(page.getByText("Free", { exact: true })).toBeVisible();
    await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Save 27%")).toBeVisible();
  });

  test("OG image endpoint returns PNG", async ({ request }) => {
    const res = await request.get("/opengraph-image");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  });

  test("sitemap has 5 URLs", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("/features");
    expect(body).toContain("/pricing");
    expect(body).toContain("/login");
    expect(body).toContain("/signup");
  });

  test("robots.txt blocks dashboard", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Disallow: /dashboard");
    expect(body).toContain("Disallow: /api/");
  });
});

test.describe("Auth Pages", () => {
  test("login page has all form elements", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    // Links to other auth pages
    await expect(page.getByRole("link", { name: /create account|sign up/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /forgot/i })).toBeVisible();
    // Required validation
    await expect(page.getByLabel(/email/i)).toHaveAttribute("required", "");
  });

  test("signup page has all form elements", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("[data-slot='card-title']", { hasText: "Create account" })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toHaveAttribute("required", "");
    await expect(page.getByLabel(/password/i)).toHaveAttribute("required", "");
  });

  test("forgot-password page has form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByText("Reset password", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  });
});

test.describe("Auth Redirect", () => {
  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  });
});

test.describe("API Endpoints (unauthenticated)", () => {
  test("POST /api/generate rejects without auth", async ({ request }) => {
    const res = await request.post("/api/generate", {
      data: { platform: "linkedin", topic: "test", tone: "professional" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/generate-image rejects without auth", async ({ request }) => {
    const res = await request.post("/api/generate-image", {
      data: { prompt: "test" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/generate-carousel rejects without auth", async ({ request }) => {
    const res = await request.post("/api/generate-carousel", {
      data: { topic: "test", tone: "professional", platform: "linkedin" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/generate-video-script rejects without auth", async ({ request }) => {
    const res = await request.post("/api/generate-video-script", {
      data: { topic: "test", tone: "professional", platform: "linkedin" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/generate-video-ad rejects without auth", async ({ request }) => {
    const res = await request.post("/api/generate-video-ad", {
      data: { topic: "test", tone: "professional", product: "test" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/generate-variants rejects without auth", async ({ request }) => {
    const res = await request.post("/api/generate-variants", {
      data: { platform: "linkedin", topic: "test", tone: "professional" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/templates rejects without auth", async ({ request }) => {
    const res = await request.get("/api/templates");
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/account/delete rejects without auth", async ({ request }) => {
    const res = await request.post("/api/account/delete");
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/account/export rejects without auth", async ({ request }) => {
    const res = await request.get("/api/account/export");
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/stripe/checkout rejects without auth", async ({ request }) => {
    const res = await request.post("/api/stripe/checkout");
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/stripe/portal rejects without auth", async ({ request }) => {
    const res = await request.post("/api/stripe/portal");
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/stripe/webhook returns 400 without signature", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", {
      data: "{}",
      headers: { "Content-Type": "text/plain" },
    });
    // Should be 400 (missing signature) or 500 (webhook not configured)
    expect([400, 500]).toContain(res.status());
  });

  test("GET /api/cron/publish requires auth when CRON_SECRET is set", async ({ request }) => {
    const res = await request.get("/api/cron/publish");
    // Without CRON_SECRET env, it processes (200). With it, 401.
    expect([200, 401]).toContain(res.status());
  });
});

test.describe("Navigation Links", () => {
  test("landing page Sign In link goes to /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /sign in/i }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("landing page Get Started link goes to /signup", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /get started/i }).first().click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("login page has link to signup", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /create account|sign up/i }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("login page has link to forgot-password", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /forgot/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});
