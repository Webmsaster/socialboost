import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";
import { isProSubscription } from "@/lib/subscription";

const PRO_LIMIT = 100;

interface SceneInput {
  imageUrl: string;
  duration?: number;
  textOverlay?: string;
}

export async function POST(request: NextRequest) {
  try {
    const renderUrl = process.env.VIDEO_RENDER_URL;
    const renderToken = process.env.VIDEO_RENDER_TOKEN;
    if (!renderUrl || !renderToken) {
      return NextResponse.json(
        { error: "Video rendering is not configured on this server." },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success } = await rateLimit(user.id, "/api/render-video");
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, generation_count")
      .eq("id", user.id)
      .single();

    if (!profile || !isProSubscription(profile.subscription_status)) {
      return NextResponse.json(
        { error: "Full video rendering requires a Pro subscription." },
        { status: 403 },
      );
    }
    if (profile.generation_count >= PRO_LIMIT) {
      return NextResponse.json(
        { error: `Monthly limit reached (${PRO_LIMIT}).` },
        { status: 403 },
      );
    }

    const body = await request.json();
    const scenes: SceneInput[] = Array.isArray(body.scenes) ? body.scenes : [];
    if (scenes.length === 0) {
      return NextResponse.json({ error: "Missing scenes" }, { status: 400 });
    }
    const validScenes = scenes
      .filter((s) => typeof s?.imageUrl === "string" && s.imageUrl.startsWith("http"))
      .slice(0, 8);
    if (validScenes.length === 0) {
      return NextResponse.json({ error: "No valid scene images" }, { status: 400 });
    }

    const aspect =
      body.aspect === "16:9" || body.aspect === "1:1" ? body.aspect : "9:16";

    const workerRes = await fetch(`${renderUrl.replace(/\/$/, "")}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${renderToken}`,
      },
      body: JSON.stringify({
        userId: user.id,
        scenes: validScenes,
        voiceoverDataUrl:
          typeof body.voiceoverDataUrl === "string" ? body.voiceoverDataUrl : undefined,
        aspect,
        brandName: typeof body.brandName === "string" ? body.brandName : undefined,
      }),
    });

    if (!workerRes.ok) {
      const text = await workerRes.text();
      captureError("Render worker error", new Error(text), {
        status: workerRes.status,
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Render failed. Please try again later." },
        { status: 502 },
      );
    }

    const { videoUrl } = (await workerRes
      .json()
      .catch(() => ({ videoUrl: null }))) as { videoUrl: string | null };

    // Only charge a generation if the worker actually returned a usable URL —
    // a 200 with an empty/garbage body must not burn quota or show a fake success.
    if (!videoUrl || typeof videoUrl !== "string") {
      captureError("Render worker returned no videoUrl", new Error("missing videoUrl"), {
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Render failed. Please try again later." },
        { status: 502 },
      );
    }

    await supabase.rpc("increment_generation_count", {
      p_user_id: user.id,
      p_limit: PRO_LIMIT,
    });

    return NextResponse.json({ videoUrl });
  } catch (error) {
    captureError("Render video error", error);
    return NextResponse.json({ error: "Failed to render video" }, { status: 500 });
  }
}
