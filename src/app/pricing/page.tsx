import type { Metadata } from "next";
import { PricingToggle } from "@/components/pricing-toggle";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "SocialBoost pricing: Free plan with 10 generations/month, Pro plan at $9/month or $79/year with 100 generations and premium features.",
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-24">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Start free, upgrade when you need more power.
        </p>
      </div>

      <PricingToggle />
    </main>
  );
}
