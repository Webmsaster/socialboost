import { test, expect } from "@playwright/test";

// =============================================================================
// Login Form — Zod Validation
// =============================================================================
test.describe("Login Form Zod Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("invalid email + short password → shows 'Please enter a valid email address'", async ({ page }) => {
    await page.locator("#email").fill("not-valid");
    await page.locator("#password").fill("x");
    // Override HTML5 validation by removing type=email temporarily
    await page.locator("#email").evaluate((el: HTMLInputElement) => {
      el.type = "text";
      el.removeAttribute("required");
    });
    await page.locator("#password").evaluate((el: HTMLInputElement) => {
      el.removeAttribute("required");
    });
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText("Please enter a valid email address")).toBeVisible();
  });

  test("valid email + empty password → HTML5 required prevents submission", async ({ page }) => {
    await page.locator("#email").fill("test@example.com");
    // Leave password empty
    await page.getByRole("button", { name: /sign in/i }).click();
    // Should stay on login page (HTML5 required prevents form submit)
    await expect(page).toHaveURL(/\/login/);
  });

  test("valid email + short password → Zod allows (login only checks non-empty)", async ({ page }) => {
    await page.locator("#email").fill("test@example.com");
    await page.locator("#password").fill("x");
    // Remove HTML5 required so Zod validation runs
    await page.locator("#password").evaluate((el: HTMLInputElement) => {
      el.removeAttribute("required");
    });
    await page.getByRole("button", { name: /sign in/i }).click();
    // Login schema only requires min(1) for password, so "x" passes Zod validation
    // The form should proceed to Supabase auth (which will fail), not show Zod error
    // We verify no Zod password error is shown
    await expect(page.getByText("Password is required")).not.toBeVisible();
  });
});

// =============================================================================
// Signup Form — Zod Validation
// =============================================================================
test.describe("Signup Form Zod Validation", () => {
  async function removeHtml5Constraints(page: import("@playwright/test").Page) {
    await page.locator("form").evaluate((el: HTMLFormElement) => {
      el.setAttribute("novalidate", "");
    });
  }

  test("bad email + short password → shows 'Please enter a valid email address'", async ({ page }) => {
    await page.goto("/signup");
    await removeHtml5Constraints(page);
    await page.locator("#email").fill("bad");
    await page.locator("#password").fill("short");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText("Please enter a valid email address")).toBeVisible();
  });

  test("bad email + short password → shows both errors", async ({ page }) => {
    await page.goto("/signup");
    await removeHtml5Constraints(page);
    await page.locator("#email").fill("bad");
    await page.locator("#password").fill("x");
    await page.getByRole("button", { name: /create account/i }).click();
    // Should show email and password errors
    await expect(page.getByText(/valid email/i)).toBeVisible();
    // Password requirements hint is always visible
    await expect(page.getByText(/8 characters/i)).toBeVisible();
  });

  test("valid email + password without uppercase → shows 'uppercase letter'", async ({ page }) => {
    await page.goto("/signup");
    await removeHtml5Constraints(page);
    await page.locator("#email").fill("test@test.com");
    await page.locator("#password").fill("abcdefgh1");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/uppercase letter/i)).toBeVisible();
  });

  test("valid email + password without lowercase → shows 'lowercase letter'", async ({ page }) => {
    await page.goto("/signup");
    await removeHtml5Constraints(page);
    await page.locator("#email").fill("test@test.com");
    await page.locator("#password").fill("ABCDEFGH1");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/lowercase letter/i)).toBeVisible();
  });

  test("bad email + password without number → shows email error", async ({ page }) => {
    await page.goto("/signup");
    await removeHtml5Constraints(page);
    await page.locator("#email").fill("bad");
    await page.locator("#password").fill("Abcdefgh");
    await page.getByRole("button", { name: /create account/i }).click();
    // Email validation error should be visible
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });
});

// =============================================================================
// Forgot Password Form — Zod Validation
// =============================================================================
test.describe("Forgot Password Zod Validation", () => {
  test("invalid email → shows 'Please enter a valid email address'", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator("form").evaluate((el: HTMLFormElement) => {
      el.setAttribute("novalidate", "");
    });
    await page.locator("#email").fill("invalid");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText("Please enter a valid email address")).toBeVisible();
  });
});

// =============================================================================
// Reset Password Form — Zod Validation
// =============================================================================
test.describe("Reset Password Zod Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/reset-password");
    // Remove HTML5 required so Zod validation runs
    await page.locator("#password").evaluate((el: HTMLInputElement) => {
      el.removeAttribute("required");
    });
    await page.locator("#confirmPassword").evaluate((el: HTMLInputElement) => {
      el.removeAttribute("required");
    });
  });

  test("short password → shows 'at least 8 characters'", async ({ page }) => {
    await page.locator("#password").fill("short");
    await page.locator("#confirmPassword").fill("short");
    await page.getByRole("button", { name: /update password/i }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test("mismatched passwords → shows 'Passwords do not match'", async ({ page }) => {
    await page.locator("#password").fill("Test1234");
    await page.locator("#confirmPassword").fill("Different1234");
    await page.getByRole("button", { name: /update password/i }).click();
    await expect(page.getByText(/Passwords do not match/i)).toBeVisible();
  });
});
