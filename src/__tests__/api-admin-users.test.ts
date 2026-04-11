import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}));

const mockAdminSelect = vi.fn();
const mockAdminIn = vi.fn();
const mockAdminRange = vi.fn();
const mockAdminOr = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "posts") {
        return {
          select: () => ({
            in: (...args: unknown[]) => {
              mockAdminIn(...args);
              return mockAdminIn.mock.results[mockAdminIn.mock.calls.length - 1]?.value ?? { data: [] };
            },
          }),
        };
      }
      return {
        select: (...args: unknown[]) => {
          mockAdminSelect(...args);
          return {
            order: () => ({
              range: (...rangeArgs: unknown[]) => {
                mockAdminRange(...rangeArgs);
                return {
                  or: (...orArgs: unknown[]) => {
                    mockAdminOr(...orArgs);
                    return mockAdminOr.mock.results[mockAdminOr.mock.calls.length - 1]?.value ?? { data: [], count: 0 };
                  },
                  then: undefined,
                  // When no .or() is called (no search), return from range
                  data: mockAdminRange.mock.results[mockAdminRange.mock.calls.length - 1]?.value?.data ?? [],
                  count: mockAdminRange.mock.results[mockAdminRange.mock.calls.length - 1]?.value?.count ?? 0,
                  error: null,
                };
              },
            }),
          };
        },
      };
    },
  })),
}));

const mockIsAdminEmail = vi.fn();
vi.mock("@/lib/admin", () => ({
  isAdminEmail: (...args: unknown[]) => mockIsAdminEmail(...args),
}));

vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

import { GET } from "@/app/api/admin/users/route";

function createRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/admin/users");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

describe("GET /api/admin/users", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 403 if not admin", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1", email: "test@example.com" } } });
    mockIsAdminEmail.mockReturnValueOnce(false);
    const res = await GET(createRequest());
    expect(res.status).toBe(403);
  });

  it("returns 403 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await GET(createRequest());
    expect(res.status).toBe(403);
  });
});
