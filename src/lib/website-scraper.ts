import { captureError } from "./logger";
import { isBlockedHostname, safeFetch } from "./ssrf";

export interface WebsiteContext {
  url: string;
  title: string;
  description: string;
  headings: string[];
  keywords: string[];
  scrapedAt: string;
}

const MAX_HTML_BYTES = 500_000;
const FETCH_TIMEOUT_MS = 10_000;

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function extractMeta(html: string, name: string): string {
  const patterns = [
    new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]*property=["']og:${name}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${name}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decodeEntities(m[1]).trim();
  }
  return "";
}

function extractHeadings(html: string, tag: "h1" | "h2", limit = 5): string[] {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null && out.length < limit) {
    const text = decodeEntities(stripTags(match[1]));
    if (text && text.length <= 200) out.push(text);
  }
  return out;
}

/**
 * Fetch a public web page and extract a compact context bundle usable as
 * additional prompt input. Best-effort — returns null on any failure.
 */
export async function scrapeWebsite(url: string): Promise<WebsiteContext | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (isBlockedHostname(parsed.hostname)) {
      captureError("Website scrape blocked (private/loopback host)", null, {
        url,
        hostname: parsed.hostname,
      });
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await safeFetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "user-agent": "SocialBoost/1.0 (+https://socialboost.app)",
        accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("html")) return null;

    // Cap payload — some pages are huge and we only need the head + top of body.
    const reader = res.body?.getReader();
    if (!reader) return null;

    let received = 0;
    const chunks: Uint8Array[] = [];
    while (received < MAX_HTML_BYTES) {
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
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const rawTitle = titleMatch ? decodeEntities(stripTags(titleMatch[1])) : "";
    const ogTitle = extractMeta(html, "title");
    const title = (ogTitle || rawTitle).slice(0, 200);

    const description = (
      extractMeta(html, "description") ||
      extractMeta(html, "og:description")
    ).slice(0, 500);

    const keywordsRaw = extractMeta(html, "keywords");
    const keywords = keywordsRaw
      ? keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 10)
      : [];

    const h1 = extractHeadings(html, "h1", 3);
    const h2 = extractHeadings(html, "h2", 5);
    const headings = [...new Set([...h1, ...h2])];

    return {
      url: parsed.toString(),
      title,
      description,
      headings,
      keywords,
      scrapedAt: new Date().toISOString(),
    };
  } catch (err) {
    captureError("Website scrape failed", err, { url });
    return null;
  }
}

/**
 * Build a compact prompt block suitable for injecting into a generation request.
 */
export function buildPromptBlockFromContext(ctx: WebsiteContext): string {
  const lines: string[] = [`WEBSITE CONTEXT (${ctx.url}):`];
  if (ctx.title) lines.push(`Title: ${ctx.title}`);
  if (ctx.description) lines.push(`Description: ${ctx.description}`);
  if (ctx.keywords.length) lines.push(`Keywords: ${ctx.keywords.join(", ")}`);
  if (ctx.headings.length) {
    lines.push("Key sections:");
    for (const h of ctx.headings.slice(0, 6)) lines.push(`  • ${h}`);
  }
  return lines.join("\n");
}
