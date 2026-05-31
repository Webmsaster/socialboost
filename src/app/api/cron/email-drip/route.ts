import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureError } from "@/lib/logger";
import { isProSubscription } from "@/lib/subscription";
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

// Extra days after a stage's anniversary during which we still try to send it.
// Combined with the per-(user,stage) claim in `drip_emails`, this lets a missed
// cron day self-heal: the stage fires on the next successful run inside the
// grace window instead of being skipped forever. The claim guarantees it still
// sends at most once.
// 1 day: stages are spaced >= 2 days apart, so a 1-day grace catches a single
// missed cron run without letting two adjacent stage windows overlap (which
// could fire two different onboarding emails to one user in a single run).
const GRACE_DAYS = 1;

// Profiles old enough for the given stage: created_at in
// (now - (days + GRACE_DAYS), now - days]  →  account age in [days, days+GRACE).
function ageWindow(days: number): { start: string; end: string } {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const olderThan = new Date(now - days * dayMs); // created_at <= this → age >= days
  const youngerThan = new Date(now - (days + GRACE_DAYS) * dayMs); // created_at > this → age < days+GRACE
  return { start: youngerThan.toISOString(), end: olderThan.toISOString() };
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
    const { start, end } = ageWindow(stage.days);
    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, generation_count, subscription_status, brand_voice")
      .gt("created_at", start)
      .lte("created_at", end);

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
      if (stage.key === "video" && isProSubscription(u.subscription_status)) {
        // Paying users have already seen the upsell — show them something else later.
        continue;
      }

      // Claim this (user, stage) atomically BEFORE sending. A duplicate-key
      // conflict (23505) means this stage was already sent (or is being sent by
      // a concurrent run) — skip. This is the idempotency guard that stops the
      // drip from re-sending the same email on a same-day re-run/retry.
      const { error: claimError } = await supabase
        .from("drip_emails")
        .insert({ user_id: u.id, stage: stage.key });
      if (claimError) {
        const code = (claimError as { code?: string }).code;
        if (code === "42P01") {
          // drip_emails table not created yet (migration-drip-log.sql not applied).
          // Fail loudly instead of silently skipping every user (which would look
          // "healthy" with sent:0) until the migration lands.
          captureError(
            "Cron email-drip: drip_emails table missing — apply migration-drip-log.sql",
            claimError,
          );
          return NextResponse.json({ error: "drip_emails table missing" }, { status: 500 });
        }
        if (code !== "23505") {
          captureError("Cron email-drip claim failed", claimError, { userId: u.id, stage: stage.key });
        }
        continue;
      }

      let ok = false;
      try {
        if (stage.key === "welcome") ok = await sendWelcomeEmail(u.email, u.full_name || undefined);
        else if (stage.key === "day3") ok = await sendDay3ReminderEmail(u.email);
        else if (stage.key === "brandVoice") ok = await sendBrandVoiceNudgeEmail(u.email, u.generation_count || 0);
        else if (stage.key === "day7") ok = await sendDay7UpgradeEmail(u.email, u.generation_count || 0);
        else if (stage.key === "video") ok = await sendVideoFeatureEmail(u.email);
      } catch (err) {
        captureError("Cron email-drip send failed", err, { userId: u.id, stage: stage.key });
        ok = false;
      }

      if (ok) {
        sent[stage.key]++;
      } else {
        // Send failed — release the claim so a future run retries (within grace).
        const { error: releaseError } = await supabase
          .from("drip_emails")
          .delete()
          .eq("user_id", u.id)
          .eq("stage", stage.key);
        if (releaseError) {
          captureError("Cron email-drip claim release failed", releaseError, {
            userId: u.id,
            stage: stage.key,
          });
        }
        failed[stage.key]++;
      }
    }
  }

  return NextResponse.json({ sent, failed });
}
