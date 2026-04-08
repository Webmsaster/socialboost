import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  DashboardSkeleton,
  CardSkeleton,
  TableSkeleton,
  Skeleton,
} from "@/components/loading-skeleton";

describe("DashboardSkeleton", () => {
  it("renders 3 skeleton cards", () => {
    const { container } = render(<DashboardSkeleton />);
    const cards = container.querySelectorAll(".grid > .rounded-xl.border");
    expect(cards).toHaveLength(3);
  });
});

describe("CardSkeleton", () => {
  it("renders", () => {
    const { container } = render(<CardSkeleton />);
    expect(container.querySelector(".rounded-xl.border")).toBeInTheDocument();
  });
});

describe("TableSkeleton", () => {
  it("renders default 5 rows", () => {
    const { container } = render(<TableSkeleton />);
    const rows = container.querySelectorAll(".space-y-3 > .flex.items-center");
    expect(rows).toHaveLength(5);
  });

  it("renders custom number of rows", () => {
    const { container } = render(<TableSkeleton rows={3} />);
    const rows = container.querySelectorAll(".space-y-3 > .flex.items-center");
    expect(rows).toHaveLength(3);
  });
});

describe("Skeleton", () => {
  it("has animate-pulse class", () => {
    const { container } = render(<Skeleton data-testid="skeleton" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("animate-pulse");
  });
});
