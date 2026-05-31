import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { PLATFORMS, TONES } from "@/lib/openai";

// Widened to string[] so the lowercased CSV values can be membership-tested
// against the shared allow-lists (src/lib/openai.ts).
const VALID_PLATFORMS: readonly string[] = PLATFORMS;
const VALID_TONES: readonly string[] = TONES;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limited = await rateLimit(user.id, "/api/import");
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const rows = body?.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    if (rows.length > 100) {
      return NextResponse.json({ error: "Max 100 rows per import" }, { status: 400 });
    }

    // Validate every row first, then batch-insert the valid ones in a single
    // round-trip. Avoids N DB calls and keeps all-or-nothing per-row accounting.
    type ValidRow = {
      user_id: string;
      platform: string;
      topic: string;
      content: string;
      hashtags: string[];
      tone: string;
      status: string;
      scheduled_for: string | null;
    };
    const toInsert: ValidRow[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = (rows[i] ?? {}) as Record<string, unknown>;
      const platform = String(row.platform || row.Platform || "").toLowerCase().trim();
      const topic = String(row.topic || row.Topic || "").trim();
      const content = String(row.content || row.Content || "").trim();
      const tone = String(row.tone || row.Tone || "professional").toLowerCase().trim();
      const hashtagsRaw = String(row.hashtags || row.Hashtags || "");
      const status = String(row.status || row.Status || "draft").toLowerCase().trim();
      const scheduledForRaw = String(
        row.scheduled_for || row.scheduledFor || row["Scheduled For"] || ""
      ).trim();

      if (!content) {
        errors.push(`Row ${i + 1}: missing content`);
        skipped++;
        continue;
      }
      if (content.length > 5000) {
        errors.push(`Row ${i + 1}: content too long (max 5000)`);
        skipped++;
        continue;
      }
      if (!VALID_PLATFORMS.includes(platform)) {
        errors.push(`Row ${i + 1}: invalid platform "${platform}"`);
        skipped++;
        continue;
      }

      const hashtags = hashtagsRaw
        ? hashtagsRaw.split(",").map((h) => h.trim().replace(/^#/, "")).filter(Boolean)
        : [];

      // Only keep "scheduled" if a valid date is supplied. A scheduled post with
      // no scheduled_for is stuck forever: the publish cron matches
      // `scheduled_for <= now`, and `NULL <= now` is UNKNOWN, so it is never
      // published and never gets a manual-publish reminder. Fall back to draft.
      let scheduledFor: string | null = null;
      if (scheduledForRaw) {
        const d = new Date(scheduledForRaw);
        if (!Number.isNaN(d.getTime())) scheduledFor = d.toISOString();
      }
      const finalStatus = status === "scheduled" && scheduledFor ? "scheduled" : "draft";

      toInsert.push({
        user_id: user.id,
        platform,
        topic: topic || `Imported ${platform} post`,
        content,
        hashtags,
        tone: VALID_TONES.includes(tone) ? tone : "professional",
        status: finalStatus,
        scheduled_for: finalStatus === "scheduled" ? scheduledFor : null,
      });
    }

    let imported = 0;
    if (toInsert.length > 0) {
      const { error, count } = await supabase
        .from("posts")
        .insert(toInsert, { count: "exact" });
      if (error) {
        captureError("CSV import batch insert failed", error, { userId: user.id });
        // Don't leak the raw Postgres error (column/constraint/RLS hints) to the
        // client — it's already captured above. Match the rest of the API surface.
        return NextResponse.json(
          { error: "Failed to insert imported posts" },
          { status: 500 }
        );
      }
      imported = count ?? toInsert.length;
    }

    return NextResponse.json({ imported, skipped, errors: errors.slice(0, 10) });
  } catch (error) {
    captureError("CSV import error", error);
    return NextResponse.json({ error: "Failed to import" }, { status: 500 });
  }
}
