import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";

// Whitelist of client-side events. Server-side trackEvent calls aren't
// constrained, but anything coming from the browser must match one of these
// — keeps the table from being polluted by arbitrary strings if /api/track
// is ever called from an extension or script.
const ALLOWED_EVENTS = new Set([
  "tab_switched",
  "post_saved_as_draft",
  "post_scheduled",
  "post_published",
  "render_video_clicked",
]);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success } = await rateLimit(user.id, "/api/track");
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const event = typeof body?.event === "string" ? body.event : null;
    if (!event || !ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }

    const rawProps = body?.properties;
    const properties: Record<string, string | number | boolean | null> = {};
    if (rawProps && typeof rawProps === "object") {
      for (const [k, v] of Object.entries(rawProps)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
          properties[k] = v;
        }
      }
    }

    trackEvent({ event, userId: user.id, properties });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
