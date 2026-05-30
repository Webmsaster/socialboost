/**
 * Shared enums used for request validation across API routes (templates, etc.).
 *
 * These mirror the canonical values used by /api/generate and PLATFORM_RULES in
 * openai.ts — keep them in sync if a platform/tone is ever added or removed.
 */

export const PLATFORMS = [
  "linkedin",
  "facebook",
  "instagram",
  "pinterest",
  "twitter",
] as const;

export const TONES = [
  "professional",
  "casual",
  "friendly",
  "humorous",
  "inspirational",
] as const;

export const LANGUAGES = ["en", "de"] as const;

export type Platform = (typeof PLATFORMS)[number];
export type Tone = (typeof TONES)[number];
export type Language = (typeof LANGUAGES)[number];
