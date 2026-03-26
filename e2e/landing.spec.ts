import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("loads with correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/SocialBoost/);
  });

  test("header has sign in and get started links", async ({ page }) => {
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /get started/i })).toBeVisible();
  });

  test("features section renders all 8 features", async ({ page }) => {
    const featureTitles = [
      "AI Image Generation",
      "Content Calendar",
      "Post Templates",
      "Bulk Generation",
      "Video Script Generator",
      "Video Ad Storyboard",
      "Carousel Generator",
      "A/B Variants",
    ];

    for (const title of featureTitles) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
  });

  test("pricing section shows Free and Pro plans", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Simple pricing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Free" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();
    await expect(page.getByText("$0")).toBeVisible();
    await expect(page.getByText("$9")).toBeVisible();
  });

  test("how it works section has 3 steps", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
    await expect(page.getByText("Choose your content type")).toBeVisible();
    await expect(page.getByText("Describe your topic")).toBeVisible();
    await expect(page.getByText("Publish or schedule")).toBeVisible();
  });
});
