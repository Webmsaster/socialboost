import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";

// GET: List audit log for user's organizations
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = 25;
    const offset = (page - 1) * limit;

    // Get org member user IDs
    const { data: memberships } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .eq("accepted", true)
      .in("role", ["owner", "admin"]);

    let userIds = [user.id];

    if (memberships && memberships.length > 0) {
      const orgIds = memberships.map((m) => m.org_id);
      const { data: members } = await supabase
        .from("org_members")
        .select("user_id")
        .in("org_id", orgIds)
        .eq("accepted", true);

      if (members) {
        userIds = [...new Set([user.id, ...members.map((m) => m.user_id).filter(Boolean)])];
      }
    }

    const { data, error, count } = await supabase
      .from("audit_log")
      .select("id, user_id, action, details, created_at, profiles(full_name, email)", { count: "exact" })
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      captureError("Audit log error", error);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    return NextResponse.json({
      entries: data || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    captureError("Audit log error", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
