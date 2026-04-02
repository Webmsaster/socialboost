import { test, expect } from "@playwright/test";

// =============================================================================
// Pricing Flow — Landing Page (/)
// =============================================================================
test.describe("Pricing Flow - Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Start Pro (monthly) → navigates to /signup?plan=monthly", async ({ page }) => {
    const startPro = page.getByRole("link", { name: "Start Pro" }).first();
    await expect(startPro).toBeVisible();
    const href = await startPro.getAttribute("href");
    expect(href).toBe("/signup?plan=monthly");
  });

  test("toggle to annual then Start Pro → /signup?plan=annual", async ({ page }) => {
    const toggle = page.getByRole("switch");
    await toggle.click();
    const startPro = page.getByRole("link", { name: "Start Pro" }).first();
    const href = await startPro.getAttribute("href");
    expect(href).toBe("/signup?plan=annual");
  });

  test("pricing toggle changes $9/mo to $79/year", async ({ page }) => {
    // Monthly state
    await expect(page.getByText("$9").first()).toBeVisible();
    await expect(page.getByText("/mo").first()).toBeVisible();

    // Toggle to annual
    await page.getByRole("switch").click();
    await expect(page.getByText("$79").first()).toBeVisible();
    await expect(page.getByText("/year").first()).toBeVisible();
  });

  test("Save 27% badge is visible", async ({ page }) => {
    await expect(page.getByText("Save 27%")).toBeVisible();
  });

  test("annual mode shows billed annually ($6.58/mo)", async ({ page }) => {
    await page.getByRole("switch").click();
    await expect(page.getByText("billed annually ($6.58/mo)")).toBeVisible();
  });

  test("Most popular badge on Pro plan", async ({ page }) => {
    await expect(page.getByText("Most popular")).toBeVisible();
  });

  test("Free plan features list", async ({ page }) => {
    await expect(page.getByText("10 generations / month").first()).toBeVisible();
    await expect(page.getByText("Social posts only").first()).toBeVisible();
    await expect(page.getByText(/5 platforms.*5 tones/).first()).toBeVisible();
  });

  test("Pro plan features list", async ({ page }) => {
    await expect(page.getByText("100 generations / month").first()).toBeVisible();
    await expect(page.getByText("All content types").first()).toBeVisible();
    await expect(page.getByText(/A\/B variants.*bulk generation/).first()).toBeVisible();
    await expect(page.getByText("Brand voice training").first()).toBeVisible();
    await expect(page.getByText("GPT-4o model option").first()).toBeVisible();
    await expect(page.getByText(/Templates.*calendar scheduling/).first()).toBeVisible();
  });
});

// =============================================================================
// Pricing Flow — Pricing Page (/pricing)
// =============================================================================
test.describe("Pricing Flow - Pricing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pricing");
  });

  test("Start Pro (monthly) → /signup?plan=monthly", async ({ page }) => {
    const startPro = page.getByRole("link", { name: "Start Pro" });
    await expect(startPro).toBeVisible();
    const href = await startPro.getAttribute("href");
    expect(href).toBe("/signup?plan=monthly");
  });

  test("toggle to annual then Start Pro → /signup?plan=annual", async ({ page }) => {
    await page.getByRole("switch").click();
    const startPro = page.getByRole("link", { name: "Start Pro" });
    const href = await startPro.getAttribute("href");
    expect(href).toBe("/signup?plan=annual");
  });

  test("Get started on Free plan → /signup (no plan param)", async ({ page }) => {
    const getStarted = page.getByRole("link", { name: "Get started" });
    await expect(getStarted).toBeVisible();
    const href = await getStarted.getAttribute("href");
    expect(href).toBe("/signup");
  });

  test("pricing toggle changes $9/mo to $79/year", async ({ page }) => {
    await expect(page.getByText("$9")).toBeVisible();
    await page.getByRole("switch").click();
    await expect(page.getByText("$79")).toBeVisible();
    await expect(page.getByText("/year")).toBeVisible();
  });

  test("Save 27% badge visible", async ({ page }) => {
    await expect(page.getByText("Save 27%")).toBeVisible();
  });

  test("annual mode shows billed annually text", async ({ page }) => {
    await page.getByRole("switch").click();
    await expect(page.getByText("billed annually ($6.58/mo)")).toBeVisible();
  });

  test("Most popular badge on Pro plan", async ({ page }) => {
    await expect(page.getByText("Most popular")).toBeVisible();
  });

  test("Free plan features", async ({ page }) => {
    await expect(page.getByText("10 generations / month")).toBeVisible();
    await expect(page.getByText("Social posts only")).toBeVisible();
    await expect(page.getByText(/5 platforms.*5 tones/)).toBeVisible();
  });

  test("Pro plan features", async ({ page }) => {
    await expect(page.getByText("100 generations / month")).toBeVisible();
    await expect(page.getByText("All content types")).toBeVisible();
    await expect(page.getByText(/A\/B variants.*bulk generation/)).toBeVisible();
    await expect(page.getByText("Brand voice training")).toBeVisible();
  });
});
