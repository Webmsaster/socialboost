import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AnalyticsConsent } from "@/components/analytics-consent";
import { CookieConsent } from "@/components/cookie-consent";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://socialboost.app",
  ),
  title: {
    default: "SocialBoost — AI Social Media Post Generator",
    template: "%s | SocialBoost",
  },
  description:
    "Generate engaging social media posts with AI. LinkedIn, Facebook, Instagram, Pinterest, Twitter/X — all from one dashboard.",
  keywords: [
    "AI social media",
    "post generator",
    "LinkedIn posts",
    "content creation",
    "social media automation",
    "AI marketing",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: "SocialBoost",
    title: "SocialBoost — AI Social Media Post Generator",
    description:
      "Generate engaging social media posts with AI for all major platforms.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SocialBoost — AI Social Media Post Generator",
    description:
      "Generate engaging social media posts with AI for all major platforms.",
    creator: "@socialboost",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    types: {
      "application/rss+xml": "/feed.xml",
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SocialBoost",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <main id="main-content">{children}</main>
          <Toaster />
          <CookieConsent />
          <AnalyticsConsent />
        </ThemeProvider>
      </body>
    </html>
  );
}
