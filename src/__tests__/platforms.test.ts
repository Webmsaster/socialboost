import { describe, it, expect } from "vitest";
import { platformConfigs } from "@/lib/platforms";
import { getPublisher, isPublishingSupported } from "@/lib/platforms/registry";

describe("platforms", () => {
  it("has configs for all 5 platforms", () => {
    expect(Object.keys(platformConfigs)).toHaveLength(5);
    expect(platformConfigs.linkedin).toBeDefined();
    expect(platformConfigs.facebook).toBeDefined();
    expect(platformConfigs.instagram).toBeDefined();
    expect(platformConfigs.pinterest).toBeDefined();
    expect(platformConfigs.twitter).toBeDefined();
  });

  it("each config has required fields", () => {
    for (const [, config] of Object.entries(platformConfigs)) {
      expect(config.name).toBeTruthy();
      expect(config.color).toBeTruthy();
      expect(config.clientIdEnv).toBeTruthy();
      expect(config.clientSecretEnv).toBeTruthy();
      expect(config.scopes).toBeTruthy();
    }
  });

  it("returns publisher for supported platforms", () => {
    expect(getPublisher("linkedin")).not.toBeNull();
    expect(getPublisher("twitter")).not.toBeNull();
    expect(getPublisher("facebook")).not.toBeNull();
    expect(getPublisher("instagram")).not.toBeNull();
    expect(getPublisher("pinterest")).not.toBeNull();
  });

  it("returns null for unknown platform", () => {
    expect(getPublisher("tiktok" as never)).toBeNull();
    expect(getPublisher("snapchat" as never)).toBeNull();
  });

  it("reports unknown platforms as not supported", () => {
    expect(isPublishingSupported("tiktok" as never)).toBe(false);
  });

  it("reports all platforms as supported", () => {
    expect(isPublishingSupported("linkedin")).toBe(true);
    expect(isPublishingSupported("twitter")).toBe(true);
    expect(isPublishingSupported("facebook")).toBe(true);
    expect(isPublishingSupported("instagram")).toBe(true);
    expect(isPublishingSupported("pinterest")).toBe(true);
  });

  it("platform names are human-readable", () => {
    expect(platformConfigs.linkedin.name).toBe("LinkedIn");
    expect(platformConfigs.twitter.name).toBe("Twitter / X");
    expect(platformConfigs.facebook.name).toBe("Facebook");
    expect(platformConfigs.instagram.name).toBe("Instagram");
    expect(platformConfigs.pinterest.name).toBe("Pinterest");
  });
});
