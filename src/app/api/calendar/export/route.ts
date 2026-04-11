import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: posts, error } = await supabase
      .from("posts")
      .select("id, platform, topic, content, status, scheduled_for, created_at")
      .eq("status", "scheduled")
      .not("scheduled_for", "is", null)
      .order("scheduled_for", { ascending: true });

    if (error) {
      captureError("Calendar export error", error);
      return NextResponse.json({ error: "Failed to export" }, { status: 500 });
    }

    const events = (posts || []).map((post) => {
      const start = new Date(post.scheduled_for!);
      const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min duration
      const uid = `${post.id}@socialboost.app`;
      const summary = escapeIcal(`[${post.platform}] ${post.topic}`);
      const description = escapeIcal(post.content.slice(0, 500));

      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTART:${formatIcalDate(start)}`,
        `DTEND:${formatIcalDate(end)}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `STATUS:CONFIRMED`,
        "END:VEVENT",
      ].join("\r\n");
    });

    const ical = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SocialBoost//Content Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:SocialBoost Content Calendar",
      ...events,
      "END:VCALENDAR",
    ].join("\r\n");

    return new NextResponse(ical, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": "attachment; filename=socialboost-calendar.ics",
      },
    });
  } catch (error) {
    captureError("Calendar export error", error);
    return NextResponse.json({ error: "Failed to export calendar" }, { status: 500 });
  }
}

function formatIcalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcal(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
