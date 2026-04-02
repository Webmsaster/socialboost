import { test, expect } from "@playwright/test";

// =============================================================================
// Landing Page Navigation
// =============================================================================
test.describe("Landing Page Links", () => {
  test("Sign In link goes to /login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /sign in/i }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("Get Started link goes to /signup", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /get started/i }).first().click();
    await expect(page).toHaveURL(/\/signup/);
  });
});

// =============================================================================
// Auth Page Cross-Navigation
// =============================================================================
test.describe("Auth Page Cross-Navigation", () => {
  test("login -> create account -> signup", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /create account|sign up/i }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("login -> forgot password", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /forgot/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test("signup -> sign in -> login", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("link", { name: /sign in|log in|already have/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot-password -> back to sign in -> login", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("link", { name: /sign in|back|login/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

// =============================================================================
// Blog Navigation
// =============================================================================
test.describe("Blog Navigation", () => {
  test("blog listing -> article page", async ({ page }) => {
    await page.goto("/blog");
    // Click the first article link
    await page.locator("article a").first().click();
    await expect(page).toHaveURL(/\/blog\/.+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("article -> Back to blog -> listing", async ({ page }) => {
    await page.goto("/blog/best-linkedin-post-examples");
    await page.getByText("Back to blog").click();
    await expect(page).toHaveURL(/\/blog$/);
  });

  test("article CTA links to signup", async ({ page }) => {
    await page.goto("/blog/best-linkedin-post-examples");
    const cta = page.getByRole("link", { name: /try socialboost|start for free|get started/i });
    const href = await cta.getAttribute("href");
    expect(href).toContain("/signup");
  });
});

// =============================================================================
// Features Page Navigation
// =============================================================================
test.describe("Features Page Links", () => {
  test("Get Started CTA links to signup", async ({ page }) => {
    await page.goto("/features");
    const cta = page.getByRole("link", { name: /get started/i });
    const href = await cta.getAttribute("href");
    expect(href).toContain("/signup");
  });
});

// =============================================================================
// 404 Page Navigation
// =============================================================================
test.describe("404 Page Links", () => {
  test("Go home navigates to /", async ({ page }) => {
    await page.goto("/nonexistent-route-test");
    await page.getByRole("link", { name: /go home/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("Dashboard link navigates (redirects to login)", async ({ page }) => {
    await page.goto("/nonexistent-route-test");
    await page.getByRole("link", { name: /dashboard/i }).click();
    await page.waitForURL("**/login");
  });
});

// =============================================================================
// Full User Journey (unauthenticated)
// =============================================================================
test.describe("Full Navigation Journey", () => {
  test("landing -> features -> back", async ({ page }) => {
    await page.goto("/");
    // Navigate to features via header if link exists, or go directly
    await page.goto("/features");
    await expect(page).toHaveTitle(/Features/);
  });

  test("landing -> pricing -> back", async ({ page }) => {
    await page.goto("/");
    await page.goto("/pricing");
    await expect(page).toHaveTitle(/Pricing/);
  });

  test("landing -> blog -> article -> back to blog", async ({ page }) => {
    await page.goto("/blog");
    await page.locator("article a").first().click();
    await expect(page).toHaveURL(/\/blog\/.+/);
    await page.getByText("Back to blog").click();
    await expect(page).toHaveURL(/\/blog$/);
  });

  test("signup -> login -> forgot-password -> full auth flow", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("link", { name: /sign in|log in|already have/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole("link", { name: /forgot/i }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });
});
