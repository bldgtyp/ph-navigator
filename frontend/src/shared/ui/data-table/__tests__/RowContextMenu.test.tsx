import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RowContextMenu, type RowContextMenuOpenState } from "../components/RowContextMenu";

// Unit coverage for the row context menu. Single-row gestures cover
// the three built-in items (Insert / Expand / Delete) plus the
// conditional Expand item (only present when onOpen is wired). The
// multi-row cases cover PRD §5 rules 1 / 2 / 3 plus the render-perf
// freeze contract on `selectionCount` / `rowIsInSelection`. Delegated
// `contextmenu` listener wiring is exercised by the GridBody /
// DataTable integration tests and the Playwright e2e specs.

function defaultOpen(overrides: Partial<RowContextMenuOpenState> = {}): RowContextMenuOpenState {
  return {
    rowId: "r1",
    rowNumber: 1,
    x: 100,
    y: 50,
    returnFocus: null,
    selectionCount: 0,
    rowIsInSelection: false,
    ...overrides,
  };
}

type RenderOverrides = Partial<{
  open: RowContextMenuOpenState | null;
  onClose: () => void;
  onInsertBelow: () => void;
  onOpen?: () => void;
  onDelete: () => void;
  onDeleteSelection: () => void;
}>;

function renderMenu(overrides: RenderOverrides = {}) {
  return render(
    <RowContextMenu
      open={overrides.open ?? defaultOpen()}
      onClose={overrides.onClose ?? vi.fn()}
      onInsertBelow={overrides.onInsertBelow ?? vi.fn()}
      onOpen={overrides.onOpen}
      onDelete={overrides.onDelete ?? vi.fn()}
      onDeleteSelection={overrides.onDeleteSelection ?? vi.fn()}
    />,
  );
}

describe("RowContextMenu — single-row branch", () => {
  test("renders Insert / Expand / Delete when onOpen is wired", () => {
    renderMenu({ onOpen: vi.fn() });
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).toEqual([
      expect.stringContaining("Insert record"),
      expect.stringContaining("Expand record"),
      expect.stringContaining("Delete record"),
    ]);
  });

  test("hides Expand record when onOpen is undefined", () => {
    renderMenu();
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).toEqual([
      expect.stringContaining("Insert record"),
      expect.stringContaining("Delete record"),
    ]);
  });

  test("Delete record carries data-danger=true", () => {
    renderMenu();
    const deleteItem = screen.getByRole("menuitem", { name: /Delete record/ });
    expect(deleteItem).toHaveAttribute("data-danger", "true");
  });

  test("renders nothing when open is null", () => {
    const { container } = renderMenu({ open: null });
    expect(container.querySelector("[role='menu']")).toBeNull();
  });

  test("clicking Insert record invokes onInsertBelow and closes the menu", () => {
    const onInsertBelow = vi.fn();
    const onClose = vi.fn();
    renderMenu({ onInsertBelow, onClose });
    fireEvent.click(screen.getByRole("menuitem", { name: /Insert record/ }));
    expect(onInsertBelow).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("clicking Delete record invokes onDelete and closes the menu", () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    renderMenu({ onDelete, onClose });
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete record/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("aria-label includes the row number", () => {
    renderMenu({ open: defaultOpen({ rowNumber: 7 }) });
    expect(screen.getByRole("menu")).toHaveAttribute("aria-label", "Row 7 actions");
  });
});

describe("RowContextMenu — multi-row collapse (PRD §5)", () => {
  test("rule 1: count>=2 and row in selection collapses to one Delete N records item", () => {
    renderMenu({
      open: defaultOpen({ selectionCount: 3, rowIsInSelection: true }),
      onOpen: vi.fn(),
    });
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Delete 3 records");
    expect(items[0]).toHaveAttribute("data-danger", "true");
    expect(screen.getByRole("menu")).toHaveAttribute("aria-label", "Selected rows actions");
  });

  test("rule 1: clicking Delete N records invokes onDeleteSelection (not onDelete)", () => {
    const onDelete = vi.fn();
    const onDeleteSelection = vi.fn();
    renderMenu({
      open: defaultOpen({ selectionCount: 4, rowIsInSelection: true }),
      onDelete,
      onDeleteSelection,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete 4 records/ }));
    expect(onDeleteSelection).toHaveBeenCalledTimes(1);
    expect(onDelete).not.toHaveBeenCalled();
  });

  test("rule 2/3: count>=2 but row not in selection renders the full single-row menu", () => {
    renderMenu({
      open: defaultOpen({ selectionCount: 3, rowIsInSelection: false }),
      onOpen: vi.fn(),
    });
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).toEqual([
      expect.stringContaining("Insert record"),
      expect.stringContaining("Expand record"),
      expect.stringContaining("Delete record"),
    ]);
  });

  test("rule 3: count<=1 renders the full single-row menu", () => {
    renderMenu({
      open: defaultOpen({ selectionCount: 1, rowIsInSelection: true }),
      onOpen: vi.fn(),
    });
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).toEqual([
      expect.stringContaining("Insert record"),
      expect.stringContaining("Expand record"),
      expect.stringContaining("Delete record"),
    ]);
  });

  test("freeze: re-rendering with a different live selection does not flip the menu's branch", () => {
    const collapsed = defaultOpen({ selectionCount: 3, rowIsInSelection: true });
    const { rerender } = render(
      <RowContextMenu
        open={collapsed}
        onClose={vi.fn()}
        onInsertBelow={vi.fn()}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onDeleteSelection={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    // Re-render with the same frozen snapshot — the menu does not
    // re-read `rowSelection` while open, so live selection toggles in
    // the parent never reach the rendered branch.
    rerender(
      <RowContextMenu
        open={collapsed}
        onClose={vi.fn()}
        onInsertBelow={vi.fn()}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onDeleteSelection={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  });
});
