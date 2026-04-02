import { test, expect } from "@playwright/test";

// =============================================================================
// Content Generation APIs - Auth Required
// =============================================================================
test.describe("Content Generation APIs", () => {
  test("POST /api/generate rejects without auth", async ({ request }) => {
    const res = await request.post("/api/generate", {
      data: { platform: "linkedin", topic: "test", tone: "professional", language: "en" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/generate-variants rejects without auth", async ({ request }) => {
    const res = await request.post("/api/generate-variants", {
      data: { platform: "linkedin", topic: "test", tone: "professional", language: "en", count: 3 },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/generate-carousel rejects without auth", async ({ request }) => {
    const res = await request.post("/api/generate-carousel", {
      data: { topic: "test", tone: "professional", platform: "linkedin", slideCount: 5 },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/generate-image rejects without auth", async ({ request }) => {
    const res = await request.post("/api/generate-image", {
      data: { prompt: "test image" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/generate-video-script rejects without auth", async ({ request }) => {
    const res = await request.post("/api/generate-video-script", {
      data: { topic: "test", tone: "professional", platform: "linkedin", language: "en" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/generate-video-ad rejects without auth", async ({ request }) => {
    const res = await request.post("/api/generate-video-ad", {
      data: { topic: "test", tone: "professional", product: "TestBrand", language: "en" },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// =============================================================================
// Content Processing APIs - Auth Required
// =============================================================================
test.describe("Content Processing APIs", () => {
  test("POST /api/repurpose rejects without auth", async ({ request }) => {
    const res = await request.post("/api/repurpose", {
      data: { content: "test", sourcePlatform: "linkedin", targetPlatforms: ["twitter"], tone: "professional", language: "en" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/hashtags rejects without auth", async ({ request }) => {
    const res = await request.post("/api/hashtags", {
      data: { topic: "test", platform: "linkedin" },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// =============================================================================
// Template APIs - Auth Required
// =============================================================================
test.describe("Template APIs", () => {
  test("GET /api/templates rejects without auth", async ({ request }) => {
    const res = await request.get("/api/templates");
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/templates rejects without auth", async ({ request }) => {
    const res = await request.post("/api/templates", {
      data: { name: "Test", platform: "linkedin", tone: "professional" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("DELETE /api/templates/[id] rejects without auth", async ({ request }) => {
    const res = await request.delete("/api/templates/fake-id");
    expect([401, 403, 405]).toContain(res.status());
  });
});

// =============================================================================
// Account APIs - Auth Required
// =============================================================================
test.describe("Account APIs", () => {
  test("POST /api/account/delete rejects without auth", async ({ request }) => {
    const res = await request.post("/api/account/delete");
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/account/export rejects without auth", async ({ request }) => {
    const res = await request.get("/api/account/export");
    expect([401, 403]).toContain(res.status());
  });
});

// =============================================================================
// Stripe APIs
// =============================================================================
test.describe("Stripe APIs", () => {
  test("POST /api/stripe/checkout rejects without auth", async ({ request }) => {
    const res = await request.post("/api/stripe/checkout");
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/stripe/portal rejects without auth", async ({ request }) => {
    const res = await request.post("/api/stripe/portal");
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/stripe/webhook returns 400 without valid signature", async ({ request }) => {
    const res = await request.post("/api/stripe/webhook", {
      data: "{}",
      headers: { "Content-Type": "text/plain" },
    });
    expect([400, 500]).toContain(res.status());
  });
});

// =============================================================================
// OAuth APIs - Auth Required
// =============================================================================
test.describe("OAuth APIs", () => {
  test("POST /api/auth/oauth/connect rejects without auth", async ({ request }) => {
    const res = await request.post("/api/auth/oauth/connect", {
      data: { platform: "linkedin" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/auth/oauth/disconnect rejects without auth", async ({ request }) => {
    const res = await request.post("/api/auth/oauth/disconnect", {
      data: { platform: "linkedin" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/auth/oauth/callback redirects without code param", async ({ request }) => {
    const res = await request.get("/api/auth/oauth/callback", { maxRedirects: 0 });
    expect([302, 307]).toContain(res.status());
  });
});

// =============================================================================
// Referral APIs - Auth Required
// =============================================================================
test.describe("Referral APIs", () => {
  test("GET /api/referral rejects without auth", async ({ request }) => {
    const res = await request.get("/api/referral");
    expect(res.status()).toBe(401);
  });

  test("POST /api/referral/claim rejects without auth or data", async ({ request }) => {
    const res = await request.post("/api/referral/claim", { data: {} });
    expect([400, 401, 403]).toContain(res.status());
  });
});

// =============================================================================
// Team APIs - Auth Required
// =============================================================================
test.describe("Team APIs", () => {
  test("GET /api/team rejects without auth", async ({ request }) => {
    const res = await request.get("/api/team");
    expect(res.status()).toBe(401);
  });

  test("POST /api/team rejects without auth", async ({ request }) => {
    const res = await request.post("/api/team", {
      data: { name: "Test Team" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/team/invite rejects without auth", async ({ request }) => {
    const res = await request.post("/api/team/invite", {
      data: { orgId: "fake-id", email: "test@test.com" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("POST /api/team/accept rejects without auth", async ({ request }) => {
    const res = await request.post("/api/team/accept", {
      data: { orgId: "fake-id" },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// =============================================================================
// Webhook & Cron APIs
// =============================================================================
test.describe("Webhook & Cron APIs", () => {
  test("POST /api/webhooks/test rejects without auth", async ({ request }) => {
    const res = await request.post("/api/webhooks/test", {
      data: { webhookUrl: "https://example.com" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/cron/publish respects CRON_SECRET", async ({ request }) => {
    const res = await request.get("/api/cron/publish");
    // Without CRON_SECRET: processes (200). With it: 401.
    expect([200, 401]).toContain(res.status());
  });
});

// =============================================================================
// Metrics API - Auth Required
// =============================================================================
test.describe("Metrics API", () => {
  test("GET /api/metrics rejects without auth", async ({ request }) => {
    const res = await request.get("/api/metrics");
    expect(res.status()).toBe(401);
  });
});

// =============================================================================
// Method Validation - wrong HTTP methods
// =============================================================================
test.describe("Method Validation", () => {
  test("GET /api/generate returns 405 or rejects", async ({ request }) => {
    const res = await request.get("/api/generate");
    expect([401, 403, 405]).toContain(res.status());
  });

  test("GET /api/stripe/checkout returns 405 or rejects", async ({ request }) => {
    const res = await request.get("/api/stripe/checkout");
    expect([401, 403, 405]).toContain(res.status());
  });

  test("GET /api/account/delete returns 405 or rejects", async ({ request }) => {
    const res = await request.get("/api/account/delete");
    expect([401, 403, 405]).toContain(res.status());
  });

  test("POST /api/metrics returns 405 or rejects", async ({ request }) => {
    const res = await request.post("/api/metrics", { data: {} });
    expect([401, 403, 405]).toContain(res.status());
  });

  test("POST /api/referral returns 405 or rejects", async ({ request }) => {
    const res = await request.post("/api/referral", { data: {} });
    expect([401, 403, 405]).toContain(res.status());
  });

  test("GET /api/repurpose returns 405 or rejects", async ({ request }) => {
    const res = await request.get("/api/repurpose");
    expect([401, 403, 405]).toContain(res.status());
  });

  test("GET /api/hashtags returns 405 or rejects", async ({ request }) => {
    const res = await request.get("/api/hashtags");
    expect([401, 403, 405]).toContain(res.status());
  });

  test("GET /api/generate-carousel returns 405 or rejects", async ({ request }) => {
    const res = await request.get("/api/generate-carousel");
    expect([401, 403, 405]).toContain(res.status());
  });

  test("GET /api/generate-video-script returns 405 or rejects", async ({ request }) => {
    const res = await request.get("/api/generate-video-script");
    expect([401, 403, 405]).toContain(res.status());
  });

  test("GET /api/generate-video-ad returns 405 or rejects", async ({ request }) => {
    const res = await request.get("/api/generate-video-ad");
    expect([401, 403, 405]).toContain(res.status());
  });

  test("GET /api/generate-variants returns 405 or rejects", async ({ request }) => {
    const res = await request.get("/api/generate-variants");
    expect([401, 403, 405]).toContain(res.status());
  });

  test("GET /api/generate-image returns 405 or rejects", async ({ request }) => {
    const res = await request.get("/api/generate-image");
    expect([401, 403, 405]).toContain(res.status());
  });
});

// =============================================================================
// Empty / Malformed Request Bodies
// =============================================================================
test.describe("Malformed Requests", () => {
  test("POST /api/generate with empty body rejects", async ({ request }) => {
    const res = await request.post("/api/generate", { data: {} });
    expect([400, 401, 403]).toContain(res.status());
  });

  test("POST /api/generate-carousel with empty body rejects", async ({ request }) => {
    const res = await request.post("/api/generate-carousel", { data: {} });
    expect([400, 401, 403]).toContain(res.status());
  });

  test("POST /api/templates with empty body rejects", async ({ request }) => {
    const res = await request.post("/api/templates", { data: {} });
    expect([400, 401, 403]).toContain(res.status());
  });

  test("POST /api/team/invite with empty body rejects", async ({ request }) => {
    const res = await request.post("/api/team/invite", { data: {} });
    expect([400, 401, 403]).toContain(res.status());
  });
});
