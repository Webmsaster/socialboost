/**
 * Single source of truth for blog post metadata.
 * Consumed by the blog index page, sitemap, and RSS feed.
 */
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  category: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: "best-linkedin-post-examples",
    title: "10 Best LinkedIn Post Examples That Get Engagement in 2026",
    excerpt:
      "Discover the LinkedIn post formats that drive the most engagement, from personal stories to data-driven insights.",
    date: "2026-03-25",
    readTime: "6 min read",
    category: "LinkedIn",
  },
  {
    slug: "ai-social-media-content-guide",
    title: "The Complete Guide to AI-Generated Social Media Content",
    excerpt:
      "How to use AI tools like SocialBoost to create authentic, engaging social media posts that sound like you.",
    date: "2026-03-20",
    readTime: "8 min read",
    category: "Strategy",
  },
  {
    slug: "instagram-caption-tips",
    title: "15 Instagram Caption Tips to Boost Your Engagement Rate",
    excerpt:
      "Master the art of writing Instagram captions that stop the scroll and drive comments, saves, and shares.",
    date: "2026-03-15",
    readTime: "5 min read",
    category: "Instagram",
  },
  {
    slug: "social-media-scheduling-strategy",
    title:
      "How to Build a Social Media Scheduling Strategy That Actually Works",
    excerpt:
      "Learn optimal posting times, content batching, and consistency frameworks that drive real results across platforms.",
    date: "2026-03-27",
    readTime: "7 min read",
    category: "Strategy",
  },
  {
    slug: "twitter-x-growth-tips",
    title: "12 Twitter/X Growth Tips for 2026: From Zero to Engaged Audience",
    excerpt:
      "Actionable strategies to build an engaged Twitter/X audience from scratch with threads, engagement tactics, and content systems.",
    date: "2026-03-27",
    readTime: "8 min read",
    category: "Twitter",
  },
  {
    slug: "content-repurposing-guide",
    title:
      "Content Repurposing: How to Turn 1 Post Into 5 Platform-Ready Pieces",
    excerpt:
      "Master content repurposing workflows to multiply your social media output without multiplying your effort.",
    date: "2026-03-27",
    readTime: "8 min read",
    category: "Strategy",
  },
  {
    slug: "facebook-marketing-strategies",
    title: "Facebook Marketing Strategies That Actually Work in 2026",
    excerpt:
      "Proven organic reach tactics, ad optimization, community building, and AI-powered content generation for Facebook in 2026.",
    date: "2026-04-09",
    readTime: "9 min read",
    category: "Facebook",
  },
  {
    slug: "tiktok-marketing-guide",
    title: "The TikTok Marketing Guide for Brands in 2026",
    excerpt:
      "Complete TikTok marketing guide: algorithm insights, content formats, trending audio, hashtag strategy, and AI-powered script generation.",
    date: "2026-04-09",
    readTime: "10 min read",
    category: "TikTok",
  },
  {
    slug: "threads-growth-strategy",
    title:
      "Threads Growth Strategy: Building an Audience on Meta's Newest Platform",
    excerpt:
      "How to grow on Threads in 2026. Content formats, posting cadence, algorithm tips, and AI-powered content that resonates.",
    date: "2026-04-09",
    readTime: "7 min read",
    category: "Threads",
  },
  {
    slug: "youtube-shorts-strategy",
    title:
      "YouTube Shorts Strategy: The Complete Growth Playbook for 2026",
    excerpt:
      "Master YouTube Shorts in 2026. Algorithm insights, content formats, monetization, and AI-powered script generation that drives views and subscribers.",
    date: "2026-04-09",
    readTime: "9 min read",
    category: "YouTube",
  },
  {
    slug: "hashtag-strategy-2026",
    title: "Hashtag Strategy in 2026: What Still Works, What Doesn't",
    excerpt:
      "The 2026 hashtag playbook: platform-by-platform rules, how many to use, niche vs broad tags, and the mistakes that now hurt your reach.",
    date: "2026-04-09",
    readTime: "6 min read",
    category: "Strategy",
  },
  {
    slug: "ai-content-voice-guide",
    title: "How to Make AI-Generated Content Sound Like You",
    excerpt:
      "AI content is a tool, not a replacement. Here is how to prompt, edit, and direct AI so the output sounds unmistakably like your brand voice.",
    date: "2026-04-09",
    readTime: "7 min read",
    category: "AI",
  },
  {
    slug: "social-media-kpis-that-matter",
    title: "Social Media KPIs That Actually Matter in 2026",
    excerpt:
      "Stop tracking vanity metrics. The KPIs that actually predict business growth on social media in 2026, with benchmarks and how to measure them.",
    date: "2026-04-09",
    readTime: "7 min read",
    category: "Analytics",
  },
  {
    slug: "social-media-team-workflow",
    title: "Social Media Team Workflow: From Draft to Publish in 2026",
    excerpt:
      "Build a social media team workflow that scales. Content approval processes, role management, and maintaining brand consistency across platforms.",
    date: "2026-04-11",
    readTime: "7 min read",
    category: "Strategy",
  },
  {
    slug: "ai-content-scoring-guide",
    title: "AI Content Scoring: How to Optimize Posts Before You Publish",
    excerpt:
      "Learn how AI content scoring analyzes post length, hooks, CTAs, and hashtags to optimize your social media content before publishing.",
    date: "2026-04-11",
    readTime: "6 min read",
    category: "AI",
  },
  {
    slug: "content-series-strategy",
    title: "Content Series Strategy: How Recurring Themes 10x Your Engagement",
    excerpt:
      "Learn how to build a content series strategy. Discover how recurring post themes like Monday Motivation drive consistent engagement and save time.",
    date: "2026-04-11",
    readTime: "7 min read",
    category: "Strategy",
  },
  {
    slug: "pinterest-seo-guide",
    title: "Pinterest SEO Guide: Drive Free Traffic in 2026",
    excerpt:
      "The complete Pinterest SEO guide for 2026. Keyword research, pin optimization, board structure, and AI-powered content for long-tail discovery traffic.",
    date: "2026-04-09",
    readTime: "8 min read",
    category: "Pinterest",
  },
];

/** Posts sorted newest-first, for the blog index and RSS feed. */
export function getSortedPosts(): BlogPost[] {
  return [...blogPosts].sort((a, b) => b.date.localeCompare(a.date));
}
