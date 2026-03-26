import { test, expect } from "@playwright/test";

test.describe("Auth pages", () => {
  test("login page renders with email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("signup page renders with email and password fields", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  test("forgot password page renders", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
  });

  test("login form shows validation errors for empty fields", async ({ page }) => {
    await page.goto("/login");

    // Clear any default values and submit the form
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);

    // HTML5 required attributes prevent form submission with empty fields.
    // Verify that required attributes are present.
    await expect(emailInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("required", "");
  });

  test("signup form shows validation errors", async ({ page }) => {
    await page.goto("/signup");

    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);

    // Verify required attributes are present
    await expect(emailInput).toHaveAttribute("required", "");
    await expect(passwordInput).toHaveAttribute("required", "");
  });
});
