import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { captureError } from "@/lib/logger";

// GET: Get user's referral info
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [profileRes, countRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("referral_code, bonus_generations")
        .eq("id", user.id)
        .single(),
      supabase
        .from("referrals")
        .select("*", { count: "exact", head: true })
        .eq("referrer_id", user.id),
    ]);

    return NextResponse.json({
      referralCode: profileRes.data?.referral_code,
      bonusGenerations: profileRes.data?.bonus_generations || 0,
      totalReferrals: countRes.count || 0,
      referralLink: `${process.env.NEXT_PUBLIC_APP_URL || ""}/signup?ref=${profileRes.data?.referral_code ?? ""}`,
    });
  } catch (err) {
    captureError("Referral fetch error", err);
    return NextResponse.json({ error: "Failed to load referral info" }, { status: 500 });
  }
}
