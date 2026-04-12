import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await rateLimit(user.id, "/api/auth/oauth/disconnect");
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { platform } = (await request.json()) as { platform: string };
    if (!platform) {
      return NextResponse.json({ error: "Missing platform" }, { status: 400 });
    }

    const { error } = await supabase
      .from("connected_accounts")
      .delete()
      .eq("user_id", user.id)
      .eq("platform", platform);

    if (error) {
      captureError("OAuth disconnect failed", error, { userId: user.id, platform });
      return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    captureError("OAuth disconnect error", err);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
