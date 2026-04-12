import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: (table: string) => {
      if (table === "org_members") {
        return {
          select: (...args: unknown[]) => {
            mockSelect(...args);
            return {
              eq: (...eqArgs: unknown[]) => {
                mockEq(...eqArgs);
                return {
                  eq: (...eq2Args: unknown[]) => {
                    mockEq(...eq2Args);
                    return {
                      eq: () => ({ single: () => mockSingle() }),
                      single: () => mockSingle(),
                    };
                  },
                  order: () => ({ limit: () => mockOrder() }),
                  single: () => mockSingle(),
                };
              },
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
        };
      }
      return {
        select: () => ({ eq: () => ({ single: () => mockSingle() }) }),
      };
    },
  }),
}));

vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

import { GET, DELETE } from "@/app/api/team/members/route";

function createGetRequest(orgId: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/team/members?orgId=${orgId}`);
}

function createDeleteRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/team/members", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/team/members", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("GET", () => {
    it("returns 401 if no user", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await GET(createGetRequest("org1"));
      expect(res.status).toBe(401);
    });

    it("returns 400 if no orgId", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      const res = await GET(new NextRequest("http://localhost:3000/api/team/members"));
      expect(res.status).toBe(400);
    });

    it("returns 403 if not a member", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      mockSingle.mockResolvedValueOnce({ data: null });
      const res = await GET(createGetRequest("org1"));
      expect(res.status).toBe(403);
    });

    it("returns members list when authorized", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      mockSingle.mockResolvedValueOnce({ data: { role: "owner" } });
      mockOrder.mockResolvedValueOnce({
        data: [{ id: "m1", user_id: "u1", role: "owner", accepted: true }],
        error: null,
      });
      const res = await GET(createGetRequest("org1"));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.members).toHaveLength(1);
      expect(json.userRole).toBe("owner");
    });
  });

  describe("DELETE", () => {
    it("returns 401 if no user", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await DELETE(createDeleteRequest({ orgId: "org1", memberId: "m1" }));
      expect(res.status).toBe(401);
    });

    it("returns 400 if missing fields", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      const res = await DELETE(createDeleteRequest({ orgId: "org1" }));
      expect(res.status).toBe(400);
    });

    it("returns 403 if not admin/owner", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      mockSingle.mockResolvedValueOnce({ data: { role: "member" } });
      const res = await DELETE(createDeleteRequest({ orgId: "org1", memberId: "m2" }));
      expect(res.status).toBe(403);
    });

    it("returns 403 when trying to remove owner", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      mockSingle
        .mockResolvedValueOnce({ data: { role: "owner" } }) // user is owner
        .mockResolvedValueOnce({ data: { role: "owner", user_id: "u1" } }); // target is also owner
      const res = await DELETE(createDeleteRequest({ orgId: "org1", memberId: "m1" }));
      expect(res.status).toBe(403);
    });

    it("removes a member successfully", async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
      mockSingle
        .mockResolvedValueOnce({ data: { role: "owner" } })
        .mockResolvedValueOnce({ data: { role: "member", user_id: "u2" } });
      mockDelete.mockResolvedValueOnce({ error: null });
      const res = await DELETE(createDeleteRequest({ orgId: "org1", memberId: "m2" }));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });
});
