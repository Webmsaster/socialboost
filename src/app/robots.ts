import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://socialboost.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog", "/features", "/pricing", "/login", "/signup"],
        disallow: [
          "/api/",
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
