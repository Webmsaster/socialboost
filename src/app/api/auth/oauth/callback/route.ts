import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";
import { type PlatformId } from "@/lib/platforms";
import { getPublisher } from "@/lib/platforms/registry";
import { encryptToken } from "@/lib/token-crypto";

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
  let stateUserId: string | undefined;
  let stateNonce: string | undefined;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString());
    platform = parsed.platform;
    stateUserId = parsed.userId;
    stateNonce = parsed.nonce;
  } catch {
    return NextResponse.redirect(new URL("/accounts?error=invalid_state", request.url));
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // CSRF: the state nonce must match the httpOnly cookie set at connect time,
    // and the flow must have been started by THIS session user. Defeats forced
    // account-linking (an attacker tricking a victim into completing the
    // attacker's authorize flow against the victim's session).
    const cookieNonce = request.cookies.get("oauth_state")?.value;
    if (!stateNonce || !cookieNonce || stateNonce !== cookieNonce || stateUserId !== user.id) {
      const res = NextResponse.redirect(new URL("/accounts?error=invalid_state", request.url));
      res.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });
      res.cookies.set("oauth_pkce_verifier", "", { maxAge: 0, path: "/" });
      return res;
    }

    const publisher = getPublisher(platform);
    if (!publisher) {
      return NextResponse.redirect(new URL("/accounts?error=unsupported_platform", request.url));
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      new URL(request.url).origin;
    const redirectUri = `${baseUrl}/api/auth/oauth/callback`;

    // Twitter/X PKCE: hand the stored verifier back during token exchange.
    const codeVerifier = request.cookies.get("oauth_pkce_verifier")?.value;

    const result = await publisher.exchangeCode(code, redirectUri, codeVerifier);

    // Upsert connected account
    const { error: dbError } = await supabase
      .from("connected_accounts")
      .upsert(
        {
          user_id: user.id,
          platform,
          platform_user_id: result.platformUserId,
          platform_username: result.platformUsername || null,
          access_token: encryptToken(result.accessToken),
          refresh_token: encryptToken(result.refreshToken || null),
          token_expires_at: result.expiresAt?.toISOString() || null,
        },
        { onConflict: "user_id,platform" }
      );

    if (dbError) {
      captureError("OAuth: failed to save connected account", dbError);
      return NextResponse.redirect(new URL("/accounts?error=save_failed", request.url));
    }

    const res = NextResponse.redirect(new URL("/accounts?success=connected", request.url));
    res.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });
    res.cookies.set("oauth_pkce_verifier", "", { maxAge: 0, path: "/" });
    return res;
  } catch (err) {
    captureError("OAuth callback failed", err, { platform });
    const res = NextResponse.redirect(new URL("/accounts?error=exchange_failed", request.url));
    res.cookies.set("oauth_pkce_verifier", "", { maxAge: 0, path: "/" });
    return res;
  }
}
