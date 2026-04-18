import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchSitemapUrls } from "@/lib/sitemap";

// Minimal Response shim for the stream reader used by the sitemap fetcher.
function mockXmlResponse(body: string, ok = true): Response {
  const enc = new TextEncoder().encode(body);
  let sent = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent) {
        controller.close();
        return;
      }
      controller.enqueue(enc);
      sent = true;
      controller.close();
    },
  });
  return new Response(stream, {
    status: ok ? 200 : 404,
    headers: { "content-type": "application/xml" },
  });
}

describe("fetchSitemapUrls", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("returns null for invalid URL", async () => {
    const result = await fetchSitemapUrls("not a url");
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("blocks private/loopback hosts (SSRF)", async () => {
    const result = await fetchSitemapUrls("http://127.0.0.1/sitemap.xml");
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses a flat urlset", async () => {
    const xml = `<?xml version="1.0"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/a</loc></url>
        <url><loc>https://example.com/b</loc></url>
        <url><loc>https://example.com/b</loc></url>
      </urlset>`;
    fetchSpy.mockResolvedValueOnce(mockXmlResponse(xml));

    const result = await fetchSitemapUrls("https://example.com");
    expect(result).not.toBeNull();
    expect(result!.urls).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
    expect(result!.truncated).toBe(false);
  });

  it("follows a sitemap index and merges children", async () => {
    const index = `<?xml version="1.0"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sitemap-pages.xml</loc></sitemap>
        <sitemap><loc>https://example.com/sitemap-posts.xml</loc></sitemap>
      </sitemapindex>`;
    const pages = `<?xml version="1.0"?>
      <urlset><url><loc>https://example.com/about</loc></url></urlset>`;
    const posts = `<?xml version="1.0"?>
      <urlset>
        <url><loc>https://example.com/blog/1</loc></url>
        <url><loc>https://example.com/blog/2</loc></url>
      </urlset>`;

    fetchSpy
      .mockResolvedValueOnce(mockXmlResponse(index))
      .mockResolvedValueOnce(mockXmlResponse(pages))
      .mockResolvedValueOnce(mockXmlResponse(posts));

    const result = await fetchSitemapUrls("https://example.com/sitemap.xml");
    expect(result).not.toBeNull();
    expect(result!.urls).toEqual([
      "https://example.com/about",
      "https://example.com/blog/1",
      "https://example.com/blog/2",
    ]);
  });

  it("returns null when no sitemap is reachable", async () => {
    fetchSpy.mockResolvedValue(mockXmlResponse("not found", false));
    const result = await fetchSitemapUrls("https://example.com");
    expect(result).toBeNull();
  });

  it("decodes basic HTML entities in <loc>", async () => {
    const xml = `<urlset>
      <url><loc>https://example.com/search?q=a&amp;b=1</loc></url>
    </urlset>`;
    fetchSpy.mockResolvedValueOnce(mockXmlResponse(xml));

    const result = await fetchSitemapUrls("https://example.com/sitemap.xml");
    expect(result!.urls).toEqual(["https://example.com/search?q=a&b=1"]);
  });
});
