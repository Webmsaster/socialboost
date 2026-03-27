import { describe, it, expect } from "vitest";
import { optimalPostingTimes } from "@/lib/optimal-times";

describe("optimalPostingTimes", () => {
  it("has data for all 5 platforms", () => {
    expect(optimalPostingTimes.linkedin).toBeDefined();
    expect(optimalPostingTimes.facebook).toBeDefined();
    expect(optimalPostingTimes.instagram).toBeDefined();
    expect(optimalPostingTimes.twitter).toBeDefined();
    expect(optimalPostingTimes.pinterest).toBeDefined();
  });

  it("each entry has day, times, and engagement", () => {
    for (const [, times] of Object.entries(optimalPostingTimes)) {
      for (const entry of times) {
        expect(entry.day).toBeTruthy();
        expect(entry.times.length).toBeGreaterThan(0);
        expect(["high", "medium"]).toContain(entry.engagement);
      }
    }
  });

  it("times are in readable format", () => {
    for (const [, times] of Object.entries(optimalPostingTimes)) {
      for (const entry of times) {
        for (const time of entry.times) {
          // Should match pattern like "9:00 AM" or "12:00 PM"
          expect(time).toMatch(/^\d{1,2}:\d{2}\s(AM|PM)$/);
        }
      }
    }
  });

  it("days are valid weekday names", () => {
    const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for (const [, times] of Object.entries(optimalPostingTimes)) {
      for (const entry of times) {
        expect(validDays).toContain(entry.day);
      }
    }
  });

  it("each platform has at least 3 entries", () => {
    for (const [, times] of Object.entries(optimalPostingTimes)) {
      expect(times.length).toBeGreaterThanOrEqual(3);
    }
  });
});
