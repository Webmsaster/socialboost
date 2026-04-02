import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service - SocialBoost",
  description:
    "Read the terms and conditions for using SocialBoost, the AI-powered social media content generator.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              S
            </div>
            <span className="text-xl font-bold">SocialBoost</span>
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Get started free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Terms of Service</h1>
          <p className="lead">
            Last updated: March 29, 2026
          </p>
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your use of
            SocialBoost, a web application operated by Florian Poll
            (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By creating an
            account or using our service, you agree to these Terms.
          </p>

          <h2>1. Service Description</h2>
          <p>
            SocialBoost is an AI-powered social media content generation
            platform. Our service allows you to create optimized posts for
            multiple platforms including LinkedIn, Facebook, Instagram, Pinterest,
            and Twitter/X. Content is generated using artificial intelligence
            based on your input (topics, tone, platform selection).
          </p>

          <h2>2. Account Registration</h2>
          <p>
            To use SocialBoost, you must create an account with a valid email
            address. You are responsible for:
          </p>
          <ul>
            <li>Maintaining the confidentiality of your login credentials.</li>
            <li>All activity that occurs under your account.</li>
            <li>
              Notifying us immediately of any unauthorized use of your account.
            </li>
          </ul>
          <p>
            You must be at least 16 years old to create an account and use our
            service.
          </p>

          <h2>3. Plans and Pricing</h2>
          <p>SocialBoost offers the following plans:</p>
          <ul>
            <li>
              <strong>Free Plan:</strong> Up to 10 AI-generated posts per month.
              No payment required.
            </li>
            <li>
              <strong>Pro Plan ($9/month):</strong> Up to 100 AI-generated posts
              per month, plus access to premium features.
            </li>
          </ul>
          <p>
            Generation limits reset at the beginning of each calendar month.
            Unused generations do not carry over. We reserve the right to adjust
            pricing and plan features with at least 30 days&apos; notice to
            existing subscribers.
          </p>

          <h2>4. Payments and Billing</h2>
          <p>
            Paid subscriptions are billed monthly through Stripe. By subscribing
            to a paid plan, you authorize us to charge your payment method on a
            recurring basis. You can cancel your subscription at any time through
            the Stripe Billing Portal, accessible from your Settings page. Upon
            cancellation, you retain access to Pro features until the end of your
            current billing period.
          </p>

          <h2>5. Content Ownership</h2>
          <p>
            <strong>Your content:</strong> You retain full ownership of all
            content generated through SocialBoost. The AI-generated posts are
            yours to use, modify, and publish on any platform without
            restriction.
          </p>
          <p>
            <strong>Our service:</strong> We retain all rights to the
            SocialBoost platform, including its design, code, algorithms, and
            branding. You may not copy, modify, or redistribute any part of our
            service.
          </p>

          <h2>6. Acceptable Use</h2>
          <p>You agree not to use SocialBoost to:</p>
          <ul>
            <li>
              Generate content that is illegal, defamatory, hateful,
              threatening, or promotes violence.
            </li>
            <li>
              Create spam, misleading content, or content designed to deceive or
              manipulate.
            </li>
            <li>
              Impersonate other individuals or organizations.
            </li>
            <li>
              Attempt to reverse-engineer, exploit, or abuse the AI generation
              system.
            </li>
            <li>
              Circumvent rate limits, generation quotas, or other technical
              restrictions.
            </li>
            <li>
              Use automated tools (bots, scrapers) to access the service without
              our written permission.
            </li>
          </ul>
          <p>
            We reserve the right to suspend or terminate accounts that violate
            these terms without prior notice.
          </p>

          <h2>7. AI-Generated Content Disclaimer</h2>
          <p>
            Content generated by SocialBoost is created using artificial
            intelligence. While we strive for high quality, we cannot guarantee
            that all generated content is accurate, appropriate, or free from
            errors. You are responsible for reviewing and editing all generated
            content before publishing it on any platform.
          </p>

          <h2>8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, SocialBoost and
            its operator shall not be liable for:
          </p>
          <ul>
            <li>
              Any indirect, incidental, special, or consequential damages
              arising from your use of the service.
            </li>
            <li>
              Loss of revenue, data, or business opportunities related to
              content generated or published through our platform.
            </li>
            <li>
              Service interruptions, downtime, or data loss.
            </li>
            <li>
              Actions taken by third-party platforms (e.g., social media
              networks) in response to content you publish.
            </li>
          </ul>
          <p>
            Our total liability shall not exceed the amount you have paid us in
            the 12 months preceding the claim.
          </p>

          <h2>9. Availability and Modifications</h2>
          <p>
            We strive to maintain high availability but do not guarantee
            uninterrupted service. We may modify, suspend, or discontinue any
            part of the service at any time. Significant changes to features
            included in paid plans will be communicated with reasonable advance
            notice.
          </p>

          <h2>10. Termination</h2>
          <p>
            You may terminate your account at any time by deleting it through
            the Settings page. We may terminate or suspend your account if you
            violate these Terms or engage in activity that harms the service or
            other users. Upon termination:
          </p>
          <ul>
            <li>Your access to SocialBoost will be revoked immediately.</li>
            <li>
              Your data will be deleted in accordance with our{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </li>
            <li>
              Active paid subscriptions will be cancelled. No refunds are issued
              for partial billing periods.
            </li>
          </ul>

          <h2>11. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the Federal Republic of
            Germany. Any disputes arising from these Terms shall be subject to
            the jurisdiction of the competent courts in Germany.
          </p>

          <h2>12. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify
            registered users of material changes via email at least 30 days
            before they take effect. Continued use of the service after changes
            take effect constitutes acceptance of the updated Terms.
          </p>

          <h2>13. Contact</h2>
          <p>
            If you have questions about these Terms, please contact:
          </p>
          <p>
            Florian Poll
            <br />
            Email:{" "}
            <a href="mailto:contact@socialboost.app">contact@socialboost.app</a>
          </p>
        </article>
      </main>

      <footer className="mt-16 border-t py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} SocialBoost. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
