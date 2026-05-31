"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/loading-skeleton";
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

interface OrgMember {
  id: string;
  user_id: string | null;
  role: string;
  accepted: boolean;
  invited_email: string | null;
  created_at: string;
  profiles: { id: string; email: string; full_name: string | null } | null;
}

export default function TeamPage() {
  const { t } = useLanguage();
  const [memberships, setMemberships] = useState<OrgMembership[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [newOrgName, setNewOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [members, setMembers] = useState<Record<string, OrgMember[]>>({});
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadMembers = useCallback(async (orgId: string) => {
    const res = await fetch(`/api/team/members?orgId=${orgId}`);
    if (res.ok) {
      const data = await res.json();
      setMembers((prev) => ({ ...prev, [orgId]: data.members || [] }));
      setUserRoles((prev) => ({ ...prev, [orgId]: data.userRole }));
    }
  }, []);

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/team");
      if (res.ok) {
        const data = await res.json();
        setMemberships(data.memberships || []);
        for (const m of data.memberships || []) {
          loadMembers(m.org_id);
        }
      }
    } finally {
      setLoadingTeams(false);
    }
  }, [loadMembers]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

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
        toast.success(t("team.created"));
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
        toast.success(t("team.inviteSent"));
        setInviteEmail("");
        loadMembers(orgId);
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

  async function handleRemoveMember(orgId: string, memberId: string) {
    setRemovingId(memberId);
    try {
      const res = await fetch("/api/team/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, memberId }),
      });
      if (res.ok) {
        toast.success(t("team.memberRemoved"));
        loadMembers(orgId);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to remove member");
      }
    } catch {
      toast.error("Failed to remove member");
    } finally {
      setRemovingId(null);
    }
  }

  const canManage = (orgId: string) => ["owner", "admin"].includes(userRoles[orgId] || "");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("team.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("team.description")}</p>
      </div>

      {loadingTeams ? (
        <CardSkeleton />
      ) : memberships.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold">{t("team.noTeam")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("team.noTeamHint")}</p>
            <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Input
                placeholder={t("team.namePlaceholder")}
                aria-label={t("team.namePlaceholder")}
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="w-full max-w-xs"
              />
              <Button onClick={handleCreateOrg} disabled={creating || !newOrgName.trim()} className="w-full sm:w-auto">
                {creating ? "..." : t("team.create")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        memberships.map((m) => {
          const orgMembers = members[m.org_id] || [];
          const acceptedMembers = orgMembers.filter((mb) => mb.accepted);
          const pendingMembers = orgMembers.filter((mb) => !mb.accepted);

          return (
            <Card key={m.org_id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{m.organizations.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {acceptedMembers.length}/{m.organizations.max_members} {t("team.members")}
                    </Badge>
                    <Badge variant={m.role === "owner" ? "default" : "outline"}>
                      {m.role}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Members list */}
                {acceptedMembers.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t("team.members")}</h4>
                    <div className="divide-y rounded-lg border">
                      {acceptedMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                              {(member.profiles?.full_name || member.profiles?.email || member.invited_email || "?")[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {member.profiles?.full_name || member.profiles?.email || member.invited_email}
                              </p>
                              {member.profiles?.full_name && (
                                <p className="text-xs text-muted-foreground">{member.profiles.email}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={member.role === "owner" ? "default" : "outline"} className="text-xs">
                              {member.role}
                            </Badge>
                            {canManage(m.org_id) && member.role !== "owner" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive text-xs"
                                disabled={removingId === member.id}
                                onClick={() => handleRemoveMember(m.org_id, member.id)}
                              >
                                {removingId === member.id ? "..." : t("team.remove")}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending invites */}
                {pendingMembers.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">{t("team.pendingInvites")}</h4>
                    <div className="divide-y rounded-lg border border-dashed">
                      {pendingMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                              {(member.invited_email || "?")[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">{member.invited_email}</p>
                              <p className="text-xs text-muted-foreground">
                                {t("team.invitedOn")} {new Date(member.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{t("team.pending")}</Badge>
                            {canManage(m.org_id) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive text-xs"
                                disabled={removingId === member.id}
                                onClick={() => handleRemoveMember(m.org_id, member.id)}
                              >
                                {removingId === member.id ? "..." : t("team.revoke")}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invite form */}
                {canManage(m.org_id) && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center pt-2 border-t">
                    <Input
                      placeholder={t("team.emailPlaceholder")}
                      aria-label={t("team.emailPlaceholder")}
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
                      {inviting ? "..." : t("team.invite")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
