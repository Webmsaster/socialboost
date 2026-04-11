"use client";

import { useState } from "react";
import Link from "next/link";

const checkIcon = (
  <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
);

export function PricingToggle() {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-12">
        <span className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>Monthly</span>
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
          Annual <span className="text-xs text-primary font-semibold">Save 27%</span>
        </span>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Free plan */}
        <div className="rounded-xl border bg-background p-8">
          <h3 className="text-xl font-semibold">Free</h3>
          <p className="mt-2 text-4xl font-bold">$0</p>
          <p className="mt-1 text-sm text-muted-foreground">forever</p>
          <ul className="mt-6 space-y-3 text-left text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              {checkIcon}
              10 generations / month
            </li>
            <li className="flex items-start gap-2">
              {checkIcon}
              Social posts only
            </li>
            <li className="flex items-start gap-2">
              {checkIcon}
              5 platforms &amp; 5 tones
            </li>
          </ul>
          <Link href="/signup" className="mt-8 block rounded-lg border px-6 py-2.5 text-center font-medium hover:bg-muted">
            Get started
          </Link>
        </div>

        {/* Pro plan */}
        <div className="rounded-xl border-2 border-primary bg-background p-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Pro</h3>
            <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
              Most popular
            </span>
          </div>
          <p className="mt-2 text-4xl font-bold">
            {annual ? "$79" : "$9"}
            <span className="text-lg font-normal text-muted-foreground">
              {annual ? "/year" : "/mo"}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {annual ? "billed annually ($6.58/mo)" : "billed monthly"}
          </p>
          <ul className="mt-6 space-y-3 text-left text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              {checkIcon}
              100 generations / month
            </li>
            <li className="flex items-start gap-2">
              {checkIcon}
              All content types
            </li>
            <li className="flex items-start gap-2">
              {checkIcon}
              A/B variants &amp; bulk generation
            </li>
            <li className="flex items-start gap-2">
              {checkIcon}
              Brand voice training
            </li>
            <li className="flex items-start gap-2">
              {checkIcon}
              GPT-4o model option
            </li>
            <li className="flex items-start gap-2">
              {checkIcon}
              Templates &amp; calendar scheduling
            </li>
            <li className="flex items-start gap-2">
              {checkIcon}
              Content series &amp; auto-scheduling
            </li>
            <li className="flex items-start gap-2">
              {checkIcon}
              AI content score &amp; performance insights
            </li>
            <li className="flex items-start gap-2">
              {checkIcon}
              Cross-platform repurposing
            </li>
          </ul>
          <Link
            href={`/signup?plan=${annual ? "annual" : "monthly"}`}
            className="mt-8 block rounded-lg bg-primary px-6 py-2.5 text-center font-medium text-primary-foreground hover:bg-primary/90"
          >
            Start Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
