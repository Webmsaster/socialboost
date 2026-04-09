import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { captureError } from "@/lib/logger";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = getAdmin();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      totalUsers,
      activeSubs,
      postsLast7d,
      postsLast30d,
      newUsersLast7d,
    ] = await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("subscription_status", "active"),
      admin
        .from("posts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),
      admin
        .from("posts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo),
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo),
    ]);

    // Estimated MRR: active subs × $9/month (conservative, doesn't split
    // monthly vs annual; annual plans inflate monthly revenue proportionally)
    const estimatedMrr = (activeSubs.count ?? 0) * 9;

    return NextResponse.json({
      totalUsers: totalUsers.count ?? 0,
      activeSubscriptions: activeSubs.count ?? 0,
      postsLast7d: postsLast7d.count ?? 0,
      postsLast30d: postsLast30d.count ?? 0,
      newUsersLast7d: newUsersLast7d.count ?? 0,
      estimatedMrr,
    });
  } catch (error) {
    captureError("Admin metrics error", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
