import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ----
const mockGetPublisher = vi.fn();
const mockEnsureFreshToken = vi.fn();

vi.mock("@/lib/platforms/registry", () => ({
  getPublisher: (...args: unknown[]) => mockGetPublisher(...args),
  ensureFreshToken: (...args: unknown[]) => mockEnsureFreshToken(...args),
}));

const mockDecryptToken = vi.fn((v: string | null) => v);
const mockEncryptToken = vi.fn((v: string | null) => v);

vi.mock("@/lib/token-crypto", () => ({
  decryptToken: (...args: unknown[]) => mockDecryptToken(...(args as [string | null])),
  encryptToken: (...args: unknown[]) => mockEncryptToken(...(args as [string | null])),
}));

// Supabase admin client mock — chainable query builder
type Row = Record<string, unknown>;

let postsStore: Row[] = [];
let accountsStore: Row[] = [];
let updatedPosts: Array<{ id: unknown; patch: Row }> = [];

function makeQuery(table: string) {
  const state: { filters: Record<string, unknown>; pendingUpdate?: Row } = { filters: {} };

  const builder: Record<string, unknown> = {
    select() {
      return builder;
    },
    update(patch: Row) {
      state.pendingUpdate = patch;
      return builder;
    },
    eq(col: string, val: unknown) {
      state.filters[col] = val;
      // An .eq() after .update() is the terminal write call.
      if (state.pendingUpdate) {
        if (table === "posts") {
          updatedPosts.push({ id: val, patch: state.pendingUpdate });
          const row = postsStore.find((p) => p.id === val);
          if (row) Object.assign(row, state.pendingUpdate);
        }
        state.pendingUpdate = undefined;
        return Promise.resolve({ data: null, error: null });
      }
      return builder;
    },
    lte() {
      return builder;
    },
    gte() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    in() {
      return builder;
    },
    not() {
      return builder;
    },
    then(resolve: (v: { data: Row[]; error: null }) => void) {
      if (table === "posts") {
        return resolve({ data: postsStore, error: null });
      }
      if (table === "connected_accounts") {
        return resolve({ data: accountsStore, error: null });
      }
      return resolve({ data: [], error: null });
    },
  };
  return builder;
}

const mockFrom = vi.fn((table: string) => makeQuery(table));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/logger", () => ({
  captureError: vi.fn(),
}));

import { GET } from "@/app/api/cron/sync-metrics/route";

function makeRequest() {
  return new Request("http://localhost/api/cron/sync-metrics", {
    headers: { authorization: "Bearer test-secret" },
  }) as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  postsStore = [];
  accountsStore = [];
  updatedPosts = [];
  process.env.CRON_SECRET = "test-secret";
  mockDecryptToken.mockImplementation((v: string | null) => v);
  mockEncryptToken.mockImplementation((v: string | null) => v);
  mockEnsureFreshToken.mockImplementation((acc: unknown) => ({ account: acc, refreshed: false }));
});

describe("cron/sync-metrics route", () => {
  it("returns 401 without valid CRON_SECRET", async () => {
    const req = new Request("http://localhost/api/cron/sync-metrics", {
      headers: { authorization: "Bearer wrong" },
    }) as unknown as Parameters<typeof GET>[0];
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("syncs metrics for a published post", async () => {
    postsStore = [
      {
        id: "post-1",
        platform: "twitter",
        platform_post_id: "tw-1",
        connected_account_id: "acc-1",
        published_at: new Date().toISOString(),
      },
    ];
    accountsStore = [{ id: "acc-1", platform: "twitter", access_token: "tok", refresh_token: "ref" }];
    const fetchMetrics = vi
      .fn()
      .mockResolvedValue({ likes: 5, shares: 2, comments: 1, impressions: 100 });
    mockGetPublisher.mockReturnValue({ fetchMetrics });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.synced).toBe(1);
    expect(fetchMetrics).toHaveBeenCalledTimes(1);
    const patch = [...updatedPosts].reverse().find((u) => u.id === "post-1")?.patch;
    expect(patch?.likes).toBe(5);
  });

  it("skips an account whose token decrypt throws and continues the batch", async () => {
    postsStore = [
      {
        id: "post-bad",
        platform: "twitter",
        platform_post_id: "tw-bad",
        connected_account_id: "acc-bad",
        published_at: new Date().toISOString(),
      },
      {
        id: "post-good",
        platform: "twitter",
        platform_post_id: "tw-good",
        connected_account_id: "acc-good",
        published_at: new Date().toISOString(),
      },
    ];
    accountsStore = [
      { id: "acc-bad", platform: "twitter", access_token: "gcm1:broken", refresh_token: "ref" },
      { id: "acc-good", platform: "twitter", access_token: "tok", refresh_token: "ref" },
    ];

    // Throw only for the malformed ciphertext of the first account.
    mockDecryptToken.mockImplementation((v: string | null) => {
      if (v === "gcm1:broken") throw new Error("Malformed encrypted token");
      return v;
    });
    const fetchMetrics = vi
      .fn()
      .mockResolvedValue({ likes: 3, shares: 0, comments: 0, impressions: 10 });
    mockGetPublisher.mockReturnValue({ fetchMetrics });

    const res = await GET(makeRequest());
    const body = await res.json();

    // The bad account is skipped (no map entry → post-bad falls through),
    // and the good account is still synced — the batch did not abort.
    expect(body.synced).toBe(1);
    expect(body.skipped).toBe(1);
    // fetchMetrics only ran for the good post, never the malformed one.
    expect(fetchMetrics).toHaveBeenCalledTimes(1);
    expect(fetchMetrics).toHaveBeenCalledWith(expect.anything(), "tw-good");
  });
});
