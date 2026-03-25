"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

export default function SettingsPage() {
  const [subscriptionStatus, setSubscriptionStatus] = useState("inactive");
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("subscription_status")
        .eq("id", user.id)
        .single();
      if (data) setSubscriptionStatus(data.subscription_status);
    }
    load();
  }, [supabase]);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Failed to start checkout");
    } finally {
      setLoading(false);
    }
  }

  async function handleManage() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Failed to open portal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{t("settings.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.subscription")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {subscriptionStatus === "active" ? t("settings.plan.pro") : t("settings.plan.free")}
          </p>
          {subscriptionStatus === "active" ? (
            <Button variant="outline" onClick={handleManage} disabled={loading}>
              {t("settings.manage")}
            </Button>
          ) : (
            <Button onClick={handleUpgrade} disabled={loading}>
              {t("settings.upgrade")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">{t("settings.danger")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" disabled>
            {t("settings.deleteAccount")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
