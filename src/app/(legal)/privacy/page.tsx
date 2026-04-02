import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - SocialBoost",
  description:
    "Learn how SocialBoost collects, uses, and protects your personal data. GDPR-compliant privacy policy.",
};

export default function PrivacyPolicyPage() {
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
          <h1>Privacy Policy</h1>
          <p className="lead">
            Last updated: March 29, 2026
          </p>
          <p>
            SocialBoost (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is
            operated by Florian Poll, based in Germany. We take the protection of
            your personal data seriously and process it in accordance with the
            European General Data Protection Regulation (GDPR) and applicable
            German data protection laws.
          </p>

          <h2>1. Data We Collect</h2>
          <p>When you use SocialBoost, we may collect the following data:</p>
          <ul>
            <li>
              <strong>Account data:</strong> Email address, full name, and
              password (hashed) when you create an account.
            </li>
            <li>
              <strong>Generated content:</strong> The social media posts you
              create using our AI-powered generation service, including prompts,
              topics, and selected options (tone, platform).
            </li>
            <li>
              <strong>Connected accounts:</strong> Platform names and
              authentication tokens when you connect social media accounts
              (e.g., LinkedIn, Instagram).
            </li>
            <li>
              <strong>Subscription data:</strong> Billing information processed
              through Stripe, including your subscription plan and payment
              status.
            </li>
            <li>
              <strong>Usage data:</strong> Generation counts, feature usage, and
              basic analytics to improve our service.
            </li>
          </ul>

          <h2>2. Third-Party Service Providers</h2>
          <p>We use the following third-party services to operate SocialBoost:</p>
          <ul>
            <li>
              <strong>Supabase</strong> (database and authentication): Your
              account data, generated posts, and connected accounts are stored in
              a Supabase-hosted PostgreSQL database. Supabase processes data in
              accordance with their{" "}
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>Stripe</strong> (payment processing): When you subscribe
              to a paid plan, Stripe processes your payment information. We do
              not store your credit card details. See{" "}
              <a
                href="https://stripe.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Stripe&apos;s Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong>OpenAI</strong> (content generation): Your post topics and
              prompts are sent to OpenAI&apos;s API to generate social media
              content. OpenAI processes this data according to their{" "}
              <a
                href="https://openai.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>
              . We use the API with data retention disabled where possible.
            </li>
            <li>
              <strong>Vercel</strong> (hosting and analytics): Our application is
              hosted on Vercel. Basic analytics data (page views, performance
              metrics) may be collected. See{" "}
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vercel&apos;s Privacy Policy
              </a>
              .
            </li>
          </ul>

          <h2>3. Cookies</h2>
          <p>
            SocialBoost uses only functional cookies that are strictly necessary
            for the operation of the service:
          </p>
          <ul>
            <li>
              <strong>Authentication cookies:</strong> Managed by Supabase Auth
              to keep you signed in and maintain your session.
            </li>
            <li>
              <strong>Preference cookies:</strong> To store your language and
              theme preferences (dark/light mode).
            </li>
          </ul>
          <p>
            We do not use advertising cookies, tracking cookies, or any
            third-party marketing cookies.
          </p>

          <h2>4. Purpose and Legal Basis</h2>
          <p>We process your data for the following purposes:</p>
          <ul>
            <li>
              <strong>Contract fulfillment (Art. 6(1)(b) GDPR):</strong>{" "}
              Providing the SocialBoost service, generating content, managing
              your subscription.
            </li>
            <li>
              <strong>Legitimate interest (Art. 6(1)(f) GDPR):</strong> Service
              improvement, security, and fraud prevention.
            </li>
            <li>
              <strong>Consent (Art. 6(1)(a) GDPR):</strong> Where applicable,
              such as optional newsletter communications.
            </li>
          </ul>

          <h2>5. Data Retention and Deletion</h2>
          <p>
            We retain your data for as long as your account is active. You can
            delete your account at any time through the Settings page in your
            dashboard. Upon account deletion:
          </p>
          <ul>
            <li>Your profile and account data will be permanently deleted.</li>
            <li>Your generated posts and history will be permanently deleted.</li>
            <li>Connected account tokens will be revoked and deleted.</li>
            <li>
              Stripe subscription data will be retained as required by tax and
              accounting regulations.
            </li>
          </ul>

          <h2>6. Your Rights Under GDPR</h2>
          <p>
            As a data subject, you have the following rights under the GDPR:
          </p>
          <ul>
            <li>
              <strong>Right of access (Art. 15):</strong> You can request a copy
              of all personal data we hold about you.
            </li>
            <li>
              <strong>Right to rectification (Art. 16):</strong> You can request
              correction of inaccurate data.
            </li>
            <li>
              <strong>Right to erasure (Art. 17):</strong> You can request
              deletion of your personal data (&quot;right to be forgotten&quot;).
            </li>
            <li>
              <strong>Right to data portability (Art. 20):</strong> You can
              request your data in a machine-readable format.
            </li>
            <li>
              <strong>Right to restriction (Art. 18):</strong> You can request
              restriction of processing under certain conditions.
            </li>
            <li>
              <strong>Right to object (Art. 21):</strong> You can object to
              processing based on legitimate interest.
            </li>
          </ul>
          <p>
            To exercise any of these rights, please contact us at{" "}
            <a href="mailto:contact@socialboost.app">contact@socialboost.app</a>.
            We will respond within 30 days.
          </p>

          <h2>7. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to
            protect your data, including:
          </p>
          <ul>
            <li>Encrypted data transmission (HTTPS/TLS)</li>
            <li>Row-Level Security (RLS) policies on all database tables</li>
            <li>Hashed passwords (never stored in plain text)</li>
            <li>Server-side API key management</li>
          </ul>

          <h2>8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify
            registered users of significant changes via email. The latest version
            is always available on this page.
          </p>

          <h2>9. Contact</h2>
          <p>
            If you have questions about this Privacy Policy or your data, please
            contact:
          </p>
          <p>
            Florian Poll
            <br />
            Email:{" "}
            <a href="mailto:contact@socialboost.app">contact@socialboost.app</a>
          </p>
          <p>
            You also have the right to lodge a complaint with a supervisory
            authority if you believe your data is being processed unlawfully.
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
