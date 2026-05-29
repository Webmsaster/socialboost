import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { captureError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

// org_members writes go through service-role (RLS denies direct end-user writes).
function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// POST: Accept a team invitation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limited = await rateLimit(user.id, "/api/team/accept");
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { orgId } = await request.json();
    if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    if (!profile?.email) {
      return NextResponse.json({ error: "Profile missing email" }, { status: 400 });
    }

    // Find the pending invite for this user (case-insensitive email match) and
    // accept it. Written via service-role (RLS denies direct end-user writes);
    // the WHERE clause scopes it to THIS user's own pending invite, and only
    // accepted/user_id are set, so the invitee can't tamper with their role.
    // .select() lets us detect "0 rows matched" (a plain update reports no error
    // on zero matches, which previously returned a false success).
    const { data: updated, error } = await getAdmin()
      .from("org_members")
      .update({ accepted: true, user_id: user.id })
      .eq("org_id", orgId)
      .eq("invited_email", profile.email.toLowerCase())
      .eq("accepted", false)
      .select("id");

    if (error || !updated || updated.length === 0) {
      captureError("Team accept update failed", error, { userId: user.id, orgId });
      return NextResponse.json({ error: "No pending invite found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    captureError("Team accept error", err);
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }
}
