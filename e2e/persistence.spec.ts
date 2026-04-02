import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const TEST_EMAIL = `e2e-persist-${Date.now()}@socialboost-test.com`;
const TEST_PASSWORD = "E2eTestPass123!";
let testUserId = "";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function createTestUser() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    }),
  });
  const data = await res.json();
  testUserId = data.id;
  return data;
}

async function deleteTestUser() {
  if (!testUserId) return;
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${testUserId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
    },
  });
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", TEST_EMAIL);
  await page.fill("#password", TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 15000 });
}

// =============================================================================
// Dark Mode & Language Persistence (serial - shared test user)
// =============================================================================
test.describe.serial("Persistence Tests", () => {
  test.beforeAll(async () => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      test.skip();
      return;
    }
    await createTestUser();
  });

  test.afterAll(async () => {
    await deleteTestUser();
  });

  // ---------------------------------------------------------------------------
  // Dark Mode Persistence (authenticated)
  // ---------------------------------------------------------------------------
  test("toggle dark mode → html has dark class", async ({ page }) => {
    await login(page);
    // Click the theme toggle button (shows "Dark mode" text when in light mode)
    const darkBtn = page.getByRole("button", { name: /dark mode|dunkler modus/i });
    await expect(darkBtn).toBeVisible();
    await darkBtn.click();
    await expect(page.locator("html")).toHaveAttribute("class", /dark/);
  });

  test("reload page → dark class persists", async ({ page }) => {
    await login(page);
    // First toggle to dark
    const darkBtn = page.getByRole("button", { name: /dark mode|dunkler modus/i });
    if (await darkBtn.isVisible().catch(() => false)) {
      await darkBtn.click();
    }
    await expect(page.locator("html")).toHaveAttribute("class", /dark/);

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("html")).toHaveAttribute("class", /dark/);
  });

  test("toggle back to light → dark class removed", async ({ page }) => {
    await login(page);
    // Ensure we are in dark mode first
    const darkBtn = page.getByRole("button", { name: /dark mode|dunkler modus/i });
    if (await darkBtn.isVisible().catch(() => false)) {
      await darkBtn.click();
    }
    await expect(page.locator("html")).toHaveAttribute("class", /dark/);

    // Now toggle to light (button now says "Light mode")
    const lightBtn = page.getByRole("button", { name: /light mode|heller modus/i });
    await expect(lightBtn).toBeVisible();
    await lightBtn.click();

    // Verify dark class is gone
    const htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass).not.toMatch(/dark/);
  });

  test("reload after switching to light → still light", async ({ page }) => {
    await login(page);
    // Ensure light mode: if dark button is visible, we are in light mode
    const darkBtn = page.getByRole("button", { name: /dark mode|dunkler modus/i });
    const isDark = !(await darkBtn.isVisible().catch(() => false));
    if (isDark) {
      // We are in dark mode, toggle to light
      const lightBtn = page.getByRole("button", { name: /light mode|heller modus/i });
      await lightBtn.click();
    }

    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // In light mode, html should NOT have dark class
    const htmlClass = await page.locator("html").getAttribute("class");
    expect(htmlClass ?? "").not.toMatch(/dark/);
  });

  // ---------------------------------------------------------------------------
  // Language Persistence (authenticated)
  // ---------------------------------------------------------------------------
  test("switch to Deutsch → nav shows German text", async ({ page }) => {
    await login(page);
    const langBtn = page.getByRole("button", { name: /deutsch/i });
    await expect(langBtn).toBeVisible();
    await langBtn.click();

    await expect(page.getByText("Erstellen").first()).toBeVisible();
    await expect(page.getByText("Verlauf").first()).toBeVisible();
  });

  test("reload page → German text persists", async ({ page }) => {
    await login(page);
    // Switch to German
    const langBtn = page.getByRole("button", { name: /deutsch/i });
    if (await langBtn.isVisible().catch(() => false)) {
      await langBtn.click();
    }
    await expect(page.getByText("Erstellen").first()).toBeVisible();

    // Reload
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText("Erstellen").first()).toBeVisible();
    await expect(page.getByText("Verlauf").first()).toBeVisible();
  });

  test("switch back to English → Create Post and History visible", async ({ page }) => {
    await login(page);
    // Ensure German first
    const deBtn = page.getByRole("button", { name: /deutsch/i });
    if (await deBtn.isVisible().catch(() => false)) {
      await deBtn.click();
    }
    // Now switch to English
    const enBtn = page.getByRole("button", { name: /english/i });
    await expect(enBtn).toBeVisible();
    await enBtn.click();

    await expect(page.getByText("Create Post").first()).toBeVisible();
    await expect(page.getByText("History").first()).toBeVisible();
  });

  test("reload after switching to English → still English", async ({ page }) => {
    await login(page);
    // Ensure English: if "Deutsch" button visible, we are in English
    const deBtn = page.getByRole("button", { name: /deutsch/i });
    const isEnglish = await deBtn.isVisible().catch(() => false);
    if (!isEnglish) {
      // In German mode, switch to English
      const enBtn = page.getByRole("button", { name: /english/i });
      await enBtn.click();
    }

    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText("Create Post").first()).toBeVisible();
    await expect(page.getByText("History").first()).toBeVisible();
  });
});

// =============================================================================
// Public Page — Pricing Toggle State (no auth)
// =============================================================================
test.describe("Public Page - Pricing Toggle State", () => {
  test("pricing toggle state does NOT persist on reload", async ({ page }) => {
    await page.goto("/pricing");

    // Toggle to annual
    await page.getByRole("switch").click();
    await expect(page.getByText("$79")).toBeVisible();

    // Reload
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Should be back to monthly (useState resets)
    await expect(page.getByText("$9")).toBeVisible();
    await expect(page.getByText("/mo").first()).toBeVisible();
  });

  test("ThemeProvider renders on landing page", async ({ page }) => {
    await page.goto("/");
    // html element should exist with a class attribute (ThemeProvider adds it)
    const html = page.locator("html");
    await expect(html).toBeVisible();
    // ThemeProvider sets a class or style attribute on html
    const classAttr = await html.getAttribute("class");
    // Just verify html rendered with some class (light or dark)
    expect(classAttr).toBeTruthy();
  });
});
