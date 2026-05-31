import { captureError } from "./logger";
import { parseSafeUrl, safeFetch } from "./ssrf";

const MAX_XML_BYTES = 2_000_000; // 2 MB — enough for a few thousand URLs
const FETCH_TIMEOUT_MS = 10_000;
const MAX_URLS_RETURNED = 200;
const MAX_INDEX_CHILDREN = 10; // follow at most 10 child sitemaps from an index

export interface SitemapResult {
  sourceUrl: string;
  urls: string[];
  truncated: boolean;
}

function extractLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<\s][^<]*?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    out.push(
      match[1]
        .trim()
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    );
  }
  return out;
}

function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

async function fetchXml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await safeFetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "SocialBoost/1.0 (+https://socialboost.app)",
        accept: "application/xml, text/xml, */*",
      },
    });
    if (!res.ok) return null;

    const reader = res.body?.getReader();
    if (!reader) return null;

    let received = 0;
    const chunks: Uint8Array[] = [];
    while (received < MAX_XML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
    }
    await reader.cancel().catch(() => {});
    const buf = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
      buf.set(c.subarray(0, Math.min(c.byteLength, received - offset)), offset);
      offset += c.byteLength;
      if (offset >= received) break;
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(buf);
  } catch (err) {
    captureError("Sitemap fetch failed", err, { url });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Given a site-root URL OR a direct sitemap URL, return the list of public
 * page URLs declared in the site's sitemap(s). Supports both urlset and
 * sitemapindex documents (follows at most {@link MAX_INDEX_CHILDREN}
 * children). Returns null when nothing could be fetched/parsed.
 */
export async function fetchSitemapUrls(input: string): Promise<SitemapResult | null> {
  const parsed = parseSafeUrl(input.trim());
  if (!parsed) return null;

  // Candidate list: if the user handed us a direct .xml URL, use it. Otherwise
  // try /sitemap.xml, /sitemap_index.xml, /sitemap.txt on the given origin.
  const candidates: string[] = [];
  if (/\.xml(\?|$)/i.test(parsed.pathname + parsed.search)) {
    candidates.push(parsed.toString());
  } else {
    const base = `${parsed.protocol}//${parsed.host}`;
    candidates.push(`${base}/sitemap.xml`, `${base}/sitemap_index.xml`);
  }

  for (const cand of candidates) {
    const xml = await fetchXml(cand);
    if (!xml) continue;

    // Sitemap index — resolve up to MAX_INDEX_CHILDREN child sitemaps.
    if (isSitemapIndex(xml)) {
      const childUrls = extractLocs(xml).slice(0, MAX_INDEX_CHILDREN);
      const all: string[] = [];
      for (const child of childUrls) {
        const childSafe = parseSafeUrl(child);
        if (!childSafe) continue;
        const childXml = await fetchXml(childSafe.toString());
        if (!childXml) continue;
        all.push(...extractLocs(childXml));
        if (all.length >= MAX_URLS_RETURNED) break;
      }
      const deduped = Array.from(new Set(all))
        .filter((u) => parseSafeUrl(u) !== null);
      return {
        sourceUrl: cand,
        urls: deduped.slice(0, MAX_URLS_RETURNED),
        truncated: deduped.length > MAX_URLS_RETURNED,
      };
    }

    // Plain urlset
    const found = extractLocs(xml);
    const deduped = Array.from(new Set(found))
      .filter((u) => parseSafeUrl(u) !== null);
    if (deduped.length === 0) continue;

    return {
      sourceUrl: cand,
      urls: deduped.slice(0, MAX_URLS_RETURNED),
      truncated: deduped.length > MAX_URLS_RETURNED,
    };
  }

  return null;
}
