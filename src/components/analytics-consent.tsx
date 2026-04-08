"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const COOKIE_KEY = "socialboost-cookie-consent";

export function AnalyticsConsent() {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const check = () => setAccepted(localStorage.getItem(COOKIE_KEY) === "accepted");
    check();
    window.addEventListener("storage", check);
    window.addEventListener("cookie-consent-changed", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("cookie-consent-changed", check);
    };
  }, []);

  if (!accepted) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
