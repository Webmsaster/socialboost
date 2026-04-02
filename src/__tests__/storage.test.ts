import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Supabase before importing
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockFrom = vi.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: { from: mockFrom },
  })),
}));

import { persistImage } from "@/lib/storage";

describe("persistImage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads image and uploads to Supabase Storage", async () => {
    const imageBuffer = new ArrayBuffer(8);
    const mockBlob = { arrayBuffer: () => Promise.resolve(imageBuffer) };
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.supabase.co/image.png" },
    });

    const result = await persistImage("https://temp-url.com/image.png", "user-123");

    expect(fetch).toHaveBeenCalledWith("https://temp-url.com/image.png");
    expect(mockFrom).toHaveBeenCalledWith("generated-images");
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining("user-123/"),
      expect.any(Buffer),
      { contentType: "image/png", upsert: false }
    );
    expect(result).toBe("https://storage.supabase.co/image.png");
  });

  it("returns temporary URL if download fails", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 });

    const result = await persistImage("https://temp-url.com/gone.png", "user-123");
    expect(result).toBe("https://temp-url.com/gone.png");
  });

  it("returns temporary URL if upload fails", async () => {
    const imageBuffer = new ArrayBuffer(8);
    const mockBlob = { arrayBuffer: () => Promise.resolve(imageBuffer) };
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });
    mockUpload.mockResolvedValue({ error: new Error("Upload failed") });

    const result = await persistImage("https://temp-url.com/image.png", "user-123");
    expect(result).toBe("https://temp-url.com/image.png");
  });

  it("returns temporary URL if fetch throws", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

    const result = await persistImage("https://temp-url.com/image.png", "user-123");
    expect(result).toBe("https://temp-url.com/image.png");
  });
});
