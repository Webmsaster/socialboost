import type { Metadata } from "next";
import { PricingToggle } from "@/components/pricing-toggle";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "SocialBoost pricing: Free plan with 10 generations/month, Pro plan at $9/month or $79/year with 100 generations and premium features.",
};

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SocialBoost",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "USD",
      description: "10 AI generations per month",
    },
    {
      "@type": "Offer",
      name: "Pro Monthly",
      price: "9",
      priceCurrency: "USD",
      billingIncrement: "P1M",
      description: "100 AI generations per month, premium features",
    },
    {
      "@type": "Offer",
      name: "Pro Annual",
      price: "79",
      priceCurrency: "USD",
      billingIncrement: "P1Y",
      description: "100 AI generations per month, premium features, save 27%",
    },
  ],
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
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
