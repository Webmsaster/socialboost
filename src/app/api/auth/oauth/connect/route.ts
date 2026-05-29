import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type PlatformId, platformConfigs } from "@/lib/platforms";
import { getPublisher } from "@/lib/platforms/registry";
import { captureError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await rateLimit(user.id, "/api/auth/oauth/connect");
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { platform } = (await request.json()) as { platform: PlatformId };
    const config = platformConfigs[platform];
    if (!config) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    const clientId = process.env[config.clientIdEnv];
    if (!clientId) {
      return NextResponse.json(
        { error: `${config.name} OAuth is not configured. Set ${config.clientIdEnv} env var.` },
        { status: 501 }
      );
    }

    const publisher = getPublisher(platform);
    if (!publisher) {
      return NextResponse.json({ error: "Platform not yet supported" }, { status: 501 });
    }

    // Prefer the configured app URL; only fall back to the server-derived
    // request origin (NOT the spoofable client `Origin` header) for dev.
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/auth/oauth/callback`;

    // CSRF protection: bind the OAuth round-trip to this browser with a random
    // nonce that travels in `state` and is also stored in an httpOnly cookie the
    // callback verifies. userId lets the callback confirm the flow was started
    // by the same session user (prevents forced account-linking).
    const nonce = randomBytes(16).toString("base64url");
    const state = Buffer.from(
      JSON.stringify({ platform, userId: user.id, nonce })
    ).toString("base64url");

    const authUrl = publisher.getAuthUrl(redirectUri, state);
    const response = NextResponse.json({ url: authUrl });
    response.cookies.set("oauth_state", nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (err) {
    captureError("OAuth connect error", err);
    return NextResponse.json({ error: "Failed to start OAuth" }, { status: 500 });
  }
}
