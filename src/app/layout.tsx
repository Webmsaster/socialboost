import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
  openGraph: {
    type: "website",
    siteName: "SocialBoost",
    title: "SocialBoost — AI Social Media Post Generator",
    description:
      "Generate engaging social media posts with AI for all major platforms.",
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SocialBoost",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} antialiased`}>
        <ThemeProvider>
          {children}
          <Toaster />
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
