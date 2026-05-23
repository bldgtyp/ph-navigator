import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SingleSelectPopover } from "../components/SingleSelectPopover";
import type { FieldOption } from "../types";

const OPTIONS: FieldOption[] = [
  { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
  { id: "opt_mez", label: "Mezzanine", color: "#10b981", order: 1 },
  { id: "opt_roof", label: "Roof", color: "#a16207", order: 2 },
];

type Handlers = {
  onSearchTextChange: ReturnType<typeof vi.fn>;
  onHighlight: ReturnType<typeof vi.fn>;
  onCancel: ReturnType<typeof vi.fn>;
  onCommit: ReturnType<typeof vi.fn>;
  onCommitAndMove: ReturnType<typeof vi.fn>;
};

function renderPopover(args: {
  searchText?: string;
  highlightedOptionId?: string | null;
  options?: FieldOption[];
}): Handlers {
  const handlers: Handlers = {
    onSearchTextChange: vi.fn(),
    onHighlight: vi.fn(),
    onCancel: vi.fn(),
    onCommit: vi.fn(),
    onCommitAndMove: vi.fn(),
  };
  render(
    <SingleSelectPopover
      options={args.options ?? OPTIONS}
      searchText={args.searchText ?? ""}
      highlightedOptionId={args.highlightedOptionId ?? null}
      anchorChildren={<span data-testid="anchor">cell</span>}
      {...handlers}
    />,
  );
  return handlers;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("SingleSelectPopover", () => {
  test("renders existing options as pills", () => {
    renderPopover({});
    expect(screen.getByText("Ground")).toBeTruthy();
    expect(screen.getByText("Mezzanine")).toBeTruthy();
    expect(screen.getByText("Roof")).toBeTruthy();
  });

  test("filters options by case-insensitive substring", () => {
    renderPopover({ searchText: "MEZ" });
    expect(screen.queryByText("Ground")).toBeNull();
    expect(screen.getByText("Mezzanine")).toBeTruthy();
    expect(screen.queryByText("Roof")).toBeNull();
  });

  test("shows the Create footer when no existing option matches", () => {
    renderPopover({ searchText: "Penthouse" });
    expect(screen.getByText(/Create.*Penthouse/)).toBeTruthy();
  });

  test("hides the Create footer when an existing option matches case-insensitively", () => {
    renderPopover({ searchText: "  ground  " });
    expect(screen.getByText("Ground")).toBeTruthy();
    expect(screen.queryByText(/Create/)).toBeNull();
  });

  test("ArrowDown / ArrowUp cycle through filtered options + Create footer", () => {
    const handlers = renderPopover({
      searchText: "Loft",
      highlightedOptionId: null, // Create footer highlighted
    });
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    // Only the Create footer is in the cycle (no matches), so wrap back to null.
    expect(handlers.onHighlight).toHaveBeenLastCalledWith(null);
  });

  test("Enter calls onCommit", () => {
    const handlers = renderPopover({});
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(handlers.onCommit).toHaveBeenCalledTimes(1);
  });

  test("Tab calls onCommitAndMove with shiftKey state", () => {
    const handlers = renderPopover({});
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(handlers.onCommitAndMove).toHaveBeenCalledWith(true);
  });

  test("Escape cancels", () => {
    const handlers = renderPopover({});
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(handlers.onCancel).toHaveBeenCalled();
  });

  test("typing in the search box bubbles to onSearchTextChange", () => {
    const handlers = renderPopover({});
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Mez" } });
    expect(handlers.onSearchTextChange).toHaveBeenCalledWith("Mez");
  });

  test("clicking an option highlights then commits it", () => {
    const handlers = renderPopover({});
    fireEvent.click(screen.getByText("Mezzanine"));
    expect(handlers.onHighlight).toHaveBeenCalledWith("opt_mez");
    expect(handlers.onCommit).toHaveBeenCalled();
  });

  test("clicking the Create footer highlights null then commits", () => {
    const handlers = renderPopover({ searchText: "Penthouse" });
    fireEvent.click(screen.getByText(/Create.*Penthouse/));
    expect(handlers.onHighlight).toHaveBeenCalledWith(null);
    expect(handlers.onCommit).toHaveBeenCalled();
  });
});
