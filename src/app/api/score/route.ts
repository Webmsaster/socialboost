import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { captureError } from "@/lib/logger";

// Platform-specific scoring criteria
const PLATFORM_LIMITS: Record<string, { ideal: number; max: number }> = {
  twitter: { ideal: 200, max: 280 },
  linkedin: { ideal: 1300, max: 3000 },
  facebook: { ideal: 400, max: 2000 },
  instagram: { ideal: 1000, max: 2200 },
  pinterest: { ideal: 200, max: 500 },
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { success } = await rateLimit(user.id, "/api/score");
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const { content, platform, hashtags } = await request.json() as {
      content: string;
      platform: string;
      hashtags?: string[];
    };

    if (!content?.trim() || !platform) {
      return NextResponse.json({ error: "Missing content or platform" }, { status: 400 });
    }

    const limits = PLATFORM_LIMITS[platform] || PLATFORM_LIMITS.facebook;
    const contentLength = content.length;
    const hashtagCount = (hashtags || []).length;
    const tips: string[] = [];
    let score = 70; // Base score

    // Length scoring
    if (contentLength < 50) {
      score -= 20;
      tips.push("Your post is very short. Add more context to increase engagement.");
    } else if (contentLength <= limits.ideal) {
      score += 10;
    } else if (contentLength <= limits.max) {
      score += 5;
    } else {
      score -= 15;
      tips.push(`Post exceeds ${platform}'s ${limits.max} character limit. Consider shortening.`);
    }

    // Hashtag scoring
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

    // Hook scoring (first line)
    const firstLine = content.split("\n")[0];
    if (firstLine.endsWith("?") || firstLine.startsWith("Did you know")) {
      score += 5;
    } else if (firstLine.length < 20) {
      tips.push("Start with a strong hook — a question or bold statement gets more clicks.");
    }

    // CTA scoring
    const ctaPatterns = /click|link|comment|share|follow|subscribe|sign up|check out|learn more|read more|dm me|let me know/i;
    if (ctaPatterns.test(content)) {
      score += 5;
    } else {
      tips.push("Add a call-to-action to drive engagement (e.g., 'What do you think?' or 'Share your experience').");
    }

    // Emoji scoring (light use is good for some platforms)
    const emojiCount = (content.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length;
    if (platform !== "linkedin" && emojiCount >= 1 && emojiCount <= 5) {
      score += 3;
    }

    // Line breaks for readability (LinkedIn, Facebook)
    if (["linkedin", "facebook"].includes(platform)) {
      const lineBreaks = (content.match(/\n/g) || []).length;
      if (contentLength > 200 && lineBreaks < 2) {
        tips.push("Break your post into shorter paragraphs for better readability.");
      } else if (lineBreaks >= 2) {
        score += 3;
      }
    }

    // Clamp score
    score = Math.max(10, Math.min(100, score));

    // Add positive feedback if score is high
    if (score >= 80 && tips.length === 0) {
      tips.push("Great post! Your content length and structure look optimized for " + platform + ".");
    }

    return NextResponse.json({
      score,
      tips,
      metrics: {
        length: contentLength,
        idealLength: limits.ideal,
        maxLength: limits.max,
        hashtagCount,
      },
    });
  } catch (error) {
    captureError("Score error", error);
    return NextResponse.json({ error: "Failed to score content" }, { status: 500 });
  }
}
