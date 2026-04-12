import { describe, it, expect } from "vitest";
import { isBlockedHostname, parseSafeUrl } from "@/lib/ssrf";

describe("isBlockedHostname", () => {
  it.each([
    "localhost",
    "Localhost",
    "api.localhost",
    "127.0.0.1",
    "127.1.2.3",
    "0.0.0.0",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.20.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "[::1]",
    "metadata.google.internal",
    "fc00::1",
    "fd12:3456:789a::1",
    "fe80::1",
  ])("blocks %s", (host) => {
    expect(isBlockedHostname(host)).toBe(true);
  });

  it.each([
    "example.com",
    "api.example.com",
    "socialboost.app",
    "8.8.8.8",
    "1.1.1.1",
    "172.15.0.1", // outside 172.16-31
    "172.32.0.1",
    "192.167.1.1",
    "169.253.1.1",
  ])("allows %s", (host) => {
    expect(isBlockedHostname(host)).toBe(false);
  });
});

describe("parseSafeUrl", () => {
  it("returns URL for valid https", () => {
    const u = parseSafeUrl("https://example.com/path");
    expect(u).not.toBeNull();
    expect(u?.hostname).toBe("example.com");
  });

  it("returns URL for valid http", () => {
    expect(parseSafeUrl("http://example.com")).not.toBeNull();
  });

  it("rejects non-http protocols", () => {
    expect(parseSafeUrl("ftp://example.com")).toBeNull();
    expect(parseSafeUrl("file:///etc/passwd")).toBeNull();
    expect(parseSafeUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects invalid URLs", () => {
    expect(parseSafeUrl("not a url")).toBeNull();
    expect(parseSafeUrl("")).toBeNull();
  });

  it("rejects private hosts", () => {
    expect(parseSafeUrl("http://localhost")).toBeNull();
    expect(parseSafeUrl("http://127.0.0.1:8080")).toBeNull();
    expect(parseSafeUrl("http://169.254.169.254/latest/meta-data/")).toBeNull();
    expect(parseSafeUrl("https://192.168.1.1")).toBeNull();
  });
});
