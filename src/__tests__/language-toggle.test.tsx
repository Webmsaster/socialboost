import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockSetLang = vi.fn();

vi.mock("@/lib/i18n", () => ({
  useLanguage: () => ({
    lang: "en",
    setLang: mockSetLang,
    t: (key: string) => {
      const map: Record<string, string> = { "lang.switch": "Deutsch" };
      return map[key] || key;
    },
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.ComponentProps<"button">) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

import { LanguageToggle } from "@/components/language-toggle";

describe("LanguageToggle", () => {
  it("renders with current language label", () => {
    render(<LanguageToggle />);
    const items = screen.getAllByText("Deutsch");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("toggles language on click", () => {
    render(<LanguageToggle />);
    const button = screen.getAllByRole("button")[0];
    fireEvent.click(button);
    expect(mockSetLang).toHaveBeenCalledWith("de");
  });
});
