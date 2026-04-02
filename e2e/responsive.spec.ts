import { test, expect } from "@playwright/test";

// =============================================================================
// Mobile Viewport (375x667 - iPhone SE)
// =============================================================================
test.describe("Mobile Viewport", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("landing page renders without horizontal scroll", async ({ page }) => {
    await page.goto("/");
    const body = page.locator("body");
    const bodyWidth = await body.evaluate((el) => el.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test("landing page navigation is accessible on mobile", async ({ page }) => {
    await page.goto("/");
    // Landing page uses inline nav links instead of hamburger menu
    // Verify key navigation elements are present
    const header = page.locator("header, nav").first();
    await expect(header).toBeVisible();
    // Sign in or Get started links should be accessible
    const navLinks = await page.locator("header a, nav a").count();
    expect(navLinks).toBeGreaterThanOrEqual(1);
  });

  test("login page is usable on mobile", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("signup page is usable on mobile", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  test("pricing page shows both plans on mobile", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText("$9")).toBeVisible();
  });

  test("blog listing is readable on mobile", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("blog article is readable on mobile", async ({ page }) => {
    await page.goto("/blog/best-linkedin-post-examples");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("features page stacks cards on mobile", async ({ page }) => {
    await page.goto("/features");
    await expect(page.getByText("AI Post Generation")).toBeVisible();
  });
});

// =============================================================================
// Tablet Viewport (768x1024 - iPad)
// =============================================================================
test.describe("Tablet Viewport", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("landing page renders properly on tablet", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SocialBoost/);
    await expect(page.getByText("AI-powered content for every platform")).toBeVisible();
  });

  test("pricing page shows plans on tablet", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByText("Free", { exact: true })).toBeVisible();
    await expect(page.getByText("Pro", { exact: true }).first()).toBeVisible();
  });

  test("login form is centered on tablet", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});

// =============================================================================
// Wide Desktop (1920x1080)
// =============================================================================
test.describe("Wide Desktop Viewport", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("landing page uses full width layout", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("AI-powered content for every platform")).toBeVisible();
  });

  test("features grid displays properly", async ({ page }) => {
    await page.goto("/features");
    await expect(page.getByText("AI Post Generation")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Dark Mode" })).toBeVisible();
  });
});
