import { describe, it, expect } from "vitest";
import { validateTemplateInput } from "@/lib/validate-template";

const base = {
  name: "Weekly update",
  platform: "linkedin",
  tone: "professional",
  topic: "Share a productivity tip",
  language: "English",
};

describe("validateTemplateInput", () => {
  it("rejects non-object / null bodies", () => {
    expect(validateTemplateInput(null).ok).toBe(false);
    expect(validateTemplateInput("nope").ok).toBe(false);
    expect(validateTemplateInput(42).ok).toBe(false);
  });

  it("requires a non-empty name", () => {
    expect(validateTemplateInput({ ...base, name: "" }).ok).toBe(false);
    expect(validateTemplateInput({ ...base, name: "   " }).ok).toBe(false);
    const { name: _omit, ...noName } = base;
    void _omit;
    expect(validateTemplateInput(noName).ok).toBe(false);
  });

  it("enforces the 100-char name limit (boundary)", () => {
    expect(validateTemplateInput({ ...base, name: "a".repeat(100) }).ok).toBe(true);
    expect(validateTemplateInput({ ...base, name: "a".repeat(101) }).ok).toBe(false);
  });

  it("rejects platforms and tones outside the allow-list", () => {
    expect(validateTemplateInput({ ...base, platform: "myspace" }).ok).toBe(false);
    expect(validateTemplateInput({ ...base, tone: "sarcastic" }).ok).toBe(false);
  });

  it("rejects an empty topic but allows it to be omitted (defaults to '')", () => {
    expect(validateTemplateInput({ ...base, topic: "   " }).ok).toBe(false);
    expect(validateTemplateInput({ ...base, topic: "a".repeat(5001) }).ok).toBe(false);
    const { topic: _t, ...noTopic } = base;
    void _t;
    const res = validateTemplateInput(noTopic);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.topic).toBe("");
  });

  it("defaults language to English and rejects unknown languages", () => {
    const { language: _l, ...noLang } = base;
    void _l;
    const res = validateTemplateInput(noLang);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.language).toBe("English");

    expect(validateTemplateInput({ ...base, language: "Klingon" }).ok).toBe(false);
    expect(validateTemplateInput({ ...base, language: "de" }).ok).toBe(true);
    expect(validateTemplateInput({ ...base, language: "German" }).ok).toBe(true);
  });

  it("returns trimmed, normalized values on success", () => {
    const res = validateTemplateInput({
      ...base,
      name: "  My Template  ",
      topic: "  hello  ",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.name).toBe("My Template");
      expect(res.value.topic).toBe("hello");
      expect(res.value.platform).toBe("linkedin");
      expect(res.value.tone).toBe("professional");
    }
  });
});
