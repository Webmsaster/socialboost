import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the chain mocks for the Supabase admin client used by validateApiKey.
const mockSingle = vi.fn();
const mockUpdateThen = vi.fn();

// Mock ONLY the Supabase client — crypto stays real so we test the actual
// key format / hash behaviour the code ships with.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ single: () => mockSingle() }),
        }),
      }),
      // last_used_at best-effort update — chain ends in a thenable.
      update: () => ({
        eq: () => ({
          then: (cb: (r: { error: unknown }) => void) => cb(mockUpdateThen()),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

import { generateApiKey, hashApiKey, validateApiKey } from "@/lib/api-keys";

describe("api-keys lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the best-effort last_used_at update succeeds.
    mockUpdateThen.mockReturnValue({ error: null });
  });

  describe("generateApiKey", () => {
    it("produces a key with the sb_ prefix", () => {
      expect(generateApiKey().startsWith("sb_")).toBe(true);
    });

    it("encodes 24 random bytes as hex (48 hex chars after the prefix)", () => {
      const key = generateApiKey();
      const hex = key.slice("sb_".length);
      // 24 bytes -> 48 hex characters
      expect(hex).toHaveLength(48);
      expect(hex).toMatch(/^[0-9a-f]{48}$/);
      // Full key length: "sb_" (3) + 48 = 51
      expect(key).toHaveLength(51);
    });

    it("produces unique keys across calls", () => {
      const a = generateApiKey();
      const b = generateApiKey();
      expect(a).not.toBe(b);
    });
  });

  describe("hashApiKey", () => {
    it("is deterministic — same input yields same hash", () => {
      const key = "sb_deadbeef";
      expect(hashApiKey(key)).toBe(hashApiKey(key));
    });

    it("returns a 64-char sha256 hex digest", () => {
      const hash = hashApiKey("sb_anything");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("produces different hashes for different inputs", () => {
      expect(hashApiKey("sb_one")).not.toBe(hashApiKey("sb_two"));
    });

    it("matches the known sha256 digest of a fixed input", () => {
      // sha256("sb_test") computed independently with node crypto.
      expect(hashApiKey("sb_test")).toBe(
        "40ac2e4f485212b6bf369c9d24c98c84453ab279fbc2fb5b3fca92fb03d5731b"
      );
    });
  });

  describe("validateApiKey", () => {
    it("returns null when no matching active key is found", async () => {
      mockSingle.mockResolvedValueOnce({ data: null });
      const result = await validateApiKey("sb_missing");
      expect(result).toBeNull();
    });

    it("returns null for an inactive/absent key (no data row)", async () => {
      // The query filters on is_active = true, so an inactive key returns no row.
      mockSingle.mockResolvedValueOnce({ data: null, error: { message: "no rows" } });
      const result = await validateApiKey("sb_inactive");
      expect(result).toBeNull();
    });

    it("returns the user_id on a hit", async () => {
      mockSingle.mockResolvedValueOnce({
        data: { user_id: "user-123", is_active: true },
      });
      const result = await validateApiKey("sb_valid");
      expect(result).toBe("user-123");
    });

    it("returns null and swallows errors if the query throws", async () => {
      mockSingle.mockRejectedValueOnce(new Error("db down"));
      const result = await validateApiKey("sb_boom");
      expect(result).toBeNull();
    });
  });
});
