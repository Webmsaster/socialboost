import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
  }),
}));

const mockFireWebhook = vi.fn();
vi.mock("@/lib/webhooks", () => ({
  fireWebhook: (...args: unknown[]) => mockFireWebhook(...args),
}));

// Import after mocks
import { POST } from "@/app/api/webhooks/test/route";

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/webhooks/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhooks/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST(
      createRequest({ webhookUrl: "https://example.com/webhook" })
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 if no webhookUrl", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });

    const response = await POST(createRequest({}));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing webhookUrl");
  });

  it("returns success after firing webhook", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockFireWebhook.mockResolvedValueOnce(undefined);

    const response = await POST(
      createRequest({ webhookUrl: "https://example.com/webhook" })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockFireWebhook).toHaveBeenCalledWith(
      "https://example.com/webhook",
      "test",
      expect.objectContaining({
        message: "Webhook test from SocialBoost",
        userId: "user-1",
      })
    );
  });
});
