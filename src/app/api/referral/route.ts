import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: Get user's referral info
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_code, bonus_generations")
    .eq("id", user.id)
    .single();

  const { count } = await supabase
    .from("referrals")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", user.id);

  return NextResponse.json({
    referralCode: profile?.referral_code,
    bonusGenerations: profile?.bonus_generations || 0,
    totalReferrals: count || 0,
    referralLink: `${process.env.NEXT_PUBLIC_APP_URL || ""}/signup?ref=${profile?.referral_code}`,
  });
}
