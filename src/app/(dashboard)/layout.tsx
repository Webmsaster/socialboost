import type { Metadata } from "next";
import { DashboardNav } from "@/components/dashboard-nav";
import { LanguageProvider } from "@/lib/i18n";

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
    <LanguageProvider>
      <div className="flex h-screen">
        <DashboardNav />
        <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
          <div className="mx-auto max-w-5xl p-6 md:p-8">{children}</div>
        </main>
      </div>
    </LanguageProvider>
  );
}
