import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              order: (...orderArgs: unknown[]) => {
                mockOrder(...orderArgs);
                const result = mockOrder.mock.results[mockOrder.mock.calls.length - 1]?.value ?? { data: [], error: null };
                return { ...result, limit: () => result };
              },
            };
          },
        };
      },
      insert: (...args: unknown[]) => {
        mockInsert(...args);
        return {
          select: () => ({
            single: () => mockSingle(),
          }),
        };
      },
      delete: () => ({
        eq: (...args: unknown[]) => {
          mockEq(...args);
          return {
            eq: () => mockDelete(),
          };
        },
      }),
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return {
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: () => mockSingle(),
              }),
            }),
          }),
        };
      },
    }),
  }),
}));

vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

import { GET, POST, DELETE, PATCH } from "@/app/api/series/route";

function createRequest(method: string, body?: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/series", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("/api/series", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("GET", () => {
    it("returns 401 if no user", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns series list", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      mockOrder.mockReturnValueOnce({ data: [{ id: "s1", name: "Test" }], error: null });
      const res = await GET();
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.series).toHaveLength(1);
    });
  });

  describe("POST", () => {
    it("returns 401 if no user", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await POST(createRequest("POST", { name: "Test", platform: "linkedin", topicTemplate: "test" }));
      expect(res.status).toBe(401);
    });

    it("returns 400 if missing required fields", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      const res = await POST(createRequest("POST", { name: "", platform: "linkedin" }));
      expect(res.status).toBe(400);
    });

    it("creates a series successfully", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      mockSingle.mockResolvedValueOnce({ data: { id: "s1", name: "Weekly Tips" }, error: null });
      const res = await POST(createRequest("POST", {
        name: "Weekly Tips",
        platform: "linkedin",
        topicTemplate: "Share a tip about productivity",
        frequency: "weekly",
        dayOfWeek: 1,
      }));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.name).toBe("Weekly Tips");
    });
  });

  describe("DELETE", () => {
    it("returns 401 if no user", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await DELETE(createRequest("DELETE", { id: "s1" }));
      expect(res.status).toBe(401);
    });

    it("returns 400 if no id", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      const res = await DELETE(createRequest("DELETE", {}));
      expect(res.status).toBe(400);
    });

    it("deletes a series", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      mockDelete.mockResolvedValueOnce({ error: null });
      const res = await DELETE(createRequest("DELETE", { id: "s1" }));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe("PATCH", () => {
    it("returns 401 if no user", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await PATCH(createRequest("PATCH", { id: "s1", isActive: false }));
      expect(res.status).toBe(401);
    });

    it("returns 400 if missing fields", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      const res = await PATCH(createRequest("PATCH", { id: "s1" }));
      expect(res.status).toBe(400);
    });

    it("toggles active status", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      mockSingle.mockResolvedValueOnce({ data: { id: "s1", is_active: false }, error: null });
      const res = await PATCH(createRequest("PATCH", { id: "s1", isActive: false }));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.is_active).toBe(false);
    });
  });
});
