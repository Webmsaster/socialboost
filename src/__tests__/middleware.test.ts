import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

const mockGetUser = vi.fn();
const mockCreateServerClient = vi.mocked(createServerClient);

function setupMockSupabase() {
  mockCreateServerClient.mockReturnValue({
    auth: { getUser: mockGetUser },
  } as unknown as ReturnType<typeof createServerClient>);
}

// Need to import after mocking
import { updateSession } from "@/lib/supabase/middleware";

function makeRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = "GET", headers = {} } = options;
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers,
  });
}

describe("updateSession (middleware)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockSupabase();
    // Set env vars for Supabase by default
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("blocks mutations without Origin header (CSRF)", async () => {
    const req = makeRequest("http://localhost:3000/api/generate", {
      method: "POST",
    });
    const res = await updateSession(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("CSRF validation failed");
  });

  it("allows Stripe webhooks without CSRF check", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = makeRequest("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
    });
    const res = await updateSession(req);
    expect(res.status).toBe(200);
  });

  it("returns 503 if Supabase env vars not set", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const req = makeRequest("http://localhost:3000/dashboard");
    const res = await updateSession(req);
    expect(res.status).toBe(503);
  });

  it("redirects unauthenticated users from protected paths to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = makeRequest("http://localhost:3000/dashboard");
    const res = await updateSession(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects authenticated users from /login to /dashboard", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    const req = makeRequest("http://localhost:3000/login");
    const res = await updateSession(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("passes through for non-protected paths", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = makeRequest("http://localhost:3000/");
    const res = await updateSession(req);
    expect(res.status).toBe(200);
  });

  // --- CSRF: valid Origin allows mutation ---
  it("allows POST with valid Origin header matching request origin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = makeRequest("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });
    const res = await updateSession(req);
    // Should pass CSRF and proceed (200 passthrough since /api/generate is not protected)
    expect(res.status).toBe(200);
  });

  // --- CSRF: NEXT_PUBLIC_APP_URL env var in allowedOrigins ---
  it("allows POST when Origin matches NEXT_PUBLIC_APP_URL", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.socialboost.com/";
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = makeRequest("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { origin: "https://app.socialboost.com" },
    });
    const res = await updateSession(req);
    expect(res.status).toBe(200);

    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  // --- CSRF: NEXT_PUBLIC_SITE_URL env var in allowedOrigins ---
  it("allows POST when Origin matches NEXT_PUBLIC_SITE_URL", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://site.socialboost.com/";
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = makeRequest("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { origin: "https://site.socialboost.com" },
    });
    const res = await updateSession(req);
    expect(res.status).toBe(200);

    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  // --- CSRF: valid Referer header (no Origin) ---
  it("allows POST with valid Referer header when Origin is absent", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = makeRequest("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { referer: "http://localhost:3000/create" },
    });
    const res = await updateSession(req);
    expect(res.status).toBe(200);
  });

  // --- CSRF: invalid Referer (different origin) blocks ---
  it("blocks POST with Referer from different origin", async () => {
    const req = makeRequest("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { referer: "https://evil.com/page" },
    });
    const res = await updateSession(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("CSRF validation failed");
  });

  // --- CSRF: malformed Referer URL triggers catch block (line 34) ---
  it("blocks POST with malformed Referer URL", async () => {
    const req = makeRequest("http://localhost:3000/api/generate", {
      method: "POST",
      headers: { referer: "not-a-valid-url" },
    });
    const res = await updateSession(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("CSRF validation failed");
  });

  // --- Auth redirect: /signup redirects authenticated users to /dashboard ---
  it("redirects authenticated users from /signup to /dashboard", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    const req = makeRequest("http://localhost:3000/signup");
    const res = await updateSession(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  // --- Other protected paths redirect unauthenticated users ---
  it.each(["/create", "/history", "/calendar", "/accounts", "/settings"])(
    "redirects unauthenticated users from %s to /login",
    async (path) => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const req = makeRequest(`http://localhost:3000${path}`);
      const res = await updateSession(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    }
  );

  // --- getAll and setAll callback coverage (lines 58-68) ---
  it("invokes getAll and setAll callbacks for cookie handling", async () => {
    // Capture the cookies config passed to createServerClient
    let capturedGetAll: (() => unknown) | undefined;
    let capturedSetAll: ((cookies: Array<{ name: string; value: string; options?: unknown }>) => void) | undefined;

    mockCreateServerClient.mockImplementation((_url, _key, config: unknown) => {
      const cfg = config as { cookies: { getAll: () => unknown; setAll: (c: Array<{ name: string; value: string; options?: unknown }>) => void } };
      capturedGetAll = cfg.cookies.getAll;
      capturedSetAll = cfg.cookies.setAll;
      return {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as unknown as ReturnType<typeof createServerClient>;
    });

    const req = makeRequest("http://localhost:3000/");
    await updateSession(req);

    // Verify getAll was captured and call it to cover line 59
    expect(capturedGetAll).toBeDefined();
    const cookies = capturedGetAll!();
    expect(Array.isArray(cookies)).toBe(true);

    // Verify setAll was captured and call it to cover lines 62-68
    expect(capturedSetAll).toBeDefined();
    capturedSetAll!([
      { name: "sb-token", value: "abc123", options: { path: "/" } },
      { name: "sb-refresh", value: "def456", options: { path: "/" } },
    ]);

    // After setAll, cookies should be set on the request
    expect(req.cookies.get("sb-token")?.value).toBe("abc123");
    expect(req.cookies.get("sb-refresh")?.value).toBe("def456");
  });

  // --- PATCH and DELETE also trigger CSRF ---
  it("blocks PATCH without Origin header (CSRF)", async () => {
    const req = makeRequest("http://localhost:3000/api/generate", {
      method: "PATCH",
    });
    const res = await updateSession(req);
    expect(res.status).toBe(403);
  });

  it("blocks DELETE without Origin header (CSRF)", async () => {
    const req = makeRequest("http://localhost:3000/api/generate", {
      method: "DELETE",
    });
    const res = await updateSession(req);
    expect(res.status).toBe(403);
  });

  // --- GET requests to API skip CSRF ---
  it("allows GET to API routes without CSRF check", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = makeRequest("http://localhost:3000/api/generate", {
      method: "GET",
    });
    const res = await updateSession(req);
    expect(res.status).toBe(200);
  });
});
