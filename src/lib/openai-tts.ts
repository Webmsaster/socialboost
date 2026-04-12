import OpenAI from "openai";

let _client: OpenAI | null = null;
function getClient() {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export interface GenerateVoiceoverInput {
  text: string;
  voice?: TTSVoice;
}

/**
 * Generate MP3 voiceover audio for the given text via OpenAI TTS.
 * Returns the raw MP3 bytes.
 */
export async function generateVoiceover({
  text,
  voice = "nova",
}: GenerateVoiceoverInput): Promise<Uint8Array> {
  if (!text.trim()) throw new Error("Empty text");
  if (text.length > 4000) throw new Error("Text too long (max 4000 chars)");

  const client = getClient();
  const res = await client.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice,
    input: text,
    response_format: "mp3",
  });

  const buf = Buffer.from(await res.arrayBuffer());
  return new Uint8Array(buf);
}
