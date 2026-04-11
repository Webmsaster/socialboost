import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type AuditAction =
  | "post.created"
  | "post.published"
  | "post.deleted"
  | "post.submitted_for_review"
  | "post.approved"
  | "post.rejected"
  | "team.member_invited"
  | "team.member_removed"
  | "series.created"
  | "series.deleted"
  | "webhook.created"
  | "webhook.deleted"
  | "api_key.created"
  | "api_key.revoked";

/**
 * Log an action to the audit trail.
 * Fire-and-forget — does not throw on failure.
 */
export async function logAudit(
  userId: string,
  action: AuditAction,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getAdmin();
    await supabase.from("audit_log").insert({
      user_id: userId,
      action,
      details: details || {},
    });
  } catch {
    // Audit logging is non-critical — fail silently
  }
}
