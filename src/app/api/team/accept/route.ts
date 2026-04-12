import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

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

    // Find pending invite for this user
    const { error } = await supabase
      .from("org_members")
      .update({ accepted: true, user_id: user.id })
      .eq("org_id", orgId)
      .eq("invited_email", profile.email)
      .eq("accepted", false);

    if (error) {
      captureError("Team accept update failed", error, { userId: user.id, orgId });
      return NextResponse.json({ error: "No pending invite found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    captureError("Team accept error", err);
    return NextResponse.json({ error: "Failed to accept invite" }, { status: 500 });
  }
}
