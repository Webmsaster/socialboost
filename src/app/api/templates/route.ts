import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { validateTemplateInput } from "@/lib/validate-template";

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

    const limited = await rateLimit(user.id, "/api/templates");
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const validation = validateTemplateInput(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { name, platform, tone, topic, language } = validation.value;

    const { data, error } = await supabase
      .from("templates")
      .insert({
        user_id: user.id,
        name,
        platform,
        tone,
        topic,
        language,
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
