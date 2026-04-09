import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

import { GET } from "@/app/api/admin/check/route";

describe("GET /api/admin/check", () => {
  const originalAdmins = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalAdmins !== undefined) {
      process.env.ADMIN_EMAILS = originalAdmins;
    } else {
      delete process.env.ADMIN_EMAILS;
    }
  });

  it("returns isAdmin=false when not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isAdmin).toBe(false);
  });

  it("returns isAdmin=true for admin user", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "admin@example.com" } },
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isAdmin).toBe(true);
  });

  it("returns isAdmin=false for non-admin user", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "user@example.com" } },
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isAdmin).toBe(false);
  });

  it("returns isAdmin=false when ADMIN_EMAILS is not set", async () => {
    delete process.env.ADMIN_EMAILS;
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "any@example.com" } },
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.isAdmin).toBe(false);
  });
});
