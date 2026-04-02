import { test, expect } from "@playwright/test";

// =============================================================================
// Login Page
// =============================================================================
test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders welcome message", async ({ page }) => {
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  });

  test("shows card description", async ({ page }) => {
    await expect(page.getByText(/Sign in to your SocialBoost/i)).toBeVisible();
  });

  test("has email and password inputs", async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("has Sign In submit button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("email and password are required fields", async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toHaveAttribute("required", "");
    await expect(page.getByLabel(/password/i)).toHaveAttribute("required", "");
  });

  test("has link to create account", async ({ page }) => {
    await expect(page.getByRole("link", { name: /create account|sign up/i })).toBeVisible();
  });

  test("has link to forgot password", async ({ page }) => {
    await expect(page.getByRole("link", { name: /forgot/i })).toBeVisible();
  });
});

// =============================================================================
// Signup Page
// =============================================================================
test.describe("Signup Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup");
  });

  test("renders Create account title", async ({ page }) => {
    await expect(
      page.locator("[data-slot='card-title']", { hasText: "Create account" })
    ).toBeVisible();
  });

  test("shows card description or referral bonus", async ({ page }) => {
    // Default description or referral bonus message
    const description = page.getByText(/create.*account|bonus|referral/i).first();
    await expect(description).toBeVisible();
  });

  test("has email and password inputs", async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test("has Create account submit button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  test("email and password are required fields", async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toHaveAttribute("required", "");
    await expect(page.getByLabel(/password/i)).toHaveAttribute("required", "");
  });

  test("has link to sign in for existing users", async ({ page }) => {
    await expect(page.getByRole("link", { name: /sign in|log in|already have/i })).toBeVisible();
  });

  test("shows password requirements text", async ({ page }) => {
    await expect(
      page.getByText(/8.*character|uppercase|lowercase|number/i).first()
    ).toBeVisible();
  });
});

// =============================================================================
// Forgot Password Page
// =============================================================================
test.describe("Forgot Password Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/forgot-password");
  });

  test("renders Reset password title", async ({ page }) => {
    await expect(page.getByText("Reset password", { exact: true })).toBeVisible();
  });

  test("has email input", async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("has Send reset link button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  });

  test("has back to sign in link", async ({ page }) => {
    await expect(
      page.getByRole("link", { name: /sign in|back|login/i })
    ).toBeVisible();
  });
});

// =============================================================================
// Reset Password Page
// =============================================================================
test.describe("Reset Password Page", () => {
  test("renders page title Set new password", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByText("Set new password")).toBeVisible();
  });

  test("shows description text", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByText(/Enter your new password/i)).toBeVisible();
  });

  test("renders password input field", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.locator("#password")).toBeVisible();
  });

  test("has confirm password field", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(
      page.locator("#confirm-password").or(page.getByLabel(/confirm/i))
    ).toBeVisible();
  });

  test("shows password requirements", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(
      page.getByText(/8.*character|uppercase|lowercase|number/i).first()
    ).toBeVisible();
  });

  test("has Update password button", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(
      page.getByRole("button", { name: /update|reset|change/i })
    ).toBeVisible();
  });
});

// =============================================================================
// Protected Route Redirects (unauthenticated)
// =============================================================================
test.describe("Protected Route Redirects", () => {
  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  });

  test("unauthenticated /create redirects to /login", async ({ page }) => {
    await page.goto("/create");
    await page.waitForURL("**/login");
  });

  test("unauthenticated /history redirects to /login", async ({ page }) => {
    await page.goto("/history");
    await page.waitForURL("**/login");
  });

  test("unauthenticated /calendar redirects to /login", async ({ page }) => {
    await page.goto("/calendar");
    await page.waitForURL("**/login");
  });

  test("unauthenticated /accounts redirects to /login", async ({ page }) => {
    await page.goto("/accounts");
    await page.waitForURL("**/login");
  });

  test("unauthenticated /settings redirects to /login", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForURL("**/login");
  });
});

// =============================================================================
// Dashboard Pages respond (via request - follows redirect to 200)
// =============================================================================
test.describe("Dashboard Pages HTTP Status", () => {
  const dashboardPaths = [
    "/accounts",
    "/analytics",
    "/bulk",
    "/calendar",
    "/create",
    "/history",
    "/settings",
    "/team",
    "/templates",
  ];

  for (const path of dashboardPaths) {
    test(`${path} responds with 200`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
    });
  }
});
