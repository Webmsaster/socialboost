import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { scoreContent } from "@/lib/content-score";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { success } = await rateLimit(user.id, "/api/score");
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const { content, platform, hashtags } = (await request.json()) as {
      content: string;
      platform: string;
      hashtags?: string[];
    };

    if (!content?.trim() || !platform) {
      return NextResponse.json(
        { error: "Missing content or platform" },
        { status: 400 },
      );
    }

    return NextResponse.json(scoreContent({ content, platform, hashtags }));
  } catch (error) {
    captureError("Score content error", error);
    return NextResponse.json(
      { error: "Failed to score content" },
      { status: 500 },
    );
  }
}
