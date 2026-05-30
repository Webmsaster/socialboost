import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Mocks -----------------------------------------------------------------
// Mock the DNS resolver so we control what a hostname resolves to and can
// simulate a DNS-rebinding host (public-looking name -> private IP).
const lookupMock = vi.fn();
vi.mock("node:dns/promises", () => ({
  default: { lookup: (...args: unknown[]) => lookupMock(...args) },
  lookup: (...args: unknown[]) => lookupMock(...args),
}));

// Mock undici's Agent so we can assert that safeFetch builds a pinned agent
// and that its lookup hands back ONLY the pre-validated address. We capture the
// constructor options directly (avoids class-field init quirks under
// useDefineForClassFields) and expose a shared close() spy.
const agentClose = vi.fn().mockResolvedValue(undefined);
type AgentConnect = {
  lookup: (
    hostname: string,
    options: unknown,
    cb: (err: unknown, addr: unknown) => void,
  ) => void;
};
const agentConnects: AgentConnect[] = [];
vi.mock("undici", () => ({
  Agent: class {
    constructor(opts: { connect?: AgentConnect }) {
      agentConnects.push(opts.connect as AgentConnect);
    }
    close() {
      return agentClose();
    }
  },
}));

import {
  isBlockedHostname,
  parseSafeUrl,
  resolveAndPin,
  safeFetch,
} from "@/lib/ssrf";

const PUBLIC = [{ address: "93.184.216.34", family: 4 }];
const PRIVATE = [{ address: "169.254.169.254", family: 4 }];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  lookupMock.mockReset();
  agentClose.mockClear();
  agentConnects.length = 0;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// --- isBlockedHostname (literal checks, unchanged behavior) -----------------
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
    "[::ffff:169.254.169.254]",
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
    "93.184.216.34",
  ])("allows %s", (host) => {
    expect(isBlockedHostname(host)).toBe(false);
  });
});

// --- parseSafeUrl (sync, literal-only — unchanged contract) ----------------
describe("parseSafeUrl", () => {
  it("returns URL for valid https/http without resolving DNS", () => {
    const u = parseSafeUrl("https://example.com/path");
    expect(u).not.toBeNull();
    expect(u?.hostname).toBe("example.com");
    expect(parseSafeUrl("http://example.com")).not.toBeNull();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("rejects non-http protocols and invalid URLs", () => {
    expect(parseSafeUrl("ftp://example.com")).toBeNull();
    expect(parseSafeUrl("file:///etc/passwd")).toBeNull();
    expect(parseSafeUrl("javascript:alert(1)")).toBeNull();
    expect(parseSafeUrl("not a url")).toBeNull();
    expect(parseSafeUrl("")).toBeNull();
  });

  it("rejects blocked literal hosts", () => {
    expect(parseSafeUrl("http://localhost")).toBeNull();
    expect(parseSafeUrl("http://127.0.0.1:8080")).toBeNull();
    expect(parseSafeUrl("http://169.254.169.254/latest/meta-data/")).toBeNull();
    expect(parseSafeUrl("https://192.168.1.1")).toBeNull();
  });
});

// --- resolveAndPin (resolves + pins, the DNS-rebinding gate) ----------------
describe("resolveAndPin", () => {
  it("rejects blocked literal hosts without resolving", async () => {
    const result = await resolveAndPin("http://169.254.169.254/");
    expect(result).toBeNull();
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("returns url + pinned addresses for a public host", async () => {
    lookupMock.mockResolvedValue(PUBLIC);
    const result = await resolveAndPin("https://example.com/path");
    expect(result).not.toBeNull();
    expect(result?.url.toString()).toBe("https://example.com/path");
    expect(result?.addresses).toEqual(PUBLIC);
  });

  it("rejects DNS-rebinding: public host that resolves to a private IP", async () => {
    // Hostname looks innocent and passes the literal check, but DNS hands
    // back the metadata IP — must be rejected BEFORE any connect.
    lookupMock.mockResolvedValue(PRIVATE);
    expect(await resolveAndPin("https://rebind.attacker.example/")).toBeNull();
  });

  it("rejects when ANY resolved address is private (mixed result)", async () => {
    lookupMock.mockResolvedValue([...PUBLIC, ...PRIVATE]);
    expect(await resolveAndPin("https://mixed.example/")).toBeNull();
  });

  it("rejects when DNS resolution fails or returns nothing", async () => {
    lookupMock.mockRejectedValueOnce(new Error("ENOTFOUND"));
    expect(await resolveAndPin("https://nope.example/")).toBeNull();
    lookupMock.mockResolvedValueOnce([]);
    expect(await resolveAndPin("https://empty.example/")).toBeNull();
  });
});

// --- safeFetch (pins connection, never re-resolves) ------------------------
describe("safeFetch", () => {
  it("throws on a rebinding host BEFORE issuing any fetch", async () => {
    lookupMock.mockResolvedValue(PRIVATE);
    await expect(safeFetch("https://rebind.attacker.example/")).rejects.toThrow(
      /SSRF validation/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches a public host with a pinned dispatcher and keeps the hostname", async () => {
    lookupMock.mockResolvedValue(PUBLIC);
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));

    const res = await safeFetch("https://example.com/data");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    // Host is NOT rewritten to the IP (SNI/Host integrity preserved).
    expect(calledUrl).toBe("https://example.com/data");
    expect(calledInit.redirect).toBe("manual");
    // A pinned undici Agent was passed as the dispatcher.
    expect(calledInit.dispatcher).toBeDefined();
    expect(agentConnects).toHaveLength(1);
    // Agent is closed afterwards (no socket-pool leak).
    expect(agentClose).toHaveBeenCalled();
  });

  it("pinned agent lookup hands back ONLY the validated address", async () => {
    lookupMock.mockResolvedValue(PUBLIC);
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
    await safeFetch("https://example.com/");

    const connect = agentConnects[0];
    const cb = vi.fn();
    connect.lookup("example.com", {}, cb);
    expect(cb).toHaveBeenCalledWith(null, [
      { address: "93.184.216.34", family: 4 },
    ]);
  });

  it("re-validates and re-pins on each redirect hop", async () => {
    lookupMock
      .mockResolvedValueOnce(PUBLIC) // initial validation
      .mockResolvedValueOnce(PUBLIC); // redirect target validation
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://second.example/next" },
        }),
      )
      .mockResolvedValueOnce(new Response("done", { status: 200 }));

    const res = await safeFetch("https://first.example/");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // One pinned agent per hop.
    expect(agentConnects).toHaveLength(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://second.example/next");
  });

  it("rejects a redirect to a host that rebinds to a private IP", async () => {
    lookupMock
      .mockResolvedValueOnce(PUBLIC) // initial ok
      .mockResolvedValueOnce(PRIVATE); // redirect target resolves private
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.example/" },
      }),
    );

    await expect(safeFetch("https://first.example/")).rejects.toThrow(
      /Redirect target failed SSRF validation/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enforces the redirect cap", async () => {
    lookupMock.mockResolvedValue(PUBLIC);
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://loop.example/again" },
      }),
    );
    await expect(
      safeFetch("https://loop.example/", undefined, 2),
    ).rejects.toThrow(/Too many redirects/);
  });
});
