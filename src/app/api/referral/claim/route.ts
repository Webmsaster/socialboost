import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { captureError } from "@/lib/logger";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const BONUS_PER_REFERRAL = 10;

export async function POST(request: NextRequest) {
  try {
    const { referralCode, newUserId } = await request.json();
    if (!referralCode || !newUserId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

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

    // Create referral record
    await supabase.from("referrals").insert({
      referrer_id: referrer.id,
      referred_id: newUserId,
      bonus_granted: true,
    });

    // Grant bonus to both users
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
