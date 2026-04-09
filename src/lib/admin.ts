/**
 * Admin access control — checks if a user's email is in the ADMIN_EMAILS
 * comma-separated env var. Kept deliberately simple: no DB migration,
 * no role system. Add/remove admins by editing Vercel env var.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS;
  if (!raw) return false;
  const allowList = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowList.includes(email.toLowerCase());
}
