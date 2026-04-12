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
