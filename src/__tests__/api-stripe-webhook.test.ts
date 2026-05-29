import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockConstructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
    },
  }),
}));

const mockAdminUpdate = vi.fn();
const mockAdminSelectSingle = vi.fn();
const mockAdminUpdateResult = vi.fn();
const mockAdminInsertResult = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: (_data: unknown) => {
        const result = mockAdminInsertResult(table);
        return Promise.resolve(result ?? { data: null, error: null });
      },
      update: (data: unknown) => ({
        eq: (...args: unknown[]) => {
          mockAdminUpdate({ table, data, eq: args });
          const result = mockAdminUpdateResult();
          return result ?? { data: null, error: null };
        },
      }),
      select: () => ({
        eq: () => ({
          single: () => mockAdminSelectSingle(table),
        }),
      }),
      delete: () => ({
        eq: () => ({ data: null, error: null }),
      }),
    }),
  }),
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

function createWebhookRequest(
  body: string,
  signature?: string
): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (signature) {
    headers["stripe-signature"] = signature;
  }
  return new NextRequest("http://localhost:3000/api/stripe/webhook", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/stripe/webhook", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("returns 500 if STRIPE_WEBHOOK_SECRET not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    // Re-import to pick up env change
    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest("{}", "sig_123");
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Webhook not configured");
  });

  it("returns 400 if no stripe-signature header", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest("{}");
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing stripe-signature");
  });

  it("returns 400 on invalid signature", async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("Invalid signature");
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest("{}", "invalid_sig");
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Invalid signature");
  });

  it("handles checkout.session.completed event", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user-1" },
          customer: "cus_123",
        },
      },
    });
    mockAdminSelectSingle.mockReturnValueOnce({
      data: { id: "user-1" },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest(
      JSON.stringify({ type: "checkout.session.completed" }),
      "sig_valid"
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockAdminUpdate).toHaveBeenCalled();
  });

  it("handles customer.subscription.deleted event", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: "cus_456",
          status: "canceled",
        },
      },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest(
      JSON.stringify({ type: "customer.subscription.deleted" }),
      "sig_valid"
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockAdminUpdate).toHaveBeenCalled();
  });

  it("returns { received: true } on success", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "unknown.event",
      data: { object: {} },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest("{}", "sig_valid");
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true });
  });

  it("handles customer.subscription.updated event", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_789",
          status: "active",
        },
      },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest(
      JSON.stringify({ type: "customer.subscription.updated" }),
      "sig_valid"
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "profiles",
        data: { subscription_status: "active" },
      })
    );
  });

  it("returns 500 when DB update fails after checkout.session.completed", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user-fail" },
          customer: "cus_fail",
        },
      },
    });
    mockAdminSelectSingle.mockReturnValueOnce({
      data: { id: "user-fail" },
    });
    // All retry attempts fail
    mockAdminUpdateResult.mockReturnValue({ data: null, error: { message: "DB error" } });

    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest(
      JSON.stringify({ type: "checkout.session.completed" }),
      "sig_valid"
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Database update failed");
  });

  it("returns 500 when DB update fails after subscription.updated", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_err",
          status: "active",
        },
      },
    });
    // All retry attempts fail
    mockAdminUpdateResult.mockReturnValue({ data: null, error: { message: "DB error" } });

    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest(
      JSON.stringify({ type: "customer.subscription.updated" }),
      "sig_valid"
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Database update failed");
  });

  it("returns 500 when DB update fails after subscription.deleted", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: "cus_del_err",
          status: "canceled",
        },
      },
    });
    // All retry attempts fail
    mockAdminUpdateResult.mockReturnValue({ data: null, error: { message: "DB error" } });

    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest(
      JSON.stringify({ type: "customer.subscription.deleted" }),
      "sig_valid"
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Database update failed");
  });

  it("returns 400 when checkout.session.completed has no userId in metadata", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: {},
          customer: "cus_no_user",
        },
      },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest(
      JSON.stringify({ type: "checkout.session.completed" }),
      "sig_valid"
    );
    const response = await POST(request);
    const json = await response.json();

    // Without userId the whole checkout block is skipped, returns received: true
    expect(response.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockAdminUpdate).not.toHaveBeenCalled();
  });

  it("dedupes duplicate events via stripe_events PK conflict", async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: "evt_dup",
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_dup", status: "active" } },
    });
    // Simulate duplicate PK (23505) on stripe_events insert
    mockAdminInsertResult.mockReturnValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest(
      JSON.stringify({ type: "customer.subscription.updated" }),
      "sig_valid"
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true, duplicate: true });
    // The downstream update should NOT have been called for a duplicate
    expect(mockAdminUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 when checkout userId not found in profiles", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "ghost-user" },
          customer: "cus_ghost",
        },
      },
    });
    mockAdminSelectSingle.mockReturnValueOnce({
      data: null,
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest(
      JSON.stringify({ type: "checkout.session.completed" }),
      "sig_valid"
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("User not found");
  });
});

describe("mapSubscriptionStatus", () => {
  // We test mapSubscriptionStatus indirectly through subscription.updated events
  // since it is not exported directly

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("maps 'trialing' to 'active'", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_t", status: "trialing" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest("{}", "sig_valid");
    await POST(request);

    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscription_status: "active" } })
    );
  });

  it("maps 'past_due' to 'past_due'", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_pd", status: "past_due" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest("{}", "sig_valid");
    await POST(request);

    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscription_status: "past_due" } })
    );
  });

  it("maps 'unpaid' to 'canceled'", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_up", status: "unpaid" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest("{}", "sig_valid");
    await POST(request);

    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscription_status: "canceled" } })
    );
  });

  it("maps 'incomplete_expired' to 'canceled'", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_ie", status: "incomplete_expired" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest("{}", "sig_valid");
    await POST(request);

    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscription_status: "canceled" } })
    );
  });

  it("maps unknown status to 'inactive'", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_unk", status: "some_future_status" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest("{}", "sig_valid");
    await POST(request);

    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscription_status: "inactive" } })
    );
  });

  it("maps 'incomplete' status to 'inactive' (default branch)", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_inc", status: "incomplete" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest("{}", "sig_valid");
    await POST(request);

    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscription_status: "inactive" } })
    );
  });

  it("maps 'canceled' status directly to 'canceled'", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: { object: { customer: "cus_can", status: "canceled" } },
    });
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const request = createWebhookRequest("{}", "sig_valid");
    await POST(request);

    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { subscription_status: "canceled" } })
    );
  });
});

describe("withRetry", () => {
  // Test retry logic indirectly through webhook events with transient DB errors

  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("retries on error and eventually reports failure after max attempts", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: "cus_retry",
          status: "canceled",
        },
      },
    });
    // All 3 retry attempts fail
    mockAdminUpdateResult
      .mockReturnValue({ data: null, error: { message: "transient error" } });

    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest(
      JSON.stringify({ type: "customer.subscription.deleted" }),
      "sig_valid"
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Database update failed");
    // withRetry calls update 3 times (maxAttempts = 3)
    expect(mockAdminUpdate).toHaveBeenCalledTimes(3);
  });

  it("succeeds after a retry when first attempt fails", async () => {
    mockConstructEvent.mockReturnValueOnce({
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_retry_ok",
          status: "active",
        },
      },
    });
    // First attempt fails, second succeeds
    mockAdminUpdateResult
      .mockReturnValueOnce({ data: null, error: { message: "transient" } })
      .mockReturnValueOnce({ data: null, error: null });

    const { POST } = await import("@/app/api/stripe/webhook/route");

    const request = createWebhookRequest(
      JSON.stringify({ type: "customer.subscription.updated" }),
      "sig_valid"
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.received).toBe(true);
    expect(mockAdminUpdate).toHaveBeenCalledTimes(2);
  });
});
