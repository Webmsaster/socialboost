import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

const mockCreateCheckoutSession = vi.fn();
vi.mock("@/lib/stripe", () => ({
  createCheckoutSession: (...args: unknown[]) =>
    mockCreateCheckoutSession(...args),
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { POST } from "@/app/api/stripe/checkout/route";

function createRequest(body?: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/stripe/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileSingle.mockResolvedValue({ data: { stripe_customer_id: null } });
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST(createRequest());
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 429 if rate limited", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: false });

    const response = await POST(createRequest());
    const json = await response.json();

    expect(response.status).toBe(429);
    expect(json.error).toContain("Too many requests");
  });

  it("returns 400 if no email", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: null } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });

    const response = await POST(createRequest());
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("No email");
  });

  it("returns checkout URL for monthly plan", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockCreateCheckoutSession.mockResolvedValueOnce({
      url: "https://checkout.stripe.com/session-monthly",
    });

    const response = await POST(createRequest({ plan: "monthly" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.url).toBe("https://checkout.stripe.com/session-monthly");
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      "user-1",
      "test@example.com",
      "monthly",
      null
    );
  });

  it("returns checkout URL for annual plan", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockCreateCheckoutSession.mockResolvedValueOnce({
      url: "https://checkout.stripe.com/session-annual",
    });

    const response = await POST(createRequest({ plan: "annual" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.url).toBe("https://checkout.stripe.com/session-annual");
    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      "user-1",
      "test@example.com",
      "annual",
      null
    );
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "test@example.com" } },
    });
    mockRateLimit.mockResolvedValueOnce({ success: true });
    mockCreateCheckoutSession.mockRejectedValueOnce(new Error("Stripe error"));

    const response = await POST(createRequest({ plan: "monthly" }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to create checkout session");
  });
});
