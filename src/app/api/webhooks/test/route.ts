import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fireWebhook } from "@/lib/webhooks";
import { captureError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const limited = await rateLimit(user.id, "/api/webhooks/test");
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { webhookUrl } = await request.json();
    if (!webhookUrl) return NextResponse.json({ error: "Missing webhookUrl" }, { status: 400 });

    // Only allow https URLs to avoid SSRF/HTTP cleartext attempts.
    try {
      const parsed = new URL(webhookUrl);
      if (parsed.protocol !== "https:") {
        return NextResponse.json({ error: "Webhook URL must use https" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid webhook URL" }, { status: 400 });
    }

    await fireWebhook(webhookUrl, "test", { message: "Webhook test from SocialBoost", userId: user.id });

    return NextResponse.json({ success: true });
  } catch (err) {
    captureError("Webhook test error", err);
    return NextResponse.json({ error: "Failed to send test webhook" }, { status: 500 });
  }
}
