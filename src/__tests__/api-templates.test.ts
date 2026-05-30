import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockGetUser = vi.fn();
const mockInsertSingle = vi.fn();
const mockListResult = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: () => ({
      // GET chain: .select().order().limit()
      select: () => ({
        order: () => ({ limit: () => mockListResult() }),
      }),
      // POST chain: .insert().select().single()
      insert: () => ({
        select: () => ({ single: () => mockInsertSingle() }),
      }),
    }),
  }),
}));

const mockRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

import { GET, POST } from "@/app/api/templates/route";

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: "My Template",
  platform: "linkedin",
  tone: "professional",
  topic: "A valid template body about product launches.",
  language: "English",
};

describe("GET /api/templates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockListResult.mockResolvedValue({ data: [], error: null });
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns templates list on success", async () => {
    const rows = [{ id: "t1", name: "My Template", platform: "linkedin" }];
    mockListResult.mockResolvedValueOnce({ data: rows, error: null });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual(rows);
  });

  it("returns 500 on DB error", async () => {
    mockListResult.mockResolvedValueOnce({
      data: null,
      error: { message: "DB error" },
    });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/templates validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
    mockRateLimit.mockResolvedValue({ success: true });
    mockInsertSingle.mockResolvedValue({ data: { id: "tpl_1" }, error: null });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(createRequest(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false });
    const res = await POST(createRequest(validBody));
    expect(res.status).toBe(429);
  });

  it("returns 400 for an invalid language", async () => {
    // "fr" is the locale code, not the display name the UI/DB use, so it is rejected.
    const res = await POST(createRequest({ ...validBody, language: "fr" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("language");
  });

  it("returns 400 for an empty (whitespace) name", async () => {
    const res = await POST(createRequest({ ...validBody, name: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a missing name", async () => {
    const { name: _omit, ...rest } = validBody;
    void _omit;
    const res = await POST(createRequest(rest));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an overlong name (>100 chars)", async () => {
    const res = await POST(
      createRequest({ ...validBody, name: "x".repeat(101) })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an overlong topic/body (>5000 chars)", async () => {
    const res = await POST(
      createRequest({ ...validBody, topic: "x".repeat(5001) })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an empty (whitespace) topic when provided", async () => {
    const res = await POST(createRequest({ ...validBody, topic: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown platform", async () => {
    const res = await POST(
      createRequest({ ...validBody, platform: "myspace" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown tone", async () => {
    const res = await POST(createRequest({ ...validBody, tone: "angry" }));
    expect(res.status).toBe(400);
  });

  it("accepts the languages the templates UI offers", async () => {
    for (const language of ["English", "German", "French", "Spanish"]) {
      const res = await POST(createRequest({ ...validBody, language }));
      expect(res.status).toBe(201);
    }
  });

  it("returns 201 for a valid payload", async () => {
    const res = await POST(createRequest(validBody));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json).toEqual({ id: "tpl_1" });
  });

  it("succeeds when topic and language are omitted (defaults applied)", async () => {
    const res = await POST(
      createRequest({
        name: "Minimal",
        platform: "twitter",
        tone: "casual",
      })
    );
    expect(res.status).toBe(201);
  });
});
