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

// POST: Invite a member to an organization
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limited = await rateLimit(user.id, "/api/team/invite");
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

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
    // Normalize email so dedup + lookups are case-insensitive (Alice@x vs alice@x).
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user is an ACCEPTED owner or admin of the org. The accepted=true
    // filter matters: a not-yet-accepted invitee must not be able to act as admin.
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .eq("accepted", true)
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
      .eq("invited_email", normalizedEmail)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Already invited" }, { status: 409 });
    }

    // Find user by email or create pending invite
    const { data: invitedProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    // user_id is only set when the invited user already has an account;
    // for pending invites (no profile yet) we leave it null until they accept.
    // Written via service-role: RLS denies direct end-user org_members writes.
    const { error: inviteError } = await getAdmin().from("org_members").insert({
      org_id: orgId,
      user_id: invitedProfile?.id ?? null,
      role: normalizedRole,
      invited_email: normalizedEmail,
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
