/**
 * SSRF (Server-Side Request Forgery) defense helpers.
 *
 * Used by any code path that fetches a user-supplied URL
 * (webhooks, website scraper, etc.) to block the obvious
 * direct-literal and common-private-name targets an attacker
 * would try. DNS rebinding is not covered — we don't resolve
 * and re-check after the initial fetch.
 */

/**
 * Reject hostnames that clearly point at loopback, link-local,
 * or private network ranges.
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
 * validation failure (invalid URL, non-http(s), blocked hostname).
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

/**
 * Fetch a user-supplied URL with SSRF protection that ALSO covers redirects:
 * validates the initial URL, then follows up to `maxHops` redirects MANUALLY,
 * re-validating each Location through parseSafeUrl. undici's default
 * redirect:"follow" would transparently follow a 302 to a private/metadata host
 * that the one-time initial check never sees. Throws on any validation failure.
 * (DNS rebinding — re-resolving the same hostname to a private IP at connect
 * time — is still not covered; that needs a resolve-and-pin dispatcher.)
 */
export async function safeFetch(
  url: string,
  init?: RequestInit,
  maxHops = 4,
): Promise<Response> {
  let current = parseSafeUrl(url);
  if (!current) throw new Error("URL failed SSRF validation");
  for (let hop = 0; ; hop++) {
    const res = await fetch(current.toString(), { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      if (hop >= maxHops) throw new Error("Too many redirects");
      const next = parseSafeUrl(new URL(location, current).toString());
      if (!next) throw new Error("Redirect target failed SSRF validation");
      current = next;
      continue;
    }
    return res;
  }
}
