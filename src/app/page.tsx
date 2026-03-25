import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
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
        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
            AI-powered social media posts
            <span className="text-primary"> in seconds</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Generate engaging posts for LinkedIn, Facebook, Instagram, Pinterest, and Twitter/X.
            Choose your platform, tone, and topic — our AI does the rest.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-lg bg-primary px-8 py-3 text-lg font-medium text-primary-foreground hover:bg-primary/90"
            >
              Start for free
            </Link>
            <Link
              href="/login"
              className="rounded-lg border px-8 py-3 text-lg font-medium hover:bg-muted"
            >
              Sign in
            </Link>
          </div>
        </section>

        <section className="border-t bg-muted/50 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-bold">How it works</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">1</div>
                <h3 className="mt-4 text-lg font-semibold">Choose your platform</h3>
                <p className="mt-2 text-muted-foreground">Select LinkedIn, Facebook, Instagram, Pinterest, or Twitter/X.</p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">2</div>
                <h3 className="mt-4 text-lg font-semibold">Describe your topic</h3>
                <p className="mt-2 text-muted-foreground">Tell us what you want to post about. Pick a tone that fits your brand.</p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">3</div>
                <h3 className="mt-4 text-lg font-semibold">Post or schedule</h3>
                <p className="mt-2 text-muted-foreground">Copy your AI-generated post or schedule it for the perfect time.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl font-bold">Simple pricing</h2>
            <div className="mt-12 grid gap-8 md:grid-cols-2">
              <div className="rounded-xl border p-8">
                <h3 className="text-xl font-semibold">Free</h3>
                <p className="mt-2 text-4xl font-bold">$0</p>
                <ul className="mt-6 space-y-3 text-left text-muted-foreground">
                  <li>10 post generations / month</li>
                  <li>All 5 platforms</li>
                  <li>5 tones</li>
                  <li>Copy &amp; paste workflow</li>
                </ul>
                <Link href="/signup" className="mt-8 block rounded-lg border px-6 py-2.5 text-center font-medium hover:bg-muted">
                  Get started
                </Link>
              </div>
              <div className="rounded-xl border-2 border-primary p-8">
                <h3 className="text-xl font-semibold">Pro</h3>
                <p className="mt-2 text-4xl font-bold">$9<span className="text-lg font-normal text-muted-foreground">/mo</span></p>
                <ul className="mt-6 space-y-3 text-left text-muted-foreground">
                  <li>100 post generations / month</li>
                  <li>All 5 platforms</li>
                  <li>5 tones + 4 languages</li>
                  <li>Post scheduling</li>
                  <li>Priority support</li>
                </ul>
                <Link href="/signup" className="mt-8 block rounded-lg bg-primary px-6 py-2.5 text-center font-medium text-primary-foreground hover:bg-primary/90">
                  Start Pro
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} SocialBoost. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
