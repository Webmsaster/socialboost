import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { PricingToggle } from "@/components/pricing-toggle";

describe("PricingToggle", () => {
  it("shows Monthly and Annual options", () => {
    render(<PricingToggle />);
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText(/Annual/)).toBeInTheDocument();
  });

  it('shows "Save 27%" badge', () => {
    render(<PricingToggle />);
    expect(screen.getByText("Save 27%")).toBeInTheDocument();
  });

  it("shows Free ($0) and Pro ($9) by default", () => {
    render(<PricingToggle />);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.tagName === "P" &&
          element?.classList.contains("font-bold") &&
          !!element?.textContent?.includes("$9")
        );
      })
    ).toBeInTheDocument();
  });

  it("switch toggles to annual pricing ($79)", () => {
    render(<PricingToggle />);
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.tagName === "P" &&
          element?.classList.contains("font-bold") &&
          !!element?.textContent?.includes("$79")
        );
      })
    ).toBeInTheDocument();
  });

  it('shows "forever" for free plan', () => {
    render(<PricingToggle />);
    expect(screen.getByText("forever")).toBeInTheDocument();
  });

  it("has Get started and Start Pro links", () => {
    render(<PricingToggle />);
    const getStarted = screen.getByText("Get started");
    expect(getStarted).toBeInTheDocument();
    expect(getStarted.closest("a")).toHaveAttribute("href", "/signup");

    const startPro = screen.getByText("Start Pro");
    expect(startPro).toBeInTheDocument();
    expect(startPro.closest("a")).toHaveAttribute("href", "/signup?plan=monthly");
  });
});
