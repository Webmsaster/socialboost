"use client";

import { useState, FormEvent } from "react";
import { toast } from "sonner";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Subscription failed");
        setStatus("idle");
        return;
      }
      setStatus("success");
      setEmail("");
      toast.success("Thanks — you're on the list!");
    } catch {
      toast.error("Network error — please try again");
      setStatus("idle");
    }
  }

  return (
    <div className="not-prose mt-12 rounded-xl border bg-muted/20 p-6">
      <h3 className="text-lg font-semibold">
        Get new posts in your inbox
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        One email when we publish, never spam. Unsubscribe anytime.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={status === "loading" || status === "success"}
          className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === "loading" || status === "success"}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {status === "loading"
            ? "Subscribing..."
            : status === "success"
              ? "Subscribed ✓"
              : "Subscribe"}
        </button>
      </form>
    </div>
  );
}
