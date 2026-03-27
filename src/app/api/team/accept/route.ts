import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST: Accept a team invitation
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orgId } = await request.json();
  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();

  // Find pending invite for this user
  const { error } = await supabase
    .from("org_members")
    .update({ accepted: true, user_id: user.id })
    .eq("org_id", orgId)
    .eq("invited_email", profile?.email)
    .eq("accepted", false);

  if (error) {
    return NextResponse.json({ error: "No pending invite found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
