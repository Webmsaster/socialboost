import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              order: (...orderArgs: unknown[]) => {
                mockOrder(...orderArgs);
                return {
                  limit: (...limitArgs: unknown[]) => {
                    mockLimit(...limitArgs);
                    return mockLimit.mock.results[mockLimit.mock.calls.length - 1]?.value ?? { data: [], error: null };
                  },
                };
              },
            };
          },
        };
      },
    }),
  }),
}));

vi.mock("@/lib/logger", () => ({ captureError: vi.fn() }));

import { GET } from "@/app/api/insights/route";

describe("GET /api/insights", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 401 if no user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns null insights when no published posts", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockLimit.mockReturnValueOnce({ data: [], error: null });
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.insights).toBeNull();
  });

  it("returns insights when published posts exist", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockLimit.mockReturnValueOnce({
      data: [
        {
          id: "p1", platform: "linkedin", topic: "AI", content: "Great post about AI",
          tone: "professional", hashtags: ["ai", "tech"], likes: 50, shares: 10,
          comments: 5, impressions: 1000, content_score: 85, created_at: "2026-04-01",
        },
        {
          id: "p2", platform: "twitter", topic: "Marketing", content: "Marketing tips",
          tone: "casual", hashtags: ["marketing"], likes: 30, shares: 20,
          comments: 15, impressions: 2000, content_score: 75, created_at: "2026-04-02",
        },
      ],
      error: null,
    });

    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.insights).toBeDefined();
    expect(json.insights.platformRanking).toBeInstanceOf(Array);
    expect(json.insights.toneRanking).toBeInstanceOf(Array);
    expect(json.insights.topPosts).toHaveLength(2);
    expect(json.insights.totalAnalyzed).toBe(2);
  });
});
