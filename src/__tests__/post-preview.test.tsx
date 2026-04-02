import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

import { PostPreview } from "@/components/post-preview";

describe("PostPreview", () => {
  it("renders nothing when content is empty", () => {
    const { container } = render(
      <PostPreview platform="linkedin" content="" hashtags={[]} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows platform-specific preview for LinkedIn", () => {
    render(
      <PostPreview
        platform="linkedin"
        content="Hello LinkedIn"
        hashtags={[]}
      />
    );
    expect(screen.getByText("Like")).toBeInTheDocument();
    expect(screen.getByText("Comment")).toBeInTheDocument();
    expect(screen.getByText("Repost")).toBeInTheDocument();
    expect(screen.getByText("Send")).toBeInTheDocument();
  });

  it("shows platform-specific preview for Twitter", () => {
    render(
      <PostPreview platform="twitter" content="Hello Twitter" hashtags={[]} />
    );
    expect(screen.getByText("Reply")).toBeInTheDocument();
    expect(screen.getByText("Repost")).toBeInTheDocument();
    expect(screen.getByText("Like")).toBeInTheDocument();
    expect(screen.getByText("Share")).toBeInTheDocument();
  });

  it("shows platform-specific preview for Instagram", () => {
    render(
      <PostPreview
        platform="instagram"
        content="Hello Instagram"
        hashtags={[]}
      />
    );
    expect(screen.getAllByText("yourhandle").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Image placeholder")).toBeInTheDocument();
  });

  it("shows platform-specific preview for Facebook", () => {
    render(
      <PostPreview
        platform="facebook"
        content="Hello Facebook"
        hashtags={[]}
      />
    );
    expect(screen.getByText(/Public/)).toBeInTheDocument();
  });

  it("shows platform-specific preview for Pinterest with title truncated to 100 chars", () => {
    const longContent = "A".repeat(150);
    render(
      <PostPreview platform="pinterest" content={longContent} hashtags={[]} />
    );
    const truncated = screen.getByText("A".repeat(100));
    expect(truncated).toBeInTheDocument();
  });

  it("renders hashtags with # prefix", () => {
    render(
      <PostPreview
        platform="linkedin"
        content="Test post"
        hashtags={["react", "dev"]}
      />
    );
    expect(screen.getByText("#react #dev")).toBeInTheDocument();
  });

  it('shows "Preview — Platform" label', () => {
    render(
      <PostPreview platform="linkedin" content="Test" hashtags={[]} />
    );
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.tagName === "P" &&
          !!element?.textContent?.includes("Preview") &&
          !!element?.textContent?.includes("Linkedin")
        );
      })
    ).toBeInTheDocument();
  });

  it("Instagram truncates content longer than 125 chars", () => {
    const longContent = "B".repeat(200);
    render(
      <PostPreview platform="instagram" content={longContent} hashtags={[]} />
    );
    const expected = "B".repeat(125) + "...";
    expect(
      screen.getByText((_content, element) => {
        return (
          element?.tagName === "P" &&
          element?.textContent === "yourhandle" + expected
        );
      })
    ).toBeInTheDocument();
  });

  it("Pinterest truncates title to 100 chars", () => {
    const longContent = "C".repeat(120);
    render(
      <PostPreview platform="pinterest" content={longContent} hashtags={[]} />
    );
    expect(screen.getByText("C".repeat(100))).toBeInTheDocument();
  });

  it("Instagram shows image when imageUrl is provided", () => {
    render(
      <PostPreview
        platform="instagram"
        content="With image"
        hashtags={[]}
        imageUrl="https://example.com/img.jpg"
      />
    );
    const img = screen.getByAltText("Post visual");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/img.jpg");
  });
});
