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

// Concrete length targets per platform — these match content-score.ts' ideal
// values, so the deterministic scorer and the generation prompt agree on what
// "right length" means.
const platformRules: Record<Platform, string> = {
  linkedin: `LinkedIn post. Target 800-1300 characters (the engagement sweet spot — never over 3000). Open with a one-line hook on its own line, then a short paragraph, then 2-4 short paragraphs with single-line breaks between them. End with exactly 3-5 specific hashtags on their own line.`,
  facebook: `Facebook post. Target 300-500 characters. Conversational, story-driven. Open with a hook line. Up to 5 hashtags at the end. Light emoji use only.`,
  instagram: `Instagram caption. Target 800-1200 characters. Visual, sensory language. Use emojis naturally inline. Put 5-12 specific hashtags on a separate line break at the end.`,
  pinterest: `Pinterest pin description. Target 150-300 characters. SEO-keyword-rich, descriptive, action-oriented. 3-5 hashtags at the end.`,
  twitter: `Tweet for X/Twitter. Target 120-220 characters total (must include hashtags). Punchy single thought. 1-2 hashtags inline, not at the end. Never use multi-paragraph structure.`,
};

// Phrases that scream "I was written by ChatGPT". Injected into every
// generation system-prompt as an anti-pattern list so the model stops
// reaching for the most overused AI-tells.
//
// Keep this list short and concrete — fluffy guidance ("don't sound generic")
// is ignored, specific phrase bans actually work.
const STYLE_GUARDS = `STRICT STYLE RULES — these matter more than anything else:

1. NEVER use these AI-tell phrases or any close variants: "unlock", "leverage", "harness", "dive into", "embrace", "embark on", "pave the way", "elevate", "unprecedented", "empower", "navigate the landscape", "in today's fast-paced world", "game-changer", "revolutionize", "in conclusion", "delve into", "tapestry", "realm", "robust", "ever-evolving", "transformative", "synergy", "seamless", "cutting-edge".

2. NEVER end with generic CTAs like "What do you think?", "Let me know your thoughts", "Share your experience", "Stay tuned", or "What's your take?". If you write a CTA, it must be specific to the topic.

3. NEVER open with "As we" / "In a world where" / "Have you ever wondered" / "Did you know that".

4. NEVER use em-dashes for dramatic pauses (typical AI rhythm). Use plain periods.

5. Use concrete numbers, named tools, specific examples — not abstractions. "Stripe handles refunds in 3 clicks" beats "modern payment platforms streamline the experience".

6. Write like a human who has lived the thing. Opinions, contrarian takes, and small admissions of uncertainty land better than balanced corporate prose.`;

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

${STYLE_GUARDS}

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

// --- Cross-platform repurpose ---
// Different from generatePost: this REWRITES an existing post for a new
// platform while preserving the user's actual writing. We were previously
// just calling generatePost with a "Adapt the following…" topic, which
// produced shiny new corporate prose that threw away whatever voice the
// user had in the original. The trick is the system prompt has to be
// adapt-mode, not generate-mode.

export interface RepurposeInput {
  original: string; // the user's existing post
  sourcePlatform: Platform;
  targetPlatform: Platform;
  language: string;
  brandVoice?: string;
  model?: string;
}

export async function repurposePost(
  input: RepurposeInput,
): Promise<GeneratePostOutput> {
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
        content: `You are adapting an existing social media post for a different platform. This is REWRITE mode, not GENERATE mode — the user wrote something they liked, your job is to keep their voice and only change what the new platform demands.

${STYLE_GUARDS}

PRESERVATION RULES — these matter most:
- Keep the user's sentence patterns, vocabulary, and tone. If they write short punchy sentences, you write short punchy sentences. If they have a signature phrase, keep it.
- Keep the same core argument and any concrete numbers, named tools, or examples from the original.
- Do NOT introduce new claims, statistics, or anecdotes that weren't in the original.
- Do NOT make it more "professional" or "polished" — leave the rough edges alone, that's the voice.

ADAPT only what the platform demands:
- Adjust length to fit the new platform's range (see rules below).
- Reformat for the platform (line breaks, paragraph structure, emoji density).
- Generate platform-appropriate hashtags (the original's hashtags may or may not fit).
- If the original has hashtags inline, separate them out into the hashtags array.

Source platform: ${input.sourcePlatform}
Target platform rules:
${platformRules[input.targetPlatform]}

Output language: ${input.language}${brandVoiceSection}

Respond in JSON format:
{
  "content": "the rewritten post for the new platform (without hashtags)",
  "hashtags": ["hashtag1", "hashtag2"]
}`,
      },
      {
        role: "user",
        content: `Here is my original ${input.sourcePlatform} post. Rewrite it for ${input.targetPlatform}, keeping my voice:\n\n${sanitizeInput(input.original, 5000)}`,
      },
    ],
    temperature: 0.6,
    max_tokens: 1500,
  });

  const raw = response.choices[0].message.content;
  if (!raw) throw new Error("Empty response from OpenAI");

  const parsed = JSON.parse(raw) as Partial<GeneratePostOutput>;
  return {
    content: parsed.content ?? "",
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
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

${STYLE_GUARDS}

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

${STYLE_GUARDS}

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

${STYLE_GUARDS}

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
        content: `Generate ${input.count} STRUCTURALLY DIFFERENT variants of the same social media post. The point is to give the user real choice, not three rewordings of the same draft.

${STYLE_GUARDS}

Platform rules:
${platformRules[input.platform]}

Output language: ${input.language}
Tone: ${input.tone}${brandVoiceSection}

VARIANT DIVERSITY RULES (this is the most important constraint):
- Pick a different "angle" from the list below for EACH variant. No two variants may share an angle.
- The first sentence of every variant must use a different opening device — never start two variants with the same word, never two with a question, never two with a statistic.
- The angles available (use any ${input.count} of these, one per variant):
  1. **Personal story** — open with a first-person anecdote or lived moment, then draw the lesson.
  2. **Data point** — open with a specific, concrete statistic or number (real or clearly framed as illustrative), then explain its implication.
  3. **Contrarian hot take** — open by stating something most people in the niche believe is wrong. Defend it.
  4. **How-to** — open with the problem, then 3 short numbered steps. No filler.
  5. **Surprising fact / counter-intuitive** — open with something that sounds wrong but isn't, then explain why.
  6. **Direct question hook** — open with a one-line question the reader can't help but answer in their head. (Use at most once.)
  7. **Case study** — open by naming a specific company/person/tool and what they did concretely.

Output JSON with this exact structure:
{
  "variants": [
    {
      "variantLabel": "A",
      "content": "Full post text without hashtags",
      "hashtags": ["hashtag1", "hashtag2"],
      "approach": "Name the angle you used (must match one from the list above)"
    }
  ]
}

If two variants come out too similar, rewrite one of them from a different angle before finalizing.`,
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

// --- Feature 7: Brand Voice Analyzer ---
// Extract a structured style profile from a user's existing posts, so we can
// inject "write like THIS person" guidance into every subsequent generation
// instead of relying on the user to describe their own voice manually.

export interface BrandVoiceProfile {
  summary: string; // one-paragraph description, the thing we feed back into prompts
  toneTags: string[]; // e.g. ["witty", "story-driven", "no-nonsense"]
  vocabulary: string[]; // signature words / phrases the user uses
  hookStyle: string; // "opens with a question", "bold statement", "personal story"
  ctaStyle: string; // how they end posts
  emojiUsage: "none" | "sparse" | "heavy";
  sentenceLength: "short" | "medium" | "long" | "mixed";
}

export interface AnalyzeBrandVoiceInput {
  examples: string[]; // 1-20 example post texts
  model?: string;
}

export async function analyzeBrandVoice(
  input: AnalyzeBrandVoiceInput,
): Promise<BrandVoiceProfile> {
  if (!Array.isArray(input.examples) || input.examples.length === 0) {
    throw new Error("At least one example post is required");
  }

  const openai = getOpenAI();
  const numbered = input.examples
    .slice(0, 20)
    .map((p, i) => `--- POST ${i + 1} ---\n${sanitizeInput(p, 2000)}`)
    .join("\n\n");

  const response = await openai.chat.completions.create({
    model: input.model || "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a brand-voice analyst. The user will paste in social media posts they have written. Your job is to extract a compact, faithful description of their writing style — so a future AI can imitate it.

Output JSON with this exact structure:
{
  "summary": "One paragraph (2-4 sentences) describing the writing voice. This is what will be fed back into future post generations as 'write in this voice'. Be specific and actionable. Avoid generic words like 'engaging' or 'authentic'.",
  "toneTags": ["3-6 short tags like 'witty', 'story-driven', 'data-led', 'contrarian'"],
  "vocabulary": ["5-10 signature words or short phrases the user actually uses repeatedly"],
  "hookStyle": "How they typically open posts (1 short sentence)",
  "ctaStyle": "How they typically end posts / call to action (1 short sentence)",
  "emojiUsage": "none | sparse | heavy",
  "sentenceLength": "short | medium | long | mixed"
}

Base every field on the actual posts. Do not invent. If the examples are inconsistent, summarize the dominant pattern.`,
      },
      {
        role: "user",
        content: `Here are my posts. Extract my brand voice:\n\n${numbered}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 700,
  });

  const raw = response.choices[0].message.content;
  if (!raw) throw new Error("Empty response from OpenAI");

  const parsed = JSON.parse(raw) as Partial<BrandVoiceProfile>;
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    toneTags: Array.isArray(parsed.toneTags) ? parsed.toneTags.slice(0, 8) : [],
    vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary.slice(0, 12) : [],
    hookStyle: typeof parsed.hookStyle === "string" ? parsed.hookStyle : "",
    ctaStyle: typeof parsed.ctaStyle === "string" ? parsed.ctaStyle : "",
    emojiUsage:
      parsed.emojiUsage === "none" || parsed.emojiUsage === "heavy"
        ? parsed.emojiUsage
        : "sparse",
    sentenceLength:
      parsed.sentenceLength === "short" ||
      parsed.sentenceLength === "long" ||
      parsed.sentenceLength === "mixed"
        ? parsed.sentenceLength
        : "medium",
  };
}

/**
 * Serializes a BrandVoiceProfile to a single text block suitable for the
 * `brand_voice` column. Keeps it short enough to fit through sanitizeInput's
 * 1000-char limit when it gets injected into prompts.
 */
export function brandVoiceProfileToText(profile: BrandVoiceProfile): string {
  const parts = [
    profile.summary,
    profile.toneTags.length ? `Tone: ${profile.toneTags.join(", ")}.` : "",
    profile.vocabulary.length
      ? `Signature phrases: ${profile.vocabulary.join(", ")}.`
      : "",
    profile.hookStyle ? `Hooks: ${profile.hookStyle}` : "",
    profile.ctaStyle ? `CTAs: ${profile.ctaStyle}` : "",
    `Emojis: ${profile.emojiUsage}. Sentence length: ${profile.sentenceLength}.`,
  ];
  return parts.filter(Boolean).join("\n").slice(0, 1000);
}

