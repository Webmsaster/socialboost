import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.ComponentProps<"div">) => <div {...props}>{children}</div>,
  CardContent: ({ children }: React.ComponentProps<"div">) => <div>{children}</div>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.ComponentProps<"button">) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

vi.mock("@/lib/i18n", () => ({
  useLanguage: () => ({
    lang: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "onboarding.title": "Welcome!",
        "onboarding.subtitle": "Get started",
        "onboarding.dismiss": "Dismiss",
        "onboarding.step1.title": "Create a post",
        "onboarding.step1.desc": "Write your first post",
        "onboarding.step2.title": "Use a template",
        "onboarding.step2.desc": "Save time with templates",
        "onboarding.step3.title": "Schedule posts",
        "onboarding.step3.desc": "Plan your content",
      };
      return map[key] || key;
    },
    setLang: vi.fn(),
  }),
}));

import { Onboarding } from "@/components/onboarding";

describe("Onboarding", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
    });
  });

  it("shows onboarding content when not dismissed", async () => {
    render(<Onboarding />);
    // After useEffect, dismissed becomes false because localStorage returns null
    const title = await screen.findAllByText("Welcome!");
    expect(title.length).toBeGreaterThanOrEqual(1);
  });

  it("has links to create, templates, and calendar", async () => {
    render(<Onboarding />);
    // Wait for useEffect
    await screen.findAllByText("Welcome!");
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/create");
    expect(hrefs).toContain("/templates");
    expect(hrefs).toContain("/calendar");
  });

  it("shows all 3 onboarding steps", async () => {
    render(<Onboarding />);
    await screen.findAllByText("Welcome!");
    expect(screen.getAllByText("Create a post").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Use a template").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Schedule posts").length).toBeGreaterThanOrEqual(1);
  });
});
