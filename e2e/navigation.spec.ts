import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("login page is accessible", async ({ page }) => {
    await page.goto("/login");
    // Should render the login form (not redirect away)
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });

  test("signup page is accessible", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
  });

  test("forgot password page is accessible", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();
  });

  test("unauthenticated user is redirected from /dashboard to /login", async ({ page }) => {
    await page.goto("/dashboard");
    // The proxy redirects unauthenticated users to /login
    await page.waitForURL("**/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });
});
