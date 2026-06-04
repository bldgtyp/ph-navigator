import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RowContextMenu, type RowContextMenuOpenState } from "../components/RowContextMenu";

// Phase 1 unit coverage for the row context menu. Covers the three
// built-in items (Insert / Expand / Delete), the conditional Expand
// item (only present when onOpen is wired), and the danger marker on
// Delete. Delegated `contextmenu` listener wiring is exercised in the
// GridBody / DataTable integration tests and the Playwright e2e
// (`row-context-menu-shell.spec.ts`).

function defaultOpen(overrides: Partial<RowContextMenuOpenState> = {}): RowContextMenuOpenState {
  return { rowId: "r1", rowNumber: 1, x: 100, y: 50, returnFocus: null, ...overrides };
}

describe("RowContextMenu", () => {
  test("renders Insert / Expand / Delete when onOpen is wired", () => {
    render(
      <RowContextMenu
        open={defaultOpen()}
        onClose={vi.fn()}
        onInsertBelow={vi.fn()}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).toEqual([
      expect.stringContaining("Insert record"),
      expect.stringContaining("Expand record"),
      expect.stringContaining("Delete record"),
    ]);
  });

  test("hides Expand record when onOpen is undefined", () => {
    render(
      <RowContextMenu
        open={defaultOpen()}
        onClose={vi.fn()}
        onInsertBelow={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).toEqual([
      expect.stringContaining("Insert record"),
      expect.stringContaining("Delete record"),
    ]);
  });

  test("Delete record carries data-danger=true", () => {
    render(
      <RowContextMenu
        open={defaultOpen()}
        onClose={vi.fn()}
        onInsertBelow={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const deleteItem = screen.getByRole("menuitem", { name: /Delete record/ });
    expect(deleteItem).toHaveAttribute("data-danger", "true");
  });

  test("renders nothing when open is null", () => {
    const { container } = render(
      <RowContextMenu open={null} onClose={vi.fn()} onInsertBelow={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(container.querySelector("[role='menu']")).toBeNull();
  });

  test("clicking Insert record invokes onInsertBelow and closes the menu", () => {
    const onInsertBelow = vi.fn();
    const onClose = vi.fn();
    render(
      <RowContextMenu
        open={defaultOpen()}
        onClose={onClose}
        onInsertBelow={onInsertBelow}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Insert record/ }));
    expect(onInsertBelow).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("clicking Delete record invokes onDelete and closes the menu", () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(
      <RowContextMenu
        open={defaultOpen()}
        onClose={onClose}
        onInsertBelow={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete record/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("aria-label includes the row number", () => {
    render(
      <RowContextMenu
        open={defaultOpen({ rowNumber: 7 })}
        onClose={vi.fn()}
        onInsertBelow={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("menu")).toHaveAttribute("aria-label", "Row 7 actions");
  });
});
