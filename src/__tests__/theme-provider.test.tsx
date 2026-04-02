import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="next-themes-provider">{children}</div>
  ),
}));

import { ThemeProvider } from "@/components/theme-provider";

describe("ThemeProvider", () => {
  it("renders children", () => {
    render(
      <ThemeProvider>
        <span>Child content</span>
      </ThemeProvider>
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("wraps children in NextThemesProvider", () => {
    render(
      <ThemeProvider>
        <span>Test</span>
      </ThemeProvider>
    );
    const providers = screen.getAllByTestId("next-themes-provider");
    expect(providers.length).toBeGreaterThanOrEqual(1);
  });
});
