import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import {
  emptyViewState,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type ViewState,
} from "../types";

type Row = { id: string; number: string; name: string; count: number };

const ROWS: Row[] = [
  { id: "rm_1", number: "101", name: "Living", count: 1 },
  { id: "rm_2", number: "102", name: "Kitchen", count: 2 },
  { id: "rm_3", number: "103", name: "Bedroom", count: 3 },
];
const FIELD_DEFS: FieldDef[] = [
  { field_key: "number", field_type: "text", display_name: "Number" },
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "count", field_type: "number", display_name: "Count" },
];
const COLUMN_DEFS: DataTableColumnDef<Row>[] = [
  { id: "number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
  { id: "count", fieldKey: "count", header: "Count", accessor: (row) => row.count },
];

function renderTable(overrides: Partial<DataTableProps<Row>> = {}) {
  const [view, setView] = [emptyViewState(), vi.fn<(next: ViewState) => void>()];
  render(
    <DataTable<Row>
      rows={ROWS}
      getRowId={(row) => row.id}
      fieldDefs={FIELD_DEFS}
      columnDefs={COLUMN_DEFS}
      view={view}
      onViewChange={setView}
      emptyMessage="No rows yet."
      {...overrides}
    />,
  );
}

function getBodyCell(rowIndex: number, columnIndex: number): HTMLTableCellElement {
  const rowGroup = screen.getAllByRole("rowgroup")[1];
  if (!rowGroup) throw new Error("body rowgroup missing");
  const row = within(rowGroup).getAllByRole("row")[rowIndex];
  if (!row) throw new Error(`body row ${rowIndex} missing`);
  return within(row).getAllByRole("gridcell")[columnIndex] as HTMLTableCellElement;
}

describe("GridBody — DOM hit-test attrs", () => {
  test("body cells expose data-row-id and data-field-key", () => {
    renderTable();

    const cell = getBodyCell(0, 1);
    expect(cell.dataset.rowId).toBe("rm_1");
    expect(cell.dataset.fieldKey).toBe("name");

    const otherCell = getBodyCell(2, 2);
    expect(otherCell.dataset.rowId).toBe("rm_3");
    expect(otherCell.dataset.fieldKey).toBe("count");
  });
});

describe("GridBody — row-expand affordance", () => {
  test("renders an Expand button per row when onRowOpen is wired", () => {
    const onRowOpen = vi.fn();
    renderTable({ onRowOpen });

    const expandButtons = screen.getAllByRole("button", { name: /Expand row \d/ });
    expect(expandButtons).toHaveLength(ROWS.length);
  });

  test("clicking the Expand button invokes onRowOpen with that row", () => {
    const onRowOpen = vi.fn();
    renderTable({ onRowOpen });

    fireEvent.click(screen.getByRole("button", { name: "Expand row 2" }));
    expect(onRowOpen).toHaveBeenCalledWith(ROWS[1]);
  });

  test("clicking the Expand button does not bubble to the row-select gesture", () => {
    const onRowOpen = vi.fn();
    renderTable({ onRowOpen });

    fireEvent.click(screen.getByRole("button", { name: "Expand row 1" }));
    // The cell-range shouldn't have collapsed to a whole-row selection
    // — onSelectRow is the gutter number's click handler, separate from
    // Expand. We assert by checking that no body cell carries the
    // explicit-range selected class.
    const cell = getBodyCell(0, 1);
    expect(cell).not.toHaveClass("data-table-cell-selected");
  });

  test("omits the Expand button when onRowOpen is undefined", () => {
    renderTable();
    expect(screen.queryByRole("button", { name: /Expand row/ })).not.toBeInTheDocument();
  });
});

describe("GridBody — perimeter outline rendering", () => {
  test("the active 1x1 cell has no perimeter box-shadow (outline channel only)", () => {
    renderTable();

    const active = getBodyCell(0, 0);
    expect(active).toHaveClass("data-table-cell-active");
    expect(active).not.toHaveClass("data-table-cell-selected");
    expect(active.style.boxShadow).toBe("");
  });

  test("dragging Shift+ArrowDown produces a 2x1 range with top+left+right on the first cell and bottom+left+right on the last", () => {
    renderTable();

    const grid = screen.getByRole("grid");
    // Anchor at row 0, col 0 (default focus).
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });

    const top = getBodyCell(0, 0);
    const bottom = getBodyCell(1, 0);

    expect(top).toHaveClass("data-table-cell-selected");
    expect(bottom).toHaveClass("data-table-cell-selected");
    // 1-column range → both cells carry left+right edges. Top cell adds
    // top edge; bottom cell adds bottom edge.
    expect(top.style.boxShadow).toContain("inset 0 1px 0 0 var(--accent-edge)");
    expect(top.style.boxShadow).toContain("inset -1px 0 0 0 var(--accent-edge)");
    expect(top.style.boxShadow).toContain("inset 1px 0 0 0 var(--accent-edge)");
    expect(top.style.boxShadow).not.toContain("inset 0 -1px 0 0 var(--accent-edge)");
    expect(bottom.style.boxShadow).toContain("inset 0 -1px 0 0 var(--accent-edge)");
    expect(bottom.style.boxShadow).not.toContain("inset 0 1px 0 0 var(--accent-edge)");
  });

  test("a 2x2 range marks the four corner cells with the right pair of edges", () => {
    renderTable();

    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(grid, { key: "ArrowRight", shiftKey: true });

    const topLeft = getBodyCell(0, 0);
    const topRight = getBodyCell(0, 1);
    const bottomLeft = getBodyCell(1, 0);
    const bottomRight = getBodyCell(1, 1);

    // top-left: top + left only
    expect(topLeft.style.boxShadow).toContain("inset 0 1px 0 0 var(--accent-edge)");
    expect(topLeft.style.boxShadow).toContain("inset 1px 0 0 0 var(--accent-edge)");
    expect(topLeft.style.boxShadow).not.toContain("inset -1px 0 0 0 var(--accent-edge)");
    expect(topLeft.style.boxShadow).not.toContain("inset 0 -1px 0 0 var(--accent-edge)");

    // top-right: top + right
    expect(topRight.style.boxShadow).toContain("inset 0 1px 0 0 var(--accent-edge)");
    expect(topRight.style.boxShadow).toContain("inset -1px 0 0 0 var(--accent-edge)");

    // bottom-left: bottom + left
    expect(bottomLeft.style.boxShadow).toContain("inset 0 -1px 0 0 var(--accent-edge)");
    expect(bottomLeft.style.boxShadow).toContain("inset 1px 0 0 0 var(--accent-edge)");

    // bottom-right: bottom + right
    expect(bottomRight.style.boxShadow).toContain("inset 0 -1px 0 0 var(--accent-edge)");
    expect(bottomRight.style.boxShadow).toContain("inset -1px 0 0 0 var(--accent-edge)");
  });

  test("a 3x1 range marks the middle cell with left+right only (interior bit unset)", () => {
    renderTable();

    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });

    const middle = getBodyCell(1, 0);
    expect(middle).toHaveClass("data-table-cell-selected");
    expect(middle.style.boxShadow).toContain("inset 1px 0 0 0 var(--accent-edge)");
    expect(middle.style.boxShadow).toContain("inset -1px 0 0 0 var(--accent-edge)");
    expect(middle.style.boxShadow).not.toContain("inset 0 1px 0 0 var(--accent-edge)");
    expect(middle.style.boxShadow).not.toContain("inset 0 -1px 0 0 var(--accent-edge)");
  });

  test("Shift+Click extends the range — the subsequent click event does not collapse it", () => {
    renderTable();

    const grid = screen.getByRole("grid");
    // Click row 0, col 0 to anchor.
    fireEvent.click(getBodyCell(0, 0));
    // Shift+Click row 2, col 1 — mousedown extends via the drag hook,
    // click event must NOT call setActive (which would collapse the
    // range to 1×1). Regression test for the Phase 3 demo walk fix.
    fireEvent.mouseDown(getBodyCell(2, 1), { button: 0, shiftKey: true });
    fireEvent.mouseUp(getBodyCell(2, 1), { shiftKey: true });
    fireEvent.click(getBodyCell(2, 1), { shiftKey: true });

    const selectedCount = grid.querySelectorAll(".data-table-cell-selected").length;
    expect(selectedCount).toBe(6); // 3 rows × 2 cols
  });

  test("cells outside the range carry no perimeter shadow and no selected class", () => {
    renderTable();

    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });

    const outside = getBodyCell(2, 2);
    expect(outside).not.toHaveClass("data-table-cell-selected");
    expect(outside.style.boxShadow).toBe("");
  });
});

describe("GridBody — fill handle (Phase 7)", () => {
  test("the active cell carries data-fill-handle='true' and renders the FillHandle when writable", () => {
    renderTable({ onWrite: vi.fn() });
    const active = getBodyCell(0, 0);
    expect(active.dataset.fillHandle).toBe("true");
    expect(within(active).getByRole("button", { name: "Drag to fill" })).toBeInTheDocument();
  });

  test("no handle when the table is read-only (no onWrite handler)", () => {
    renderTable();
    const active = getBodyCell(0, 0);
    expect(active.dataset.fillHandle).toBeUndefined();
    expect(active.querySelector(".data-table-fill-handle")).toBeNull();
  });

  test("no handle when readOnly is true", () => {
    renderTable({ readOnly: true, onWrite: vi.fn() });
    const active = getBodyCell(0, 0);
    expect(active.dataset.fillHandle).toBeUndefined();
  });

  test("no handle when the source spans more than one group", () => {
    const onViewChange = vi.fn<(next: ViewState) => void>();
    render(
      <DataTable<Row>
        rows={ROWS}
        getRowId={(row) => row.id}
        fieldDefs={FIELD_DEFS}
        columnDefs={COLUMN_DEFS}
        view={{
          ...emptyViewState(),
          group: [{ fieldKey: "name", direction: "asc" }],
        }}
        onViewChange={onViewChange}
        onWrite={vi.fn()}
        emptyMessage="No rows yet."
      />,
    );
    // Each row has a unique `name`, so each row is its own group. A
    // 1-row selection sits within one group → handle visible. Now
    // extend the selection across rows: Shift+ArrowDown.
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
    // The selection spans 3 unique-name groups — no cell should carry
    // the fill-handle attribute.
    expect(document.querySelector("[data-fill-handle]")).toBeNull();
  });
});

describe("GridBody — group accordion", () => {
  test("renders group-header rows when view.group is non-empty", () => {
    const onViewChange = vi.fn<(next: ViewState) => void>();
    render(
      <DataTable<Row>
        rows={ROWS}
        getRowId={(row) => row.id}
        fieldDefs={FIELD_DEFS}
        columnDefs={COLUMN_DEFS}
        view={{
          ...emptyViewState(),
          group: [{ fieldKey: "name", direction: "asc" }],
        }}
        onViewChange={onViewChange}
        emptyMessage="No rows yet."
      />,
    );

    const groupRows = document.querySelectorAll(".data-table-group-row");
    // Each row has a unique `name` value, so we get one group header per row.
    expect(groupRows.length).toBe(3);
    // The first column in each group header shows chevron + key + count.
    const firstGroup = groupRows[0]!;
    expect(firstGroup.querySelector(".data-table-group-chevron")).not.toBeNull();
    expect(firstGroup.textContent).toContain("(1 row)");
  });

  test("aggregation values render in the group header for the aggregated column", () => {
    const onViewChange = vi.fn<(next: ViewState) => void>();
    render(
      <DataTable<Row>
        rows={ROWS}
        getRowId={(row) => row.id}
        fieldDefs={FIELD_DEFS}
        columnDefs={COLUMN_DEFS}
        view={{
          ...emptyViewState(),
          group: [{ fieldKey: "name", direction: "asc" }],
          aggregations: { count: "sum" },
        }}
        onViewChange={onViewChange}
        emptyMessage="No rows yet."
      />,
    );

    const groupRows = document.querySelectorAll(".data-table-group-row");
    // The count column is the third visible column (after the gutter).
    // Each group has one row so sum equals that row's count value.
    const counts = Array.from(groupRows).map(
      (row) => row.querySelectorAll(".data-table-group-aggregation")[1]?.textContent,
    );
    // ROWS sorted by name asc: Bedroom (3), Kitchen (2), Living (1).
    expect(counts).toEqual(["3.00", "2.00", "1.00"]);
  });

  test("clicking the chevron dispatches a view change toggling expandedGroups", () => {
    const onViewChange = vi.fn<(next: ViewState) => void>();
    render(
      <DataTable<Row>
        rows={ROWS}
        getRowId={(row) => row.id}
        fieldDefs={FIELD_DEFS}
        columnDefs={COLUMN_DEFS}
        view={{
          ...emptyViewState(),
          group: [{ fieldKey: "name", direction: "asc" }],
        }}
        onViewChange={onViewChange}
        emptyMessage="No rows yet."
      />,
    );

    const chevron = document.querySelector(".data-table-group-chevron") as HTMLButtonElement;
    expect(chevron).not.toBeNull();
    fireEvent.click(chevron);
    expect(onViewChange).toHaveBeenCalled();
    const next = onViewChange.mock.calls[0]![0] as ViewState;
    // Exactly one path key should be flipped to false.
    const flipped = Object.entries(next.expandedGroups).filter(([, v]) => v === false);
    expect(flipped.length).toBe(1);
  });
});
