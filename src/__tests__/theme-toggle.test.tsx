import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockSetTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: mockSetTheme }),
}));

vi.mock("@/lib/i18n", () => ({
  useLanguage: () => ({
    lang: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "theme.dark": "Dark mode",
        "theme.light": "Light mode",
      };
      return map[key] || key;
    },
    setLang: vi.fn(),
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.ComponentProps<"button">) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

import { ThemeToggle } from "@/components/theme-toggle";

describe("ThemeToggle", () => {
  it("renders toggle button with correct label", () => {
    render(<ThemeToggle />);
    const buttons = screen.getAllByText("Dark mode");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls setTheme on click", () => {
    render(<ThemeToggle />);
    const button = screen.getAllByRole("button")[0];
    fireEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });
});
