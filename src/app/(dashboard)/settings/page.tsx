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
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [notifyMarketing, setNotifyMarketing] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(true);
  const [notifyPublish, setNotifyPublish] = useState(true);
  const { t } = useLanguage();
  const supabase = createClient();

  async function saveNotificationPrefs() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const prefs = { digest: notifyDigest, publish: notifyPublish, marketing: notifyMarketing };
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: prefs })
        .eq("id", user.id);

      if (error) throw error;
      toast.success(t("settings.preferencesSaved") || "Notification preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    }
  }

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
          "full_name, subscription_status, generation_count, bonus_generations, brand_voice, preferred_model, notification_preferences",
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

        // Load notification preferences from server
        const prefs = data.notification_preferences as Record<string, boolean> | null;
        if (prefs) {
          if (typeof prefs.digest === "boolean") setNotifyDigest(prefs.digest);
          if (typeof prefs.publish === "boolean") setNotifyPublish(prefs.publish);
          if (typeof prefs.marketing === "boolean") setNotifyMarketing(prefs.marketing);
        }
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

  async function handleChangePassword() {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
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
            <Label htmlFor="brand-voice">{t("settings.brandVoice")}</Label>
            <Textarea
              id="brand-voice"
              placeholder="e.g. We are a tech startup targeting young professionals. Our tone is friendly, knowledgeable, and slightly witty..."
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.brandVoiceDesc")}
            </p>
          </div>
          {isPro && (
            <div className="space-y-2">
              <Label htmlFor="preferred-model">{t("settings.aiModel")}</Label>
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
                {t("settings.aiModelDesc")}
              </p>
            </div>
          )}
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? t("settings.saving") : t("settings.saveChanges")}
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
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleManage} disabled={checkoutLoading}>
                  {t("settings.manage")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("settings.portalHint")}
              </p>
            </div>
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

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.changePassword")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("settings.newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Min. 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t("settings.confirmPassword")}</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !newPassword || !confirmPassword}
          >
            {changingPassword ? t("settings.updatingPassword") : t("settings.updatePassword")}
          </Button>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.notifications")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("settings.notificationsDesc")}
          </p>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
              <div>
                <p className="text-sm font-medium">{t("settings.weeklyDigest")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.weeklyDigestDesc")}</p>
              </div>
              <input
                type="checkbox"
                checked={notifyDigest}
                onChange={(e) => setNotifyDigest(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
              <div>
                <p className="text-sm font-medium">{t("settings.publishAlerts")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.publishAlertsDesc")}</p>
              </div>
              <input
                type="checkbox"
                checked={notifyPublish}
                onChange={(e) => setNotifyPublish(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
              <div>
                <p className="text-sm font-medium">{t("settings.productUpdates")}</p>
                <p className="text-xs text-muted-foreground">{t("settings.productUpdatesDesc")}</p>
              </div>
              <input
                type="checkbox"
                checked={notifyMarketing}
                onChange={(e) => setNotifyMarketing(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
            </label>
          </div>
          <Button variant="outline" onClick={saveNotificationPrefs}>
            {t("settings.savePreferences")}
          </Button>
        </CardContent>
      </Card>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.dataExport")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("settings.dataExportDesc")}
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
            {exporting ? t("settings.exporting") : t("settings.exportData")}
          </Button>
        </CardContent>
      </Card>

      {/* Referral Program */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.referral")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("settings.referralDesc")}
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
                  <p className="text-xs text-muted-foreground">{t("settings.totalReferrals")}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold text-primary">{referral.bonusGenerations}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.bonusGenerations")}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    "I'm loving SocialBoost for AI-powered social media content. Get 10 bonus generations:"
                  )}&url=${encodeURIComponent(referral.referralLink)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Share on X
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referral.referralLink)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Share on LinkedIn
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Check out SocialBoost — AI-powered content for every platform: ${referral.referralLink}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Share on WhatsApp
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent("Try SocialBoost")}&body=${encodeURIComponent(
                    `I'm using SocialBoost for AI-powered social posts. Sign up with my link and get 10 bonus generations: ${referral.referralLink}`
                  )}`}
                  className="inline-flex items-center rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  Share via Email
                </a>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              {t("settings.referralGenerating")}
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
                  {deleting ? "..." : t("settings.confirmDelete")}
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
