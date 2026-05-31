import OpenAI from "openai";

let _openai: OpenAI | null = null;

function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export type Platform = "linkedin" | "facebook" | "instagram" | "pinterest" | "twitter";
export type Tone = "professional" | "casual" | "inspirational" | "humorous" | "educational";

export interface GeneratePostInput {
  platform: Platform;
  topic: string;
  tone: Tone;
  language: string;
  brandVoice?: string;
  model?: string;
}

interface GeneratePostOutput {
  content: string;
  hashtags: string[];
  content_score?: number;
  score_reason?: string;
}

/**
 * Sanitize user input before including it in OpenAI prompts.
 * Strips common prompt injection patterns and limits length.
 */
export function sanitizeInput(input: string, maxLength = 1000): string {
  let sanitized = input.slice(0, maxLength);
  // Remove attempts to override system instructions
  sanitized = sanitized.replace(/\b(ignore|disregard|forget)\b.*\b(instructions?|above|previous|system)\b/gi, "[filtered]");
  sanitized = sanitized.replace(/\b(you are now|act as|pretend to be|new instructions?)\b/gi, "[filtered]");
  // Remove markdown/code block injection attempts
  sanitized = sanitized.replace(/```[\s\S]*?```/g, "[filtered]");
  // Remove excessive whitespace
  sanitized = sanitized.replace(/\s{3,}/g, " ").trim();
  return sanitized;
}

const platformRules: Record<Platform, string> = {
  linkedin: `LinkedIn post. Professional formatting with line breaks for readability. Max 3000 characters. 3-5 relevant hashtags at the end. Use a hook in the first line.`,
  facebook: `Facebook post. Conversational, storytelling style. Emojis allowed but not excessive. Up to 5 hashtags.`,
  instagram: `Instagram caption. Engaging, visual language. Use emojis naturally. 5-10 hashtags at the end, separated by a line break.`,
  pinterest: `Pinterest pin description. SEO-optimized with keywords. Short, descriptive. 3-5 hashtags.`,
  twitter: `Tweet for X/Twitter. Max 280 characters including hashtags. Punchy, concise. 1-2 hashtags inline.`,
};

export async function generatePost(input: GeneratePostInput): Promise<GeneratePostOutput> {
  const openai = getOpenAI();

  const brandVoiceSection = input.brandVoice
    ? `\n\nBrand voice guidelines from the user:\n${sanitizeInput(input.brandVoice, 1000)}`
    : "";

  const response = await openai.chat.completions.create({
    model: input.model || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a social media content expert. Generate engaging posts for different platforms.

Rules for this post:
${platformRules[input.platform]}

Output language: ${input.language}
Tone: ${input.tone}${brandVoiceSection}

Respond in JSON format:
{
  "content": "the full post text (without hashtags)",
  "hashtags": ["hashtag1", "hashtag2", ...],
  "content_score": 8,
  "score_reason": "Brief explanation of the score"
}

content_score is a rating from 1-10 of the post quality based on engagement potential, clarity, and platform fit.

Make the content authentic, engaging, and platform-appropriate. Never use generic filler. Every post should provide value.`,
      },
      {
        role: "user",
        content: `Create a ${input.tone} ${input.platform} post about: ${sanitizeInput(input.topic)}`,
      },
    ],
    temperature: 0.8,
    max_tokens: 1000,
  });

  const raw = response.choices[0].message.content;
  if (!raw) throw new Error("Empty response from OpenAI");

  const parsed = JSON.parse(raw) as Partial<GeneratePostOutput>;
  return {
    content: parsed.content ?? "",
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    content_score: parsed.content_score,
    score_reason: parsed.score_reason,
  };
}

// --- Feature 1: AI Image Generation ---

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

export async function generateImage(
  prompt: string,
  size: ImageSize = "1024x1024",
): Promise<string> {
  const openai = getOpenAI();
  const safePrompt = `Create a social media visual for: ${sanitizeInput(prompt, 500)}. Professional, clean, modern design.`;

  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt: safePrompt,
    n: 1,
    size,
  });

  const item = response.data?.[0] as { url?: string; b64_json?: string } | undefined;
  if (item?.url) return item.url;
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  throw new Error("No image returned from OpenAI");
}

// --- Feature 5: Video Script Generator ---

export interface VideoScriptOutput {
  hook: string;
  scenes: Array<{
    sceneNumber: number;
    duration: string;
    visual: string;
    narration: string;
    textOverlay: string;
  }>;
  cta: string;
  totalDuration: string;
  musicSuggestion: string;
}

interface VideoScriptInput {
  topic: string;
  tone: Tone;
  language: string;
  platform: Platform;
  brandVoice?: string;
  model?: string;
}

export async function generateVideoScript(input: VideoScriptInput): Promise<VideoScriptOutput> {
  const openai = getOpenAI();

  const brandVoiceSection = input.brandVoice
    ? `\n\nBrand voice guidelines from the user:\n${sanitizeInput(input.brandVoice, 1000)}`
    : "";

  const response = await openai.chat.completions.create({
    model: input.model || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a video content expert. Create short-form video scripts for social media (Reels, TikTok, Shorts).

Output language: ${input.language}
Tone: ${input.tone}
Platform: ${input.platform}${brandVoiceSection}

Output JSON with this exact structure:
{
  "hook": "Opening hook (first 3 seconds)",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": "5 seconds",
      "visual": "What to show on screen",
      "narration": "What to say",
      "textOverlay": "On-screen text"
    }
  ],
  "cta": "Call to action",
  "totalDuration": "30 seconds",
  "musicSuggestion": "Upbeat lo-fi"
}

Create 3-6 scenes. Keep total duration between 15-60 seconds. Make it engaging and platform-appropriate.`,
      },
      {
        role: "user",
        content: `Create a ${input.tone} video script about: ${sanitizeInput(input.topic)}`,
      },
    ],
    temperature: 0.8,
    max_tokens: 1500,
  });

  const raw = response.choices[0].message.content;
  if (!raw) throw new Error("Empty response from OpenAI");

  return JSON.parse(raw) as VideoScriptOutput;
}

// --- Feature 6: Video Ad Storyboard ---

export interface VideoAdOutput {
  concept: string;
  frames: Array<{
    frameNumber: number;
    duration: string;
    background: string;
    headline: string;
    subtext: string;
    animation: string;
  }>;
  cta: string;
  targetAudience: string;
  adFormat: string;
}

interface VideoAdInput {
  topic: string;
  tone: Tone;
  language: string;
  product: string;
  brandVoice?: string;
  model?: string;
}

export async function generateVideoAd(input: VideoAdInput): Promise<VideoAdOutput> {
  const openai = getOpenAI();

  const brandVoiceSection = input.brandVoice
    ? `\n\nBrand voice guidelines from the user:\n${sanitizeInput(input.brandVoice, 1000)}`
    : "";

  const response = await openai.chat.completions.create({
    model: input.model || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a creative advertising expert specializing in video ads for social media.

Output language: ${input.language}
Tone: ${input.tone}
Product/Brand: ${input.product}${brandVoiceSection}

Output JSON with this exact structure:
{
  "concept": "Creative concept summary",
  "frames": [
    {
      "frameNumber": 1,
      "duration": "3 seconds",
      "background": "Visual description of the frame",
      "headline": "Main text on screen",
      "subtext": "Supporting text",
      "animation": "Suggested animation or transition"
    }
  ],
  "cta": "Call to action",
  "targetAudience": "Description of target audience",
  "adFormat": "Instagram Story"
}

Create 4-8 frames. Make the ad compelling, visually descriptive, and conversion-focused.`,
      },
      {
        role: "user",
        content: `Create a ${input.tone} video ad storyboard for "${sanitizeInput(input.product, 200)}" about: ${sanitizeInput(input.topic)}`,
      },
    ],
    temperature: 0.8,
    max_tokens: 1500,
  });

  const raw = response.choices[0].message.content;
  if (!raw) throw new Error("Empty response from OpenAI");

  return JSON.parse(raw) as VideoAdOutput;
}

// --- Feature 7: Carousel Generator ---

export interface CarouselOutput {
  title: string;
  slides: Array<{
    slideNumber: number;
    heading: string;
    body: string;
    visualSuggestion: string;
    speakerNotes: string;
  }>;
  hashtags: string[];
}

interface CarouselInput {
  topic: string;
  tone: Tone;
  language: string;
  platform: Platform;
  slideCount: number;
  brandVoice?: string;
  model?: string;
}

export async function generateCarousel(input: CarouselInput): Promise<CarouselOutput> {
  const openai = getOpenAI();

  const brandVoiceSection = input.brandVoice
    ? `\n\nBrand voice guidelines from the user:\n${sanitizeInput(input.brandVoice, 1000)}`
    : "";

  const response = await openai.chat.completions.create({
    model: input.model || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert at creating carousel/swipeable content for social media, especially LinkedIn and Instagram.

Output language: ${input.language}
Tone: ${input.tone}
Platform: ${input.platform}
Number of slides: ${input.slideCount}${brandVoiceSection}

Output JSON with this exact structure:
{
  "title": "Carousel title",
  "slides": [
    {
      "slideNumber": 1,
      "heading": "Slide heading",
      "body": "Slide body text (2-3 sentences max)",
      "visualSuggestion": "What visual/image to use",
      "speakerNotes": "Context for the creator"
    }
  ],
  "hashtags": ["hashtag1", "hashtag2"]
}

The first slide should be an attention-grabbing cover. The last slide should be a CTA. Middle slides should deliver value. Keep text concise — carousels are visual-first.`,
      },
      {
        role: "user",
        content: `Create a ${input.slideCount}-slide ${input.tone} carousel about: ${sanitizeInput(input.topic)}`,
      },
    ],
    temperature: 0.8,
    max_tokens: 2000,
  });

  const raw = response.choices[0].message.content;
  if (!raw) throw new Error("Empty response from OpenAI");

  return JSON.parse(raw) as CarouselOutput;
}

// --- Feature 8: A/B Variants ---

export interface PostVariant {
  variantLabel: string;
  content: string;
  hashtags: string[];
  approach: string;
}

interface VariantsInput {
  platform: Platform;
  topic: string;
  tone: Tone;
  language: string;
  count: number;
  brandVoice?: string;
  model?: string;
}

export async function generateVariants(input: VariantsInput): Promise<PostVariant[]> {
  const openai = getOpenAI();

  const brandVoiceSection = input.brandVoice
    ? `\n\nBrand voice guidelines from the user:\n${sanitizeInput(input.brandVoice, 1000)}`
    : "";

  const response = await openai.chat.completions.create({
    model: input.model || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Generate ${input.count} distinct variants of the same social media post, each with a different angle/approach.

Platform rules:
${platformRules[input.platform]}

Output language: ${input.language}
Tone: ${input.tone}${brandVoiceSection}

Output JSON with this exact structure:
{
  "variants": [
    {
      "variantLabel": "A",
      "content": "Full post text without hashtags",
      "hashtags": ["hashtag1", "hashtag2"],
      "approach": "Brief description of the angle taken"
    }
  ]
}

Each variant should be meaningfully different in approach (e.g., storytelling vs. data-driven, question-based vs. statement, emotional vs. logical). All variants should be high quality and platform-appropriate.`,
      },
      {
        role: "user",
        content: `Create ${input.count} ${input.tone} ${input.platform} post variants about: ${sanitizeInput(input.topic)}`,
      },
    ],
    temperature: 0.9,
    max_tokens: 2000,
  });

  const raw = response.choices[0].message.content;
  if (!raw) throw new Error("Empty response from OpenAI");

  const parsed = JSON.parse(raw) as { variants: PostVariant[] };
  return parsed.variants;
}
