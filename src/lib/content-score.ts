/**
 * Deterministic content scorer used by both /api/score (live feedback in the
 * Create UI) and the series-runner cron (so scheduled posts end up with the
 * same 0–100 number in the `posts.content_score` column).
 *
 * Why: previously /api/score computed 0–100 inline, while series-runner
 * stored OpenAI's self-rated 1–10 score multiplied by 10. Different units
 * sneaking into the same column made the analytics dashboard incoherent.
 */

export type ScoredPlatform =
  | "linkedin"
  | "facebook"
  | "instagram"
  | "pinterest"
  | "twitter";

interface PlatformLimit {
  ideal: number;
  max: number;
}

const PLATFORM_LIMITS: Record<string, PlatformLimit> = {
  twitter: { ideal: 200, max: 280 },
  linkedin: { ideal: 1300, max: 3000 },
  facebook: { ideal: 400, max: 2000 },
  instagram: { ideal: 1000, max: 2200 },
  pinterest: { ideal: 200, max: 500 },
};

export interface ContentScoreResult {
  score: number; // clamped 10–100
  tips: string[];
  metrics: {
    length: number;
    idealLength: number;
    maxLength: number;
    hashtagCount: number;
  };
}

export interface ScoreContentInput {
  content: string;
  platform: string;
  hashtags?: string[];
}

// --- Concrete AI-cliché detection ---
// The general STYLE_GUARDS prompt asks the model to avoid these, but it
// doesn't always comply. When a slip-through lands in the user's draft, it's
// far more useful to tell them WHICH word to fix and what to replace it
// with than a vague "make it less generic".
const CLICHE_REPLACEMENTS: Record<string, string> = {
  leverage: "use",
  harness: "use",
  unlock: "open up",
  "dive into": "look at",
  "embark on": "start",
  embrace: "adopt",
  elevate: "improve",
  empower: "help",
  unprecedented: "unique",
  "pave the way": "set up",
  "game-changer": "shift",
  "game changer": "shift",
  revolutionize: "change",
  "delve into": "explore",
  tapestry: "mix",
  realm: "area",
  robust: "solid",
  "ever-evolving": "changing",
  transformative: "useful",
  synergy: "fit",
  seamless: "smooth",
  "cutting-edge": "new",
  "in today's fast-paced world": "today",
};

// Escape regex metacharacters so phrases are matched literally. Note: '-' is a
// literal outside a character class, so it is intentionally NOT escaped —
// phrases like "game-changer" still match.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Precompile word-boundary regexes once at module scope. Using \b...\b avoids
// substring false positives (e.g. "elevate" inside "elevated", "transform"
// inside "transformation").
const CLICHE_PATTERNS: { phrase: string; regex: RegExp }[] = Object.keys(
  CLICHE_REPLACEMENTS,
).map((phrase) => ({
  phrase,
  regex: new RegExp("\\b" + escapeRegExp(phrase) + "\\b", "i"),
}));

export function scoreContent({
  content,
  platform,
  hashtags,
}: ScoreContentInput): ContentScoreResult {
  const limits = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.facebook;
  const contentLength = content.length;
  const hashtagCount = (hashtags || []).length;
  const tips: string[] = [];
  let score = 70;

  if (contentLength < 50) {
    score -= 20;
    tips.push("Your post is very short. Add more context to increase engagement.");
  } else if (contentLength <= limits.ideal) {
    score += 10;
  } else if (contentLength <= limits.max) {
    score += 5;
  } else {
    score -= 15;
    tips.push(
      `Post exceeds ${platform}'s ${limits.max} character limit. Consider shortening.`,
    );
  }

  if (platform === "instagram") {
    if (hashtagCount >= 5 && hashtagCount <= 15) score += 10;
    else if (hashtagCount < 3) {
      score -= 5;
      tips.push("Instagram posts perform better with 5-15 relevant hashtags.");
    } else if (hashtagCount > 20) {
      score -= 5;
      tips.push("Too many hashtags can look spammy. Aim for 5-15.");
    }
  } else if (platform === "linkedin") {
    if (hashtagCount >= 3 && hashtagCount <= 5) score += 5;
    else if (hashtagCount > 10) {
      score -= 5;
      tips.push("LinkedIn works best with 3-5 targeted hashtags.");
    }
  } else if (platform === "twitter") {
    if (hashtagCount >= 1 && hashtagCount <= 3) score += 5;
    else if (hashtagCount > 5) {
      score -= 5;
      tips.push("Keep Twitter hashtags to 1-3 for best engagement.");
    }
  }

  const firstLine = content.split("\n")[0];
  if (firstLine.endsWith("?") || firstLine.startsWith("Did you know")) {
    score += 5;
  } else if (firstLine.length < 20) {
    tips.push(
      "Start with a strong hook — a question or bold statement gets more clicks.",
    );
  }

  const ctaPatterns =
    /click|link|comment|share|follow|subscribe|sign up|check out|learn more|read more|dm me|let me know/i;
  if (ctaPatterns.test(content)) {
    score += 5;
  } else {
    tips.push(
      "Add a specific call-to-action (e.g., 'Reply with your favorite tool' or 'DM me if you want the template').",
    );
  }

  // Match clichés on word boundaries (regex is case-insensitive) so we don't
  // flag legitimate longer words that merely contain a cliché as a substring.
  const clicheHits: string[] = [];
  for (const { phrase, regex } of CLICHE_PATTERNS) {
    if (regex.test(content)) clicheHits.push(phrase);
  }
  if (clicheHits.length > 0) {
    score -= Math.min(15, clicheHits.length * 3);
    // Cap at three suggestions to avoid overwhelming the user.
    for (const word of clicheHits.slice(0, 3)) {
      tips.push(
        `Replace "${word}" — try "${CLICHE_REPLACEMENTS[word]}". Sounds less AI-generated.`,
      );
    }
  }

  // Generic CTAs that smell like ChatGPT defaults.
  const genericCtas = [
    /\bwhat do you think\?/i,
    /\blet me know your thoughts\b/i,
    /\bshare your experience\b/i,
    /\bstay tuned\b/i,
    /\bwhat'?s your take\?/i,
  ];
  const genericCtaHit = genericCtas.find((re) => re.test(content));
  if (genericCtaHit) {
    score -= 5;
    tips.push(
      `Generic CTA detected ("${content.match(genericCtaHit)?.[0]}"). Swap it for one specific to the post — e.g. "Which of these would you try first?" or "Reply with your stack".`,
    );
  }

  // Cliché openings.
  const trimmedFirst = firstLine.trim();
  if (/^(as we |in a world where |have you ever wondered |did you know that )/i.test(trimmedFirst)) {
    score -= 3;
    tips.push(
      `Cliché opening — drop the "As we…" / "Have you ever wondered…" hook and start with a concrete claim or number.`,
    );
  }

  // Reward presence of concrete signals (numbers, named tools) — these are
  // the easiest fix for "feels generic" critiques.
  const hasNumber = /\b\d{1,4}(\.\d+)?\s?(%|x|×|k|m|min|sec|hours?|days?)?\b/i.test(content);
  if (!hasNumber && contentLength > 200) {
    tips.push(
      "No numbers in this post. Add one concrete stat or count (years, %, hours saved, # of customers) — it's the single biggest credibility boost.",
    );
  }

  const emojiCount = (content.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length;
  if (platform !== "linkedin" && emojiCount >= 1 && emojiCount <= 5) {
    score += 3;
  }

  if (["linkedin", "facebook"].includes(platform)) {
    const lineBreaks = (content.match(/\n/g) || []).length;
    if (contentLength > 200 && lineBreaks < 2) {
      tips.push("Break your post into shorter paragraphs for better readability.");
    } else if (lineBreaks >= 2) {
      score += 3;
    }
  }

  score = Math.max(10, Math.min(100, score));

  if (score >= 80 && tips.length === 0) {
    tips.push(
      "Great post! Your content length and structure look optimized for " + platform + ".",
    );
  }

  return {
    score,
    tips,
    metrics: {
      length: contentLength,
      idealLength: limits.ideal,
      maxLength: limits.max,
      hashtagCount,
    },
  };
}
