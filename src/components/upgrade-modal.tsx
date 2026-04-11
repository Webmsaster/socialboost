"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

interface UpgradeModalProps {
  feature: string;
  description: string;
  onClose: () => void;
}

export function UpgradeModal({ feature, description, onClose }: UpgradeModalProps) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border bg-background p-8 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold">{t("upgrade.title")}</h3>
          <p className="text-sm text-muted-foreground">
            <strong>{feature}</strong> {t("upgrade.proOnly")}
          </p>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="rounded-lg bg-primary/5 p-4 text-left">
            <p className="text-sm font-medium">{t("upgrade.includes")}</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>100 generations/month</li>
              <li>Content Series & Auto-Scheduling</li>
              <li>AI Content Score & Insights</li>
              <li>Cross-platform Repurposing</li>
              <li>Brand Voice & GPT-4o</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t("upgrade.later")}
            </Button>
            <Button asChild className="flex-1">
              <Link href="/settings">{t("upgrade.cta")}</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("upgrade.price")}</p>
        </div>
      </div>
    </div>
  );
}

/** Hook to manage upgrade modal state */
export function useUpgradeModal() {
  const [modal, setModal] = useState<{ feature: string; description: string } | null>(null);

  function showUpgrade(feature: string, description: string) {
    setModal({ feature, description });
  }

  function hideUpgrade() {
    setModal(null);
  }

  return { modal, showUpgrade, hideUpgrade };
}
