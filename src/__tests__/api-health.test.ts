import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns status ok with timestamp", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
    expect(typeof data.timestamp).toBe("string");
    expect(data.version).toBeDefined();
  });

  it("returns valid ISO timestamp", async () => {
    const response = await GET();
    const data = await response.json();
    const date = new Date(data.timestamp);
    expect(date.toISOString()).toBe(data.timestamp);
  });

  it("falls back to 1.0.0 when npm_package_version is unset", async () => {
    const original = process.env.npm_package_version;
    delete process.env.npm_package_version;
    try {
      const response = await GET();
      const data = await response.json();
      expect(data.version).toBe("1.0.0");
    } finally {
      if (original !== undefined) process.env.npm_package_version = original;
    }
  });
});
