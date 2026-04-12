export const PLATFORM_LIMITS = {
  twitter: 280,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
  pinterest: 500,
} as const satisfies Record<string, number>;

export type PlatformKey = keyof typeof PLATFORM_LIMITS;

export type ContentType = "post" | "video-script" | "video-ad" | "carousel";

export const platforms = [
  "linkedin",
  "facebook",
  "instagram",
  "pinterest",
  "twitter",
] as const;

export const tones = [
  "professional",
  "casual",
  "inspirational",
  "humorous",
  "educational",
] as const;

export interface PostResult {
  content: string;
  hashtags: string[];
}

export interface PostVariant {
  variantLabel: string;
  content: string;
  hashtags: string[];
  approach: string;
}

export interface VideoScriptResult {
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

export interface VideoAdResult {
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

export interface CarouselResult {
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
