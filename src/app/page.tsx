import Link from "next/link";

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
        <section className="border-t bg-muted/50 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-bold">How it works</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                  1
                </div>
                <h3 className="mt-4 text-lg font-semibold">Choose your content type</h3>
                <p className="mt-2 text-muted-foreground">
                  Pick a social post, video script, carousel, ad storyboard, or AI image — for any platform.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                  2
                </div>
                <h3 className="mt-4 text-lg font-semibold">Describe your topic</h3>
                <p className="mt-2 text-muted-foreground">
                  Tell us your idea, pick a tone, and let the AI generate content that matches your brand voice.
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
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
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-bold">
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
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

        {/* Pricing */}
        <section className="border-t bg-muted/50 py-20">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl font-bold">Simple pricing</h2>
            <p className="mt-4 text-muted-foreground">
              Start free. Upgrade when you need the full toolkit.
            </p>
            <div className="mt-12 grid gap-8 md:grid-cols-2">
              {/* Free plan */}
              <div className="rounded-xl border bg-background p-8">
                <h3 className="text-xl font-semibold">Free</h3>
                <p className="mt-2 text-4xl font-bold">$0</p>
                <p className="mt-1 text-sm text-muted-foreground">forever</p>
                <ul className="mt-6 space-y-3 text-left text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    10 generations / month
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    Social posts only
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    5 platforms
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    5 tones
                  </li>
                </ul>
                <Link
                  href="/signup"
                  className="mt-8 block rounded-lg border px-6 py-2.5 text-center font-medium hover:bg-muted"
                >
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
                  $9<span className="text-lg font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">billed monthly</p>
                <ul className="mt-6 space-y-3 text-left text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    100 generations / month
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    All content types (posts, video scripts, carousels, ads, images)
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    A/B variants
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    Bulk generation
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    Post templates
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    Post scheduling with calendar
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    5 tones + 4 languages
                  </li>
                </ul>
                <Link
                  href="/signup"
                  className="mt-8 block rounded-lg bg-primary px-6 py-2.5 text-center font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Start Pro
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8" role="contentinfo">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} SocialBoost. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
