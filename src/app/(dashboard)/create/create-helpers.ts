import type {
  CarouselResult,
  VideoAdResult,
  VideoScriptResult,
} from "./create-types";

export function formatPostText(content: string, hashtags: string[]): string {
  return hashtags.length > 0
    ? `${content}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`
    : content;
}

export function formatVideoScriptText(script: VideoScriptResult): string {
  let text = `HOOK: ${script.hook}\n\n`;
  for (const scene of script.scenes) {
    text += `SCENE ${scene.sceneNumber} (${scene.duration})\n`;
    text += `Visual: ${scene.visual}\n`;
    text += `Narration: ${scene.narration}\n`;
    text += `Text Overlay: ${scene.textOverlay}\n\n`;
  }
  text += `CTA: ${script.cta}\n`;
  text += `Total Duration: ${script.totalDuration}\n`;
  text += `Music: ${script.musicSuggestion}`;
  return text;
}

export function formatVideoAdText(ad: VideoAdResult): string {
  let text = `CONCEPT: ${ad.concept}\n\n`;
  for (const frame of ad.frames) {
    text += `FRAME ${frame.frameNumber} (${frame.duration})\n`;
    text += `Background: ${frame.background}\n`;
    text += `Headline: ${frame.headline}\n`;
    text += `Subtext: ${frame.subtext}\n`;
    text += `Animation: ${frame.animation}\n\n`;
  }
  text += `CTA: ${ad.cta}\n`;
  text += `Target Audience: ${ad.targetAudience}\n`;
  text += `Ad Format: ${ad.adFormat}`;
  return text;
}

export function formatCarouselText(carousel: CarouselResult): string {
  let text = `TITLE: ${carousel.title}\n\n`;
  for (const slide of carousel.slides) {
    text += `SLIDE ${slide.slideNumber}\n`;
    text += `Heading: ${slide.heading}\n`;
    text += `Body: ${slide.body}\n`;
    text += `Visual: ${slide.visualSuggestion}\n`;
    text += `Notes: ${slide.speakerNotes}\n\n`;
  }
  if (carousel.hashtags.length > 0) {
    text += carousel.hashtags.map((h) => `#${h}`).join(" ");
  }
  return text;
}
