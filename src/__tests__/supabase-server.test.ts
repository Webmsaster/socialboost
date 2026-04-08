import { describe, it, expect, vi, beforeEach } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const mockGetAll = vi.fn();
const mockSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

type CookiesOpts = { cookies: { getAll: () => unknown; setAll: (c: Array<{ name: string; value: string; options?: unknown }>) => void } };

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, opts: CookiesOpts) => {
    // Store the cookies config so we can test the callbacks
    (createServerClient as unknown as { __lastOpts: CookiesOpts }).__lastOpts = opts;
    return { fake: "server-client" };
  }),
}));

const mockCookies = vi.mocked(cookies);
const mockCreateServerClient = vi.mocked(createServerClient);

import { createClient } from "@/lib/supabase/server";

describe("supabase/server — createClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

    mockGetAll.mockReturnValue([{ name: "sb-token", value: "abc123" }]);
    mockSet.mockImplementation(() => {});

    mockCookies.mockResolvedValue({
      getAll: mockGetAll,
      set: mockSet,
    } as unknown as Awaited<ReturnType<typeof cookies>>);
  });

  it("awaits cookies() and calls createServerClient with env vars", async () => {
    await createClient();

    expect(mockCookies).toHaveBeenCalledOnce();
    expect(mockCreateServerClient).toHaveBeenCalledOnce();
    expect(mockCreateServerClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      })
    );
  });

  it("returns the server client", async () => {
    const result = await createClient();
    expect(result).toEqual({ fake: "server-client" });
  });

  it("cookies.getAll delegates to cookieStore.getAll", async () => {
    await createClient();

    const opts = (mockCreateServerClient as unknown as { __lastOpts: CookiesOpts }).__lastOpts;
    const result = opts.cookies.getAll();

    expect(mockGetAll).toHaveBeenCalledOnce();
    expect(result).toEqual([{ name: "sb-token", value: "abc123" }]);
  });

  it("cookies.setAll calls cookieStore.set for each cookie", async () => {
    await createClient();

    const opts = (mockCreateServerClient as unknown as { __lastOpts: CookiesOpts }).__lastOpts;
    const cookiesToSet = [
      { name: "sb-access", value: "token1", options: { path: "/" } },
      { name: "sb-refresh", value: "token2", options: { path: "/", httpOnly: true } },
    ];

    opts.cookies.setAll(cookiesToSet);

    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockSet).toHaveBeenCalledWith("sb-access", "token1", { path: "/" });
    expect(mockSet).toHaveBeenCalledWith("sb-refresh", "token2", { path: "/", httpOnly: true });
  });

  it("cookies.setAll silently catches errors (Server Component scenario)", async () => {
    mockSet.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler");
    });

    await createClient();

    const opts = (mockCreateServerClient as unknown as { __lastOpts: CookiesOpts }).__lastOpts;
    const cookiesToSet = [
      { name: "sb-access", value: "token1", options: { path: "/" } },
    ];

    // Should not throw
    expect(() => opts.cookies.setAll(cookiesToSet)).not.toThrow();
  });

  it("cookies.setAll with empty array does nothing", async () => {
    await createClient();

    const opts = (mockCreateServerClient as unknown as { __lastOpts: CookiesOpts }).__lastOpts;
    opts.cookies.setAll([]);

    expect(mockSet).not.toHaveBeenCalled();
  });
});
