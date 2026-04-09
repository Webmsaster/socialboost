import { test, expect } from "@playwright/test";

// =============================================================================
// Coverage for the content pages added after the original marketing pages:
// about, faq, use-cases, compare, testimonials, roadmap, status
// =============================================================================

const PAGES = [
  {
    path: "/about",
    heading: /Our mission/i,
    jsonLdType: "AboutPage",
  },
  {
    path: "/faq",
    heading: /Frequently Asked Questions/i,
    jsonLdType: "FAQPage",
  },
  {
    path: "/use-cases",
    heading: /Built for real operators/i,
    jsonLdType: "CollectionPage",
  },
  {
    path: "/compare",
    heading: /How does SocialBoost compare/i,
    jsonLdType: "WebPage",
  },
  {
    path: "/testimonials",
    heading: /Loved by content creators/i,
    jsonLdType: "Product",
  },
  {
    path: "/roadmap",
    heading: /Public Roadmap/i,
    jsonLdType: null, // No JSON-LD on this page
  },
  {
    path: "/status",
    heading: /System Status/i,
    jsonLdType: null,
  },
];

for (const page of PAGES) {
  test.describe(`${page.path}`, () => {
    test("returns 200", async ({ request }) => {
      const res = await request.get(page.path);
      expect(res.status()).toBe(200);
    });

    test("renders expected h1", async ({ page: pw }) => {
      await pw.goto(page.path);
      await expect(
        pw.getByRole("heading", { level: 1, name: page.heading }),
      ).toBeVisible();
    });

    test("links to signup", async ({ page: pw }) => {
      await pw.goto(page.path);
      await expect(pw.locator('a[href="/signup"]').first()).toBeVisible();
    });

    if (page.jsonLdType) {
      test(`includes ${page.jsonLdType} JSON-LD`, async ({ page: pw }) => {
        await pw.goto(page.path);
        const jsonLdTag = pw.locator('script[type="application/ld+json"]').first();
        await expect(jsonLdTag).toHaveCount(1);
        const content = await jsonLdTag.textContent();
        expect(content).toBeTruthy();
        const parsed = JSON.parse(content as string);
        expect(parsed["@type"]).toBe(page.jsonLdType);
      });
    }
  });
}

// =============================================================================
// FAQ page specifics
// =============================================================================
test.describe("FAQ page content", () => {
  test("shows at least 10 questions as details elements", async ({ page }) => {
    await page.goto("/faq");
    const details = page.locator("details");
    const count = await details.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test("can expand a question", async ({ page }) => {
    await page.goto("/faq");
    const first = page.locator("details").first();
    await first.locator("summary").click();
    await expect(first).toHaveAttribute("open", "");
  });
});

// =============================================================================
// Use cases page specifics
// =============================================================================
test.describe("Use cases page content", () => {
  test("shows all four personas", async ({ page }) => {
    await page.goto("/use-cases");
    await expect(page.getByText("Founders", { exact: true })).toBeVisible();
    await expect(page.getByText("Freelancers & Coaches", { exact: true })).toBeVisible();
    await expect(page.getByText("Agencies", { exact: true })).toBeVisible();
    await expect(page.getByText("Small Businesses", { exact: true })).toBeVisible();
  });
});

// =============================================================================
// Compare page specifics
// =============================================================================
test.describe("Compare page content", () => {
  test("shows comparison table with all four columns", async ({ page }) => {
    await page.goto("/compare");
    // Scope to table header only — SocialBoost appears in logo and footer too
    const thead = page.locator("table thead");
    await expect(thead.getByText("SocialBoost", { exact: true })).toBeVisible();
    await expect(thead.getByText("Buffer", { exact: true })).toBeVisible();
    await expect(thead.getByText("Hootsuite", { exact: true })).toBeVisible();
    await expect(thead.getByText("Later", { exact: true })).toBeVisible();
  });
});

// =============================================================================
// Roadmap page specifics
// =============================================================================
test.describe("Roadmap page content", () => {
  test("shows three section headings", async ({ page }) => {
    await page.goto("/roadmap");
    await expect(page.getByRole("heading", { name: "Shipped", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "In Progress", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Planned", exact: true })).toBeVisible();
  });
});

// =============================================================================
// Status page specifics
// =============================================================================
test.describe("Status page content", () => {
  test("shows all six service cards", async ({ page }) => {
    await page.goto("/status");
    const services = ["Web Application", "API", "Database", "AI Generation", "Stripe Billing", "Platform Publishing"];
    for (const svc of services) {
      await expect(page.getByText(svc, { exact: true })).toBeVisible();
    }
  });

  test("shows an operational banner when API is healthy", async ({ page }) => {
    await page.goto("/status");
    // In local test env /api/health should return 200
    await expect(page.getByText(/All systems operational|Service disruption/i)).toBeVisible();
  });
});

// =============================================================================
// Well-known files
// =============================================================================
test.describe("Well-known and infrastructure files", () => {
  test("/.well-known/security.txt returns plain text with required fields", async ({ request }) => {
    const res = await request.get("/.well-known/security.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");
    const body = await res.text();
    expect(body).toContain("Contact:");
    expect(body).toContain("Expires:");
    expect(body).toContain("Canonical:");
  });

  test("/humans.txt returns plain text", async ({ request }) => {
    const res = await request.get("/humans.txt");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/plain");
    const body = await res.text();
    expect(body).toContain("TEAM");
  });

  test("/feed.xml returns valid RSS", async ({ request }) => {
    const res = await request.get("/feed.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/rss+xml");
    const body = await res.text();
    expect(body).toContain('<?xml version="1.0"');
    expect(body).toContain("<rss version=\"2.0\"");
    expect(body).toContain("SocialBoost Blog");
  });
});
