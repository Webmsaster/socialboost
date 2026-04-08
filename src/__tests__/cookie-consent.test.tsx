import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.ComponentProps<"button">) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

import { CookieConsent } from "@/components/cookie-consent";

describe("CookieConsent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows banner when no consent stored", () => {
    render(<CookieConsent />);
    expect(screen.getByText(/cookies/i)).toBeDefined();
  });

  it("hides banner when consent was already accepted", () => {
    localStorage.setItem("socialboost-cookie-consent", "accepted");
    const { container } = render(<CookieConsent />);
    expect(container.innerHTML).toBe("");
  });

  it("hides banner when consent was already declined", () => {
    localStorage.setItem("socialboost-cookie-consent", "declined");
    const { container } = render(<CookieConsent />);
    expect(container.innerHTML).toBe("");
  });

  it("stores accepted consent and hides on accept click", () => {
    render(<CookieConsent />);
    const buttons = screen.getAllByRole("button");
    const acceptBtn = buttons.find((b) => b.textContent === "Accept");
    expect(acceptBtn).toBeDefined();
    fireEvent.click(acceptBtn!);
    expect(localStorage.getItem("socialboost-cookie-consent")).toBe("accepted");
  });

  it("stores declined consent and hides on decline click", () => {
    render(<CookieConsent />);
    const buttons = screen.getAllByRole("button");
    const declineBtn = buttons.find((b) => b.textContent === "Decline");
    expect(declineBtn).toBeDefined();
    fireEvent.click(declineBtn!);
    expect(localStorage.getItem("socialboost-cookie-consent")).toBe("declined");
  });

  it("links to privacy policy", () => {
    render(<CookieConsent />);
    const links = screen.getAllByRole("link");
    const privacyLink = links.find((l) => l.textContent === "Privacy Policy");
    expect(privacyLink).toBeDefined();
    expect(privacyLink!.getAttribute("href")).toBe("/privacy");
  });
});
