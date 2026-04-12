import { createClient } from "@supabase/supabase-js";
import { captureError } from "./logger";
import { randomBytes, createHash } from "crypto";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function generateApiKey(): string {
  return `sb_${randomBytes(24).toString("hex")}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Validate an API key and return the associated user ID.
 * Returns null if the key is invalid or inactive.
 */
export async function validateApiKey(key: string): Promise<string | null> {
  try {
    const hash = hashApiKey(key);
    const supabase = getAdmin();

    const { data } = await supabase
      .from("api_keys")
      .select("user_id, is_active")
      .eq("key_hash", hash)
      .eq("is_active", true)
      .single();

    if (!data) return null;

    // Update last_used_at best-effort: we don't want to add a DB round-trip
    // to the hot path of every API request, and a dropped update here just
    // means the "last used" display is slightly stale.
    void supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_hash", hash)
      .then(({ error }) => {
        if (error) captureError("API key last_used_at update failed", error);
      });

    return data.user_id;
  } catch (err) {
    captureError("API key validation error", err);
    return null;
  }
}
