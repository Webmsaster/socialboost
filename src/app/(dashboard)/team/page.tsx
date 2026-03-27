"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";

interface OrgMembership {
  org_id: string;
  role: string;
  organizations: {
    id: string;
    name: string;
    owner_id: string;
    subscription_status: string;
    max_members: number;
  };
}

export default function TeamPage() {
  const { t } = useLanguage();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [newOrgName, setNewOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  async function loadTeams() {
    const res = await fetch("/api/team");
    if (res.ok) {
      const data = await res.json();
      setMemberships(data.memberships || []);
    }
  }

  async function handleCreateOrg() {
    if (!newOrgName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName }),
      });
      if (res.ok) {
        toast.success("Team created!");
        setNewOrgName("");
        loadTeams();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create team");
      }
    } catch {
      toast.error("Failed to create team");
    } finally {
      setCreating(false);
    }
  }

  async function handleInvite(orgId: string) {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, email: inviteEmail }),
      });
      if (res.ok) {
        toast.success("Invite sent!");
        setInviteEmail("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to invite");
      }
    } catch {
      toast.error("Failed to invite");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("nav.team") || "Team"}</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your team and collaborate on content creation.
        </p>
      </div>

      {memberships.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold">No team yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a team to collaborate with colleagues on content creation.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Input
                placeholder="Team name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="w-full max-w-xs"
              />
              <Button onClick={handleCreateOrg} disabled={creating || !newOrgName.trim()} className="w-full sm:w-auto">
                {creating ? "Creating..." : "Create Team"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        memberships.map((m) => (
          <Card key={m.org_id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{m.organizations.name}</span>
                <Badge variant={m.role === "owner" ? "default" : "outline"}>
                  {m.role}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Max members: {m.organizations.max_members} | Status: {m.organizations.subscription_status}
              </div>

              {["owner", "admin"].includes(m.role) && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    placeholder="Email to invite"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full max-w-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleInvite(m.org_id)}
                    disabled={inviting || !inviteEmail.trim()}
                    className="w-full sm:w-auto"
                  >
                    {inviting ? "Sending..." : "Invite"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
