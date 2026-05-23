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

function getColumnSelectStrip(displayName: string): HTMLElement {
  return screen.getByRole("button", { name: `Select column ${displayName}` });
}

function getBodyCell(rowIndex: number, columnIndex: number): HTMLTableCellElement {
  const rowGroup = screen.getAllByRole("rowgroup")[1];
  if (!rowGroup) throw new Error("body rowgroup missing");
  const row = within(rowGroup).getAllByRole("row")[rowIndex];
  if (!row) throw new Error(`body row ${rowIndex} missing`);
  return within(row).getAllByRole("gridcell")[columnIndex] as HTMLTableCellElement;
}

describe("DataTable column-select strip", () => {
  test("each header renders a column-select strip with the right fieldKey", () => {
    renderTable();

    const numberStrip = getColumnSelectStrip("Number");
    expect(numberStrip.dataset.columnSelectFieldkey).toBe("number");

    const nameStrip = getColumnSelectStrip("Name");
    expect(nameStrip.dataset.columnSelectFieldkey).toBe("name");

    const countStrip = getColumnSelectStrip("Count");
    expect(countStrip.dataset.columnSelectFieldkey).toBe("count");
  });

  test("mousedown on the strip selects the full column (perimeter outline spans all rows)", () => {
    renderTable();

    fireEvent.mouseDown(getColumnSelectStrip("Name"), { button: 0 });

    // After column select, every body cell in the `name` column should
    // be marked as selected (interior fill + perimeter outline).
    const topCell = getBodyCell(0, 1);
    const middleCell = getBodyCell(1, 1);
    const bottomCell = getBodyCell(2, 1);

    expect(topCell).toHaveClass("data-table-cell-selected");
    expect(middleCell).toHaveClass("data-table-cell-selected");
    expect(bottomCell).toHaveClass("data-table-cell-selected");

    // Outside the selected column: no selected styling.
    expect(getBodyCell(0, 0)).not.toHaveClass("data-table-cell-selected");
    expect(getBodyCell(0, 2)).not.toHaveClass("data-table-cell-selected");

    // Edges compose: the top cell carries the top edge, the bottom the
    // bottom edge, every cell in the column carries left+right.
    expect(topCell.style.boxShadow).toContain("inset 0 1px 0 0 var(--accent-edge)");
    expect(topCell.style.boxShadow).toContain("inset 1px 0 0 0 var(--accent-edge)");
    expect(topCell.style.boxShadow).toContain("inset -1px 0 0 0 var(--accent-edge)");
    expect(bottomCell.style.boxShadow).toContain("inset 0 -1px 0 0 var(--accent-edge)");
    expect(middleCell.style.boxShadow).not.toContain("inset 0 1px 0 0 var(--accent-edge)");
    expect(middleCell.style.boxShadow).not.toContain("inset 0 -1px 0 0 var(--accent-edge)");
  });

  test("Shift+mousedown on a second strip extends across to a contiguous column block", () => {
    renderTable();

    // First click: anchor on `number`.
    fireEvent.mouseDown(getColumnSelectStrip("Number"), { button: 0 });
    // Second click: shift-extend to `count` — should cover number,
    // name, and count.
    fireEvent.mouseDown(getColumnSelectStrip("Count"), { button: 0, shiftKey: true });

    for (let columnIndex = 0; columnIndex <= 2; columnIndex += 1) {
      for (let rowIndex = 0; rowIndex <= 2; rowIndex += 1) {
        expect(getBodyCell(rowIndex, columnIndex)).toHaveClass("data-table-cell-selected");
      }
    }
  });

  test("read-only mode still renders the strip (drag-select for copy is preserved)", () => {
    renderTable({ readOnly: true });

    // Strip is present and clickable.
    fireEvent.mouseDown(getColumnSelectStrip("Name"), { button: 0 });
    expect(getBodyCell(0, 1)).toHaveClass("data-table-cell-selected");
  });

  test("non-primary mousedown is ignored on the strip", () => {
    renderTable();

    fireEvent.mouseDown(getColumnSelectStrip("Name"), { button: 2 });

    expect(getBodyCell(0, 1)).not.toHaveClass("data-table-cell-selected");
  });
});
