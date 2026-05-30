/**
 * SSRF (Server-Side Request Forgery) defense helpers.
 *
 * Used by any code path that fetches a user-supplied URL
 * (webhooks, website scraper, etc.) to block the obvious
 * direct-literal and common-private-name targets an attacker
 * would try.
 *
 * DNS rebinding IS now covered for safeFetch(): before each network hop we
 * resolve the hostname, validate EVERY returned address against the blocked
 * ranges, and then connect to those validated ("pinned") addresses via a
 * custom undici Agent whose lookup hook hands back ONLY the pre-validated IP.
 * That way the kernel never re-resolves the hostname at connect time — which
 * is exactly where a rebinding attack would swap in 169.254.169.254 / a
 * private IP after validation passed.
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { Agent } from "undici";

/**
 * Reject IP addresses (already-resolved, dotted-quad v4 or v6 string) or
 * hostnames that clearly point at loopback, link-local, or private ranges.
 * Reused both on the literal hostname (pre-resolution) and on every
 * resolved address (post-resolution / pinning).
 */
export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "metadata.google.internal") return true;
  // IPv6 loopback / unspecified
  if (h === "::1" || h === "[::1]" || h === "::" || h === "[::]") return true;
  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10) — prefix check
  if (/^\[?fc|^\[?fd/.test(h) || /^\[?fe8|^\[?fe9|^\[?fea|^\[?feb/.test(h)) return true;
  // IPv4-mapped IPv6 (e.g. [::ffff:169.254.169.254] parses to "[::ffff:a9fe:a9fe]"):
  // Node doesn't normalize these to dotted-quad, so they bypass the v4 checks
  // below while the kernel still routes them to the embedded IPv4
  // (loopback/metadata). Block all of them outright.
  if (/^\[?::ffff:/i.test(h)) return true;
  // IPv4 literal checks
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [parseInt(v4[1]), parseInt(v4[2])];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local (incl. AWS metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true; // multicast / reserved
  }
  return false;
}

/**
 * Parse a URL and return it if it is safe to fetch. Returns null on any
 * validation failure (invalid URL, non-http(s), blocked literal hostname).
 *
 * This is the cheap, synchronous, literal-only check. It does NOT resolve DNS
 * — callers that only need to validate a string keep using it as before.
 * safeFetch additionally performs resolve-and-pin (see resolveAndPin) to also
 * defend against DNS rebinding.
 */
export function parseSafeUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (isBlockedHostname(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** A resolved address as returned by dns.lookup({ all: true }). */
type ResolvedAddress = { address: string; family: number };

/** A URL that passed validation together with the IP address(es) it
 * resolved to at validation time. safeFetch pins connections to these. */
export interface PinnedUrl {
  url: URL;
  /** Resolved + validated addresses (in the form dns.lookup returns). */
  addresses: ResolvedAddress[];
}

/**
 * Validate a URL AND resolve it, checking every resolved address against the
 * blocked ranges, then return the URL plus the validated/pinned addresses.
 * Returns null on any failure (invalid/blocked URL, DNS failure, empty result,
 * or any resolved address in a blocked range).
 *
 * Resolving here and pinning the result in safeFetch is what closes the DNS
 * rebinding hole — without it, fetch() would re-resolve the hostname at
 * connect time and could land on a private/metadata IP.
 */
export async function resolveAndPin(url: string): Promise<PinnedUrl | null> {
  const parsed = parseSafeUrl(url);
  if (!parsed) return null;

  // Strip IPv6 brackets for the resolver; literal IPs resolve to themselves.
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  let resolved: ResolvedAddress[];
  try {
    resolved = await dnsLookup(host, { all: true });
  } catch {
    return null;
  }
  if (resolved.length === 0) return null;
  // Re-run the literal/range checks on every resolved address.
  for (const { address } of resolved) {
    if (isBlockedHostname(address)) return null;
  }
  return { url: parsed, addresses: resolved };
}

/**
 * Build an undici Agent that connects ONLY to the pre-validated addresses.
 * The custom connect.lookup short-circuits the OS resolver, so the kernel
 * never re-resolves the hostname (DNS rebinding window closed). We keep the
 * original hostname in the URL so TLS SNI and the Host header stay correct —
 * we do NOT rewrite the URL host to the IP (that would break SNI/vhosts).
 */
function pinnedAgent(pinned: PinnedUrl): Agent {
  return new Agent({
    connect: {
      lookup: (
        _hostname: string,
        _options: unknown,
        callback: (
          err: NodeJS.ErrnoException | null,
          address: string | ResolvedAddress[],
          family?: number,
        ) => void,
      ) => {
        // Hand back the validated address(es); the kernel never re-resolves.
        callback(
          null,
          pinned.addresses.map((a) => ({ address: a.address, family: a.family })),
        );
      },
    },
  });
}

/**
 * Fetch a user-supplied URL with SSRF protection that covers BOTH redirects
 * and DNS rebinding:
 *  - validates + resolves the initial URL via resolveAndPin (range-checks all IPs),
 *  - connects to the pinned IP(s) through a per-hop undici Agent so the
 *    hostname is never re-resolved at connect time,
 *  - follows up to `maxHops` redirects MANUALLY, re-validating AND re-pinning
 *    each Location (a fresh resolve + fresh Agent for every hop). undici's
 *    default redirect:"follow" would transparently follow a 302 to a
 *    private/metadata host the one-time check never sees.
 * Throws on any validation failure. Signature/behavior (timeout passthrough
 * via init.signal, manual redirects, max hops) are otherwise unchanged so its
 * callers (webhook-dispatcher, website-scraper, sitemap, video-from-site) are
 * unaffected.
 *
 * Residual risk: there is still a (tiny) TOCTOU gap between resolving in
 * resolveAndPin and the TCP connect — but because we pin the connect to the
 * exact addresses we validated, an attacker cannot influence which IP is
 * dialed after validation. A legitimate host that rotates IPs between resolve
 * and connect (rare) would just fail the request rather than become unsafe.
 */
export async function safeFetch(
  url: string,
  init?: RequestInit,
  maxHops = 4,
): Promise<Response> {
  let current = await resolveAndPin(url);
  if (!current) throw new Error("URL failed SSRF validation");
  for (let hop = 0; ; hop++) {
    const agent = pinnedAgent(current);
    let res: Response;
    try {
      res = await fetch(current.url.toString(), {
        ...init,
        redirect: "manual",
        // `dispatcher` is an undici extension to RequestInit (not in the DOM
        // lib types), so cast through an undici-augmented init shape.
        dispatcher: agent,
      } as RequestInit & { dispatcher: Agent });
    } finally {
      // Don't leak the per-hop agent/socket pool.
      void agent.close();
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      if (hop >= maxHops) throw new Error("Too many redirects");
      const next = await resolveAndPin(new URL(location, current.url).toString());
      if (!next) throw new Error("Redirect target failed SSRF validation");
      current = next;
      continue;
    }
    return res;
  }
}
