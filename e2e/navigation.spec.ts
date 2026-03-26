import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("login page is accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  });

  test("signup page is accessible", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("[data-slot='card-title']", { hasText: "Create account" })).toBeVisible();
  });

  test("forgot password page is accessible", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByText("Reset password", { exact: true })).toBeVisible();
  });

  test("unauthenticated user is redirected from /dashboard to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
  });
});
