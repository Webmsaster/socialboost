"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";

const variants = {
  a: {
    headline: "AI-powered content",
    headlineAccent: " for every platform",
    subtext: "Generate social posts, video scripts, carousels, ad storyboards, and AI images — all from a single prompt. Choose your platform, tone, and topic. Our AI handles the rest.",
    cta: "Start for free",
  },
  b: {
    headline: "Stop writing posts.",
    headlineAccent: " Start generating them.",
    subtext: "SocialBoost creates platform-optimized content in seconds. LinkedIn, Instagram, Twitter, Facebook, Pinterest — one tool, every format, 5 tones, instant results.",
    cta: "Try it free — no credit card",
  },
};

function getVariant(): "a" | "b" {
  try {
    const stored = document.cookie
      .split("; ")
      .find((c) => c.startsWith("sb_hero="))
      ?.split("=")[1];
    if (stored === "a" || stored === "b") return stored;
    const pick = Math.random() < 0.5 ? "a" : "b";
    document.cookie = `sb_hero=${pick}; path=/; max-age=${60 * 60 * 24 * 30}`;
    return pick;
  } catch {
    return "a";
  }
}

function subscribeNoop(_cb: () => void) {
  // Cookie doesn't change during session
  return () => {};
}

export function ABHero() {
  const variant = useSyncExternalStore(subscribeNoop, getVariant, () => "a" as const);
  const v = variants[variant];

  return (
    <section className="mx-auto max-w-4xl px-6 py-16 text-center md:py-24">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
        {v.headline}
        <span className="text-primary">{v.headlineAccent}</span>
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
        {v.subtext}
      </p>
      <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <Link
          href="/signup"
          className="w-full rounded-lg bg-primary px-8 py-3 text-center text-lg font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto"
        >
          {v.cta}
        </Link>
        <Link
          href="/login"
          className="w-full rounded-lg border px-8 py-3 text-center text-lg font-medium hover:bg-muted sm:w-auto"
        >
          Sign in
        </Link>
      </div>
    </section>
  );
}
