import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();

// GET chain
const mockListSelect = vi.fn();
const mockListResult = vi.fn();

// POST count chain
const mockCountResult = vi.fn();

// POST insert chain
const mockInsertSingle = vi.fn();

// DELETE chain — capture both .eq() filter args to assert id + user_id scoping.
const mockDeleteEq = vi.fn();
const mockDeleteResult = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: () => ({
      // GET: .select(cols).eq().order().limit()
      // POST count: .select("*", {count,head}).eq()
      select: (...args: unknown[]) => {
        mockListSelect(...args);
        return {
          eq: () => ({
            // GET list
            order: () => ({ limit: () => mockListResult() }),
            // POST count head query resolves directly off .eq()
            then: (cb: (r: { count: number | null }) => unknown) =>
              Promise.resolve(cb(mockCountResult())),
          }),
        };
      },
      // POST insert: .insert(row).select(cols).single()
      insert: () => ({
        select: () => ({ single: () => mockInsertSingle() }),
      }),
      // DELETE: .delete().eq("id", id).eq("user_id", user.id)
      delete: () => ({
        eq: (...args: unknown[]) => {
          mockDeleteEq(...args);
          return {
            eq: (...args2: unknown[]) => {
              mockDeleteEq(...args2);
              return mockDeleteResult();
            },
          };
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 9 }),
}));

import { GET, POST, DELETE } from "@/app/api/keys/route";

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/keys", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 if no user", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns the keys list and never selects key_hash", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      mockListResult.mockResolvedValueOnce({
        data: [{ id: "k1", name: "Default", key_prefix: "sb_12345...", is_active: true }],
        error: null,
      });

      const res = await GET();
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.keys).toHaveLength(1);

      // The select column list must NOT leak the secret hash.
      const selectArg = mockListSelect.mock.calls[0]?.[0] as string;
      expect(selectArg).toBeTypeOf("string");
      expect(selectArg).not.toContain("key_hash");
      expect(selectArg).toContain("key_prefix");
    });
  });

  describe("POST", () => {
    it("returns 401 if no user", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await POST(createPostRequest({ name: "x" }));
      expect(res.status).toBe(401);
    });

    it("rejects with 400 when the user already has 3 keys", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      mockCountResult.mockReturnValueOnce({ count: 3 });

      const res = await POST(createPostRequest({ name: "fourth" }));
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toMatch(/max 3/i);
    });

    it("returns the raw key exactly once on success", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      mockCountResult.mockReturnValueOnce({ count: 1 });
      mockInsertSingle.mockResolvedValueOnce({
        data: { id: "k9", name: "My Key", key_prefix: "sb_abcdef...", created_at: "now" },
        error: null,
      });

      const res = await POST(createPostRequest({ name: "My Key" }));
      const json = await res.json();
      expect(res.status).toBe(200);
      // Raw secret returned this one time, alongside the stored metadata.
      expect(json.key).toMatch(/^sb_[0-9a-f]{48}$/);
      expect(json.id).toBe("k9");
      // The persisted hash is never echoed back to the client.
      expect(json.key_hash).toBeUndefined();
    });
  });

  describe("DELETE", () => {
    it("returns 401 if no user", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await DELETE(createDeleteRequest({ id: "k1" }));
      expect(res.status).toBe(401);
    });

    it("returns 400 if no id", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      const res = await DELETE(createDeleteRequest({}));
      expect(res.status).toBe(400);
    });

    it("scopes the delete to both id and user_id", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      mockDeleteResult.mockResolvedValueOnce({ error: null });

      const res = await DELETE(createDeleteRequest({ id: "k1" }));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);

      // Both filters were applied: .eq("id", "k1") and .eq("user_id", "u1").
      expect(mockDeleteEq).toHaveBeenCalledWith("id", "k1");
      expect(mockDeleteEq).toHaveBeenCalledWith("user_id", "u1");
    });
  });
});
