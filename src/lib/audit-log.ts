import { createClient } from "@supabase/supabase-js";
import { captureError } from "./logger";

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
  | "series.run_now"
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
    const { error } = await supabase.from("audit_log").insert({
      user_id: userId,
      action,
      details: details || {},
    });
    if (error) {
      captureError("Audit log insert failed", error, { userId, action });
    }
  } catch (err) {
    captureError("Audit log unexpected error", err, { userId, action });
  }
}
