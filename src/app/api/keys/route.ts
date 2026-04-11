import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateApiKey, hashApiKey } from "@/lib/api-keys";
import { captureError } from "@/lib/logger";

// GET: List user's API keys (without the actual key)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, is_active, last_used_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      captureError("API keys list error", error);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    return NextResponse.json({ keys: data || [] });
  } catch (error) {
    captureError("API keys error", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST: Create a new API key
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name } = await request.json();

    // Limit: max 3 keys per user
    const { count } = await supabase
      .from("api_keys")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count || 0) >= 3) {
      return NextResponse.json({ error: "Max 3 API keys per account" }, { status: 400 });
    }

    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 10) + "...";

    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        user_id: user.id,
        name: (name || "Default").slice(0, 50),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        is_active: true,
      })
      .select("id, name, key_prefix, created_at")
      .single();

    if (error) {
      captureError("API key create error", error);
      return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
    }

    // Return the raw key ONCE — it cannot be retrieved again
    return NextResponse.json({ ...data, key: rawKey });
  } catch (error) {
    captureError("API key create error", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// DELETE: Revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { error } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      captureError("API key delete error", error);
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureError("API key delete error", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
