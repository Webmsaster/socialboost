import { test, expect } from "@playwright/test";

test.describe("Auth pages", () => {
  test("login page renders with email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome back", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("signup page renders with email and password fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("[data-slot='card-title']", { hasText: "Create account" })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  test("forgot password page renders", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByText("Reset password", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  });

  test("login form shows validation errors for empty fields", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);

    await expect(emailInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("required", "");
  });

  test("signup form shows validation errors", async ({ page }) => {
    await page.goto("/signup");

    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);

    await expect(emailInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("required", "");
  });
});
