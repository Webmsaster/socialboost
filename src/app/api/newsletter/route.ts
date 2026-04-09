import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { newsletterSchema } from "@/lib/validations";
import { captureError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Newsletter subscription endpoint.
 * Stores emails in the `newsletter_subscribers` table (graceful degradation
 * if the table doesn't exist — the table is optional and logs the signup
 * without failing the user's request).
 */
export async function POST(request: NextRequest) {
  try {
    // Rate-limit by IP to deter scraping/abuse
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "anonymous";
    const limited = await rateLimit(`newsletter:${ip}`);
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const parsed = newsletterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid email" },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const admin = getAdmin();

    // Upsert — duplicate subscriptions return success silently
    const { error } = await admin
      .from("newsletter_subscribers")
      .upsert({ email: email.toLowerCase() }, { onConflict: "email" });

    if (error) {
      // Table may not exist yet — log and still return success so the
      // user gets positive feedback without exposing infrastructure state.
      captureError("Newsletter subscribe: DB write failed", error, { email });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureError("Newsletter subscribe error", error);
    return NextResponse.json(
      { error: "Subscription failed" },
      { status: 500 }
    );
  }
}
