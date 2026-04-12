import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

type MockWith<T> = import("vitest").Mock<(...args: unknown[]) => unknown> & T;

const mockGetUser = vi.fn();
const mockOrder = vi.fn() as MockWith<{ _result?: unknown }>;
const mockSelectChain = vi.fn();
const mockInsertSingle = vi.fn();
const mockDeleteEq2 = vi.fn() as MockWith<{ _result?: unknown }>;
const mockDeleteEq1 = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      if (table === "templates") {
        return {
          select: (...args: unknown[]) => {
            mockSelectChain(...args);
            type OrderResult = { data: unknown; error: unknown; limit: () => OrderResult };
            const orderResult: OrderResult = {
              get data() { return (mockOrder._result as { data?: unknown })?.data ?? []; },
              get error() { return (mockOrder._result as { error?: unknown })?.error ?? null; },
              limit: () => orderResult,
            };
            return {
              order: (...oArgs: unknown[]) => {
                mockOrder(...oArgs);
                return orderResult;
              },
            };
          },
          insert: (row: unknown) => ({
            select: () => ({
              single: () => mockInsertSingle(row),
            }),
          }),
          delete: () => ({
            eq: (...args: unknown[]) => {
              mockDeleteEq1(...args);
              return {
                eq: (...args2: unknown[]) => {
                  mockDeleteEq2(...args2);
                  return mockDeleteEq2._result ?? { error: null };
                },
              };
            },
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
import { GET, POST } from "@/app/api/templates/route";
import { DELETE } from "@/app/api/templates/[id]/route";

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockOrder as ReturnType<typeof vi.fn> & { _result?: unknown })._result = undefined;
    (mockDeleteEq2 as ReturnType<typeof vi.fn> & { _result?: unknown })._result = undefined;
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns templates list on success", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    const templates = [
      { id: "t1", name: "My Template", platform: "linkedin" },
    ];
    (mockOrder as ReturnType<typeof vi.fn> & { _result?: unknown })._result = {
      data: templates,
      error: null,
    };

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual(templates);
  });

  it("returns 500 on DB error", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    (mockOrder as ReturnType<typeof vi.fn> & { _result?: unknown })._result = {
      data: null,
      error: { message: "DB error" },
    };

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to load templates");
  });

  it("returns 500 when an unexpected error is thrown (GET catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected GET error"));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to load templates");
  });
});

describe("POST /api/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = createPostRequest({ name: "T", platform: "linkedin", tone: "casual" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 if missing name/platform/tone", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });

    const request = createPostRequest({ name: "T" });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing required fields");
  });

  it("returns 400 for invalid platform", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });

    const request = createPostRequest({
      name: "T",
      platform: "tiktok",
      tone: "casual",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid platform");
  });

  it("returns 400 for invalid tone", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });

    const request = createPostRequest({
      name: "T",
      platform: "linkedin",
      tone: "angry",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid tone");
  });

  it("returns 201 with created template on success", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    const created = {
      id: "t1",
      name: "My Template",
      platform: "linkedin",
      tone: "professional",
    };
    mockInsertSingle.mockResolvedValueOnce({ data: created, error: null });

    const request = createPostRequest({
      name: "My Template",
      platform: "linkedin",
      tone: "professional",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toEqual(created);
  });

  it("returns 500 when insert returns a DB error (POST inner catch)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockInsertSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "DB constraint violation" },
    });

    const request = createPostRequest({
      name: "My Template",
      platform: "linkedin",
      tone: "professional",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to create template");
  });

  it("returns 500 when an unexpected error is thrown (POST catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected POST error"));

    const request = createPostRequest({
      name: "My Template",
      platform: "linkedin",
      tone: "professional",
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to create template");
  });
});

describe("DELETE /api/templates/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockDeleteEq2 as ReturnType<typeof vi.fn> & { _result?: unknown })._result = undefined;
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = new NextRequest("http://localhost:3000/api/templates/t1", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "t1" }),
    });
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

    const request = new NextRequest("http://localhost:3000/api/templates/t1", {
      method: "DELETE",
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: "t1" }),
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });
});
