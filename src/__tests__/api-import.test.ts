import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let mockUser: { id: string } | null = { id: "u1" };
let mockRateOk = true;
let insertedRows: Record<string, unknown>[] | null = null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => Promise.resolve({ data: { user: mockUser } }) },
    from: () => ({
      insert: (rows: Record<string, unknown>[]) => {
        insertedRows = rows;
        return Promise.resolve({ error: null, count: rows.length });
      },
    }),
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () =>
    Promise.resolve({ success: mockRateOk, remaining: 9, limit: 10, reset: 0 }),
}));

vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

import { POST } from "@/app/api/import/route";

function post(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = { id: "u1" };
    mockRateOk = true;
    insertedRows = null;
  });

  it("returns 401 when unauthenticated", async () => {
    mockUser = null;
    const res = await POST(post({ rows: [{ content: "x", platform: "linkedin" }] }));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    mockRateOk = false;
    const res = await POST(post({ rows: [{ content: "x", platform: "linkedin" }] }));
    expect(res.status).toBe(400 + 29);
  });

  it("returns 400 on empty rows and on more than 100 rows", async () => {
    expect((await POST(post({ rows: [] }))).status).toBe(400);
    const many = Array.from({ length: 101 }, () => ({ content: "x", platform: "linkedin" }));
    expect((await POST(post({ rows: many }))).status).toBe(400);
  });

  it("coerces a scheduled row with no date to draft (would otherwise be stuck forever)", async () => {
    const res = await POST(
      post({ rows: [{ content: "Hello world", platform: "linkedin", status: "scheduled" }] }),
    );
    const json = await res.json();
    expect(json.imported).toBe(1);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows![0].status).toBe("draft");
    expect(insertedRows![0].scheduled_for).toBeNull();
  });

  it("keeps a scheduled row when a valid scheduled_for is supplied", async () => {
    const when = "2026-12-01T10:00:00.000Z";
    const res = await POST(
      post({
        rows: [
          { content: "Future post", platform: "twitter", status: "scheduled", scheduled_for: when },
        ],
      }),
    );
    await res.json();
    expect(insertedRows![0].status).toBe("scheduled");
    expect(insertedRows![0].scheduled_for).toBe(when);
  });

  it("skips invalid-platform rows and reports them, importing the rest", async () => {
    const res = await POST(
      post({
        rows: [
          { content: "ok", platform: "linkedin" },
          { content: "bad", platform: "myspace" },
          { content: "", platform: "twitter" },
        ],
      }),
    );
    const json = await res.json();
    expect(json.imported).toBe(1);
    expect(json.skipped).toBe(2);
    expect(json.errors.length).toBeGreaterThanOrEqual(2);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows![0].platform).toBe("linkedin");
  });

  it("falls back to a default tone for unknown tone values", async () => {
    await POST(post({ rows: [{ content: "ok", platform: "linkedin", tone: "weird" }] }));
    expect(insertedRows![0].tone).toBe("professional");
  });
});
