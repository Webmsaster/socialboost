import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockGetUser = vi.fn();
const mockExportSingle = vi.fn();
const mockExportSelect = vi.fn();

// Server client mock (for auth + export)
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        mockExportSelect(table, ...args);
        return {
          eq: () => ({
            single: () => mockExportSingle(table),
          }),
          order: () => mockExportSelect._orderResult?.[table] ?? { data: [] },
        };
      },
    }),
  }),
}));

// Admin client mock (for delete)
const mockAdminDeleteEq = vi.fn();
const mockAdminDeleteUser = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      delete: () => ({
        eq: (...args: unknown[]) => {
          mockAdminDeleteEq(table, ...args);
          return mockAdminDeleteEq._results?.[table] ?? { error: null };
        },
      }),
    }),
    auth: {
      admin: {
        deleteUser: (...args: unknown[]) => mockAdminDeleteUser(...args),
      },
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { POST as DeleteAccount } from "@/app/api/account/delete/route";
import { GET as ExportAccount } from "@/app/api/account/export/route";

describe("POST /api/account/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockAdminDeleteEq as ReturnType<typeof vi.fn> & { _results?: Record<string, unknown> })._results = undefined;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await DeleteAccount();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("cascades data deletion", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockAdminDeleteUser.mockResolvedValueOnce({ error: null });

    const response = await DeleteAccount();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    // Verify posts, connected_accounts, templates, profiles were deleted
    expect(mockAdminDeleteEq).toHaveBeenCalledWith("posts", "user_id", "user-1");
    expect(mockAdminDeleteEq).toHaveBeenCalledWith("connected_accounts", "user_id", "user-1");
    expect(mockAdminDeleteEq).toHaveBeenCalledWith("templates", "user_id", "user-1");
    expect(mockAdminDeleteEq).toHaveBeenCalledWith("profiles", "id", "user-1");
    expect(mockAdminDeleteUser).toHaveBeenCalledWith("user-1");
  });

  it("returns 500 if posts deletion fails", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    (mockAdminDeleteEq as ReturnType<typeof vi.fn> & { _results?: Record<string, unknown> })._results = {
      posts: { error: { message: "DB error" } },
    };

    const response = await DeleteAccount();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to delete posts");
  });

  it("returns 500 if auth user deletion fails", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockAdminDeleteUser.mockResolvedValueOnce({ error: { message: "Auth delete error" } });

    const response = await DeleteAccount();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to delete account");
  });

  it("returns 500 when an unexpected error is thrown (outer catch)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected crash"));

    const response = await DeleteAccount();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Internal server error");
  });
});

describe("GET /api/account/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockExportSelect as ReturnType<typeof vi.fn> & { _orderResult?: Record<string, unknown> })._orderResult = undefined;
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await ExportAccount();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns JSON with Content-Disposition header", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-1",
          email: "test@example.com",
          created_at: "2026-01-01",
        },
      },
    });
    mockExportSingle.mockReturnValue({
      data: { full_name: "Test User" },
    });
    (mockExportSelect as ReturnType<typeof vi.fn> & { _orderResult?: Record<string, unknown> })._orderResult = {
      posts: { data: [{ id: "p1", content: "Hello" }] },
      templates: { data: [] },
    };

    const response = await ExportAccount();
    const text = await response.text();
    const json = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    expect(response.headers.get("Content-Disposition")).toContain("socialboost-export");
    expect(json.user.id).toBe("user-1");
    expect(json.user.email).toBe("test@example.com");
  });

  it("handles null data from database queries gracefully", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-1",
          email: "test@example.com",
          created_at: "2026-01-01",
        },
      },
    });
    mockExportSingle.mockReturnValue({ data: null });
    // Set _orderResult with null data to trigger ?? [] fallback
    (mockExportSelect as ReturnType<typeof vi.fn> & { _orderResult?: Record<string, unknown> })._orderResult = {
      posts: { data: null },
      templates: { data: null },
    };

    const response = await ExportAccount();
    const text = await response.text();
    const json = JSON.parse(text);

    expect(response.status).toBe(200);
    expect(json.posts).toEqual([]);
    expect(json.templates).toEqual([]);
    expect(json.connected_accounts).toEqual([]);
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Export crash"));

    const response = await ExportAccount();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to export data");
  });
});
