"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface AdminMetrics {
  totalUsers: number;
  activeSubscriptions: number;
  postsLast7d: number;
  postsLast30d: number;
  newUsersLast7d: number;
  estimatedMrr: number;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/metrics");
        if (res.status === 403) {
          setError("forbidden");
          return;
        }
        if (!res.ok) {
          throw new Error("Failed to load metrics");
        }
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error(message);
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (error === "forbidden") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-2">
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to view this page. Contact the
              owner to request admin access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System-wide metrics and health overview.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Total Users"
          value={loading ? null : formatNumber(metrics?.totalUsers ?? 0)}
          description="All signed-up accounts"
        />
        <MetricCard
          title="Active Subscriptions"
          value={loading ? null : formatNumber(metrics?.activeSubscriptions ?? 0)}
          description="Users on the Pro plan"
        />
        <MetricCard
          title="Estimated MRR"
          value={loading ? null : formatCurrency(metrics?.estimatedMrr ?? 0)}
          description="Monthly recurring revenue"
        />
        <MetricCard
          title="New Users (7d)"
          value={loading ? null : formatNumber(metrics?.newUsersLast7d ?? 0)}
          description="Signups this week"
        />
        <MetricCard
          title="Posts Generated (7d)"
          value={loading ? null : formatNumber(metrics?.postsLast7d ?? 0)}
          description="Activity this week"
        />
        <MetricCard
          title="Posts Generated (30d)"
          value={loading ? null : formatNumber(metrics?.postsLast30d ?? 0)}
          description="Activity this month"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>How admin access works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            This page is gated by the <code className="rounded bg-muted px-1.5 py-0.5">ADMIN_EMAILS</code> environment variable
            in Vercel. Add a comma-separated list of emails to grant access.
          </p>
          <p>
            Revenue numbers are estimates based on active Pro subscriptions
            at the monthly price. For precise revenue, check Stripe directly.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string | null;
  description: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <div className="text-3xl font-bold">{value}</div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
