"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

const STORAGE_KEY = "socialboost-onboarding-dismissed";

const steps = [
  {
    key: "create" as const,
    href: "/create",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    key: "template" as const,
    href: "/templates",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    key: "calendar" as const,
    href: "/calendar",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export function Onboarding() {
  const [dismissed, setDismissed] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // localStorage unavailable
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // localStorage unavailable
    }
  }

  if (dismissed) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("onboarding.title")}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t("onboarding.subtitle")}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={dismiss} className="text-muted-foreground -mt-1">
            {t("onboarding.dismiss")}
          </Button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {steps.map((step, i) => (
            <Link
              key={step.key}
              href={step.href}
              className="flex items-start gap-3 rounded-lg border bg-background p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm">{t(`onboarding.step${i + 1}.title`)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t(`onboarding.step${i + 1}.desc`)}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
