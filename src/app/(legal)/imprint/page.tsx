import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Imprint (Impressum) - SocialBoost",
  description:
    "Legal notice and imprint (Impressum) for SocialBoost as required by German law (TMG).",
};

export default function ImprintPage() {
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
          <h1>Impressum (Imprint)</h1>
          <p className="lead">
            Legal notice in accordance with Section 5 TMG
            (Telemediengesetz).
          </p>

          <h2>Service Provider</h2>
          <p>
            SocialBoost
            <br />
            Florian Poll
            <br />
            Email:{" "}
            <a href="mailto:contact@socialboost.app">contact@socialboost.app</a>
          </p>

          <h2>Responsible for Content</h2>
          <p>
            Responsible for content according to Section 18(2) MStV
            (Medienstaatsvertrag):
          </p>
          <p>
            Florian Poll
            <br />
            Email:{" "}
            <a href="mailto:contact@socialboost.app">contact@socialboost.app</a>
          </p>

          <h2>EU Online Dispute Resolution</h2>
          <p>
            The European Commission provides a platform for online dispute
            resolution (OS):{" "}
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://ec.europa.eu/consumers/odr/
            </a>
          </p>
          <p>
            We are neither obligated nor willing to participate in dispute
            resolution proceedings before a consumer arbitration board.
          </p>

          <h2>Disclaimer</h2>

          <h3>Liability for Content</h3>
          <p>
            As a service provider, we are responsible for our own content on
            these pages in accordance with general laws pursuant to Section 7(1)
            TMG. According to Sections 8 to 10 TMG, however, we as a service
            provider are not obligated to monitor transmitted or stored
            third-party information or to investigate circumstances that indicate
            illegal activity.
          </p>
          <p>
            Obligations to remove or block the use of information under general
            laws remain unaffected. However, liability in this regard is only
            possible from the point in time at which we become aware of a
            specific legal infringement. Upon becoming aware of such
            infringements, we will remove this content immediately.
          </p>

          <h3>Liability for Links</h3>
          <p>
            Our website may contain links to external third-party websites over
            whose content we have no influence. Therefore, we cannot assume any
            liability for this external content. The respective provider or
            operator of the pages is always responsible for the content of the
            linked pages. The linked pages were checked for possible legal
            violations at the time of linking. Illegal content was not
            recognizable at the time of linking.
          </p>
          <p>
            However, permanent monitoring of the content of the linked pages is
            not reasonable without concrete evidence of a legal violation. Upon
            becoming aware of legal violations, we will remove such links
            immediately.
          </p>

          <h3>Copyright</h3>
          <p>
            The content and works created by the site operator on these pages are
            subject to German copyright law. Reproduction, editing, distribution,
            and any kind of use beyond the limits of copyright law require the
            written consent of the respective author or creator. Downloads and
            copies of this site are only permitted for private, non-commercial
            use.
          </p>
          <p>
            Insofar as the content on this site was not created by the operator,
            the copyrights of third parties are respected. In particular,
            third-party content is marked as such. Should you nevertheless become
            aware of a copyright infringement, please inform us accordingly. Upon
            becoming aware of legal violations, we will remove such content
            immediately.
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
