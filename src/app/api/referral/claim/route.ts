import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const BONUS_PER_REFERRAL = 10;

export async function POST(request: NextRequest) {
  try {
    // Authenticate: the claiming user must be logged in
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await rateLimit(user.id, "/api/referral/claim");
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { referralCode } = await request.json();
    if (!referralCode) {
      return NextResponse.json({ error: "Missing referral code" }, { status: 400 });
    }

    // Use the authenticated user's ID — never trust client-supplied user IDs
    const newUserId = user.id;
    const supabase = getAdmin();

    // Find referrer
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", referralCode)
      .single();

    if (!referrer || referrer.id === newUserId) {
      return NextResponse.json({ error: "Invalid referral" }, { status: 400 });
    }

    // Check if already referred
    const { data: existing } = await supabase
      .from("referrals")
      .select("id")
      .eq("referrer_id", referrer.id)
      .eq("referred_id", newUserId)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Already referred" }, { status: 409 });
    }

    // Create referral record. The unique(referrer_id, referred_id) constraint is
    // the concurrency guard: if two claims race, only one insert succeeds, so the
    // bonus is granted exactly once (no double-grant on double-submit/retry).
    const { error: insertError } = await supabase.from("referrals").insert({
      referrer_id: referrer.id,
      referred_id: newUserId,
      bonus_granted: true,
    });
    if (insertError) {
      // 23505 = already referred (lost the race) — expected, not worth surfacing.
      if ((insertError as { code?: string }).code !== "23505") {
        captureError("Referral insert failed", insertError, { referrerId: referrer.id });
      }
      return NextResponse.json({ error: "Already referred" }, { status: 409 });
    }

    // Grant bonus to both users — only reached when the insert above succeeded.
    await supabase.rpc("grant_referral_bonus", {
      p_referrer_id: referrer.id,
      p_referred_id: newUserId,
      p_bonus: BONUS_PER_REFERRAL,
    });

    return NextResponse.json({ success: true, bonus: BONUS_PER_REFERRAL });
  } catch (error) {
    captureError("Referral claim error", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
