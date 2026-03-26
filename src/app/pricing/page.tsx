import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "SocialBoost pricing: Free plan with 10 generations/month, Pro plan at $9/month with 100 generations and premium features.",
};

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for trying things out",
    features: [
      "10 AI post generations / month",
      "5 platforms supported",
      "5 tone options",
      "Content calendar",
      "Post history & export",
      "Dark mode",
    ],
    cta: "Get started",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    description: "For serious content creators",
    features: [
      "100 AI post generations / month",
      "Everything in Free, plus:",
      "AI image generation (DALL-E 3)",
      "Video script generator",
      "Video ad storyboard",
      "Carousel generator",
      "A/B variant testing",
      "Priority support",
    ],
    cta: "Start Pro",
    href: "/signup",
    highlighted: true,
  },
];

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

      <div className="grid gap-8 md:grid-cols-2">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border p-8 space-y-6 ${
              plan.highlighted ? "border-primary ring-2 ring-primary/20" : ""
            }`}
          >
            <div>
              <h2 className="text-2xl font-bold">{plan.name}</h2>
              <p className="text-muted-foreground">{plan.description}</p>
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">{plan.price}</span>
              <span className="text-muted-foreground">{plan.period}</span>
            </div>

            <ul className="space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href={plan.href}
              className={`block w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-colors ${
                plan.highlighted
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border border-border bg-background hover:bg-accent"
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
