import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockGetUser = vi.fn();
const mockLimit = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: (...args: unknown[]) => mockLimit(...args),
            }),
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
import { GET } from "@/app/api/metrics/route";

describe("GET /api/metrics", () => {
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

  it("returns metrics summary when posts data is null", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockLimit.mockReturnValueOnce({ data: null });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.summary).toEqual({
      totalPosts: 0,
      totalLikes: 0,
      totalShares: 0,
      totalComments: 0,
      totalImpressions: 0,
      avgScore: 0,
    });
    expect(json.byPlatform).toEqual({});
    expect(json.recentPosts).toEqual([]);
  });

  it("returns metrics summary with empty posts", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    mockLimit.mockReturnValueOnce({ data: [] });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.summary).toEqual({
      totalPosts: 0,
      totalLikes: 0,
      totalShares: 0,
      totalComments: 0,
      totalImpressions: 0,
      avgScore: 0,
    });
    expect(json.byPlatform).toEqual({});
    expect(json.recentPosts).toEqual([]);
  });

  it("handles posts with null metric fields (|| 0 branches)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    const posts = [
      {
        id: "p1",
        platform: "linkedin",
        content: "Post 1",
        published_at: "2026-01-01",
        likes: null,
        shares: null,
        comments: null,
        impressions: null,
        content_score: null,
      },
    ];
    mockLimit.mockReturnValueOnce({ data: posts });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.summary.totalPosts).toBe(1);
    expect(json.summary.totalLikes).toBe(0);
    expect(json.summary.totalShares).toBe(0);
    expect(json.summary.totalComments).toBe(0);
    expect(json.summary.totalImpressions).toBe(0);
    expect(json.summary.avgScore).toBe(0);
    expect(json.byPlatform).toEqual({ linkedin: 1 });
  });

  it("returns correct calculations with posts data", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
    });
    const posts = [
      {
        id: "p1",
        platform: "linkedin",
        content: "Post 1",
        published_at: "2026-01-01",
        likes: 10,
        shares: 5,
        comments: 3,
        impressions: 100,
        content_score: 80,
      },
      {
        id: "p2",
        platform: "twitter",
        content: "Post 2",
        published_at: "2026-01-02",
        likes: 20,
        shares: 10,
        comments: 7,
        impressions: 200,
        content_score: 90,
      },
      {
        id: "p3",
        platform: "linkedin",
        content: "Post 3",
        published_at: "2026-01-03",
        likes: 5,
        shares: 2,
        comments: 1,
        impressions: 50,
        content_score: 70,
      },
    ];
    mockLimit.mockReturnValueOnce({ data: posts });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.summary.totalPosts).toBe(3);
    expect(json.summary.totalLikes).toBe(35);
    expect(json.summary.totalShares).toBe(17);
    expect(json.summary.totalComments).toBe(11);
    expect(json.summary.totalImpressions).toBe(350);
    expect(json.summary.avgScore).toBe(80); // (80+90+70)/3 = 80
    expect(json.byPlatform).toEqual({ linkedin: 2, twitter: 1 });
    expect(json.recentPosts).toHaveLength(3);
  });

  it("returns 500 when an unexpected error is thrown (catch block)", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("Unexpected error"));

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to fetch metrics");
  });
});
