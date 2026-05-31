import { describe, it, expect, vi } from "vitest";
import {
  reserveGeneration,
  refundGeneration,
  reserveVideoGeneration,
  refundVideoGeneration,
} from "@/lib/quota";

type RpcResult = { data: unknown; error: unknown };

/** Fake Supabase-style client whose rpc() returns a per-function canned result. */
function fakeClient(byFn: Record<string, RpcResult>) {
  const rpc = vi.fn((fn: string) =>
    Promise.resolve(byFn[fn] ?? { data: null, error: null }),
  );
  return { rpc };
}

describe("quota.reserveGeneration", () => {
  it("returns true only when the RPC resolves data === true", async () => {
    const client = fakeClient({ reserve_generation: { data: true, error: null } });
    await expect(reserveGeneration(client, "u1", 100)).resolves.toBe(true);
    expect(client.rpc).toHaveBeenCalledWith("reserve_generation", {
      p_user_id: "u1",
      p_limit: 100,
    });
  });

  it("returns false when the RPC resolves data === false (at/over limit)", async () => {
    const client = fakeClient({ reserve_generation: { data: false, error: null } });
    await expect(reserveGeneration(client, "u1", 10)).resolves.toBe(false);
  });

  it("fails closed: returns false on an RPC error even if data is truthy", async () => {
    const client = fakeClient({
      reserve_generation: { data: true, error: { message: "boom" } },
    });
    // A DB error must NEVER grant a free generation.
    await expect(reserveGeneration(client, "u1", 10)).resolves.toBe(false);
  });

  it("returns false for a truthy-but-not-true result (no loose coercion)", async () => {
    const client = fakeClient({ reserve_generation: { data: "true", error: null } });
    await expect(reserveGeneration(client, "u1", 10)).resolves.toBe(false);
  });
});

describe("quota.refundGeneration", () => {
  it("calls refund_generation with the user id", async () => {
    const client = fakeClient({});
    await refundGeneration(client, "u1");
    expect(client.rpc).toHaveBeenCalledWith("refund_generation", { p_user_id: "u1" });
  });
});

describe("quota.reserveVideoGeneration", () => {
  it("returns true only on data === true and passes the video limit", async () => {
    const client = fakeClient({ reserve_video_generation: { data: true, error: null } });
    await expect(reserveVideoGeneration(client, "u1", 5)).resolves.toBe(true);
    expect(client.rpc).toHaveBeenCalledWith("reserve_video_generation", {
      p_user_id: "u1",
      p_limit: 5,
    });
  });

  it("fails closed on RPC error", async () => {
    const client = fakeClient({
      reserve_video_generation: { data: true, error: { message: "x" } },
    });
    await expect(reserveVideoGeneration(client, "u1", 5)).resolves.toBe(false);
  });
});

describe("quota.refundVideoGeneration", () => {
  it("calls refund_video_generation with the user id", async () => {
    const client = fakeClient({});
    await refundVideoGeneration(client, "u1");
    expect(client.rpc).toHaveBeenCalledWith("refund_video_generation", {
      p_user_id: "u1",
    });
  });
});
