import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

type MockWith<T> = import("vitest").Mock<(...args: unknown[]) => unknown> & T;

const mockGetUser = vi.fn();
const mockDeleteEq2 = vi.fn() as MockWith<{ _result?: unknown }>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      if (table === "templates") {
        return {
          delete: () => ({
            eq: (...args: unknown[]) => ({
              eq: (...args2: unknown[]) => {
                mockDeleteEq2(...args, ...args2);
                return mockDeleteEq2._result ?? { error: null };
              },
            }),
          }),
        };
      }
      return {};
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { DELETE } from "@/app/api/templates/[id]/route";

function createDeleteRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  const request = new NextRequest(`http://localhost:3000/api/templates/${id}`, {
    method: "DELETE",
  });
  return [request, { params: Promise.resolve({ id }) }];
}

describe("DELETE /api/templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockDeleteEq2 as ReturnType<typeof vi.fn> & { _result?: unknown })._result = undefined;
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const [request, params] = createDeleteRequest("t1");
    const response = await DELETE(request, params);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns success on delete", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    (mockDeleteEq2 as ReturnType<typeof vi.fn> & { _result?: unknown })._result = {
      error: null,
    };

    const [request, params] = createDeleteRequest("t1");
    const response = await DELETE(request, params);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("returns 500 when delete fails with DB error", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    (mockDeleteEq2 as ReturnType<typeof vi.fn> & { _result?: unknown })._result = {
      error: { message: "DB delete error" },
    };

    const [request, params] = createDeleteRequest("t1");
    const response = await DELETE(request, params);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to delete template");
  });

  it("returns 500 when an unexpected error is thrown", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected crash"));

    const [request, params] = createDeleteRequest("t1");
    const response = await DELETE(request, params);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to delete template");
  });
});
