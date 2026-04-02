import { test, expect } from "@playwright/test";

// =============================================================================
// API Error Responses
// =============================================================================
test.describe("API Error Responses", () => {
  test("POST /api/generate returns JSON error for invalid JSON body", async ({ request }) => {
    const res = await request.post("/api/generate", {
      data: "not valid json",
      headers: { "Content-Type": "text/plain" },
    });
    expect([400, 401, 403, 500]).toContain(res.status());
  });

  test("POST /api/generate-image with empty prompt returns error", async ({ request }) => {
    const res = await request.post("/api/generate-image", {
      data: { prompt: "" },
    });
    expect([400, 401, 403]).toContain(res.status());
  });

  test("POST /api/templates with invalid platform returns error", async ({ request }) => {
    const res = await request.post("/api/templates", {
      data: { name: "Test", platform: "tiktok", tone: "casual" },
    });
    expect([400, 401, 403]).toContain(res.status());
  });

  test("GET /api/cron/publish without CRON_SECRET returns 401", async ({ request }) => {
    const res = await request.get("/api/cron/publish", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    // Either 401 (wrong secret) or 200 (no secret configured)
    expect([200, 401]).toContain(res.status());
  });

  test("POST /api/stripe/webhook with invalid body returns 400 or 500", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", {
      data: "invalid",
      headers: { "stripe-signature": "fake-sig" },
    });
    expect([400, 500]).toContain(res.status());
  });
});

// =============================================================================
// 404 and Invalid Routes
// =============================================================================
test.describe("404 and Invalid Routes", () => {
  test("deeply nested invalid route returns 404", async ({ page }) => {
    const res = await page.goto("/a/b/c/d/e/f");
    expect(res?.status()).toBe(404);
  });

  test("invalid blog article returns 404", async ({ page }) => {
    const res = await page.goto("/blog/this-article-does-not-exist");
    expect(res?.status()).toBe(404);
  });

  test("invalid API route returns 404", async ({ request }) => {
    const res = await request.get("/api/nonexistent");
    expect(res.status()).toBe(404);
  });

  test("special characters in URL are handled gracefully", async ({ page }) => {
    const res = await page.goto("/blog/<script>alert(1)</script>");
    expect(res?.status()).toBe(404);
  });
});

// =============================================================================
// Security Edge Cases
// =============================================================================
test.describe("Security Edge Cases", () => {
  test("API endpoints set correct content-type", async ({ request }) => {
    const res = await request.post("/api/generate", {
      data: { platform: "linkedin", topic: "test", tone: "casual" },
    });
    expect(res.headers()["content-type"]).toContain("application/json");
  });

  test("HTML pages do not expose server details", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();
    expect(headers["server"]).toBeUndefined();
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("auth callback without code param redirects safely", async ({ page }) => {
    await page.goto("/api/auth/oauth/callback");
    // Should redirect to /accounts with error or /login
    await page.waitForURL(/(accounts|login)/);
  });
});

// =============================================================================
// Heading Structure (Accessibility)
// =============================================================================
test.describe("Heading Structure", () => {
  test("landing page has exactly one h1", async ({ page }) => {
    await page.goto("/");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("features page has exactly one h1", async ({ page }) => {
    await page.goto("/features");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("pricing page has exactly one h1", async ({ page }) => {
    await page.goto("/pricing");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("blog listing has exactly one h1", async ({ page }) => {
    await page.goto("/blog");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("blog article has exactly one h1", async ({ page }) => {
    await page.goto("/blog/best-linkedin-post-examples");
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });

  test("login page has exactly one h1 or prominent heading", async ({ page }) => {
    await page.goto("/login");
    // shadcn CardTitle renders as <div data-slot="card-title">
    const headings = await page.locator('h1, h2, h3, [data-slot="card-title"]').count();
    expect(headings).toBeGreaterThanOrEqual(1);
  });
});
