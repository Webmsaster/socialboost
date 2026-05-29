import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { captureError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

// org_members rows are written via the service-role client: RLS forbids direct
// end-user writes to org_members (so a user can't self-escalate to owner/admin
// over the REST API), so the route authorizes the action and the server writes.
function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// GET: Get user's team/org info
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get orgs the user belongs to
    const { data: memberships } = await supabase
      .from("org_members")
      .select("org_id, role, organizations(id, name, owner_id, subscription_status, max_members)")
      .eq("user_id", user.id)
      .eq("accepted", true);

    return NextResponse.json({ memberships: memberships || [] });
  } catch (error) {
    captureError("Team fetch error", error);
    return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
  }
}

// POST: Create a new organization
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limited = await rateLimit(user.id, "/api/team");
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { name } = await request.json();
    if (typeof name === "string" && name.length > 100) {
      return NextResponse.json({ error: "Name too long (max 100 chars)" }, { status: 400 });
    }
    if (!name?.trim()) return NextResponse.json({ error: "Missing name" }, { status: 400 });

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: name.trim(), owner_id: user.id })
      .select()
      .single();

    if (orgError) {
      captureError("Create org error", orgError);
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
    }

    // Add owner as member (service-role: end users can't write org_members directly)
    const { error: memberError } = await getAdmin().from("org_members").insert({
      org_id: org.id,
      user_id: user.id,
      role: "owner",
      accepted: true,
    });
    if (memberError) {
      captureError("Create org: owner membership insert failed", memberError, { orgId: org.id });
      return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
    }

    return NextResponse.json(org);
  } catch (error) {
    captureError("Team create error", error);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}
