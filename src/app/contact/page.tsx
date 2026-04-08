import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the SocialBoost team. We are happy to help with questions, feedback, or partnership inquiries.",
};

export default function ContactPage() {
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

      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-bold">Contact Us</h1>
        <p className="mt-4 text-muted-foreground">
          Have a question, feedback, or partnership inquiry? We&apos;d love to hear from you.
        </p>

        <ContactForm />

        <div className="mt-16 grid gap-8 border-t pt-12 sm:grid-cols-3">
          <div>
            <h3 className="font-semibold">Email</h3>
            <p className="mt-1 text-sm text-muted-foreground">hello@socialboost.app</p>
          </div>
          <div>
            <h3 className="font-semibold">Response Time</h3>
            <p className="mt-1 text-sm text-muted-foreground">Usually within 24 hours</p>
          </div>
          <div>
            <h3 className="font-semibold">Social</h3>
            <p className="mt-1 text-sm text-muted-foreground">@socialboost on X</p>
          </div>
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} SocialBoost. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
