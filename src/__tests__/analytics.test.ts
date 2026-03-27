import { describe, it, expect, vi } from "vitest";
import { trackEvent } from "@/lib/analytics";

describe("trackEvent", () => {
  it("logs structured JSON event", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    trackEvent({ event: "test_event", userId: "user-1", properties: { platform: "linkedin" } });

    expect(spy).toHaveBeenCalledOnce();
    const logged = JSON.parse(spy.mock.calls[0][0]);
    expect(logged._analytics).toBe(true);
    expect(logged.event).toBe("test_event");
    expect(logged.userId).toBe("user-1");
    expect(logged.platform).toBe("linkedin");
    expect(logged.timestamp).toBeDefined();
    spy.mockRestore();
  });

  it("defaults userId to anonymous", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    trackEvent({ event: "anon_event" });

    const logged = JSON.parse(spy.mock.calls[0][0]);
    expect(logged.userId).toBe("anonymous");
    spy.mockRestore();
  });

  it("spreads properties into the log object", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    trackEvent({ event: "multi_props", properties: { count: 5, active: true } });

    const logged = JSON.parse(spy.mock.calls[0][0]);
    expect(logged.count).toBe(5);
    expect(logged.active).toBe(true);
    spy.mockRestore();
  });

  it("includes ISO timestamp", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    trackEvent({ event: "time_check" });

    const logged = JSON.parse(spy.mock.calls[0][0]);
    // Verify it's a valid ISO date string
    expect(new Date(logged.timestamp).toISOString()).toBe(logged.timestamp);
    spy.mockRestore();
  });
});
