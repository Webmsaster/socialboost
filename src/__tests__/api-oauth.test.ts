import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

type MockWith<T> = import("vitest").Mock<(...args: unknown[]) => unknown> & T;

const mockGetUser = vi.fn();
const mockDeleteEq2 = vi.fn() as MockWith<{ _result?: unknown }>;
const mockUpsert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      delete: () => ({
        eq: () => ({
          eq: (...args: unknown[]) => {
            mockDeleteEq2(...args);
            return mockDeleteEq2._result ?? { error: null };
          },
        }),
      }),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    }),
  }),
}));

const mockGetPublisher = vi.fn();
vi.mock("@/lib/platforms/registry", () => ({
  getPublisher: (...args: unknown[]) => mockGetPublisher(...args),
}));

vi.mock("@/lib/platforms", () => ({
  platformConfigs: {
    linkedin: {
      name: "LinkedIn",
      color: "bg-blue-600",
      clientIdEnv: "LINKEDIN_CLIENT_ID",
      clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
      scopes: "openid profile",
    },
    facebook: {
      name: "Facebook",
      color: "bg-blue-500",
      clientIdEnv: "FACEBOOK_APP_ID",
      clientSecretEnv: "FACEBOOK_APP_SECRET",
      scopes: "pages_manage_posts",
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { POST as ConnectPost } from "@/app/api/auth/oauth/connect/route";
import { POST as DisconnectPost } from "@/app/api/auth/oauth/disconnect/route";
import { GET as CallbackGet } from "@/app/api/auth/oauth/callback/route";

function createPostRequest(
  body: Record<string, unknown>,
  url = "http://localhost:3000/api/auth/oauth/connect"
): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/oauth/connect", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await ConnectPost(
      createPostRequest({ platform: "linkedin" })
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid platform", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });

    const response = await ConnectPost(
      createPostRequest({ platform: "tiktok" })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Invalid platform");
  });

  it("returns 501 if OAuth not configured", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    // Ensure LINKEDIN_CLIENT_ID is not set
    delete process.env.LINKEDIN_CLIENT_ID;

    const response = await ConnectPost(
      createPostRequest({ platform: "linkedin" })
    );
    const json = await response.json();

    expect(response.status).toBe(501);
    expect(json.error).toContain("OAuth is not configured");
  });

  it("returns 501 if getPublisher returns null", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    process.env.LINKEDIN_CLIENT_ID = "test-client-id";
    mockGetPublisher.mockReturnValueOnce(null);

    const response = await ConnectPost(
      createPostRequest({ platform: "linkedin" })
    );
    const json = await response.json();

    expect(response.status).toBe(501);
    expect(json.error).toContain("Platform not yet supported");
  });

  it("returns auth URL when env vars are set and publisher exists", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    process.env.LINKEDIN_CLIENT_ID = "test-client-id";
    mockGetPublisher.mockReturnValueOnce({
      getAuthUrl: vi.fn().mockReturnValue("https://linkedin.com/oauth?redirect=test"),
      exchangeCode: vi.fn(),
      publish: vi.fn(),
    });

    const response = await ConnectPost(
      createPostRequest({ platform: "linkedin" })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.url).toBe("https://linkedin.com/oauth?redirect=test");
  });
});

describe("POST /api/auth/oauth/disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockDeleteEq2 as ReturnType<typeof vi.fn> & { _result?: unknown })._result = undefined;
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await DisconnectPost(
      createPostRequest(
        { platform: "linkedin" },
        "http://localhost:3000/api/auth/oauth/disconnect"
      )
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("removes account on success", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    (mockDeleteEq2 as ReturnType<typeof vi.fn> & { _result?: unknown })._result = {
      error: null,
    };

    const response = await DisconnectPost(
      createPostRequest(
        { platform: "linkedin" },
        "http://localhost:3000/api/auth/oauth/disconnect"
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("returns 500 when db delete returns an error", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    (mockDeleteEq2 as ReturnType<typeof vi.fn> & { _result?: unknown })._result = {
      error: { message: "DB delete error" },
    };

    const response = await DisconnectPost(
      createPostRequest(
        { platform: "linkedin" },
        "http://localhost:3000/api/auth/oauth/disconnect"
      )
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to disconnect");
  });
});

describe("GET /api/auth/oauth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockUpsert as ReturnType<typeof vi.fn>).mockReset();
  });

  /** Helper to create a valid base64url-encoded state param */
  function encodeState(obj: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(obj)).toString("base64url");
  }

  function callbackUrl(params: Record<string, string>): string {
    const sp = new URLSearchParams(params);
    return `http://localhost:3000/api/auth/oauth/callback?${sp.toString()}`;
  }

  it("redirects on error param", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/oauth/callback?error=access_denied"
    );
    const response = await CallbackGet(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/accounts?error=oauth_denied");
  });

  it("redirects on missing code/state", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/auth/oauth/callback"
    );
    const response = await CallbackGet(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/accounts?error=missing_params");
  });

  it("redirects with invalid_state when base64 state is malformed", async () => {
    const request = new NextRequest(
      callbackUrl({ code: "auth-code", state: "!!!invalid-base64!!!" })
    );
    const response = await CallbackGet(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/accounts?error=invalid_state");
  });

  it("redirects to /login when user is not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const request = new NextRequest(
      callbackUrl({
        code: "auth-code",
        state: encodeState({ platform: "linkedin", userId: "user-1", nonce: "test-nonce" }),
      }),
      { headers: { cookie: "oauth_state=test-nonce" } }
    );
    const response = await CallbackGet(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("redirects with unsupported_platform when getPublisher returns null", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockGetPublisher.mockReturnValueOnce(null);

    const request = new NextRequest(
      callbackUrl({
        code: "auth-code",
        state: encodeState({ platform: "tiktok", userId: "user-1", nonce: "test-nonce" }),
      }),
      { headers: { cookie: "oauth_state=test-nonce" } }
    );
    const response = await CallbackGet(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/accounts?error=unsupported_platform");
  });

  it("redirects with success=connected after successful exchange and upsert", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockGetPublisher.mockReturnValueOnce({
      exchangeCode: vi.fn().mockResolvedValueOnce({
        platformUserId: "li-123",
        platformUsername: "john",
        accessToken: "tok",
        refreshToken: "ref",
        expiresAt: new Date("2026-12-31"),
      }),
    });
    mockUpsert.mockReturnValueOnce({ error: null });

    const request = new NextRequest(
      callbackUrl({
        code: "auth-code",
        state: encodeState({ platform: "linkedin", userId: "user-1", nonce: "test-nonce" }),
      }),
      { headers: { cookie: "oauth_state=test-nonce" } }
    );
    const response = await CallbackGet(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/accounts?success=connected");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        platform: "linkedin",
        platform_user_id: "li-123",
        access_token: "tok",
      }),
      { onConflict: "user_id,platform" }
    );
  });

  it("redirects with save_failed when DB upsert returns an error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockGetPublisher.mockReturnValueOnce({
      exchangeCode: vi.fn().mockResolvedValueOnce({
        platformUserId: "li-123",
        platformUsername: null,
        accessToken: "tok",
        refreshToken: null,
        expiresAt: null,
      }),
    });
    mockUpsert.mockReturnValueOnce({ error: { message: "DB constraint" } });

    const request = new NextRequest(
      callbackUrl({
        code: "auth-code",
        state: encodeState({ platform: "linkedin", userId: "user-1", nonce: "test-nonce" }),
      }),
      { headers: { cookie: "oauth_state=test-nonce" } }
    );
    const response = await CallbackGet(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/accounts?error=save_failed");
  });

  it("redirects with exchange_failed when exchangeCode throws", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
    mockGetPublisher.mockReturnValueOnce({
      exchangeCode: vi.fn().mockRejectedValueOnce(new Error("Network error")),
    });

    const request = new NextRequest(
      callbackUrl({
        code: "auth-code",
        state: encodeState({ platform: "linkedin", userId: "user-1", nonce: "test-nonce" }),
      }),
      { headers: { cookie: "oauth_state=test-nonce" } }
    );
    const response = await CallbackGet(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/accounts?error=exchange_failed");
  });
});
