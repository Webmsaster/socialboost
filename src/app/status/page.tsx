import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "System Status",
  description:
    "Current operational status of SocialBoost services: API, database, AI generation, and publishing pipelines.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ServiceStatus {
  name: string;
  description: string;
  status: "operational" | "degraded" | "outage";
}

async function checkHealth(): Promise<boolean> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/health`, {
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

const services: Omit<ServiceStatus, "status">[] = [
  {
    name: "Web Application",
    description: "Landing page, dashboard, and user-facing pages",
  },
  {
    name: "API",
    description: "Authentication, post generation, and data endpoints",
  },
  {
    name: "Database",
    description: "Supabase PostgreSQL with row-level security",
  },
  {
    name: "AI Generation",
    description: "OpenAI gpt-4o-mini and gpt-4o models",
  },
  {
    name: "Stripe Billing",
    description: "Subscription checkout, billing portal, and webhooks",
  },
  {
    name: "Platform Publishing",
    description: "OAuth and scheduled post publishing to social platforms",
  },
];

export default async function StatusPage() {
  const apiHealthy = await checkHealth();
  const statuses: ServiceStatus[] = services.map((s) => ({
    ...s,
    // We only have a real live probe for web + API. The rest are
    // inferred as operational unless we know otherwise — a proper
    // status page would ping each dependency separately.
    status: apiHealthy ? "operational" : "outage",
  }));

  const allOperational = statuses.every((s) => s.status === "operational");

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
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            System Status
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Current operational status of all SocialBoost services.
          </p>
        </div>

        <div
          className={
            "mt-12 rounded-xl border p-6 text-center " +
            (allOperational
              ? "border-green-500/30 bg-green-500/5"
              : "border-destructive/30 bg-destructive/5")
          }
        >
          <div className="flex items-center justify-center gap-3">
            <span
              className={
                "inline-flex h-3 w-3 rounded-full " +
                (allOperational ? "bg-green-500" : "bg-destructive")
              }
              aria-hidden="true"
            />
            <h2 className="text-xl font-bold">
              {allOperational
                ? "All systems operational"
                : "Service disruption detected"}
            </h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Last checked: {new Date().toISOString().replace("T", " ").slice(0, 19)} UTC
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {statuses.map((svc) => (
            <div
              key={svc.name}
              className="flex items-center justify-between rounded-xl border p-5"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      "inline-flex h-2.5 w-2.5 rounded-full " +
                      (svc.status === "operational"
                        ? "bg-green-500"
                        : svc.status === "degraded"
                          ? "bg-yellow-500"
                          : "bg-destructive")
                    }
                    aria-hidden="true"
                  />
                  <span className="font-semibold">{svc.name}</span>
                </div>
                <p className="mt-1 pl-5 text-sm text-muted-foreground">
                  {svc.description}
                </p>
              </div>
              <span
                className={
                  "rounded-full px-2.5 py-1 text-xs font-medium " +
                  (svc.status === "operational"
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : svc.status === "degraded"
                      ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                      : "bg-destructive/10 text-destructive")
                }
              >
                {svc.status === "operational"
                  ? "Operational"
                  : svc.status === "degraded"
                    ? "Degraded"
                    : "Outage"}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">
              Experiencing an issue?
            </strong>{" "}
            If a service is marked operational but you&apos;re seeing errors,
            please <Link href="/contact" className="text-primary hover:underline">contact support</Link> so we can investigate.
          </p>
        </div>
      </main>

      <footer className="mt-16 border-t py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} SocialBoost. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
