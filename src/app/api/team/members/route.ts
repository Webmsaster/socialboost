import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { captureError } from "@/lib/logger";

// org_members writes go through service-role (RLS denies direct end-user writes).
function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// GET: List all members of an organization
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const orgId = request.nextUrl.searchParams.get("orgId");
    if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

    // Verify user is a member of this org
    const { data: userMembership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .single();

    if (!userMembership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    // Get all members (accepted and pending)
    const { data: members, error } = await supabase
      .from("org_members")
      .select("id, user_id, role, accepted, invited_email, created_at, profiles(id, email, full_name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      captureError("List members error", error);
      return NextResponse.json({ error: "Failed to list members" }, { status: 500 });
    }

    return NextResponse.json({ members: members || [], userRole: userMembership.role });
  } catch (error) {
    captureError("Team members error", error);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

// DELETE: Remove a member from an organization
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { orgId, memberId } = await request.json() as { orgId: string; memberId: string };
    if (!orgId || !memberId) {
      return NextResponse.json({ error: "Missing orgId or memberId" }, { status: 400 });
    }

    // Check if user is owner or admin
    const { data: userMembership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .single();

    if (!userMembership || !["owner", "admin"].includes(userMembership.role)) {
      return NextResponse.json({ error: "Not authorized to remove members" }, { status: 403 });
    }

    // Prevent removing the owner
    const { data: targetMember } = await supabase
      .from("org_members")
      .select("role, user_id")
      .eq("id", memberId)
      .eq("org_id", orgId)
      .single();

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMember.role === "owner") {
      return NextResponse.json({ error: "Cannot remove the owner" }, { status: 403 });
    }

    // Service-role write (RLS denies direct end-user org_members writes); the
    // route has already verified the caller is an accepted owner/admin and the
    // target is not the owner.
    const { error } = await getAdmin()
      .from("org_members")
      .delete()
      .eq("id", memberId)
      .eq("org_id", orgId);

    if (error) {
      captureError("Remove member error", error);
      return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureError("Team remove error", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
