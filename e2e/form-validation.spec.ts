import { test, expect } from "@playwright/test";

// =============================================================================
// Login Form Validation
// =============================================================================
test.describe("Login Form Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("email field shows validation on invalid input", async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill("not-an-email");
    await page.getByRole("button", { name: /sign in/i }).click();
    // Browser native validation or custom validation should trigger
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test("empty form submission is prevented", async ({ page }) => {
    await page.getByRole("button", { name: /sign in/i }).click();
    // Should stay on login page
    await expect(page).toHaveURL(/login/);
  });

  test("password field is type=password", async ({ page }) => {
    const pwInput = page.getByLabel(/password/i);
    const type = await pwInput.getAttribute("type");
    expect(type).toBe("password");
  });
});

// =============================================================================
// Signup Form Validation
// =============================================================================
test.describe("Signup Form Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup");
  });

  test("email field validates email format", async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill("bad-email");
    await page.getByRole("button", { name: /create account/i }).click();
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test("shows password requirements text", async ({ page }) => {
    await expect(page.getByText(/8 characters/i)).toBeVisible();
  });

  test("empty form cannot be submitted", async ({ page }) => {
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/signup/);
  });
});

// =============================================================================
// Forgot Password Form Validation
// =============================================================================
test.describe("Forgot Password Form Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/forgot-password");
  });

  test("email field validates format", async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill("invalid");
    await page.getByRole("button", { name: /send reset link/i }).click();
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test("empty email cannot be submitted", async ({ page }) => {
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page).toHaveURL(/forgot-password/);
  });
});

// =============================================================================
// Reset Password Form Validation
// =============================================================================
test.describe("Reset Password Form Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/reset-password");
  });

  test("password field is type=password", async ({ page }) => {
    const pwInput = page.getByLabel(/^password/i).or(page.getByLabel(/new password/i));
    if (await pwInput.count() > 0) {
      const type = await pwInput.first().getAttribute("type");
      expect(type).toBe("password");
    }
  });

  test("shows password requirements", async ({ page }) => {
    await expect(page.getByText(/8 characters|uppercase|lowercase|number/i)).toBeVisible();
  });
});
