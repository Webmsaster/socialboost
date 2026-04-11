"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";

const checkIcon = (
  <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);

type Lang = "en" | "de";

function getLangSnapshot(): Lang {
  try {
    const stored = localStorage.getItem("socialboost-lang");
    if (stored === "de") return "de";
  } catch {
    // ignore
  }
  return "en";
}

function getLangServerSnapshot(): Lang {
  return "en";
}

function subscribeLang(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

const t = (lang: Lang, key: string): string => {
  const dict: Record<string, Record<Lang, string>> = {
    monthly: { en: "Monthly", de: "Monatlich" },
    annual: { en: "Annual", de: "Jaehrlich" },
    save: { en: "Save 27%", de: "27% sparen" },
    forever: { en: "forever", de: "fuer immer" },
    billedAnnual: { en: "billed annually ($6.58/mo)", de: "jaehrlich abgerechnet ($6,58/Monat)" },
    billedMonthly: { en: "billed monthly", de: "monatlich abgerechnet" },
    popular: { en: "Most popular", de: "Beliebteste" },
    getStarted: { en: "Get started", de: "Loslegen" },
    startPro: { en: "Start Pro", de: "Pro starten" },
    gen10: { en: "10 generations / month", de: "10 Generierungen / Monat" },
    gen100: { en: "100 generations / month", de: "100 Generierungen / Monat" },
    socialOnly: { en: "Social posts only", de: "Nur Social Posts" },
    allTypes: { en: "All content types", de: "Alle Inhaltstypen" },
    platforms: { en: "5 platforms & 5 tones", de: "5 Plattformen & 5 Tonalitaeten" },
    abBulk: { en: "A/B variants & bulk generation", de: "A/B-Varianten & Bulk-Generierung" },
    brandVoice: { en: "Brand voice training", de: "Markenstimme Training" },
    gpt4o: { en: "GPT-4o model option", de: "GPT-4o Modell-Option" },
    templates: { en: "Templates & calendar scheduling", de: "Vorlagen & Kalender-Planung" },
    series: { en: "Content series & auto-scheduling", de: "Inhalts-Serien & Auto-Planung" },
    score: { en: "AI content score & performance insights", de: "KI Content-Score & Performance-Einblicke" },
    repurpose: { en: "Cross-platform repurposing", de: "Plattform-uebergreifende Umwandlung" },
  };
  return dict[key]?.[lang] || key;
};

export function PricingToggle() {
  const [annual, setAnnual] = useState(false);
  const lang = useSyncExternalStore(subscribeLang, getLangSnapshot, getLangServerSnapshot);

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-12">
        <span className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>
          {t(lang, "monthly")}
        </span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${annual ? "bg-primary" : "bg-muted"}`}
          role="switch"
          aria-checked={annual}
          aria-label="Toggle annual billing"
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${annual ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>
          {t(lang, "annual")} <span className="text-xs text-primary font-semibold">{t(lang, "save")}</span>
        </span>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Free plan */}
        <div className="rounded-xl border bg-background p-8">
          <h3 className="text-xl font-semibold">Free</h3>
          <p className="mt-2 text-4xl font-bold">$0</p>
          <p className="mt-1 text-sm text-muted-foreground">{t(lang, "forever")}</p>
          <ul className="mt-6 space-y-3 text-left text-sm text-muted-foreground">
            <li className="flex items-start gap-2">{checkIcon}{t(lang, "gen10")}</li>
            <li className="flex items-start gap-2">{checkIcon}{t(lang, "socialOnly")}</li>
            <li className="flex items-start gap-2">{checkIcon}{t(lang, "platforms")}</li>
          </ul>
          <Link href="/signup" className="mt-8 block rounded-lg border px-6 py-2.5 text-center font-medium hover:bg-muted">
            {t(lang, "getStarted")}
          </Link>
        </div>

        {/* Pro plan */}
        <div className="rounded-xl border-2 border-primary bg-background p-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Pro</h3>
            <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
              {t(lang, "popular")}
            </span>
          </div>
          <p className="mt-2 text-4xl font-bold">
            {annual ? "$79" : "$9"}
            <span className="text-lg font-normal text-muted-foreground">
              {annual ? "/year" : "/mo"}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {annual ? t(lang, "billedAnnual") : t(lang, "billedMonthly")}
          </p>
          <ul className="mt-6 space-y-3 text-left text-sm text-muted-foreground">
            <li className="flex items-start gap-2">{checkIcon}{t(lang, "gen100")}</li>
            <li className="flex items-start gap-2">{checkIcon}{t(lang, "allTypes")}</li>
            <li className="flex items-start gap-2">{checkIcon}{t(lang, "abBulk")}</li>
            <li className="flex items-start gap-2">{checkIcon}{t(lang, "brandVoice")}</li>
            <li className="flex items-start gap-2">{checkIcon}{t(lang, "gpt4o")}</li>
            <li className="flex items-start gap-2">{checkIcon}{t(lang, "templates")}</li>
            <li className="flex items-start gap-2">{checkIcon}{t(lang, "series")}</li>
            <li className="flex items-start gap-2">{checkIcon}{t(lang, "score")}</li>
            <li className="flex items-start gap-2">{checkIcon}{t(lang, "repurpose")}</li>
          </ul>
          <Link
            href={`/signup?plan=${annual ? "annual" : "monthly"}`}
            className="mt-8 block rounded-lg bg-primary px-6 py-2.5 text-center font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t(lang, "startPro")}
          </Link>
        </div>
      </div>
    </div>
  );
}
