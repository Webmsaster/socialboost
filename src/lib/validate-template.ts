/**
 * Server-side validation for the templates create API payload.
 *
 * The templates table columns are: name, platform, tone, topic, language.
 * There is no separate "content" column — the template body is stored in `topic`.
 *
 * Allowed platform/tone values mirror the lists already used elsewhere in the
 * app (see src/lib/openai.ts Platform/Tone types and the previous inline
 * validPlatforms/validTones arrays in this route). Allowed languages are
 * derived from the app's supported locales (Language = "en" | "de" in
 * src/lib/translations.ts) plus the display names the existing UI/DB use
 * ("English" is the DB default), so existing payloads keep working.
 */

const NAME_MAX_LENGTH = 100;
const TOPIC_MAX_LENGTH = 5000;

export const VALID_PLATFORMS = [
  "linkedin",
  "facebook",
  "instagram",
  "pinterest",
  "twitter",
] as const;

export const VALID_TONES = [
  "professional",
  "casual",
  "inspirational",
  "humorous",
  "educational",
] as const;

// Allowed languages: the display names offered by the templates UI
// (src/app/(dashboard)/templates/page.tsx -> ["English","German","French","Spanish"]),
// plus the app locale codes ("en" | "de" from src/lib/i18n.tsx) and the German
// display variant "Deutsch", so existing UI payloads and the "English" DB
// default all keep working while arbitrary values are rejected.
export const VALID_LANGUAGES = [
  "English",
  "German",
  "French",
  "Spanish",
  "Deutsch",
  "en",
  "de",
] as const;

const DEFAULT_LANGUAGE = "English";

export type ValidPlatform = (typeof VALID_PLATFORMS)[number];
export type ValidTone = (typeof VALID_TONES)[number];

export interface TemplateInput {
  name: string;
  platform: ValidPlatform;
  tone: ValidTone;
  topic: string;
  language: string;
}

export type ValidationResult =
  | { ok: true; value: TemplateInput }
  | { ok: false; error: string };

/**
 * Validate and normalize an unknown request body for the templates create API.
 * Returns trimmed values on success, or a 400-ready error message.
 */
export function validateTemplateInput(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body" };
  }

  const { name, platform, tone, topic, language } = body as Record<
    string,
    unknown
  >;

  // name: required, trimmed, non-empty, max length
  if (typeof name !== "string" || name.trim().length === 0) {
    return {
      ok: false,
      error: "Missing required fields: name, platform, tone",
    };
  }
  const trimmedName = name.trim();
  if (trimmedName.length > NAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Name must be ${NAME_MAX_LENGTH} characters or fewer`,
    };
  }

  // platform / tone: required, restricted to known sets
  if (
    typeof platform !== "string" ||
    typeof tone !== "string" ||
    platform.length === 0 ||
    tone.length === 0
  ) {
    return {
      ok: false,
      error: "Missing required fields: name, platform, tone",
    };
  }
  if (!VALID_PLATFORMS.includes(platform as ValidPlatform)) {
    return { ok: false, error: "Invalid platform" };
  }
  if (!VALID_TONES.includes(tone as ValidTone)) {
    return { ok: false, error: "Invalid tone" };
  }

  // topic (template body): optional in the old route, but when provided it must
  // be a trimmed, non-empty string within the length limit. We keep the old
  // "default to empty string" behavior only when the field is omitted entirely.
  let normalizedTopic = "";
  if (topic !== undefined && topic !== null) {
    if (typeof topic !== "string") {
      return { ok: false, error: "Invalid topic" };
    }
    const trimmedTopic = topic.trim();
    if (trimmedTopic.length === 0) {
      return { ok: false, error: "Topic must not be empty" };
    }
    if (trimmedTopic.length > TOPIC_MAX_LENGTH) {
      return {
        ok: false,
        error: `Topic must be ${TOPIC_MAX_LENGTH} characters or fewer`,
      };
    }
    normalizedTopic = trimmedTopic;
  }

  // language: optional; defaults to "English". When provided, restrict to the
  // known set to prevent arbitrary values being stored.
  let normalizedLanguage = DEFAULT_LANGUAGE;
  if (language !== undefined && language !== null && language !== "") {
    if (
      typeof language !== "string" ||
      !VALID_LANGUAGES.includes(language as (typeof VALID_LANGUAGES)[number])
    ) {
      return {
        ok: false,
        error: `Invalid language. Allowed: ${VALID_LANGUAGES.join(", ")}`,
      };
    }
    normalizedLanguage = language;
  }

  return {
    ok: true,
    value: {
      name: trimmedName,
      platform: platform as ValidPlatform,
      tone: tone as ValidTone,
      topic: normalizedTopic,
      language: normalizedLanguage,
    },
  };
}
