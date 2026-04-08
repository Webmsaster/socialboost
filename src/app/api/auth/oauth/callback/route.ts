import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";
import { type PlatformId } from "@/lib/platforms";
import { getPublisher } from "@/lib/platforms/registry";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/accounts?error=oauth_denied", request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/accounts?error=missing_params", request.url));
  }

  let platform: PlatformId;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString());
    platform = parsed.platform;
  } catch {
    return NextResponse.redirect(new URL("/accounts?error=invalid_state", request.url));
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const publisher = getPublisher(platform);
    if (!publisher) {
      return NextResponse.redirect(new URL("/accounts?error=unsupported_platform", request.url));
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const redirectUri = `${baseUrl}/api/auth/oauth/callback`;

    const result = await publisher.exchangeCode(code, redirectUri);

    // Upsert connected account
    const { error: dbError } = await supabase
      .from("connected_accounts")
      .upsert(
        {
          user_id: user.id,
          platform,
          platform_user_id: result.platformUserId,
          platform_username: result.platformUsername || null,
          access_token: result.accessToken,
          refresh_token: result.refreshToken || null,
          token_expires_at: result.expiresAt?.toISOString() || null,
        },
        { onConflict: "user_id,platform" }
      );

    if (dbError) {
      captureError("OAuth: failed to save connected account", dbError);
      return NextResponse.redirect(new URL("/accounts?error=save_failed", request.url));
    }

    return NextResponse.redirect(new URL("/accounts?success=connected", request.url));
  } catch (err) {
    captureError("OAuth callback failed", err, { platform });
    return NextResponse.redirect(new URL("/accounts?error=exchange_failed", request.url));
  }
}
