import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Verify a cron request's bearer token against CRON_SECRET.
 *
 * Returns a ready 401 NextResponse when the request is unauthorized, or null
 * when it is allowed — so call sites read:
 *
 *   const unauthorized = requireCronAuth(request);
 *   if (unauthorized) return unauthorized;
 *
 * The comparison is constant-time (timingSafeEqual): a plain `!==` short-circuits
 * on the first differing byte and leaks the secret through response timing. These
 * endpoints trigger publishing, email sends, and paid renders, so CRON_SECRET is
 * security-critical. Shared by every cron route so a change happens in one place.
 */
export function requireCronAuth(request: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization");
  if (!cronSecret || !provided || !safeEqual(provided, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual requires equal-length buffers. Comparing lengths first leaks
  // only the length (not the contents), which is not sensitive here.
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
