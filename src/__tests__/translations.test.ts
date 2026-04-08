import { describe, it, expect } from "vitest";
import { translations } from "@/lib/translations";

// Helper: recursively collect all keys from a flat translation object
function getKeys(obj: Record<string, string>): string[] {
  return Object.keys(obj);
}

describe("Translations", () => {
  const enKeys = getKeys(translations.en);
  const deKeys = getKeys(translations.de);

  it("EN and DE have the same number of keys", () => {
    expect(enKeys.length).toBe(deKeys.length);
  });

  it("every EN key exists in DE", () => {
    const missingInDE = enKeys.filter(
      (key) => !(key in translations.de)
    );
    expect(missingInDE).toEqual([]);
  });

  it("every DE key exists in EN", () => {
    const missingInEN = deKeys.filter(
      (key) => !(key in translations.en)
    );
    expect(missingInEN).toEqual([]);
  });

  it("no EN values are empty strings", () => {
    const emptyEN = enKeys.filter(
      (key) => (translations.en[key as keyof typeof translations.en] as string) === ""
    );
    expect(emptyEN).toEqual([]);
  });

  it("no DE values are empty strings", () => {
    const emptyDE = deKeys.filter(
      (key) => (translations.de[key as keyof typeof translations.de] as string) === ""
    );
    expect(emptyDE).toEqual([]);
  });
});
