import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { requireCronAuth } from "@/lib/cron-auth";

const SECRET = "super-secret-cron-token";

function req(authHeader?: string): Request {
  return new Request("http://localhost/api/cron/publish", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("requireCronAuth", () => {
  const original = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });
  afterEach(() => {
    process.env.CRON_SECRET = original;
  });

  it("returns 401 when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    const res = requireCronAuth(req(`Bearer ${SECRET}`));
    expect(res?.status).toBe(401);
  });

  it("returns 401 when the Authorization header is missing", () => {
    expect(requireCronAuth(req())?.status).toBe(401);
  });

  it("returns 401 on a wrong secret of the same length", () => {
    const wrong = "x".repeat(SECRET.length);
    expect(requireCronAuth(req(`Bearer ${wrong}`))?.status).toBe(401);
  });

  it("returns 401 on a length-mismatched token (no timingSafeEqual throw)", () => {
    expect(requireCronAuth(req("Bearer short"))?.status).toBe(401);
  });

  it("returns null (authorized) for the correct bearer token", () => {
    expect(requireCronAuth(req(`Bearer ${SECRET}`))).toBeNull();
  });
});
