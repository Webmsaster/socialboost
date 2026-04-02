import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockGetUser = vi.fn();
const mockSelectResult = vi.fn();
const mockInsertResult = vi.fn();
const mockInsertSelectSingle = vi.fn();
const mockUpdateResult = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        const isCount = args[1] && typeof args[1] === "object" && "count" in (args[1] as Record<string, unknown>);
        if (isCount) {
          return {
            eq: (...eqArgs: unknown[]) => mockSelectResult(table, "count", ...eqArgs),
          };
        }
        return {
          eq: (...eqArgs: unknown[]) => {
            const eqResult = mockSelectResult(table, "first-eq", ...eqArgs);
            return {
              eq: (...eq2Args: unknown[]) => {
                const eq2Result = mockSelectResult(table, "second-eq", ...eqArgs, ...eq2Args);
                return {
                  eq: () => mockSelectResult(table, "triple-eq", ...eqArgs, ...eq2Args),
                  single: () => mockSelectResult(table, "double-eq-single", ...eqArgs, ...eq2Args),
                  // Spread the result so { data } can be destructured directly
                  ...(eq2Result ?? {}),
                };
              },
              single: () => mockSelectResult(table, "single", ...eqArgs),
              ...(eqResult ?? {}),
            };
          },
        };
      },
      insert: (data: unknown) => {
        const result = mockInsertResult(table, data);
        return {
          select: () => ({
            single: () => mockInsertSelectSingle(table, data),
          }),
          ...(result ?? {}),
        };
      },
      update: (data: unknown) => ({
        eq: (...eqArgs: unknown[]) => ({
          eq: (...eq2Args: unknown[]) => ({
            eq: () => mockUpdateResult(table, data, ...eqArgs, ...eq2Args),
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

// Import after mocks
import { GET, POST } from "@/app/api/team/route";
import { POST as InvitePost } from "@/app/api/team/invite/route";
import { POST as AcceptPost } from "@/app/api/team/accept/route";

function createRequest(body: Record<string, unknown>, url = "http://localhost:3000/api/team"): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/team", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns empty memberships when db returns null", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    // first-eq returns nothing special, second-eq returns { data: null }
    mockSelectResult
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ data: null });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.memberships).toEqual([]);
  });

  it("returns memberships", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    const memberships = [
      { org_id: "org-1", role: "owner", organizations: { id: "org-1", name: "My Org" } },
    ];
    // first-eq returns nothing special, second-eq returns { data: memberships }
    mockSelectResult
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ data: memberships });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.memberships).toEqual(memberships);
  });

  it("returns 500 when an unexpected error is thrown (GET catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected GET error"));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to fetch team");
  });
});

describe("POST /api/team", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await POST(createRequest({ name: "Org" }));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 if missing name", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });

    const response = await POST(createRequest({ name: "" }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing name");
  });

  it("creates org and adds owner as member", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    const org = { id: "org-1", name: "New Org", owner_id: "user-1" };
    mockInsertSelectSingle.mockResolvedValueOnce({ data: org, error: null });
    mockInsertResult.mockReturnValue(null);

    const response = await POST(createRequest({ name: "New Org" }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.id).toBe("org-1");
    expect(json.name).toBe("New Org");
  });

  it("returns 500 when org insert returns error", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockInsertSelectSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "Insert error" },
    });

    const response = await POST(createRequest({ name: "Failing Org" }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to create organization");
  });

  it("returns 500 when an unexpected error is thrown (POST catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected POST error"));

    const response = await POST(createRequest({ name: "Org" }));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to create team");
  });
});

describe("POST /api/team/invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await InvitePost(
      createRequest({ orgId: "org-1", email: "test@example.com" }, "http://localhost:3000/api/team/invite")
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 if missing orgId/email", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });

    const response = await InvitePost(
      createRequest({ orgId: "" }, "http://localhost:3000/api/team/invite")
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing orgId or email");
  });

  it("returns 403 if not owner/admin", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    // Mock chain: first-eq (returns undefined), second-eq (returns undefined),
    // then double-eq-single (returns membership with 'member' role)
    mockSelectResult
      .mockReturnValueOnce(undefined)   // first-eq
      .mockReturnValueOnce(undefined)   // second-eq
      .mockReturnValueOnce({ data: { role: "member" } }); // double-eq-single

    const response = await InvitePost(
      createRequest(
        { orgId: "org-1", email: "invite@example.com" },
        "http://localhost:3000/api/team/invite"
      )
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Not authorized");
  });

  it("returns 403 when team member limit is reached", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockSelectResult
      .mockReturnValueOnce(undefined)   // first-eq (auth check)
      .mockReturnValueOnce(undefined)   // second-eq (auth check)
      .mockReturnValueOnce({ data: { role: "owner" } }) // double-eq-single (auth check)
      .mockReturnValueOnce({ count: 5 }) // count (member count)
      .mockReturnValueOnce(undefined)   // first-eq (org lookup)
      .mockReturnValueOnce({ data: { max_members: 5, name: "My Org" } }); // single (org lookup)

    const response = await InvitePost(
      createRequest(
        { orgId: "org-1", email: "new@example.com" },
        "http://localhost:3000/api/team/invite"
      )
    );
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Team limit reached");
  });

  it("returns 409 when user is already invited", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockSelectResult
      .mockReturnValueOnce(undefined)   // first-eq (auth check)
      .mockReturnValueOnce(undefined)   // second-eq (auth check)
      .mockReturnValueOnce({ data: { role: "admin" } }) // double-eq-single (auth check)
      .mockReturnValueOnce({ count: 2 }) // count (member count)
      .mockReturnValueOnce(undefined)   // first-eq (org lookup)
      .mockReturnValueOnce({ data: { max_members: 10, name: "My Org" } }) // single (org lookup)
      .mockReturnValueOnce(undefined)   // first-eq (already invited check)
      .mockReturnValueOnce(undefined)   // second-eq (already invited check)
      .mockReturnValueOnce({ data: { id: "existing-invite" } }); // double-eq-single (already invited)

    const response = await InvitePost(
      createRequest(
        { orgId: "org-1", email: "already@example.com" },
        "http://localhost:3000/api/team/invite"
      )
    );
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toContain("Already invited");
  });

  it("successfully invites a user when authorized", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockSelectResult
      .mockReturnValueOnce(undefined)   // first-eq (auth check)
      .mockReturnValueOnce(undefined)   // second-eq (auth check)
      .mockReturnValueOnce({ data: { role: "owner" } }) // double-eq-single (auth check)
      .mockReturnValueOnce({ count: 2 }) // count (member count)
      .mockReturnValueOnce(undefined)   // first-eq (org lookup)
      .mockReturnValueOnce({ data: { max_members: 10, name: "My Org" } }) // single (org lookup)
      .mockReturnValueOnce(undefined)   // first-eq (already invited check)
      .mockReturnValueOnce(undefined)   // second-eq (already invited check)
      .mockReturnValueOnce({ data: null }) // double-eq-single (not already invited)
      .mockReturnValueOnce(undefined)   // first-eq (profile lookup)
      .mockReturnValueOnce({ data: { id: "invited-user-id" } }); // single (profile found)
    mockInsertResult.mockReturnValueOnce({ error: null });

    const response = await InvitePost(
      createRequest(
        { orgId: "org-1", email: "newmember@example.com" },
        "http://localhost:3000/api/team/invite"
      )
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockInsertResult).toHaveBeenCalledWith("org_members", expect.objectContaining({
      org_id: "org-1",
      invited_email: "newmember@example.com",
      accepted: false,
    }));
  });

  it("returns 500 when invite insert fails", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockSelectResult
      .mockReturnValueOnce(undefined)   // first-eq (auth check)
      .mockReturnValueOnce(undefined)   // second-eq (auth check)
      .mockReturnValueOnce({ data: { role: "owner" } }) // double-eq-single (auth check)
      .mockReturnValueOnce({ count: 1 }) // count (member count)
      .mockReturnValueOnce(undefined)   // first-eq (org lookup)
      .mockReturnValueOnce({ data: { max_members: 10, name: "My Org" } }) // single (org lookup)
      .mockReturnValueOnce(undefined)   // first-eq (already invited check)
      .mockReturnValueOnce(undefined)   // second-eq (already invited check)
      .mockReturnValueOnce({ data: null }) // double-eq-single (not already invited)
      .mockReturnValueOnce(undefined)   // first-eq (profile lookup)
      .mockReturnValueOnce({ data: null }); // single (profile not found)
    mockInsertResult.mockReturnValueOnce({ error: { message: "DB insert error" } });

    const response = await InvitePost(
      createRequest(
        { orgId: "org-1", email: "fail@example.com" },
        "http://localhost:3000/api/team/invite"
      )
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to invite");
  });

  it("returns 500 when an unexpected error is thrown (outer catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected invite error"));

    const response = await InvitePost(
      createRequest(
        { orgId: "org-1", email: "test@example.com" },
        "http://localhost:3000/api/team/invite"
      )
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed to invite");
  });
});

describe("POST /api/team/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const response = await AcceptPost(
      createRequest({ orgId: "org-1" }, "http://localhost:3000/api/team/accept")
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 if missing orgId", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });

    const response = await AcceptPost(
      createRequest({}, "http://localhost:3000/api/team/accept")
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Missing orgId");
  });

  it("successfully accepts a pending invite", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    // Profile lookup: select("email").eq("id", user.id).single()
    mockSelectResult
      .mockReturnValueOnce(undefined)   // first-eq (profile lookup)
      .mockReturnValueOnce({ data: { email: "user@example.com" } }); // single (profile)
    // Update: update({accepted: true, user_id: ...}).eq("org_id", orgId).eq("invited_email", email).eq("accepted", false)
    mockUpdateResult.mockReturnValueOnce({ error: null });

    const response = await AcceptPost(
      createRequest({ orgId: "org-1" }, "http://localhost:3000/api/team/accept")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("returns 404 when no pending invite found", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    // Profile lookup
    mockSelectResult
      .mockReturnValueOnce(undefined)   // first-eq (profile lookup)
      .mockReturnValueOnce({ data: { email: "user@example.com" } }); // single (profile)
    // Update fails (no matching row)
    mockUpdateResult.mockReturnValueOnce({ error: { message: "No rows updated" } });

    const response = await AcceptPost(
      createRequest({ orgId: "org-1" }, "http://localhost:3000/api/team/accept")
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toContain("No pending invite found");
  });
});
