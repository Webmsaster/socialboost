import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";

const VALID_PLATFORMS = ["linkedin", "facebook", "instagram", "pinterest", "twitter"];
const VALID_TONES = ["professional", "casual", "inspirational", "humorous", "educational"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { rows } = await request.json() as { rows: Array<Record<string, string>> };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    if (rows.length > 100) {
      return NextResponse.json({ error: "Max 100 rows per import" }, { status: 400 });
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const platform = (row.platform || row.Platform || "").toLowerCase().trim();
      const topic = (row.topic || row.Topic || "").trim();
      const content = (row.content || row.Content || "").trim();
      const tone = (row.tone || row.Tone || "professional").toLowerCase().trim();
      const hashtagsRaw = row.hashtags || row.Hashtags || "";
      const status = (row.status || row.Status || "draft").toLowerCase().trim();

      if (!content) {
        errors.push(`Row ${i + 1}: missing content`);
        skipped++;
        continue;
      }

      if (!VALID_PLATFORMS.includes(platform)) {
        errors.push(`Row ${i + 1}: invalid platform "${platform}"`);
        skipped++;
        continue;
      }

      const hashtags = hashtagsRaw
        ? hashtagsRaw.split(",").map((h: string) => h.trim().replace(/^#/, "")).filter(Boolean)
        : [];

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        platform,
        topic: topic || `Imported ${platform} post`,
        content,
        hashtags,
        tone: VALID_TONES.includes(tone) ? tone : "professional",
        status: status === "scheduled" ? "scheduled" : "draft",
      });

      if (error) {
        errors.push(`Row ${i + 1}: ${error.message}`);
        skipped++;
      } else {
        imported++;
      }
    }

    return NextResponse.json({ imported, skipped, errors: errors.slice(0, 10) });
  } catch (error) {
    captureError("CSV import error", error);
    return NextResponse.json({ error: "Failed to import" }, { status: 500 });
  }
}
