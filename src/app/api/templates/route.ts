import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      captureError("List templates error", error);
      return NextResponse.json(
        { error: "Failed to load templates" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    captureError("List templates error", error);
    return NextResponse.json(
      { error: "Failed to load templates" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, platform, tone, topic, language } = body as {
      name: string;
      platform: string;
      tone: string;
      topic: string;
      language: string;
    };

    if (!name || !platform || !tone) {
      return NextResponse.json(
        { error: "Missing required fields: name, platform, tone" },
        { status: 400 }
      );
    }

    const validPlatforms = ["linkedin", "facebook", "instagram", "pinterest", "twitter"];
    const validTones = ["professional", "casual", "inspirational", "humorous", "educational"];

    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: "Invalid platform" },
        { status: 400 }
      );
    }

    if (!validTones.includes(tone)) {
      return NextResponse.json(
        { error: "Invalid tone" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("templates")
      .insert({
        user_id: user.id,
        name,
        platform,
        tone,
        topic: topic || "",
        language: language || "English",
      })
      .select()
      .single();

    if (error) {
      captureError("Create template error", error);
      return NextResponse.json(
        { error: "Failed to create template" },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    captureError("Create template error", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
