import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ComponentProps<"button">) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.ComponentProps<"textarea">) => <textarea {...props} />,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.ComponentProps<"div">) => <div {...props}>{children}</div>,
  CardContent: ({ children }: React.ComponentProps<"div">) => <div>{children}</div>,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

import { OnboardingWizard } from "@/components/onboarding-wizard";

describe("OnboardingWizard", () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders step 0 - welcome screen", () => {
    render(<OnboardingWizard onComplete={mockOnComplete} />);
    expect(screen.getByText("Welcome to SocialBoost!")).toBeInTheDocument();
  });

  it("has Let's go and Skip onboarding buttons", () => {
    render(<OnboardingWizard onComplete={mockOnComplete} />);
    const buttons = screen.getAllByRole("button");
    const texts = buttons.map((b) => b.textContent);
    expect(texts.some((t) => t?.includes("go"))).toBe(true);
    expect(texts.some((t) => t?.includes("Skip"))).toBe(true);
  });

  it("advances to step 1 when Let's go is clicked", () => {
    render(<OnboardingWizard onComplete={mockOnComplete} />);
    // Click the first button that contains "go"
    const goButton = screen.getAllByRole("button").find((b) => b.textContent?.includes("go"));
    fireEvent.click(goButton!);
    expect(screen.getByText("Choose your primary platform")).toBeInTheDocument();
  });

  it("shows all 5 platforms in step 1", () => {
    render(<OnboardingWizard onComplete={mockOnComplete} />);
    const goButton = screen.getAllByRole("button").find((b) => b.textContent?.includes("go"));
    fireEvent.click(goButton!);
    expect(screen.getAllByText("LinkedIn").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Facebook").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Instagram").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pinterest").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Twitter/X").length).toBeGreaterThanOrEqual(1);
  });

  it("advances to step 2 - topic input", () => {
    render(<OnboardingWizard onComplete={mockOnComplete} />);
    const goButton = screen.getAllByRole("button").find((b) => b.textContent?.includes("go"));
    fireEvent.click(goButton!);
    const nextBtn = screen.getAllByRole("button").find((b) => b.textContent === "Next");
    fireEvent.click(nextBtn!);
    expect(screen.getAllByText("Generate your first post").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onComplete when Skip onboarding is clicked", () => {
    render(<OnboardingWizard onComplete={mockOnComplete} />);
    const skipBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("Skip"));
    fireEvent.click(skipBtn!);
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it("has Back button in step 1", () => {
    render(<OnboardingWizard onComplete={mockOnComplete} />);
    const goButton = screen.getAllByRole("button").find((b) => b.textContent?.includes("go"));
    fireEvent.click(goButton!);
    const backBtn = screen.getAllByRole("button").find((b) => b.textContent?.includes("Back"));
    fireEvent.click(backBtn!);
    expect(screen.getAllByText("Welcome to SocialBoost!").length).toBeGreaterThanOrEqual(1);
  });
});
