"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";

const platformConfigs = [
  { id: "linkedin", name: "LinkedIn", color: "bg-blue-600" },
  { id: "facebook", name: "Facebook", color: "bg-blue-500" },
  { id: "instagram", name: "Instagram", color: "bg-pink-500" },
  { id: "pinterest", name: "Pinterest", color: "bg-red-500" },
  { id: "twitter", name: "Twitter / X", color: "bg-neutral-800" },
];

export default function AccountsPage() {
  const { t } = useLanguage();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{t("accounts.title")}</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {platformConfigs.map((platform) => (
          <Card key={platform.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${platform.color}`} />
                {platform.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <Badge variant="outline">{t("accounts.notConnected")}</Badge>
              <Button size="sm" disabled>
                {t("accounts.connect")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        OAuth integration coming soon. For now, generate posts and copy them to your platforms.
      </p>
    </div>
  );
}
