import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";
import { logAudit } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limit";

// GET: List user's content series
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("content_series")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      captureError("Series fetch error", error);
      return NextResponse.json({ error: "Failed to fetch series" }, { status: 500 });
    }

    return NextResponse.json({ series: data || [] });
  } catch (error) {
    captureError("Series error", error);
    return NextResponse.json({ error: "Failed to fetch series" }, { status: 500 });
  }
}

// POST: Create a new content series
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limited = await rateLimit(user.id, "/api/series");
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const { name, platform, tone, topicTemplate, frequency, dayOfWeek, preferredTime, websiteUrl } = body;

    if (!name?.trim() || !platform || !topicTemplate?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let normalizedWebsiteUrl: string | null = null;
    if (typeof websiteUrl === "string" && websiteUrl.trim()) {
      try {
        const parsed = new URL(websiteUrl.trim());
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return NextResponse.json({ error: "Website URL must be http or https" }, { status: 400 });
        }
        normalizedWebsiteUrl = parsed.toString();
      } catch {
        return NextResponse.json({ error: "Invalid website URL" }, { status: 400 });
      }
    }

    const { data, error } = await supabase
      .from("content_series")
      .insert({
        user_id: user.id,
        name: name.trim(),
        platform,
        tone: tone || "professional",
        topic_template: topicTemplate.trim(),
        frequency: frequency || "weekly",
        day_of_week: dayOfWeek ?? null,
        preferred_time: preferredTime || "09:00",
        website_url: normalizedWebsiteUrl,
      })
      .select()
      .single();

    if (error) {
      captureError("Series create error", error);
      return NextResponse.json({ error: "Failed to create series" }, { status: 500 });
    }

    await logAudit(user.id, "series.created", { seriesId: data.id, name: data.name, platform });

    return NextResponse.json(data);
  } catch (error) {
    captureError("Series create error", error);
    return NextResponse.json({ error: "Failed to create series" }, { status: 500 });
  }
}

// DELETE: Delete a content series
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limited = await rateLimit(user.id, "/api/series");
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { error } = await supabase
      .from("content_series")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      captureError("Series delete error", error);
      return NextResponse.json({ error: "Failed to delete series" }, { status: 500 });
    }

    await logAudit(user.id, "series.deleted", { seriesId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    captureError("Series delete error", error);
    return NextResponse.json({ error: "Failed to delete series" }, { status: 500 });
  }
}

// PATCH: Toggle active status
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limited = await rateLimit(user.id, "/api/series");
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id, isActive } = await request.json();
    if (!id || typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Missing id or isActive" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("content_series")
      .update({ is_active: isActive })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      captureError("Series toggle error", error);
      return NextResponse.json({ error: "Failed to update series" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    captureError("Series toggle error", error);
    return NextResponse.json({ error: "Failed to update series" }, { status: 500 });
  }
}
