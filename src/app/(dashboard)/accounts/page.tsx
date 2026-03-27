"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ConnectedAccount {
  id: string;
  platform: string;
  platform_username: string | null;
  created_at: string;
}

const platformConfigs = [
  { id: "linkedin", name: "LinkedIn", color: "bg-blue-600", supported: true },
  { id: "facebook", name: "Facebook", color: "bg-blue-500", supported: true },
  { id: "instagram", name: "Instagram", color: "bg-pink-500", supported: false },
  { id: "pinterest", name: "Pinterest", color: "bg-red-500", supported: false },
  { id: "twitter", name: "Twitter / X", color: "bg-neutral-800", supported: true },
];

export default function AccountsPage() {
  const { t } = useLanguage();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    const supabase = createClient();
    const { data } = await supabase
      .from("connected_accounts")
      .select("id, platform, platform_username, created_at");
    if (data) setAccounts(data);
  }

  async function handleConnect(platform: string) {
    setLoading(platform);
    try {
      const res = await fetch("/api/auth/oauth/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to connect");
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("Connection failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleDisconnect(platform: string) {
    setLoading(platform);
    try {
      const res = await fetch("/api/auth/oauth/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.platform !== platform));
        toast.success("Account disconnected");
      }
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setLoading(null);
    }
  }

  function getAccount(platformId: string) {
    return accounts.find((a) => a.platform === platformId);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("accounts.title")}</h1>
        <p className="mt-2 text-muted-foreground">
          Connect your social media accounts to publish posts directly from SocialBoost.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {platformConfigs.map((platform) => {
          const account = getAccount(platform.id);
          const isConnected = !!account;
          const isLoading = loading === platform.id;

          return (
            <Card key={platform.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${platform.color}`} />
                  {platform.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                {isConnected ? (
                  <>
                    <div>
                      <Badge variant="default" className="bg-green-600">Connected</Badge>
                      {account.platform_username && (
                        <p className="mt-1 text-xs text-muted-foreground">@{account.platform_username}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDisconnect(platform.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? "..." : "Disconnect"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="outline">{t("accounts.notConnected")}</Badge>
                    <Button
                      size="sm"
                      onClick={() => handleConnect(platform.id)}
                      disabled={isLoading || !platform.supported}
                    >
                      {!platform.supported ? "Coming soon" : isLoading ? "Connecting..." : t("accounts.connect")}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        Connected accounts allow SocialBoost to publish scheduled posts directly to your platforms.
        Instagram and Pinterest support is coming soon.
      </p>
    </div>
  );
}
