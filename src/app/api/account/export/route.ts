import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [profileRes, postsRes, templatesRes, accountsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("posts").select("*").order("created_at", { ascending: false }),
      supabase.from("templates").select("*").order("created_at", { ascending: false }),
      supabase.from("connected_accounts").select("*"),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      profile: profileRes.data,
      posts: postsRes.data ?? [],
      templates: templatesRes.data ?? [],
      connected_accounts: accountsRes.data ?? [],
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="socialboost-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    captureError("Data export failed", err);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
