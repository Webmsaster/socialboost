import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://socialboost.app";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/features`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/changelog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/use-cases`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/roadmap`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/compare`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/testimonials`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/status`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/imprint`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog/best-linkedin-post-examples`,
      lastModified: new Date("2026-03-25"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/ai-social-media-content-guide`,
      lastModified: new Date("2026-03-20"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/instagram-caption-tips`,
      lastModified: new Date("2026-03-15"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/social-media-scheduling-strategy`,
      lastModified: new Date("2026-03-27"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/twitter-x-growth-tips`,
      lastModified: new Date("2026-03-27"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/content-repurposing-guide`,
      lastModified: new Date("2026-03-27"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/facebook-marketing-strategies`,
      lastModified: new Date("2026-04-09"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/tiktok-marketing-guide`,
      lastModified: new Date("2026-04-09"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/threads-growth-strategy`,
      lastModified: new Date("2026-04-09"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/youtube-shorts-strategy`,
      lastModified: new Date("2026-04-09"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/pinterest-seo-guide`,
      lastModified: new Date("2026-04-09"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/social-media-kpis-that-matter`,
      lastModified: new Date("2026-04-10"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/hashtag-strategy-2026`,
      lastModified: new Date("2026-04-10"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/ai-content-voice-guide`,
      lastModified: new Date("2026-04-10"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/blog/content-series-strategy`,
      lastModified: new Date("2026-04-11"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
