import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSessionsCreate = vi.fn();
const mockPortalCreate = vi.fn();

vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      checkout = { sessions: { create: mockSessionsCreate } };
      billingPortal = { sessions: { create: mockPortalCreate } };
      webhooks = { constructEvent: vi.fn() };
      constructor() {}
    },
  };
});

import { getStripe, createCheckoutSession, createPortalSession } from "@/lib/stripe";

describe("stripe lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_PRICE_ID = "price_monthly";
    process.env.STRIPE_ANNUAL_PRICE_ID = "price_annual";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.test.com";
  });

  it("throws when STRIPE_SECRET_KEY is not set", async () => {
    vi.resetModules();
    delete process.env.STRIPE_SECRET_KEY;

    // Re-mock stripe for fresh module
    vi.doMock("stripe", () => ({
      default: class MockStripe {
        checkout = { sessions: { create: vi.fn() } };
        billingPortal = { sessions: { create: vi.fn() } };
        webhooks = { constructEvent: vi.fn() };
      },
    }));

    const { getStripe } = await import("@/lib/stripe");
    expect(() => getStripe()).toThrow("STRIPE_SECRET_KEY is not configured");
  });

  it("getStripe returns an instance with checkout and billingPortal", () => {
    const stripe = getStripe();
    expect(stripe).toBeDefined();
    expect(stripe.checkout).toBeDefined();
    expect(stripe.billingPortal).toBeDefined();
  });

  it("createCheckoutSession creates a monthly session by default", async () => {
    mockSessionsCreate.mockResolvedValue({ id: "cs_test_123", url: "https://checkout.stripe.com" });

    await createCheckoutSession("user-1", "user@test.com");

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_email: "user@test.com",
        mode: "subscription",
        line_items: [{ price: "price_monthly", quantity: 1 }],
        metadata: { userId: "user-1", plan: "monthly" },
      })
    );
  });

  it("createCheckoutSession uses annual price for annual plan", async () => {
    mockSessionsCreate.mockResolvedValue({ id: "cs_test_456", url: "https://checkout.stripe.com" });

    await createCheckoutSession("user-1", "user@test.com", "annual");

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_annual", quantity: 1 }],
        metadata: { userId: "user-1", plan: "annual" },
      })
    );
  });

  it("createCheckoutSession includes correct URLs", async () => {
    mockSessionsCreate.mockResolvedValue({ id: "cs_test", url: "https://checkout.stripe.com" });

    await createCheckoutSession("user-1", "user@test.com");

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: "https://app.test.com/dashboard?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://app.test.com/dashboard",
      })
    );
  });

  it("uses NEXT_PUBLIC_STRIPE_PRICE_ID when STRIPE_PRICE_ID is not set", async () => {
    delete process.env.STRIPE_PRICE_ID;
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID = "price_public_monthly";
    mockSessionsCreate.mockResolvedValue({ id: "cs_fallback", url: "https://checkout.stripe.com" });

    await createCheckoutSession("user-1", "user@test.com", "monthly");

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_public_monthly", quantity: 1 }],
      })
    );
  });

  it("uses NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID when STRIPE_ANNUAL_PRICE_ID is not set", async () => {
    delete process.env.STRIPE_ANNUAL_PRICE_ID;
    process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID = "price_public_annual";
    mockSessionsCreate.mockResolvedValue({ id: "cs_fallback_annual", url: "https://checkout.stripe.com" });

    await createCheckoutSession("user-1", "user@test.com", "annual");

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_public_annual", quantity: 1 }],
      })
    );
  });

  it("createPortalSession creates a portal session", async () => {
    mockPortalCreate.mockResolvedValue({ url: "https://portal.stripe.com/session" });

    await createPortalSession("cus_test_123");

    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: "cus_test_123",
      return_url: "https://app.test.com/dashboard",
    });
  });
});
