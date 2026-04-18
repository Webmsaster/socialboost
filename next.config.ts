import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compiler: {
    // Strip console.* in production, except warnings and errors
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-DNS-Prefetch-Control", value: "on" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' https://fonts.gstatic.com",
            "connect-src 'self' https://*.supabase.co https://api.openai.com https://api.stripe.com https://vitals.vercel-insights.com",
            "frame-src 'self' https://js.stripe.com",
            "frame-ancestors 'none'",
          ].join("; "),
        },
      ],
    },
    {
      // Cache static assets for 1 year
      source: "/(.*)\\.(ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      // Cache blog pages for 1 hour, revalidate in background
      source: "/blog/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      ],
    },
    {
      // Cache landing, features, pricing for 10 minutes
      source: "/(features|pricing)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, s-maxage=600, stale-while-revalidate=3600",
        },
      ],
    },
    {
      // Don't cache API routes by default
      source: "/api/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
      ],
    },
    // Per-user cacheable GETs — private browser cache w/ stale-while-revalidate.
    // Declared AFTER the /api/:path* blanket so later-match-wins overrides it.
    {
      source: "/api/achievements",
      headers: [
        { key: "Cache-Control", value: "private, max-age=30, stale-while-revalidate=120" },
      ],
    },
    {
      source: "/api/metrics",
      headers: [
        { key: "Cache-Control", value: "private, max-age=30, stale-while-revalidate=120" },
      ],
    },
    {
      source: "/api/insights",
      headers: [
        { key: "Cache-Control", value: "private, max-age=60, stale-while-revalidate=300" },
      ],
    },
    {
      source: "/api/admin/check",
      headers: [
        { key: "Cache-Control", value: "private, max-age=300, stale-while-revalidate=3600" },
      ],
    },
    {
      // Don't cache dashboard
      source:
        "/(dashboard|create|history|calendar|settings|accounts|team|analytics|bulk|templates)/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
      ],
    },
  ],
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
