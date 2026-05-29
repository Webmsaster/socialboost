import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptToken, decryptToken, isEncrypted } from "@/lib/token-crypto";

const KEY = "a".repeat(64); // 32-byte hex key

describe("token-crypto", () => {
  const original = process.env.TOKEN_ENCRYPTION_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
    else process.env.TOKEN_ENCRYPTION_KEY = original;
  });

  describe("with a key configured", () => {
    beforeEach(() => {
      process.env.TOKEN_ENCRYPTION_KEY = KEY;
    });

    it("round-trips a token", () => {
      const plain = "ya29.super-secret-access-token";
      const enc = encryptToken(plain);
      expect(enc).not.toBe(plain);
      expect(isEncrypted(enc)).toBe(true);
      expect(decryptToken(enc)).toBe(plain);
    });

    it("produces a different ciphertext each time (random IV)", () => {
      expect(encryptToken("same")).not.toBe(encryptToken("same"));
    });

    it("derives a key from a non-hex passphrase too", () => {
      process.env.TOKEN_ENCRYPTION_KEY = "some-long-passphrase";
      const enc = encryptToken("token");
      expect(decryptToken(enc)).toBe("token");
    });

    it("still returns legacy plaintext (no prefix) unchanged", () => {
      expect(decryptToken("legacy-plaintext-token")).toBe("legacy-plaintext-token");
    });

    it("throws on a tampered ciphertext (GCM auth)", () => {
      const enc = encryptToken("token")!;
      const tampered = enc.slice(0, -4) + "AAAA";
      expect(() => decryptToken(tampered)).toThrow();
    });

    it("handles null/undefined/empty", () => {
      expect(encryptToken(null)).toBeNull();
      expect(encryptToken(undefined)).toBeNull();
      expect(encryptToken("")).toBe("");
      expect(decryptToken(null)).toBeNull();
    });
  });

  describe("without a key (dev / not configured)", () => {
    beforeEach(() => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    });

    it("stores and reads plaintext unchanged (graceful)", () => {
      const enc = encryptToken("plain-token");
      expect(enc).toBe("plain-token");
      expect(isEncrypted(enc)).toBe(false);
      expect(decryptToken(enc)).toBe("plain-token");
    });

    it("throws if asked to decrypt an encrypted value with no key", () => {
      process.env.TOKEN_ENCRYPTION_KEY = KEY;
      const enc = encryptToken("token")!;
      delete process.env.TOKEN_ENCRYPTION_KEY;
      expect(() => decryptToken(enc)).toThrow(/TOKEN_ENCRYPTION_KEY/);
    });
  });
});
