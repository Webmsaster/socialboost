import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { captureError } from "@/lib/logger";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

interface EventRow {
  event: string;
  created_at: string;
  properties: Record<string, unknown> | null;
}

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = getAdmin();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Pulling rows directly is fine at our scale (under ~50k events/month).
    // If the table grows materially we'll move this to a SQL function with
    // GROUP BY done in the database; the client-side aggregation here is the
    // intentionally-simple version while we're still under that ceiling.
    const { data, error } = await admin
      .from("analytics_events")
      .select("event, created_at, properties")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000);

    if (error) throw error;
    const rows = (data || []) as EventRow[];

    // Top events in the last 30 days (whole window).
    const eventCounts = new Map<string, number>();
    for (const r of rows) {
      eventCounts.set(r.event, (eventCounts.get(r.event) ?? 0) + 1);
    }
    const topEvents = Array.from(eventCounts.entries())
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count);

    // Tab-switch breakdown — which content type users actually engage with.
    // Anything else is noise here.
    const tabCounts = new Map<string, number>();
    for (const r of rows) {
      if (r.event !== "tab_switched") continue;
      const tab = typeof r.properties?.to === "string" ? r.properties.to : "unknown";
      tabCounts.set(tab, (tabCounts.get(tab) ?? 0) + 1);
    }
    const tabBreakdown = Array.from(tabCounts.entries())
      .map(([tab, count]) => ({ tab, count }))
      .sort((a, b) => b.count - a.count);

    // Daily event volume across the 30-day window. Buckets keyed by YYYY-MM-DD.
    const byDay = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of rows) {
      const day = r.created_at.slice(0, 10);
      if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const daily = Array.from(byDay.entries()).map(([day, count]) => ({ day, count }));

    return NextResponse.json({
      windowDays: 30,
      totalEvents: rows.length,
      topEvents,
      tabBreakdown,
      daily,
    });
  } catch (error) {
    captureError("Admin analytics-events error", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics events" },
      { status: 500 },
    );
  }
}
