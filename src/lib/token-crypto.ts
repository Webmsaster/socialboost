import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

/**
 * AES-256-GCM encryption for OAuth tokens at rest
 * (connected_accounts.access_token / refresh_token).
 *
 * Stored format: "gcm1:" + base64(iv) ":" base64(authTag) ":" base64(ciphertext).
 *
 * Graceful by design so it can be rolled out without a data migration or
 * breaking local dev:
 *  - No TOKEN_ENCRYPTION_KEY set  → values are stored/returned as plaintext, so
 *    the app keeps working in dev and existing plaintext rows still read.
 *    Setting the env var in production activates encryption for all new writes
 *    with no code change.
 *  - A legacy plaintext value (no "gcm1:" prefix) is returned as-is by decrypt,
 *    so existing rows keep working until they are next refreshed/re-written.
 */

const PREFIX = "gcm1:";

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  // Accept a 64-char hex key (32 bytes) directly; otherwise derive 32 bytes
  // deterministically from an arbitrary passphrase.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return createHash("sha256").update(raw).digest();
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Encrypt a token for storage. Returns plaintext unchanged if no key is configured. */
export function encryptToken(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return plaintext === undefined ? null : plaintext;
  }
  const key = getKey();
  if (!key) return plaintext; // no key → store as-is (dev / not yet configured)
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

/** Decrypt a stored token. Returns legacy plaintext (no prefix) unchanged. */
export function decryptToken(stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined) return null;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext, pass through
  const key = getKey();
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not set, but an encrypted token was found");
  }
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted token");
  const [ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
