import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isAdminEmail } from "@/lib/admin";

describe("isAdminEmail", () => {
  const originalEnv = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    delete process.env.ADMIN_EMAILS;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_EMAILS = originalEnv;
    } else {
      delete process.env.ADMIN_EMAILS;
    }
  });

  it("returns false when ADMIN_EMAILS is not set", () => {
    expect(isAdminEmail("admin@example.com")).toBe(false);
  });

  it("returns false for null email", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(isAdminEmail(null)).toBe(false);
  });

  it("returns false for undefined email", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it("returns true for matching email", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(isAdminEmail("admin@example.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(isAdminEmail("Admin@Example.COM")).toBe(true);
  });

  it("handles comma-separated list", () => {
    process.env.ADMIN_EMAILS = "a@x.com, b@y.com ,c@z.com";
    expect(isAdminEmail("a@x.com")).toBe(true);
    expect(isAdminEmail("b@y.com")).toBe(true);
    expect(isAdminEmail("c@z.com")).toBe(true);
    expect(isAdminEmail("d@w.com")).toBe(false);
  });

  it("returns false for non-matching email", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(isAdminEmail("user@example.com")).toBe(false);
  });

  it("ignores empty entries in the list", () => {
    process.env.ADMIN_EMAILS = "a@x.com,,b@y.com,";
    expect(isAdminEmail("a@x.com")).toBe(true);
    expect(isAdminEmail("b@y.com")).toBe(true);
  });
});
