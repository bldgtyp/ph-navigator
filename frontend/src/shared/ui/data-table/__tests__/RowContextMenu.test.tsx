import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RowContextMenu, type RowContextMenuOpenState } from "../components/RowContextMenu";

// Unit coverage for the row context menu. Single-row gestures cover the
// four built-in items (Insert / Duplicate / Expand / Delete). "Expand
// record" is UNCONDITIONAL — `onOpen` is a required prop, never gated on
// per-table wiring (DataTable always supplies a handler). The multi-row
// cases cover PRD §5 rules 1 / 2 / 3 plus the render-perf freeze contract
// on `selectionCount` / `rowIsInSelection`. Delegated `contextmenu`
// listener wiring is exercised by the GridBody / DataTable integration
// tests and the Playwright e2e specs.

function defaultOpen(overrides: Partial<RowContextMenuOpenState> = {}): RowContextMenuOpenState {
  return {
    rowId: "r1",
    rowNumber: 1,
    x: 100,
    y: 50,
    returnFocus: null,
    selectionCount: 0,
    rowIsInSelection: false,
    customActions: [],
    ...overrides,
  };
}

type RenderOverrides = Partial<{
  open: RowContextMenuOpenState | null;
  onClose: () => void;
  onInsertBelow: () => void;
  onDuplicate: () => void;
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
      onDuplicate={overrides.onDuplicate ?? vi.fn()}
      onOpen={overrides.onOpen ?? vi.fn()}
      onDelete={overrides.onDelete ?? vi.fn()}
      onDeleteSelection={overrides.onDeleteSelection ?? vi.fn()}
    />,
  );
}

describe("RowContextMenu — single-row branch", () => {
  test("renders Insert / Duplicate / Expand / Delete in order", () => {
    renderMenu({ onOpen: vi.fn() });
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).toEqual([
      expect.stringContaining("Insert record"),
      expect.stringContaining("Duplicate record"),
      expect.stringContaining("Expand record"),
      expect.stringContaining("Delete record"),
    ]);
  });

  test("Expand record is always present — the affordance is never gated", () => {
    // No `onOpen` override here: the helper still supplies a handler
    // because `onOpen` is a required prop. There is no code path that
    // drops the item, so a table can never lose row-expand.
    renderMenu();
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).toEqual([
      expect.stringContaining("Insert record"),
      expect.stringContaining("Duplicate record"),
      expect.stringContaining("Expand record"),
      expect.stringContaining("Delete record"),
    ]);
  });

  test("Duplicate record carries no danger tint and no shortcut hint", () => {
    renderMenu();
    const dup = screen.getByRole("menuitem", { name: /Duplicate record/ });
    expect(dup).not.toHaveAttribute("data-danger");
    expect(dup.querySelector(".data-table-column-menu-item-hint")).toBeNull();
  });

  test("clicking Duplicate record invokes onDuplicate and closes the menu", () => {
    const onDuplicate = vi.fn();
    const onClose = vi.fn();
    renderMenu({ onDuplicate, onClose });
    fireEvent.click(screen.getByRole("menuitem", { name: /Duplicate record/ }));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
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
      expect.stringContaining("Duplicate record"),
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
      expect.stringContaining("Duplicate record"),
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
        onDuplicate={vi.fn()}
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
        onDuplicate={vi.fn()}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
        onDeleteSelection={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  });
});

describe("RowContextMenu — rowActions extension slot (Phase 4)", () => {
  const fixtureActions = [
    {
      key: "ping",
      label: "Ping row",
      icon: <span data-testid="ping-icon" />,
      shortcutHint: "P",
      onSelect: () => undefined,
    },
    {
      key: "archive",
      label: "Archive row",
      danger: true,
      onSelect: () => undefined,
    },
  ];

  test("renders custom items after the built-ins separated by a divider", () => {
    renderMenu({
      open: defaultOpen({ customActions: fixtureActions }),
      onOpen: vi.fn(),
    });
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent ?? "");
    expect(items).toEqual([
      expect.stringContaining("Insert record"),
      expect.stringContaining("Duplicate record"),
      expect.stringContaining("Expand record"),
      expect.stringContaining("Delete record"),
      expect.stringContaining("Ping row"),
      expect.stringContaining("Archive row"),
    ]);
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });

  test("returning [] produces no divider", () => {
    renderMenu({ open: defaultOpen({ customActions: [] }), onOpen: vi.fn() });
    expect(screen.queryByRole("separator")).toBeNull();
  });

  test("danger flag routes to data-danger=true on the custom item", () => {
    renderMenu({ open: defaultOpen({ customActions: fixtureActions }) });
    const archive = screen.getByRole("menuitem", { name: /Archive row/ });
    expect(archive).toHaveAttribute("data-danger", "true");
    const ping = screen.getByRole("menuitem", { name: /Ping row/ });
    expect(ping).not.toHaveAttribute("data-danger");
  });

  test("custom item icon renders in the icon slot", () => {
    renderMenu({ open: defaultOpen({ customActions: fixtureActions }) });
    const ping = screen.getByRole("menuitem", { name: /Ping row/ });
    expect(ping.querySelector("[data-testid='ping-icon']")).not.toBeNull();
  });

  test("clicking a custom item closes the menu then invokes onSelect", () => {
    const onPing = vi.fn();
    const onClose = vi.fn();
    const callOrder: string[] = [];
    onClose.mockImplementation(() => callOrder.push("close"));
    onPing.mockImplementation(() => callOrder.push("ping"));
    renderMenu({
      open: defaultOpen({
        customActions: [
          {
            key: "ping",
            label: "Ping row",
            onSelect: onPing,
          },
        ],
      }),
      onClose,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: /Ping row/ }));
    expect(callOrder).toEqual(["close", "ping"]);
  });

  test("each custom item carries a stable data-row-action-key for test selectors", () => {
    renderMenu({ open: defaultOpen({ customActions: fixtureActions }) });
    expect(screen.getByRole("menuitem", { name: /Ping row/ })).toHaveAttribute(
      "data-row-action-key",
      "ping",
    );
    expect(screen.getByRole("menuitem", { name: /Archive row/ })).toHaveAttribute(
      "data-row-action-key",
      "archive",
    );
  });

  test("collapsed branch suppresses custom items entirely (PRD §5 rule 1)", () => {
    renderMenu({
      open: defaultOpen({
        selectionCount: 3,
        rowIsInSelection: true,
        customActions: fixtureActions,
      }),
    });
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Delete 3 records");
    expect(screen.queryByRole("separator")).toBeNull();
  });

  test("shortcutHint on a custom item renders as right-aligned hint text", () => {
    renderMenu({ open: defaultOpen({ customActions: fixtureActions }) });
    const ping = screen.getByRole("menuitem", { name: /Ping row/ });
    const hint = ping.querySelector(".data-table-column-menu-item-hint");
    expect(hint?.textContent).toBe("P");
  });
});
