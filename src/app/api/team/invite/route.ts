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
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    const normalizedRole = typeof role === "string" ? role : "member";
    if (!["owner", "admin", "member"].includes(normalizedRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    // Only an owner can grant owner role — prevent an admin from escalating.
    // We check the caller's role after the membership lookup below.

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

    // An admin cannot promote someone to owner — only an owner can.
    if (normalizedRole === "owner" && membership.role !== "owner") {
      return NextResponse.json(
        { error: "Only the owner can grant owner role" },
        { status: 403 }
      );
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

    // user_id is only set when the invited user already has an account;
    // for pending invites (no profile yet) we leave it null until they accept.
    const { error: inviteError } = await supabase.from("org_members").insert({
      org_id: orgId,
      user_id: invitedProfile?.id ?? null,
      role: normalizedRole,
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
