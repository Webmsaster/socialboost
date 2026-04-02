import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockGetUser = vi.fn();
const mockSelectSingle = vi.fn();
const mockSelectCount = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        // Check if count query
        if (args[1] && typeof args[1] === "object" && "count" in (args[1] as Record<string, unknown>)) {
          return {
            eq: () => mockSelectCount(table),
          };
        }
        return {
          eq: () => ({
            single: () => mockSelectSingle(table),
          }),
        };
      },
    }),
  }),
}));

// Admin client mock (for referral/claim)
const mockAdminSelectSingle = vi.fn();
const mockAdminInsert = vi.fn();
const mockAdminRpc = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: (...eqArgs: unknown[]) => ({
          single: () => mockAdminSelectSingle(table, ...eqArgs),
          eq: (...eq2Args: unknown[]) => ({
            single: () => mockAdminSelectSingle(table, ...eqArgs, ...eq2Args),
          }),
        }),
      }),
      insert: (data: unknown) => mockAdminInsert(table, data),
    }),
    rpc: (...args: unknown[]) => mockAdminRpc(...args),
  }),
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { GET } from "@/app/api/referral/route";
import { POST as ClaimPost } from "@/app/api/referral/claim/route";

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/referral/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/referral", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("handles null profile and count gracefully", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockSelectSingle.mockReturnValueOnce({
      data: null,
    });
    mockSelectCount.mockReturnValueOnce({ count: null });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.bonusGenerations).toBe(0);
    expect(json.totalReferrals).toBe(0);
    expect(json.referralCode).toBeUndefined();
  });

  it("returns referral info", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockSelectSingle.mockReturnValueOnce({
      data: { referral_code: "ABC123", bonus_generations: 20 },
    });
    mockSelectCount.mockReturnValueOnce({ count: 3 });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.referralCode).toBe("ABC123");
    expect(json.bonusGenerations).toBe(20);
    expect(json.totalReferrals).toBe(3);
    expect(json.referralLink).toContain("ref=ABC123");
  });
});

describe("POST /api/referral/claim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  });

  it("returns 400 if missing fields", async () => {
    const response = await ClaimPost(createRequest({ referralCode: "" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing fields");
  });

  it("returns 400 for self-referral", async () => {
    // Referrer found, but referrer.id === newUserId
    mockAdminSelectSingle.mockReturnValueOnce({
      data: { id: "user-1" },
    });

    const response = await ClaimPost(
      createRequest({ referralCode: "ABC123", newUserId: "user-1" })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Invalid referral");
  });

  it("returns 409 if already referred", async () => {
    // Referrer found
    mockAdminSelectSingle.mockReturnValueOnce({
      data: { id: "referrer-1" },
    });
    // Existing referral found
    mockAdminSelectSingle.mockReturnValueOnce({
      data: { id: "existing-ref" },
    });

    const response = await ClaimPost(
      createRequest({ referralCode: "ABC123", newUserId: "user-2" })
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toContain("Already referred");
  });

  it("grants bonus on success", async () => {
    // Referrer found
    mockAdminSelectSingle.mockReturnValueOnce({
      data: { id: "referrer-1" },
    });
    // No existing referral
    mockAdminSelectSingle.mockReturnValueOnce({
      data: null,
    });
    // Insert success
    mockAdminInsert.mockReturnValueOnce({ error: null });
    // RPC success
    mockAdminRpc.mockResolvedValueOnce({ data: null, error: null });

    const response = await ClaimPost(
      createRequest({ referralCode: "ABC123", newUserId: "user-2" })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.bonus).toBe(10);
    expect(mockAdminRpc).toHaveBeenCalledWith(
      "grant_referral_bonus",
      expect.objectContaining({
        p_referrer_id: "referrer-1",
        p_referred_id: "user-2",
        p_bonus: 10,
      })
    );
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    // Make the admin client throw during select (referrer lookup)
    mockAdminSelectSingle.mockImplementationOnce(() => {
      throw new Error("Unexpected crash");
    });

    const response = await ClaimPost(
      createRequest({ referralCode: "ABC123", newUserId: "user-2" })
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed");
  });
});
