import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fireWebhook } from "@/lib/webhooks";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { webhookUrl } = await request.json();
  if (!webhookUrl) return NextResponse.json({ error: "Missing webhookUrl" }, { status: 400 });

  await fireWebhook(webhookUrl, "test", { message: "Webhook test from SocialBoost", userId: user.id });

  return NextResponse.json({ success: true });
}
