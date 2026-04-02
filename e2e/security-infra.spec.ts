import { test, expect } from "@playwright/test";

// =============================================================================
// CSRF Protection
// =============================================================================
test.describe("CSRF Protection", () => {
  test("POST /api/generate without Origin header → 403 with CSRF validation failed", async ({ request }) => {
    const res = await request.post("/api/generate", {
      data: { platform: "linkedin", topic: "test", tone: "professional", language: "en" },
      headers: {
        // Explicitly remove origin/referer by not including them
        "Content-Type": "application/json",
      },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("CSRF validation failed");
  });

  test("POST /api/generate with valid Origin → NOT 403 (should be 401 for auth)", async ({ request }) => {
    const res = await request.post("/api/generate", {
      data: { platform: "linkedin", topic: "test", tone: "professional", language: "en" },
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
    });
    // Should pass CSRF check but fail on auth
    expect(res.status()).not.toBe(403);
    expect([401, 400, 500]).toContain(res.status());
  });

  test("POST /api/stripe/webhook (CSRF exempt) → NOT 403", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", {
      data: "{}",
      headers: { "Content-Type": "text/plain" },
    });
    // Webhook is exempt from CSRF — should get 400 or 500 (bad signature), not 403
    expect(res.status()).not.toBe(403);
  });

  test("DELETE /api/templates/fake-id without Origin → 403", async ({ request }) => {
    const res = await request.delete("/api/templates/fake-id", {
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status()).toBe(403);
  });
});

// =============================================================================
// Auth Callback
// =============================================================================
test.describe("Auth Callback", () => {
  test("GET /auth/callback without params → redirects (doesn't crash)", async ({ request }) => {
    const res = await request.get("/auth/callback", { maxRedirects: 0 });
    // Should redirect to /dashboard (default next) or similar
    expect([302, 307, 308]).toContain(res.status());
  });
});

// =============================================================================
// Sitemap Verification
// =============================================================================
test.describe("Sitemap", () => {
  test("sitemap.xml has at least 10 URLs and all return 200", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();

    // Extract all URLs from the sitemap
    const urlMatches = xml.match(/<loc>(.*?)<\/loc>/g);
    expect(urlMatches).not.toBeNull();
    const urls = urlMatches!.map((match) => match.replace(/<\/?loc>/g, ""));

    // Verify at least 10 URLs
    expect(urls.length).toBeGreaterThanOrEqual(10);

    // Verify every URL starts with expected base URL
    for (const url of urls) {
      expect(url).toMatch(/^https?:\/\//);
    }

    // Verify each URL returns 200 (convert absolute URLs to relative paths for local testing)
    for (const url of urls) {
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname;
      const pageRes = await request.get(path);
      expect(pageRes.status(), `Expected 200 for ${path}`).toBe(200);
    }
  });
});

// =============================================================================
// Security Headers on Public Pages
// =============================================================================
test.describe("Security Headers", () => {
  const publicPages = ["/", "/features", "/pricing", "/blog", "/login", "/signup"];

  for (const path of publicPages) {
    test(`${path} has X-Content-Type-Options: nosniff`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    });

    test(`${path} does NOT expose X-Powered-By header`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.headers()["x-powered-by"]).toBeUndefined();
    });

    test(`${path} has Referrer-Policy header`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.headers()["referrer-policy"]).toBeTruthy();
    });
  }
});

// =============================================================================
// Content-Type Verification
// =============================================================================
test.describe("Content-Type Verification", () => {
  test("API routes return application/json", async ({ request }) => {
    // POST to generate without origin → CSRF 403, but still JSON
    const res = await request.post("/api/generate", {
      data: {},
      headers: { "Content-Type": "application/json" },
    });
    expect(res.headers()["content-type"]).toContain("application/json");
  });

  test("HTML pages return text/html", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["content-type"]).toContain("text/html");
  });
});
