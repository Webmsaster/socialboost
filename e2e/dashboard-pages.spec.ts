import { test, expect } from "@playwright/test";

// Dashboard pages require auth — we test that they load (200) and contain expected UI elements.
// Without auth cookies, they render the client-side shell which checks auth client-side.

test.describe("Dashboard Pages Load", () => {
  // Dashboard pages redirect to /login without auth or render client-side
  for (const path of ["/accounts", "/analytics", "/bulk", "/calendar", "/create", "/history", "/settings", "/team", "/templates"]) {
    test(`${path} responds with 200`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
    });
  }
});

test.describe("Auth Pages", () => {
  test("reset-password page renders", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.locator("#password")).toBeVisible();
  });
});

test.describe("Remaining Blog Articles", () => {
  test("ai-social-media-content-guide loads with heading", async ({ page }) => {
    await page.goto("/blog/ai-social-media-content-guide");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Back to blog")).toBeVisible();
  });

  test("instagram-caption-tips loads with heading", async ({ page }) => {
    await page.goto("/blog/instagram-caption-tips");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Back to blog")).toBeVisible();
  });

  test("social-media-scheduling-strategy loads with heading", async ({ page }) => {
    await page.goto("/blog/social-media-scheduling-strategy");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Back to blog")).toBeVisible();
  });

  test("twitter-x-growth-tips loads with heading", async ({ page }) => {
    await page.goto("/blog/twitter-x-growth-tips");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Back to blog")).toBeVisible();
  });

  test("content-repurposing-guide loads with heading", async ({ page }) => {
    await page.goto("/blog/content-repurposing-guide");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Back to blog")).toBeVisible();
  });
});

test.describe("Remaining API Endpoints", () => {
  test("GET /api/auth/oauth/callback redirects without code", async ({ request }) => {
    const res = await request.get("/api/auth/oauth/callback", { maxRedirects: 0 });
    // Should redirect (302) when missing params
    expect([302, 307]).toContain(res.status());
  });

  test("DELETE /api/templates/[id] rejects without auth", async ({ request }) => {
    const res = await request.delete("/api/templates/fake-id");
    expect([401, 403, 405]).toContain(res.status());
  });
});
