import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
vi.mock("openai", () => {
  class MockOpenAI {
    chat = { completions: { create: mockCreate } };
    images = { generate: vi.fn() };
    audio = { speech: { create: vi.fn() } };
  }
  return { default: MockOpenAI };
});

describe("analyzeBrandVoice + brandVoiceProfileToText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("rejects when no examples are passed", async () => {
    const { analyzeBrandVoice } = await import("@/lib/openai");
    await expect(analyzeBrandVoice({ examples: [] })).rejects.toThrow(
      "At least one example post is required",
    );
  });

  it("returns a normalized profile with sane defaults when the model omits fields", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "Punchy first-person stories about solopreneur life.",
              toneTags: ["story-driven", "casual", "punchy"],
              vocabulary: ["solopreneur", "ship", "lean"],
              hookStyle: "Opens with a contrarian question.",
              ctaStyle: "Direct: 'DM me' or 'reply if you want X'.",
              emojiUsage: "sparse",
              sentenceLength: "short",
            }),
          },
        },
      ],
    });

    const { analyzeBrandVoice } = await import("@/lib/openai");
    const out = await analyzeBrandVoice({
      examples: ["Hello world. This is post one.", "Post two with another idea."],
    });

    expect(out.summary).toMatch(/solopreneur/);
    expect(out.toneTags).toContain("punchy");
    expect(out.emojiUsage).toBe("sparse");
    expect(out.sentenceLength).toBe("short");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      response_format: { type: "json_object" },
    });
  });

  it("falls back to defaults for unrecognized enum values", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "Generic voice",
              toneTags: null,
              vocabulary: null,
              hookStyle: null,
              ctaStyle: null,
              emojiUsage: "lots",
              sentenceLength: "epic",
            }),
          },
        },
      ],
    });
    const { analyzeBrandVoice } = await import("@/lib/openai");
    const out = await analyzeBrandVoice({ examples: ["one post"] });
    expect(out.toneTags).toEqual([]);
    expect(out.vocabulary).toEqual([]);
    expect(out.hookStyle).toBe("");
    expect(out.emojiUsage).toBe("sparse"); // default fallback
    expect(out.sentenceLength).toBe("medium"); // default fallback
  });

  it("brandVoiceProfileToText stays under 1000 chars and includes the summary", async () => {
    const { brandVoiceProfileToText } = await import("@/lib/openai");
    const text = brandVoiceProfileToText({
      summary: "Test voice summary.",
      toneTags: ["a", "b"],
      vocabulary: ["x", "y"],
      hookStyle: "Question hook.",
      ctaStyle: "Direct CTA.",
      emojiUsage: "sparse",
      sentenceLength: "short",
    });
    expect(text).toContain("Test voice summary.");
    expect(text).toContain("Tone: a, b.");
    expect(text.length).toBeLessThanOrEqual(1000);
  });
});
