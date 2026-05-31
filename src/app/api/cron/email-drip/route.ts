import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureError } from "@/lib/logger";
import {
  sendWelcomeEmail,
  sendDay3ReminderEmail,
  sendBrandVoiceNudgeEmail,
  sendDay7UpgradeEmail,
  sendVideoFeatureEmail,
} from "@/lib/email";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Window: profiles whose created_at falls on the date exactly N days ago (UTC).
// Since this cron runs once per day, a calendar-day window tiles perfectly
// without overlap or gaps.
function dayWindow(daysAgo: number): { start: string; end: string } {
  const now = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo));
  const next = new Date(target);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: target.toISOString(), end: next.toISOString() };
}

/**
 * Runs once per day. Sends a three-step onboarding drip based on signup age.
 * Day 1: Welcome, Day 3: Feature reminder, Day 7: Upgrade nudge.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdmin();

  // Onboarding drip: each stage fires once when a user hits the signup-anniversary
  // day window. Day 5 + Day 10 push the two features users almost never discover
  // on their own (brand-voice training and the video pipeline).
  const stages = [
    { days: 1, key: "welcome" as const },
    { days: 3, key: "day3" as const },
    { days: 5, key: "brandVoice" as const },
    { days: 7, key: "day7" as const },
    { days: 10, key: "video" as const },
  ];

  const sent: Record<string, number> = {
    welcome: 0, day3: 0, brandVoice: 0, day7: 0, video: 0,
  };
  const failed: Record<string, number> = {
    welcome: 0, day3: 0, brandVoice: 0, day7: 0, video: 0,
  };

  for (const stage of stages) {
    const { start, end } = dayWindow(stage.days);
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, generation_count, subscription_status, brand_voice")
      .gte("created_at", start)
      .lt("created_at", end);

    if (error) {
      captureError("Cron email-drip fetch failed", error, { stage: stage.key });
      continue;
    }

    for (const u of users || []) {
      if (!u.email) continue;

      // Targeting rules to avoid pestering users with irrelevant emails.
      if (stage.key === "brandVoice" && (u.brand_voice ?? "").toString().trim().length > 0) {
        // Already trained — skip the nudge.
        continue;
      }
      if (stage.key === "video" && u.subscription_status === "active") {
        // Pro users have already seen the upsell — show them something else later.
        continue;
      }

      try {
        let ok = false;
        if (stage.key === "welcome") ok = await sendWelcomeEmail(u.email, u.full_name || undefined);
        else if (stage.key === "day3") ok = await sendDay3ReminderEmail(u.email);
        else if (stage.key === "brandVoice") ok = await sendBrandVoiceNudgeEmail(u.email, u.generation_count || 0);
        else if (stage.key === "day7") ok = await sendDay7UpgradeEmail(u.email, u.generation_count || 0);
        else if (stage.key === "video") ok = await sendVideoFeatureEmail(u.email);

        if (ok) sent[stage.key]++;
        else failed[stage.key]++;
      } catch (err) {
        captureError("Cron email-drip send failed", err, { userId: u.id, stage: stage.key });
        failed[stage.key]++;
      }
    }
  }

  return NextResponse.json({ sent, failed });
}
