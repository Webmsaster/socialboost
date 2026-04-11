"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  subscription_status: string;
  generation_count: number;
  created_at: string;
  postCount: number;
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

  // User management state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/metrics");
        if (res.status === 403) {
          setError("forbidden");
          return;
        }
        if (!res.ok) throw new Error("Failed to load metrics");
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

  async function loadUsers(page = 1, search = "") {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users || []);
      setTotalPages(data.totalPages || 1);
      setTotalUsers(data.total || 0);
      setUserPage(data.page || 1);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setUsersLoading(false);
    }
  }

  function handleUsersTab() {
    if (users.length === 0 && !usersLoading) loadUsers();
  }

  function handleUserSearch() {
    setUserPage(1);
    loadUsers(1, userSearch);
  }

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
          System-wide metrics, user management, and health overview.
        </p>
      </div>

      <Tabs defaultValue="overview" onValueChange={(v) => v === "users" && handleUsersTab()}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
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
        </TabsContent>

        <TabsContent value="users" className="space-y-4 mt-4">
          {/* Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Search by email or name..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUserSearch()}
              className="max-w-md"
            />
            <Button variant="outline" onClick={handleUserSearch}>
              Search
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            {totalUsers} users total
          </p>

          {/* User list */}
          {usersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-sm">No users found.</p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <Card key={user.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {(user.full_name || user.email)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{user.full_name || "—"}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Badge variant={user.subscription_status === "active" ? "default" : "secondary"}>
                          {user.subscription_status}
                        </Badge>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{user.postCount} posts</p>
                          <p className="text-xs text-muted-foreground">{user.generation_count} gen/mo</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={userPage <= 1}
                onClick={() => { setUserPage((p) => p - 1); loadUsers(userPage - 1, userSearch); }}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {userPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={userPage >= totalPages}
                onClick={() => { setUserPage((p) => p + 1); loadUsers(userPage + 1, userSearch); }}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
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
