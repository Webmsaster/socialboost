import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Delete all user posts
    const { error: postsError } = await admin
      .from("posts")
      .delete()
      .eq("user_id", user.id);

    if (postsError) {
      captureError("Failed to delete user posts", postsError);
      return NextResponse.json(
        { error: "Failed to delete posts" },
        { status: 500 }
      );
    }

    // Delete connected accounts
    await admin
      .from("connected_accounts")
      .delete()
      .eq("user_id", user.id);

    // Delete templates
    await admin
      .from("templates")
      .delete()
      .eq("user_id", user.id);

    // Delete profile (cascades from auth.users delete, but explicit for safety)
    await admin.from("profiles").delete().eq("id", user.id);

    // Delete the auth user (this is the definitive action)
    const { error: authError } = await admin.auth.admin.deleteUser(user.id);

    if (authError) {
      captureError("Failed to delete auth user", authError);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    captureError("Account deletion failed", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
