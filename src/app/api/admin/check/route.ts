import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

/**
 * Lightweight admin-status check for client-side UI gating.
 * Returns { isAdmin: boolean } without leaking the ADMIN_EMAILS list.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }

  return NextResponse.json({ isAdmin: isAdminEmail(user.email) });
}
