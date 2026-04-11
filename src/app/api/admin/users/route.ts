import { NextRequest, NextResponse } from "next/server";
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

// GET: List/search users with pagination
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = getAdmin();
    const search = request.nextUrl.searchParams.get("search") || "";
    const page = parseInt(request.nextUrl.searchParams.get("page") || "1");
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = admin
      .from("profiles")
      .select("id, email, full_name, subscription_status, generation_count, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search.trim()) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      captureError("Admin users error", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Get post counts for these users
    const userIds = (data || []).map((u) => u.id);
    const postCounts: Record<string, number> = {};

    if (userIds.length > 0) {
      const { data: posts } = await admin
        .from("posts")
        .select("user_id")
        .in("user_id", userIds);

      for (const post of posts || []) {
        postCounts[post.user_id] = (postCounts[post.user_id] || 0) + 1;
      }
    }

    const users = (data || []).map((u) => ({
      ...u,
      postCount: postCounts[u.id] || 0,
    }));

    return NextResponse.json({
      users,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    captureError("Admin users error", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
