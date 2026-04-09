import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks ---

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

type CountResult = { count: number | null };
const mockHead = vi.fn<() => CountResult>();

// All terminal query ops return the same thenable type, so Promise.all
// awaits them uniformly. mockHead is called inside the .then handler,
// which runs in microtask order matching Promise.all's iteration order.
function makeCountThenable() {
  return {
    then: (onFulfilled: (v: CountResult) => unknown) =>
      Promise.resolve().then(() => onFulfilled(mockHead())),
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        ...makeCountThenable(),
        eq: () => makeCountThenable(),
        gte: () => makeCountThenable(),
      }),
    }),
  }),
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

import { GET } from "@/app/api/admin/metrics/route";

describe("GET /api/admin/metrics", () => {
  const originalAdmins = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  });

  afterEach(() => {
    if (originalAdmins !== undefined) {
      process.env.ADMIN_EMAILS = originalAdmins;
    } else {
      delete process.env.ADMIN_EMAILS;
    }
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when user is not in admin list", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "random@user.com" } },
    });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Forbidden");
  });

  it("returns 403 when ADMIN_EMAILS is not set", async () => {
    delete process.env.ADMIN_EMAILS;
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "anyone@example.com" } },
    });

    const res = await GET();

    expect(res.status).toBe(403);
  });

  it("returns metrics for admin user", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "admin@example.com" } },
    });

    // 5 count queries: totalUsers, activeSubs, postsLast7d, postsLast30d, newUsersLast7d
    mockHead
      .mockReturnValueOnce({ count: 1000 })
      .mockReturnValueOnce({ count: 50 })
      .mockReturnValueOnce({ count: 200 })
      .mockReturnValueOnce({ count: 800 })
      .mockReturnValueOnce({ count: 20 });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.totalUsers).toBe(1000);
    expect(json.activeSubscriptions).toBe(50);
    expect(json.postsLast7d).toBe(200);
    expect(json.postsLast30d).toBe(800);
    expect(json.newUsersLast7d).toBe(20);
    expect(json.estimatedMrr).toBe(450); // 50 × $9
  });

  it("handles null counts with 0 fallback", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "admin@example.com" } },
    });

    mockHead
      .mockReturnValueOnce({ count: null })
      .mockReturnValueOnce({ count: null })
      .mockReturnValueOnce({ count: null })
      .mockReturnValueOnce({ count: null })
      .mockReturnValueOnce({ count: null });

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.totalUsers).toBe(0);
    expect(json.activeSubscriptions).toBe(0);
    expect(json.estimatedMrr).toBe(0);
  });

  it("returns 500 on unexpected error", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    mockGetUser.mockRejectedValueOnce(new Error("DB connection lost"));

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to fetch metrics");
  });
});
