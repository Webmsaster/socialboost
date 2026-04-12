import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

const VALID_PLATFORMS = ["linkedin", "facebook", "instagram", "pinterest", "twitter"];
const VALID_TONES = ["professional", "casual", "inspirational", "humorous", "educational"];

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

      toInsert.push({
        user_id: user.id,
        platform,
        topic: topic || `Imported ${platform} post`,
        content,
        hashtags,
        tone: VALID_TONES.includes(tone) ? tone : "professional",
        status: status === "scheduled" ? "scheduled" : "draft",
      });
    }

    let imported = 0;
    if (toInsert.length > 0) {
      const { error, count } = await supabase
        .from("posts")
        .insert(toInsert, { count: "exact" });
      if (error) {
        captureError("CSV import batch insert failed", error, { userId: user.id });
        return NextResponse.json(
          { error: "Failed to insert imported posts", details: error.message },
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
