"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

interface ProfileData {
  full_name: string | null;
  subscription_status: string;
  generation_count: number;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { t } = useLanguage();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? "");

      const { data } = await supabase
        .from("profiles")
        .select("full_name, subscription_status, generation_count")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setFullName(data.full_name ?? "");
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function handleSaveProfile() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated");
    }
    setSaving(false);
  }

  async function handleUpgrade() {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Failed to start checkout");
    } finally {
      setCheckoutLoading(false);
    }
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
            <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
          </div>
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
            <Button onClick={handleUpgrade} disabled={checkoutLoading}>
              {t("settings.upgrade")}
            </Button>
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
