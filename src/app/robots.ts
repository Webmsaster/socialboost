import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://socialboost.app";

  return {
    rules: [
      {
        userAgent: "*",
        // Crawl everything by default; only explicitly disallow private/auth-gated routes.
        // Auto-covers new public pages (legal, landing sections, future blog posts).
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/dashboard",
          "/create",
          "/history",
          "/calendar",
          "/settings",
          "/accounts",
          "/bulk",
          "/templates",
          "/analytics",
          "/team",
          "/onboarding",
          "/reset-password",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
