"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

interface ProfileData {
  full_name: string | null;
  subscription_status: string;
  generation_count: number;
  bonus_generations: number;
  brand_voice: string | null;
  preferred_model: string | null;
}

interface ReferralData {
  referralCode: string;
  bonusGenerations: number;
  totalReferrals: number;
  referralLink: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [preferredModel, setPreferredModel] = useState("gpt-4o-mini");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("profiles")
        .select(
          "full_name, subscription_status, generation_count, bonus_generations, brand_voice, preferred_model",
        )
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile({
          ...data,
          bonus_generations: data.bonus_generations ?? 0,
          brand_voice: data.brand_voice ?? null,
          preferred_model: data.preferred_model ?? null,
        });
        setFullName(data.full_name ?? "");
        setBrandVoice(data.brand_voice ?? "");
        setPreferredModel(data.preferred_model ?? "gpt-4o-mini");
      }

      // Load referral data
      try {
        const res = await fetch("/api/referral");
        if (res.ok) {
          const refData = await res.json();
          setReferral(refData);
        }
      } catch {
        // Referral data not critical
      }

      setLoading(false);
    }
    load();
  }, [supabase]);

  async function handleSaveProfile() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || null,
        brand_voice: brandVoice.trim() || null,
        preferred_model: preferredModel || "gpt-4o-mini",
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated");
    }
    setSaving(false);
  }

  async function handleUpgrade(plan: "monthly" | "annual" = "monthly") {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Failed to start checkout");
    } finally {
      setCheckoutLoading(false);
    }
  }

  function handleCopyReferral() {
    if (!referral?.referralLink) return;
    navigator.clipboard.writeText(referral.referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete account");
        setDeleting(false);
        return;
      }
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch {
      toast.error("Failed to delete account");
      setDeleting(false);
    }
  }

  async function handleManage() {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Failed to open portal");
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-9 w-40" />
        <Card>
          <CardHeader><Skeleton className="h-6 w-24" /></CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPro = profile?.subscription_status === "active";
  const limit = isPro ? 100 : 10;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{t("settings.title")}</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Your name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed here
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="brand-voice">Brand Voice</Label>
            <Textarea
              id="brand-voice"
              placeholder="e.g. We are a tech startup targeting young professionals. Our tone is friendly, knowledgeable, and slightly witty..."
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              Describe your writing style, target audience, and brand
              personality. This will be used to customize all AI-generated
              content.
            </p>
          </div>
          {isPro && (
            <div className="space-y-2">
              <Label htmlFor="preferred-model">AI Model</Label>
              <Select
                value={preferredModel}
                onValueChange={setPreferredModel}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini">
                    gpt-4o-mini (Faster)
                  </SelectItem>
                  <SelectItem value="gpt-4o">
                    gpt-4o (Higher quality)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pro users can choose between faster or higher quality AI
                generation.
              </p>
            </div>
          )}
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.subscription")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isPro ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {isPro ? t("settings.plan.pro") : t("settings.plan.free")}
            </span>
            <span className="text-sm text-muted-foreground">
              {profile?.generation_count ?? 0} / {limit} {t("dashboard.generations")}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(((profile?.generation_count ?? 0) / limit) * 100, 100)}%` }}
            />
          </div>
          {isPro ? (
            <Button variant="outline" onClick={handleManage} disabled={checkoutLoading}>
              {t("settings.manage")}
            </Button>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => handleUpgrade("monthly")} disabled={checkoutLoading}>
                {t("settings.upgrade")} ($9/mo)
              </Button>
              <Button variant="outline" onClick={() => handleUpgrade("annual")} disabled={checkoutLoading}>
                Annual ($79/yr — save 27%)
              </Button>
            </div>
          )}
          {(profile?.bonus_generations ?? 0) > 0 && (
            <p className="text-sm text-muted-foreground">
              +{profile?.bonus_generations} bonus generations from referrals
            </p>
          )}
        </CardContent>
      </Card>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle>Data Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Download all your data (profile, posts, templates) as a JSON file.
          </p>
          <Button
            variant="outline"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const res = await fetch("/api/account/export");
                if (!res.ok) throw new Error("Export failed");
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `socialboost-export-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Data exported");
              } catch {
                toast.error("Failed to export data");
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting ? "Exporting..." : "Export my data"}
          </Button>
        </CardContent>
      </Card>

      {/* Referral Program */}
      <Card>
        <CardHeader>
          <CardTitle>Referral Program</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Invite friends and earn 10 bonus generations for each signup. Your friend gets 10 bonus generations too!
          </p>
          {referral?.referralCode ? (
            <>
              <div className="flex items-center gap-2">
                <Input
                  value={referral.referralLink}
                  readOnly
                  className="bg-muted font-mono text-xs"
                />
                <Button variant="outline" size="sm" onClick={handleCopyReferral}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold text-primary">{referral.totalReferrals}</p>
                  <p className="text-xs text-muted-foreground">Total referrals</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold text-primary">{referral.bonusGenerations}</p>
                  <p className="text-xs text-muted-foreground">Bonus generations</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              Your referral code is being generated...
            </p>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">{t("settings.danger")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {showDeleteConfirm ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{t("settings.deleteConfirm")}</p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={deleting}
                  onClick={handleDeleteAccount}
                >
                  {deleting ? "Deleting..." : "Confirm Delete"}
                </Button>
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              {t("settings.deleteAccount")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
