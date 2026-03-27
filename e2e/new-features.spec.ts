import { test, expect } from "@playwright/test";

test.describe("Blog", () => {
  test("blog listing shows all 6 articles", async ({ page }) => {
    await page.goto("/blog");
    await expect(page).toHaveTitle(/Blog/);
    await expect(page.getByText("10 Best LinkedIn Post Examples", { exact: false })).toBeVisible();
    await expect(page.getByText("AI-Generated Social Media Content", { exact: false })).toBeVisible();
    await expect(page.getByText("Instagram Caption Tips", { exact: false })).toBeVisible();
    // Check article count via links
    const articles = page.locator("article");
    await expect(articles).toHaveCount(6);
  });

  test("blog article page renders with CTA", async ({ page }) => {
    await page.goto("/blog/best-linkedin-post-examples");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Back to blog")).toBeVisible();
    await expect(page.getByRole("link", { name: /try socialboost|start for free|get started/i })).toBeVisible();
  });

  test("all 6 blog articles load", async ({ request }) => {
    const slugs = [
      "best-linkedin-post-examples",
      "ai-social-media-content-guide",
      "instagram-caption-tips",
      "social-media-scheduling-strategy",
      "twitter-x-growth-tips",
      "content-repurposing-guide",
    ];
    for (const slug of slugs) {
      const res = await request.get(`/blog/${slug}`);
      expect(res.status(), `blog/${slug}`).toBe(200);
    }
  });

  test("blog OG images return PNG", async ({ request }) => {
    const slugs = [
      "best-linkedin-post-examples",
      "ai-social-media-content-guide",
      "instagram-caption-tips",
      "social-media-scheduling-strategy",
      "twitter-x-growth-tips",
      "content-repurposing-guide",
    ];
    for (const slug of slugs) {
      const res = await request.get(`/blog/${slug}/opengraph-image`);
      expect(res.status(), `OG image ${slug}`).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
    }
  });
});

test.describe("404 Page", () => {
  test("shows custom 404 with navigation links", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist-xyz");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByRole("link", { name: /go home/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
  });
});

test.describe("Landing Page - New Sections", () => {
  test("shows stats section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("10K+")).toBeVisible();
    await expect(page.getByText("99.9%")).toBeVisible();
    await expect(page.getByText("Posts generated")).toBeVisible();
  });

  test("shows testimonials section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Loved by content creators")).toBeVisible();
    await expect(page.getByText("Sarah Chen")).toBeVisible();
    await expect(page.getByText("Marcus Rivera")).toBeVisible();
    await expect(page.getByText("Lisa Hoffmann")).toBeVisible();
  });

  test("pricing has monthly/annual toggle", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Monthly", { exact: true })).toBeVisible();
    await expect(page.getByText("Save 27%")).toBeVisible();
    await expect(page.getByRole("switch")).toBeVisible();
  });
});

test.describe("New API Endpoints - Auth Required", () => {
  test("POST /api/repurpose rejects without auth", async ({ request }) => {
    const res = await request.post("/api/repurpose", { data: {} });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/hashtags rejects without auth", async ({ request }) => {
    const res = await request.post("/api/hashtags", { data: {} });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/metrics rejects without auth", async ({ request }) => {
    const res = await request.get("/api/metrics");
    expect(res.status()).toBe(401);
  });

  test("GET /api/referral rejects without auth", async ({ request }) => {
    const res = await request.get("/api/referral");
    expect(res.status()).toBe(401);
  });

  test("POST /api/referral/claim rejects without auth/data", async ({ request }) => {
    const res = await request.post("/api/referral/claim", { data: {} });
    expect([400, 401, 403]).toContain(res.status());
  });

  test("GET /api/team rejects without auth", async ({ request }) => {
    const res = await request.get("/api/team");
    expect(res.status()).toBe(401);
  });

  test("POST /api/team rejects without auth", async ({ request }) => {
    const res = await request.post("/api/team", { data: { name: "test" } });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/team/invite rejects without auth", async ({ request }) => {
    const res = await request.post("/api/team/invite", { data: {} });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/team/accept rejects without auth", async ({ request }) => {
    const res = await request.post("/api/team/accept", { data: {} });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/auth/oauth/connect rejects without auth", async ({ request }) => {
    const res = await request.post("/api/auth/oauth/connect", { data: { platform: "linkedin" } });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/auth/oauth/disconnect rejects without auth", async ({ request }) => {
    const res = await request.post("/api/auth/oauth/disconnect", { data: { platform: "linkedin" } });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/webhooks/test rejects without auth", async ({ request }) => {
    const res = await request.post("/api/webhooks/test", { data: {} });
    expect([401, 403]).toContain(res.status());
  });
});

test.describe("SEO & Infrastructure", () => {
  test("sitemap has all URLs including blog", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("/blog");
    expect(body).toContain("/blog/best-linkedin-post-examples");
    expect(body).toContain("/blog/content-repurposing-guide");
    expect(body).toContain("/features");
    expect(body).toContain("/pricing");
  });

  test("robots.txt allows blog and blocks dashboard", async ({ request }) => {
    const res = await request.get("/robots.txt");
    const body = await res.text();
    expect(body).toContain("Allow: /blog");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Disallow: /dashboard");
    expect(body).toContain("Disallow: /team");
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("blog pages return 200", async ({ request }) => {
    const res = await request.get("/blog");
    expect(res.status()).toBe(200);
  });

  test("PWA manifest is accessible", async ({ request }) => {
    const res = await request.get("/manifest.json");
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.name).toBe("SocialBoost");
    expect(json.start_url).toBe("/dashboard");
  });
});
