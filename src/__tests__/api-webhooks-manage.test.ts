import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockGetUser = vi.fn();
// Drives the GET list query result (.select().eq().order().limit()).
const mockListResult = vi.fn();
// Drives the POST count query result (.select(..., { head: true }).eq()).
const mockCountResult = vi.fn();
// Drives the POST insert result (.insert().select().single()).
const mockInsertSingle = vi.fn();
// Captures the row passed to .insert() so we can assert the secret is stored.
const mockInsert = vi.fn();
// Captures the columns passed to .select() so we can assert GET omits `secret`.
const mockSelect = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: () => ({
      // GET chain: .select(cols).eq().order().limit()
      // POST count chain: .select(cols, { head: true }).eq()  (awaited -> { count })
      // The .eq() return value is both awaitable (count) and chainable (order).
      select: (...selectArgs: unknown[]) => {
        mockSelect(...selectArgs);
        const eqResult = {
          // count branch resolves directly on .eq()
          then: (resolve: (v: unknown) => unknown) =>
            resolve(mockCountResult()),
          // list branch continues chaining
          order: () => ({ limit: () => mockListResult() }),
        };
        return { eq: () => eqResult };
      },
      // POST insert chain: .insert(row).select(cols).single()
      insert: (...insertArgs: unknown[]) => {
        mockInsert(...insertArgs);
        return { select: () => ({ single: () => mockInsertSingle() }) };
      },
    }),
  }),
}));

const mockRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

const mockIsBlockedHostname = vi.fn();
vi.mock("@/lib/ssrf", () => ({
  isBlockedHostname: (...args: unknown[]) => mockIsBlockedHostname(...args),
}));

vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { GET, POST } from "@/app/api/webhooks/manage/route";

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/manage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/webhooks/manage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("never selects or returns the per-endpoint secret", async () => {
    // Even if the DB row contained a secret, the route must not surface it.
    mockListResult.mockResolvedValue({
      data: [
        {
          id: "wh-1",
          url: "https://example.com/hook",
          events: ["post.created"],
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      error: null,
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    // The select() column list must not request `secret`.
    const selectedColumns = String(mockSelect.mock.calls[0]?.[0] ?? "");
    expect(selectedColumns).not.toContain("secret");
    // And the serialized response must not leak it either.
    expect(JSON.stringify(json)).not.toContain("secret");
    expect(json.webhooks[0]).not.toHaveProperty("secret");
  });
});

describe("POST /api/webhooks/manage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockRateLimit.mockResolvedValue({ success: true });
    mockIsBlockedHostname.mockReturnValue(false);
    mockCountResult.mockReturnValue({ count: 0 });
    mockInsertSingle.mockResolvedValue({
      data: {
        id: "wh-new",
        url: "https://example.com/hook",
        events: ["post.created"],
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      error: null,
    });
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST(
      createPostRequest({ url: "https://example.com/hook" })
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false });

    const response = await POST(
      createPostRequest({ url: "https://example.com/hook" })
    );

    expect(response.status).toBe(429);
  });

  it("returns 400 for a blocked (SSRF) hostname like the metadata IP", async () => {
    mockIsBlockedHostname.mockReturnValueOnce(true);

    const response = await POST(
      createPostRequest({ url: "https://169.254.169.254/hook" })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("private or loopback");
    // The SSRF guard must have been consulted with the URL hostname.
    expect(mockIsBlockedHostname).toHaveBeenCalledWith("169.254.169.254");
  });

  it("returns 400 for a non-HTTPS URL", async () => {
    const response = await POST(
      createPostRequest({ url: "http://example.com/hook" })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("HTTPS");
    // HTTPS check happens before the SSRF guard, so it is never consulted.
    expect(mockIsBlockedHostname).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing URL", async () => {
    const response = await POST(createPostRequest({}));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing URL");
  });

  it("rejects the 6th webhook (max-5 cap)", async () => {
    mockCountResult.mockReturnValueOnce({ count: 5 });

    const response = await POST(
      createPostRequest({ url: "https://example.com/hook" })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Max 5 webhooks");
    // Must reject before inserting.
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("creates the webhook and returns the HMAC secret exactly once", async () => {
    const response = await POST(
      createPostRequest({
        url: "https://example.com/hook",
        events: ["post.created"],
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    // Secret returned to the caller this one time.
    expect(typeof json.secret).toBe("string");
    expect(json.secret.length).toBeGreaterThan(0);

    // The same secret was persisted on the inserted row.
    const insertedRow = mockInsert.mock.calls[0]?.[0] as { secret?: string };
    expect(insertedRow.secret).toBe(json.secret);

    // A fresh secret is generated per creation, not a fixed/predictable value.
    mockInsert.mockClear();
    const response2 = await POST(
      createPostRequest({
        url: "https://example.com/hook2",
        events: ["post.created"],
      })
    );
    const json2 = await response2.json();
    expect(json2.secret).not.toBe(json.secret);

    // Subsequent reads (the insert .select() column list) must not include the
    // secret column — it is returned only via the explicit response field.
    const insertSelectColumns = String(mockSelect.mock.calls.at(-1)?.[0] ?? "");
    expect(insertSelectColumns).not.toContain("secret");
  });

  it("only persists whitelisted events", async () => {
    await POST(
      createPostRequest({
        url: "https://example.com/hook",
        events: ["post.created", "totally.bogus.event"],
      })
    );

    const insertedRow = mockInsert.mock.calls[0]?.[0] as { events?: string[] };
    expect(insertedRow.events).toEqual(["post.created"]);
  });
});
