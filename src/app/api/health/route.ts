import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

// Bound every dependency probe so a hung connection can't hang the health
// check itself (the thing uptime monitors poll).
const PROBE_TIMEOUT_MS = 3000;

type ProbeResult = "ok" | "error" | "timeout" | "not_configured";

// Accepts a PromiseLike so the Supabase query builder (a thenable, not a real
// Promise) can be passed directly.
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | "timeout"> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), ms);
  });
  return Promise.race([Promise.resolve(promise).finally(() => clearTimeout(timer)), timeout]);
}

// Cheapest possible connectivity check: a single-row read on a table that always
// exists. A dead host (e.g. NXDOMAIN) surfaces as a thrown/rejected fetch ->
// "error"; a slow host -> "timeout".
async function probeDatabase(): Promise<ProbeResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return "not_configured";
  try {
    const supabase = createClient(url, key);
    const result = await withTimeout(
      supabase.from("profiles").select("id").limit(1),
      PROBE_TIMEOUT_MS
    );
    if (result === "timeout") return "timeout";
    return result.error ? "error" : "ok";
  } catch {
    return "error";
  }
}

async function probeRedis(): Promise<ProbeResult> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return "not_configured";
  try {
    const redis = new Redis({ url, token });
    const result = await withTimeout(redis.ping(), PROBE_TIMEOUT_MS);
    if (result === "timeout") return "timeout";
    return "ok";
  } catch {
    return "error";
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([probeDatabase(), probeRedis()]);

  // The database is critical: a dead DB means no authenticated traffic can be
  // served, so report 503 and let uptime monitors page. Redis only degrades the
  // app to an in-memory rate-limit fallback, so a Redis blip is "degraded", not
  // down. "not_configured" is treated as healthy so envs that intentionally run
  // without Redis (or without a service-role key locally) aren't falsely red.
  const dbHealthy = database === "ok" || database === "not_configured";
  const redisHealthy = redis === "ok" || redis === "not_configured";

  const status = !dbHealthy ? "error" : !redisHealthy ? "degraded" : "ok";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "1.0.0",
      checks: { database, redis },
    },
    { status: dbHealthy ? 200 : 503 }
  );
}
