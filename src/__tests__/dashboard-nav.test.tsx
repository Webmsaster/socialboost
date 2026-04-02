import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue({});

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}));

vi.mock("@/lib/i18n", () => ({
  useLanguage: () => ({
    lang: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "nav.dashboard": "Dashboard",
        "nav.create": "Create",
        "nav.bulk": "Bulk",
        "nav.templates": "Templates",
        "nav.history": "History",
        "nav.calendar": "Calendar",
        "nav.analytics": "Analytics",
        "nav.accounts": "Accounts",
        "nav.settings": "Settings",
        "nav.signOut": "Sign Out",
      };
      return map[key] || key;
    },
    setLang: vi.fn(),
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.ComponentProps<"button"> & { variant?: string }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock("@/components/language-toggle", () => ({
  LanguageToggle: () => <div data-testid="language-toggle" />,
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { DashboardNav } from "@/components/dashboard-nav";

describe("DashboardNav", () => {
  it("renders all 9 navigation links", () => {
    render(<DashboardNav />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/create");
    expect(hrefs).toContain("/bulk");
    expect(hrefs).toContain("/templates");
    expect(hrefs).toContain("/history");
    expect(hrefs).toContain("/calendar");
    expect(hrefs).toContain("/analytics");
    expect(hrefs).toContain("/accounts");
    expect(hrefs).toContain("/settings");
  });

  it("renders SocialBoost branding", () => {
    render(<DashboardNav />);
    const brandElements = screen.getAllByText("SocialBoost");
    expect(brandElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders sign out button", () => {
    render(<DashboardNav />);
    const signOutBtns = screen.getAllByText("Sign Out");
    expect(signOutBtns.length).toBeGreaterThanOrEqual(1);
  });

  it("calls signOut on sign out click", async () => {
    render(<DashboardNav />);
    const signOutBtn = screen.getAllByText("Sign Out")[0].closest("button");
    fireEvent.click(signOutBtn!);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("renders theme and language toggles", () => {
    render(<DashboardNav />);
    expect(screen.getAllByTestId("theme-toggle").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByTestId("language-toggle").length).toBeGreaterThanOrEqual(1);
  });

  it("renders mobile and desktop navigation", () => {
    render(<DashboardNav />);
    const navs = screen.getAllByRole("navigation");
    expect(navs.length).toBeGreaterThanOrEqual(1);
  });
});
