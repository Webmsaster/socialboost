import Link from "next/link";
import { PricingToggle } from "@/components/pricing-toggle";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SocialBoost",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "AI-powered social media post generator for LinkedIn, Facebook, Instagram, Pinterest, and Twitter/X.",
  offers: [
    {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      name: "Free Plan",
    },
    {
      "@type": "Offer",
      price: "9",
      priceCurrency: "USD",
      name: "Pro Plan Monthly",
      billingIncrement: "P1M",
    },
    {
      "@type": "Offer",
      price: "79",
      priceCurrency: "USD",
      name: "Pro Plan Annual",
      billingIncrement: "P1Y",
    },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is SocialBoost free to use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! The free plan includes 10 AI-generated posts per month. Upgrade to Pro for 100 generations, AI images, video scripts, carousels, and more.",
      },
    },
    {
      "@type": "Question",
      name: "Which platforms are supported?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SocialBoost generates optimized content for LinkedIn, Facebook, Instagram, Pinterest, and Twitter/X.",
      },
    },
    {
      "@type": "Question",
      name: "Can I customize the tone of my posts?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolutely. Choose from 5 tones — professional, casual, inspirational, humorous, and educational — plus optional brand voice customization on the Pro plan.",
      },
    },
    {
      "@type": "Question",
      name: "What AI model powers the content?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "SocialBoost uses OpenAI's GPT-4o-mini for fast, high-quality generations. Pro users can also select GPT-4o for even better results.",
      },
    },
    {
      "@type": "Question",
      name: "Can I cancel my Pro subscription?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, cancel anytime from the billing portal. You keep Pro access until the end of your current billing period.",
      },
    },
  ],
};

const features = [
  {
    title: "AI Image Generation",
    description: "Generate matching visuals for your posts with DALL-E 3. No stock photos needed.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </svg>
    ),
  },
  {
    title: "Content Calendar",
    description: "Visual calendar with drag and drop. Schedule posts across all platforms at a glance.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 14h.01" />
        <path d="M12 14h.01" />
        <path d="M16 14h.01" />
        <path d="M8 18h.01" />
        <path d="M12 18h.01" />
      </svg>
    ),
  },
  {
    title: "Post Templates",
    description: "Save your best-performing posts as templates. Reuse and adapt them in one click.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M12 11h4" />
        <path d="M12 16h4" />
        <path d="M8 11h.01" />
        <path d="M8 16h.01" />
      </svg>
    ),
  },
  {
    title: "Bulk Generation",
    description: "Generate a full week of content in one click. Save hours of planning and writing.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3h5v5" />
        <path d="M8 3H3v5" />
        <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
        <path d="m15 9 6-6" />
        <path d="M16 21h5v-5" />
        <path d="M8 21H3v-5" />
      </svg>
    ),
  },
  {
    title: "Video Script Generator",
    description: "AI-written scripts for Reels, TikTok, and YouTube Shorts. Ready to record.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
        <rect x="2" y="6" width="14" height="12" rx="2" />
      </svg>
    ),
  },
  {
    title: "Video Ad Storyboard",
    description: "Frame-by-frame storyboards for video ads. Visualize your campaign before production.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
      </svg>
    ),
  },
  {
    title: "Carousel Generator",
    description: "Multi-slide carousels for LinkedIn and Instagram. Boost engagement with swipeable content.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="12" height="18" x="2" y="3" rx="2" />
        <path d="M18 7h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2" />
      </svg>
    ),
  },
  {
    title: "A/B Variants",
    description: "Generate multiple post variants side by side. Pick the one that fits your audience best.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 2h4" />
        <path d="M12 14v-4" />
        <path d="M4 14h16" />
        <path d="M6 14v7" />
        <path d="M18 14v7" />
        <path d="M12 14v7" />
        <path d="M2 2l20 20" />
      </svg>
    ),
  },
];

const contentTypes = [
  "Social Posts",
  "Video Scripts",
  "Video Ads",
  "Carousels",
  "AI Images",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {/* Header */}
      <header className="border-b" role="banner">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              S
            </div>
            <span className="text-xl font-bold">SocialBoost</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 py-16 text-center md:py-24">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            AI-powered content
            <span className="text-primary"> for every platform</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Generate social posts, video scripts, carousels, ad storyboards, and AI images
            — all from a single prompt. Choose your platform, tone, and topic. Our AI handles the rest.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="w-full rounded-lg bg-primary px-8 py-3 text-center text-lg font-medium text-primary-foreground hover:bg-primary/90 sm:w-auto"
            >
              Start for free
            </Link>
            <Link
              href="/login"
              className="w-full rounded-lg border px-8 py-3 text-center text-lg font-medium hover:bg-muted sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        </section>

        {/* What you can create */}
        <section className="border-t bg-muted/30 py-10">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
              What you can create
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {contentTypes.map((type) => (
                <span
                  key={type}
                  className="text-lg font-semibold text-foreground/80"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t bg-muted/50 py-20" aria-labelledby="how-it-works">
          <div className="mx-auto max-w-6xl px-6">
            <h2 id="how-it-works" className="text-center text-3xl font-bold">How it works</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold" aria-hidden="true">
                  1
                </div>
                <h3 className="mt-4 text-lg font-semibold">Choose your content type</h3>
                <p className="mt-2 text-muted-foreground">
                  Pick a social post, video script, carousel, ad storyboard, or AI image — for any platform.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold" aria-hidden="true">
                  2
                </div>
                <h3 className="mt-4 text-lg font-semibold">Describe your topic</h3>
                <p className="mt-2 text-muted-foreground">
                  Tell us your idea, pick a tone, and let the AI generate content that matches your brand voice.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold" aria-hidden="true">
                  3
                </div>
                <h3 className="mt-4 text-lg font-semibold">Publish or schedule</h3>
                <p className="mt-2 text-muted-foreground">
                  Copy, download, or drag your content into the calendar. Schedule it for the perfect time.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section className="py-20" aria-labelledby="features">
          <div className="mx-auto max-w-6xl px-6">
            <h2 id="features" className="text-center text-3xl font-bold">
              Everything you need to create faster
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              From AI-generated images to bulk scheduling — SocialBoost covers your entire content workflow.
            </p>
            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border bg-background p-6 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                    {feature.icon}
                  </div>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-t py-14">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {[
                { value: "10K+", label: "Posts generated" },
                { value: "5", label: "Platforms supported" },
                { value: "8", label: "Content types" },
                { value: "99.9%", label: "Uptime" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl font-bold text-primary">{stat.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="border-t bg-muted/30 py-20" aria-labelledby="testimonials">
          <div className="mx-auto max-w-6xl px-6">
            <h2 id="testimonials" className="text-center text-3xl font-bold">Loved by content creators</h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              See what creators and marketers say about SocialBoost.
            </p>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {[
                {
                  quote: "SocialBoost cut my content creation time in half. I generate a full week of LinkedIn posts in under 5 minutes.",
                  name: "Sarah Chen",
                  role: "Marketing Manager",
                  company: "TechFlow",
                },
                {
                  quote: "The carousel generator alone is worth the Pro plan. My engagement rates went up 40% since switching to AI-generated carousels.",
                  name: "Marcus Rivera",
                  role: "Social Media Strategist",
                  company: "GrowthLab",
                },
                {
                  quote: "I was skeptical about AI-generated content, but the quality and tone customization blew me away. My audience can't tell the difference.",
                  name: "Lisa Hoffmann",
                  role: "Freelance Creator",
                  company: "Self-employed",
                },
              ].map((testimonial) => (
                <div
                  key={testimonial.name}
                  className="rounded-xl border bg-background p-6"
                >
                  <div className="flex gap-1 text-primary" aria-hidden="true">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg key={i} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                  <div className="mt-4 border-t pt-4">
                    <p className="text-sm font-semibold">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.role}, {testimonial.company}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t py-20" aria-labelledby="faq">
          <div className="mx-auto max-w-3xl px-6">
            <h2 id="faq" className="text-center text-3xl font-bold">
              Frequently Asked Questions
            </h2>
            <div className="mt-12 space-y-4">
              {[
                {
                  q: "Is SocialBoost free to use?",
                  a: "Yes! The free plan includes 10 AI-generated posts per month. Upgrade to Pro for 100 generations, AI images, video scripts, carousels, and more.",
                },
                {
                  q: "Which platforms are supported?",
                  a: "SocialBoost generates optimized content for LinkedIn, Facebook, Instagram, Pinterest, and Twitter/X. Each post is tailored to the platform's best practices.",
                },
                {
                  q: "Can I customize the tone of my posts?",
                  a: "Absolutely. Choose from 5 tones — professional, casual, inspirational, humorous, and educational — plus optional brand voice customization on the Pro plan.",
                },
                {
                  q: "Do I need to connect my social accounts?",
                  a: "No. You can copy and paste the generated content manually. Connecting accounts enables one-click publishing and scheduling — available on Pro.",
                },
                {
                  q: "What AI model powers the content?",
                  a: "SocialBoost uses OpenAI's GPT-4o-mini for fast, high-quality generations. Pro users can also select GPT-4o for even better results.",
                },
                {
                  q: "Can I cancel my Pro subscription?",
                  a: "Yes, cancel anytime from the billing portal. You keep Pro access until the end of your current billing period.",
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="group rounded-xl border bg-background p-5 transition-colors hover:bg-muted/50"
                >
                  <summary className="flex cursor-pointer items-center justify-between font-medium">
                    {item.q}
                    <svg
                      className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="border-t bg-muted/50 py-20" aria-labelledby="pricing">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 id="pricing" className="text-3xl font-bold">Simple pricing</h2>
            <p className="mt-4 text-muted-foreground">
              Start free. Upgrade when you need the full toolkit.
            </p>
            <div className="mt-12">
              <PricingToggle />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12" role="contentinfo">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 sm:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                  S
                </div>
                <span className="font-bold">SocialBoost</span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                AI-powered content for every platform.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Product</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link href="/features" className="hover:text-foreground">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
                <li><Link href="/changelog" className="hover:text-foreground">Changelog</Link></li>
                <li><Link href="/blog" className="hover:text-foreground">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Company</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
                <li><Link href="/imprint" className="hover:text-foreground">Imprint</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Legal</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t pt-6 text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} SocialBoost. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
