import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";

describe("KeyboardShortcuts", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("renders nothing by default", () => {
    const { container } = render(<KeyboardShortcuts />);
    expect(container.innerHTML).toBe("");
  });

  it("opens shortcut overlay on ? key press", () => {
    render(<KeyboardShortcuts />);
    fireEvent.keyDown(document, { key: "?" });
    const matches = screen.getAllByText("Keyboard Shortcuts");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("closes overlay on Escape key", () => {
    render(<KeyboardShortcuts />);
    fireEvent.keyDown(document, { key: "?" });
    expect(screen.getAllByText("Keyboard Shortcuts").length).toBeGreaterThanOrEqual(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryAllByText("Keyboard Shortcuts").length).toBe(0);
  });

  it("navigates to dashboard on D key press", () => {
    render(<KeyboardShortcuts />);
    fireEvent.keyDown(document, { key: "d" });
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("navigates to create on N key press", () => {
    render(<KeyboardShortcuts />);
    fireEvent.keyDown(document, { key: "n" });
    expect(mockPush).toHaveBeenCalledWith("/create");
  });

  it("does not navigate when typing in input", () => {
    render(
      <div>
        <input data-testid="input" />
        <KeyboardShortcuts />
      </div>
    );
    const input = screen.getByTestId("input");
    input.focus();
    fireEvent.keyDown(input, { key: "d" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not navigate on Ctrl+key combos", () => {
    render(<KeyboardShortcuts />);
    fireEvent.keyDown(document, { key: "d", ctrlKey: true });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("navigates to repurpose on R key press", () => {
    render(<KeyboardShortcuts />);
    fireEvent.keyDown(document, { key: "r" });
    expect(mockPush).toHaveBeenCalledWith("/repurpose");
  });

  it("navigates to series on E key press", () => {
    render(<KeyboardShortcuts />);
    fireEvent.keyDown(document, { key: "e" });
    expect(mockPush).toHaveBeenCalledWith("/series");
  });
});
