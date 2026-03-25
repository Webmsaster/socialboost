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

interface GeneratePostInput {
  platform: Platform;
  topic: string;
  tone: Tone;
  language: string;
}

interface GeneratePostOutput {
  content: string;
  hashtags: string[];
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

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a social media content expert. Generate engaging posts for different platforms.

Rules for this post:
${platformRules[input.platform]}

Output language: ${input.language}
Tone: ${input.tone}

Respond in JSON format:
{
  "content": "the full post text (without hashtags)",
  "hashtags": ["hashtag1", "hashtag2", ...]
}

Make the content authentic, engaging, and platform-appropriate. Never use generic filler. Every post should provide value.`,
      },
      {
        role: "user",
        content: `Create a ${input.tone} ${input.platform} post about: ${input.topic}`,
      },
    ],
    temperature: 0.8,
    max_tokens: 1000,
  });

  const raw = response.choices[0].message.content;
  if (!raw) throw new Error("Empty response from OpenAI");

  const parsed = JSON.parse(raw) as GeneratePostOutput;
  return parsed;
}
