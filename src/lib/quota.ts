/**
 * Reserve-before-spend quota helpers (TOCTOU fix).
 *
 * Routes must RESERVE a generation slot atomically BEFORE running the
 * expensive OpenAI/render call, instead of the old read-compare-spend-then-
 * increment flow where two concurrent requests could both pass the read and
 * over-spend. If reserve returns false the user is at/over the limit and the
 * route should return 429 without calling OpenAI. If the expensive call fails,
 * the route should refund the reserved slot.
 *
 * These wrap the SQL RPCs in supabase/migration-quota-reserve.sql:
 *   reserve_generation / reserve_video_generation -> boolean (FOUND)
 *   refund_generation / refund_video_generation -> void
 *
 * The first argument is any Supabase client that exposes rpc() — the
 * RLS-scoped server client or the service-role admin client (both are used by
 * the affected routes). It is intentionally typed loosely because the two
 * client types do not share a single exported interface in this codebase.
 */

interface RpcClient {
  // PromiseLike (not Promise): Supabase's rpc() returns a PostgrestFilterBuilder
  // which is a thenable but lacks Promise's catch/finally — typing it as Promise
  // made the real client non-assignable here.
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

/**
 * Atomically reserve one text-generation slot. Returns true if reserved,
 * false if the user is already at/over the limit. On an RPC error returns
 * false (fail closed — never let a DB error grant free generations).
 */
export async function reserveGeneration(
  client: RpcClient,
  userId: string,
  limit: number,
): Promise<boolean> {
  const { data, error } = await client.rpc("reserve_generation", {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) return false;
  return data === true;
}

/** Refund one previously-reserved text slot (failure path). Best-effort. */
export async function refundGeneration(
  client: RpcClient,
  userId: string,
): Promise<void> {
  await client.rpc("refund_generation", { p_user_id: userId });
}

/**
 * Atomically reserve one video slot. Returns true if reserved, false if at/
 * over the video limit. Fails closed on RPC error.
 */
export async function reserveVideoGeneration(
  client: RpcClient,
  userId: string,
  limit: number,
): Promise<boolean> {
  const { data, error } = await client.rpc("reserve_video_generation", {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) return false;
  return data === true;
}

/** Refund one previously-reserved video slot (failure path). Best-effort. */
export async function refundVideoGeneration(
  client: RpcClient,
  userId: string,
): Promise<void> {
  await client.rpc("refund_video_generation", { p_user_id: userId });
}
