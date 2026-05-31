import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock functions placed at module scope so the factory can reference them
const mockChatCreate = vi.fn();
const mockImagesGenerate = vi.fn();

vi.mock("openai", () => {
  // Return a class so `new OpenAI(...)` works
  class MockOpenAI {
    chat = {
      completions: {
        create: mockChatCreate,
      },
    };
    images = {
      generate: mockImagesGenerate,
    };
  }
  return { default: MockOpenAI };
});

// Helper to build a chat completion response
function chatResponse(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

describe("OpenAI lib", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the cached _openai singleton between tests
    vi.resetModules();
    process.env.OPENAI_API_KEY = "test-key";
  });

  // ---------- getOpenAI branch ----------
  describe("getOpenAI", () => {
    it("throws when OPENAI_API_KEY is not set", async () => {
      vi.resetModules();
      delete process.env.OPENAI_API_KEY;
      const { generatePost } = await import("@/lib/openai");

      await expect(
        generatePost({
          platform: "linkedin",
          topic: "test",
          tone: "professional",
          language: "English",
        })
      ).rejects.toThrow("OPENAI_API_KEY is not configured");
    });
  });

  // ---------- getOpenAI singleton ----------
  describe("getOpenAI singleton", () => {
    it("reuses the OpenAI instance on second call (cached branch)", async () => {
      const { generatePost } = await import("@/lib/openai");

      mockChatCreate.mockResolvedValue(
        chatResponse(JSON.stringify({ content: "x", hashtags: [] }))
      );

      // First call creates the OpenAI instance
      await generatePost({ platform: "linkedin", topic: "a", tone: "casual", language: "English" });
      // Second call reuses cached instance (hits !_openai false branch)
      await generatePost({ platform: "twitter", topic: "b", tone: "casual", language: "English" });

      expect(mockChatCreate).toHaveBeenCalledTimes(2);
    });
  });

  // ---------- generatePost ----------
  describe("generatePost", () => {
    it("returns content and hashtags", async () => {
      const { generatePost } = await import("@/lib/openai");

      const expected = {
        content: "Great post about AI",
        hashtags: ["#AI", "#Tech"],
      };
      mockChatCreate.mockResolvedValueOnce(
        chatResponse(JSON.stringify(expected))
      );

      const result = await generatePost({
        platform: "linkedin",
        topic: "AI trends",
        tone: "professional",
        language: "English",
      });

      expect(result).toEqual(expected);
      expect(mockChatCreate).toHaveBeenCalledOnce();
    });

    it("throws on empty response", async () => {
      const { generatePost } = await import("@/lib/openai");

      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(
        generatePost({
          platform: "twitter",
          topic: "test",
          tone: "casual",
          language: "English",
        })
      ).rejects.toThrow("Empty response from OpenAI");
    });

    it("includes brandVoice and custom model when provided", async () => {
      const { generatePost } = await import("@/lib/openai");

      mockChatCreate.mockResolvedValueOnce(
        chatResponse(JSON.stringify({ content: "x", hashtags: [] }))
      );

      await generatePost({
        platform: "linkedin",
        topic: "test",
        tone: "professional",
        language: "English",
        brandVoice: "Friendly and approachable",
        model: "gpt-4o",
      });

      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-4o" })
      );
      const systemMsg = mockChatCreate.mock.calls[0][0].messages[0].content;
      expect(systemMsg).toContain("Brand voice guidelines");
      expect(systemMsg).toContain("Friendly and approachable");
    });

    it("passes correct model and response_format", async () => {
      const { generatePost } = await import("@/lib/openai");

      mockChatCreate.mockResolvedValueOnce(
        chatResponse(JSON.stringify({ content: "x", hashtags: [] }))
      );

      await generatePost({
        platform: "instagram",
        topic: "food",
        tone: "humorous",
        language: "German",
      });

      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
        })
      );
    });
  });

  // ---------- generateImage ----------
  describe("generateImage", () => {
    it("returns image URL when provider sends one", async () => {
      const { generateImage } = await import("@/lib/openai");

      const url = "https://example.com/image.png";
      mockImagesGenerate.mockResolvedValueOnce({
        data: [{ url }],
      });

      const result = await generateImage("a sunset");
      expect(result).toBe(url);
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gpt-image-1",
          n: 1,
          size: "1024x1024",
        })
      );
    });

    it("returns data URL when provider sends b64_json", async () => {
      const { generateImage } = await import("@/lib/openai");

      const b64 = "aGVsbG8="; // "hello"
      mockImagesGenerate.mockResolvedValueOnce({
        data: [{ b64_json: b64 }],
      });

      const result = await generateImage("a sunset");
      expect(result).toBe(`data:image/png;base64,${b64}`);
    });

    it("throws when no image is returned", async () => {
      const { generateImage } = await import("@/lib/openai");

      mockImagesGenerate.mockResolvedValueOnce({ data: [] });

      await expect(generateImage("broken prompt")).rejects.toThrow(
        "No image returned from OpenAI"
      );
    });

    it("forwards the size override to OpenAI", async () => {
      const { generateImage } = await import("@/lib/openai");

      mockImagesGenerate.mockResolvedValueOnce({
        data: [{ url: "https://example.com/portrait.png" }],
      });

      await generateImage("a vertical scene", "1024x1536");
      expect(mockImagesGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ size: "1024x1536" })
      );
    });
  });

  // ---------- generateVideoScript ----------
  describe("generateVideoScript", () => {
    it("returns a valid video script structure", async () => {
      const { generateVideoScript } = await import("@/lib/openai");
      type VideoScriptOutput = Awaited<ReturnType<typeof generateVideoScript>>;

      const expected: VideoScriptOutput = {
        hook: "Did you know?",
        scenes: [
          {
            sceneNumber: 1,
            duration: "5 seconds",
            visual: "Person typing",
            narration: "Hello world",
            textOverlay: "Welcome",
          },
        ],
        cta: "Follow for more",
        totalDuration: "30 seconds",
        musicSuggestion: "Upbeat lo-fi",
      };
      mockChatCreate.mockResolvedValueOnce(
        chatResponse(JSON.stringify(expected))
      );

      const result = await generateVideoScript({
        topic: "coding tips",
        tone: "educational",
        language: "English",
        platform: "instagram",
      });

      expect(result).toEqual(expected);
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0].sceneNumber).toBe(1);
    });

    it("throws on empty response", async () => {
      const { generateVideoScript } = await import("@/lib/openai");

      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(
        generateVideoScript({
          topic: "test",
          tone: "casual",
          language: "English",
          platform: "twitter",
        })
      ).rejects.toThrow("Empty response from OpenAI");
    });

    it("includes brandVoice and custom model when provided", async () => {
      const { generateVideoScript } = await import("@/lib/openai");
      mockChatCreate.mockResolvedValueOnce(
        chatResponse(JSON.stringify({ hook: "h", scenes: [], cta: "c", totalDuration: "30s", musicSuggestion: "lo-fi" }))
      );

      await generateVideoScript({
        topic: "test",
        tone: "professional",
        language: "English",
        platform: "instagram",
        brandVoice: "Bold and direct",
        model: "gpt-4o",
      });

      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-4o" })
      );
      const systemMsg = mockChatCreate.mock.calls[0][0].messages[0].content;
      expect(systemMsg).toContain("Brand voice guidelines");
    });
  });

  // ---------- generateVideoAd ----------
  describe("generateVideoAd", () => {
    it("returns a valid video ad structure", async () => {
      const { generateVideoAd } = await import("@/lib/openai");
      type VideoAdOutput = Awaited<ReturnType<typeof generateVideoAd>>;

      const expected: VideoAdOutput = {
        concept: "Bold product showcase",
        frames: [
          {
            frameNumber: 1,
            duration: "3 seconds",
            background: "Gradient blue",
            headline: "Introducing X",
            subtext: "The future is here",
            animation: "Fade in",
          },
        ],
        cta: "Shop now",
        targetAudience: "Tech enthusiasts 25-35",
        adFormat: "Instagram Story",
      };
      mockChatCreate.mockResolvedValueOnce(
        chatResponse(JSON.stringify(expected))
      );

      const result = await generateVideoAd({
        topic: "product launch",
        tone: "professional",
        language: "English",
        product: "TechGadget Pro",
      });

      expect(result).toEqual(expected);
      expect(result.frames).toHaveLength(1);
      expect(result.frames[0].frameNumber).toBe(1);
    });

    it("throws on empty response", async () => {
      const { generateVideoAd } = await import("@/lib/openai");

      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(
        generateVideoAd({
          topic: "test",
          tone: "casual",
          language: "English",
          product: "TestProduct",
        })
      ).rejects.toThrow("Empty response from OpenAI");
    });

    it("includes brandVoice and custom model when provided", async () => {
      const { generateVideoAd } = await import("@/lib/openai");
      mockChatCreate.mockResolvedValueOnce(
        chatResponse(JSON.stringify({ concept: "c", frames: [], cta: "c", targetAudience: "t", adFormat: "Story" }))
      );

      await generateVideoAd({
        topic: "test",
        tone: "professional",
        language: "English",
        product: "TechGadget",
        brandVoice: "Innovative and futuristic",
        model: "gpt-4o",
      });

      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-4o" })
      );
      const systemMsg = mockChatCreate.mock.calls[0][0].messages[0].content;
      expect(systemMsg).toContain("Brand voice guidelines");
    });
  });

  // ---------- generateCarousel ----------
  describe("generateCarousel", () => {
    it("returns title, slides, and hashtags", async () => {
      const { generateCarousel } = await import("@/lib/openai");
      type CarouselOutput = Awaited<ReturnType<typeof generateCarousel>>;

      const expected: CarouselOutput = {
        title: "5 Tips for Productivity",
        slides: [
          {
            slideNumber: 1,
            heading: "Start Early",
            body: "Wake up at 6 AM.",
            visualSuggestion: "Sunrise photo",
            speakerNotes: "Emphasize morning routines",
          },
        ],
        hashtags: ["#productivity", "#tips"],
      };
      mockChatCreate.mockResolvedValueOnce(
        chatResponse(JSON.stringify(expected))
      );

      const result = await generateCarousel({
        topic: "productivity",
        tone: "educational",
        language: "English",
        platform: "linkedin",
        slideCount: 5,
      });

      expect(result).toEqual(expected);
      expect(result.slides).toHaveLength(1);
      expect(result.hashtags).toContain("#productivity");
    });

    it("throws on empty response", async () => {
      const { generateCarousel } = await import("@/lib/openai");

      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(
        generateCarousel({
          topic: "test",
          tone: "casual",
          language: "English",
          platform: "instagram",
          slideCount: 3,
        })
      ).rejects.toThrow("Empty response from OpenAI");
    });

    it("includes brandVoice and custom model when provided", async () => {
      const { generateCarousel } = await import("@/lib/openai");
      mockChatCreate.mockResolvedValueOnce(
        chatResponse(JSON.stringify({ title: "t", slides: [], hashtags: [] }))
      );

      await generateCarousel({
        topic: "test",
        tone: "professional",
        language: "English",
        platform: "linkedin",
        slideCount: 5,
        brandVoice: "Corporate and polished",
        model: "gpt-4o",
      });

      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-4o" })
      );
      const systemMsg = mockChatCreate.mock.calls[0][0].messages[0].content;
      expect(systemMsg).toContain("Brand voice guidelines");
    });
  });

  // ---------- generateVariants ----------
  describe("generateVariants", () => {
    it("returns an array of PostVariant objects", async () => {
      const { generateVariants } = await import("@/lib/openai");
      type PostVariant = Awaited<ReturnType<typeof generateVariants>>[number];

      const variants: PostVariant[] = [
        {
          variantLabel: "A",
          content: "Story-driven post about AI",
          hashtags: ["#AI"],
          approach: "Storytelling",
        },
        {
          variantLabel: "B",
          content: "Data-driven post about AI",
          hashtags: ["#AI", "#Data"],
          approach: "Data-driven",
        },
      ];
      mockChatCreate.mockResolvedValueOnce(
        chatResponse(JSON.stringify({ variants }))
      );

      const result = await generateVariants({
        platform: "linkedin",
        topic: "AI",
        tone: "professional",
        language: "English",
        count: 2,
      });

      expect(result).toEqual(variants);
      expect(result).toHaveLength(2);
      expect(result[0].variantLabel).toBe("A");
      expect(result[1].approach).toBe("Data-driven");
    });

    it("throws on empty response", async () => {
      const { generateVariants } = await import("@/lib/openai");

      mockChatCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      await expect(
        generateVariants({
          platform: "twitter",
          topic: "test",
          tone: "casual",
          language: "English",
          count: 2,
        })
      ).rejects.toThrow("Empty response from OpenAI");
    });

    it("includes brandVoice and custom model when provided", async () => {
      const { generateVariants } = await import("@/lib/openai");
      mockChatCreate.mockResolvedValueOnce(
        chatResponse(JSON.stringify({ variants: [{ variantLabel: "A", content: "x", hashtags: [], approach: "a" }] }))
      );

      await generateVariants({
        platform: "linkedin",
        topic: "test",
        tone: "professional",
        language: "English",
        count: 2,
        brandVoice: "Warm and personal",
        model: "gpt-4o",
      });

      expect(mockChatCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-4o" })
      );
      const systemMsg = mockChatCreate.mock.calls[0][0].messages[0].content;
      expect(systemMsg).toContain("Brand voice guidelines");
    });
  });
});
