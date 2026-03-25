import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateImage } from "@/lib/openai";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";

const FREE_LIMIT = 10;
const PRO_LIMIT = 100;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success: withinLimit } = await rateLimit(user.id, "/api/generate-image");
    if (!withinLimit) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { prompt } = body as { prompt: string };

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "Missing required field: prompt" },
        { status: 400 }
      );
    }

    // Check generation limit
    const { data: profile } = await supabase
      .from("profiles")
      .select("generation_count, subscription_status")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const limit = profile.subscription_status === "active" ? PRO_LIMIT : FREE_LIMIT;

    if (profile.generation_count >= limit) {
      return NextResponse.json(
        { error: `Monthly limit reached (${limit}). Upgrade to Pro for more.` },
        { status: 403 }
      );
    }

    const url = await generateImage(prompt);

    await supabase.rpc("increment_generation_count", {
      p_user_id: user.id,
      p_limit: limit,
    });

    return NextResponse.json({ url });
  } catch (error) {
    captureError("Generate image error", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
