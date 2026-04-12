import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";
import { logAudit } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limit";

// GET: List user's webhooks
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("user_webhooks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      captureError("Webhook list error", error);
      return NextResponse.json({ error: "Failed to list webhooks" }, { status: 500 });
    }

    return NextResponse.json({ webhooks: data || [] });
  } catch (error) {
    captureError("Webhook list error", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST: Create a new webhook
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limited = await rateLimit(user.id, "/api/webhooks/manage");
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { url, events } = await request.json() as { url: string; events: string[] };

    if (!url?.trim()) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    if (!url.startsWith("https://")) {
      return NextResponse.json({ error: "Webhook URL must use HTTPS" }, { status: 400 });
    }

    const validEvents = ["post.created", "post.published", "post.approved", "post.rejected", "series.generated"];
    const filteredEvents = (events || validEvents).filter((e: string) => validEvents.includes(e));

    // Limit: max 5 webhooks per user
    const { count } = await supabase
      .from("user_webhooks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count || 0) >= 5) {
      return NextResponse.json({ error: "Max 5 webhooks per account" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("user_webhooks")
      .insert({
        user_id: user.id,
        url: url.trim(),
        events: filteredEvents,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      captureError("Webhook create error", error);
      return NextResponse.json({ error: "Failed to create webhook" }, { status: 500 });
    }

    await logAudit(user.id, "webhook.created", { webhookId: data.id, url: data.url, events: filteredEvents });

    return NextResponse.json(data);
  } catch (error) {
    captureError("Webhook create error", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// DELETE: Remove a webhook
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { error } = await supabase
      .from("user_webhooks")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      captureError("Webhook delete error", error);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    await logAudit(user.id, "webhook.deleted", { webhookId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    captureError("Webhook delete error", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
