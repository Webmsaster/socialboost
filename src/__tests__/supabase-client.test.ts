import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBrowserClient } from "@supabase/ssr";

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => ({ fake: "client" })),
}));

const mockCreateBrowserClient = vi.mocked(createBrowserClient);

import { createClient } from "@/lib/supabase/client";

describe("supabase/client — createClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("calls createBrowserClient with env vars and returns the client", () => {
    const result = createClient();

    expect(mockCreateBrowserClient).toHaveBeenCalledOnce();
    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key"
    );
    expect(result).toEqual({ fake: "client" });
  });

  it("passes through whatever createBrowserClient returns", () => {
    const customClient = { auth: {}, from: vi.fn() };
    mockCreateBrowserClient.mockReturnValue(customClient as any);

    const result = createClient();
    expect(result).toBe(customClient);
  });
});
