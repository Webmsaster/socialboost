import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";

// POST: Invite a member to an organization
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { orgId, email, role } = await request.json() as {
      orgId: string;
      email: string;
      role?: string;
    };

    if (!orgId || !email) {
      return NextResponse.json({ error: "Missing orgId or email" }, { status: 400 });
    }

    // Check if user is owner or admin of the org
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Not authorized to invite" }, { status: 403 });
    }

    // Check member limit
    const { count } = await supabase
      .from("org_members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId);

    const { data: org } = await supabase
      .from("organizations")
      .select("max_members, name")
      .eq("id", orgId)
      .single();

    if (org && count && count >= org.max_members) {
      return NextResponse.json({ error: `Team limit reached (${org.max_members} members)` }, { status: 403 });
    }

    // Check if already invited
    const { data: existing } = await supabase
      .from("org_members")
      .select("id")
      .eq("org_id", orgId)
      .eq("invited_email", email)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Already invited" }, { status: 409 });
    }

    // Find user by email or create pending invite
    const { data: invitedProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    const { error: inviteError } = await supabase.from("org_members").insert({
      org_id: orgId,
      user_id: invitedProfile?.id || user.id,
      role: role || "member",
      invited_email: email,
      accepted: false,
    });

    if (inviteError) {
      captureError("Invite error", inviteError);
      return NextResponse.json({ error: "Failed to invite" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureError("Team invite error", error);
    return NextResponse.json({ error: "Failed to invite" }, { status: 500 });
  }
}
