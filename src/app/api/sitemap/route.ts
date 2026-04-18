import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { fetchSitemapUrls } from "@/lib/sitemap";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { success } = await rateLimit(user.id, "/api/sitemap");
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const input: unknown = body?.url;
    if (typeof input !== "string" || !input.trim()) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }
    if (input.length > 2000) {
      return NextResponse.json({ error: "URL too long" }, { status: 400 });
    }

    const result = await fetchSitemapUrls(input);
    if (!result) {
      return NextResponse.json(
        {
          error:
            "Could not find a sitemap. Check the URL or try giving the direct sitemap.xml link.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    captureError("Sitemap error", error);
    return NextResponse.json({ error: "Failed to fetch sitemap" }, { status: 500 });
  }
}
