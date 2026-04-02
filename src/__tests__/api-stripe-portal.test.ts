import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockGetUser = vi.fn();
const mockProfileSingle = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockProfileSingle(),
        }),
      }),
    }),
  }),
}));

const mockRateLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

const mockCreatePortalSession = vi.fn();
vi.mock("@/lib/stripe", () => ({
  createPortalSession: (...args: unknown[]) =>
    mockCreatePortalSession(...args),
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { POST } from "@/app/api/stripe/portal/route";

describe("POST /api/stripe/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 if rate limited", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: false });

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
  });

  it("returns 400 if no stripe_customer_id", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockProfileSingle.mockResolvedValueOnce({
      data: { stripe_customer_id: null },
    });

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("No active subscription");
  });

  it("returns portal URL on success", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockProfileSingle.mockResolvedValueOnce({
      data: { stripe_customer_id: "cus_123" },
    });
    mockCreatePortalSession.mockResolvedValueOnce({
      url: "https://billing.stripe.com/portal-session",
    });

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.url).toBe("https://billing.stripe.com/portal-session");
    expect(mockCreatePortalSession).toHaveBeenCalledWith("cus_123");
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockProfileSingle.mockResolvedValueOnce({
      data: { stripe_customer_id: "cus_123" },
    });
    mockCreatePortalSession.mockRejectedValueOnce(new Error("Stripe error"));

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to create portal session");
  });
});
