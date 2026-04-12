import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { type PlatformId, platformConfigs } from "@/lib/platforms";
import { getPublisher } from "@/lib/platforms/registry";
import { captureError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "";
    const redirectUri = `${baseUrl}/api/auth/oauth/callback`;
    const state = Buffer.from(JSON.stringify({ platform, userId: user.id })).toString("base64url");

    const authUrl = publisher.getAuthUrl(redirectUri, state);
    return NextResponse.json({ url: authUrl });
  } catch (err) {
    captureError("OAuth connect error", err);
    return NextResponse.json({ error: "Failed to start OAuth" }, { status: 500 });
  }
}
