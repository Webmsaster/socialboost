import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard-nav";
import { LanguageProvider } from "@/lib/i18n";
import { ErrorBoundary } from "@/components/error-boundary";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { SWRProvider } from "@/components/swr-provider";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRProvider>
      <LanguageProvider>
        <div className="flex h-screen">
          <DashboardNav />
          <main id="main-content" className="flex-1 overflow-y-auto pt-14 md:pt-0">
            <div className="mx-auto max-w-5xl p-6 md:p-8">
              <ErrorBoundary>{children}</ErrorBoundary>
              <KeyboardShortcuts />
            </div>
          </main>
        </div>
      </LanguageProvider>
    </SWRProvider>
  );
}
