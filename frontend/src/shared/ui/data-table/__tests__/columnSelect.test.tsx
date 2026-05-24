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

function getColumnHeader(name: string): HTMLElement {
  // The header `<th>` itself is the column-select hit target. Match by
  // its accessible label (the rendered header text).
  return screen.getByRole("columnheader", { name: new RegExp(name) });
}

function getBodyCell(rowIndex: number, columnIndex: number): HTMLTableCellElement {
  const rowGroup = screen.getAllByRole("rowgroup")[1];
  if (!rowGroup) throw new Error("body rowgroup missing");
  const row = within(rowGroup).getAllByRole("row")[rowIndex];
  if (!row) throw new Error(`body row ${rowIndex} missing`);
  return within(row).getAllByRole("gridcell")[columnIndex] as HTMLTableCellElement;
}

describe("DataTable column-select via header click (Phase 3 R1)", () => {
  test("mousedown anywhere on the header selects the full column", () => {
    renderTable();

    fireEvent.mouseDown(getColumnHeader("Name"), { button: 0 });

    const topCell = getBodyCell(0, 1);
    const middleCell = getBodyCell(1, 1);
    const bottomCell = getBodyCell(2, 1);

    expect(topCell).toHaveClass("data-table-cell-selected");
    expect(middleCell).toHaveClass("data-table-cell-selected");
    expect(bottomCell).toHaveClass("data-table-cell-selected");

    // Outside the selected column: no selected styling.
    expect(getBodyCell(0, 0)).not.toHaveClass("data-table-cell-selected");
    expect(getBodyCell(0, 2)).not.toHaveClass("data-table-cell-selected");

    expect(topCell.style.boxShadow).toBe("");
    expect(middleCell.style.boxShadow).toBe("");
    expect(bottomCell.style.boxShadow).toBe("");
  });

  test("clicking the same header again deselects the column (toggle)", () => {
    renderTable();

    fireEvent.mouseDown(getColumnHeader("Name"), { button: 0 });
    expect(getBodyCell(0, 1)).toHaveClass("data-table-cell-selected");

    fireEvent.mouseDown(getColumnHeader("Name"), { button: 0 });

    // Range collapses; no body cell carries the selected class.
    expect(getBodyCell(0, 1)).not.toHaveClass("data-table-cell-selected");
    expect(getBodyCell(1, 1)).not.toHaveClass("data-table-cell-selected");
    expect(getBodyCell(2, 1)).not.toHaveClass("data-table-cell-selected");
  });

  test("Shift+mousedown on a second header extends across to a contiguous column block", () => {
    renderTable();

    fireEvent.mouseDown(getColumnHeader("Number"), { button: 0 });
    fireEvent.mouseDown(getColumnHeader("Count"), { button: 0, shiftKey: true });

    for (let columnIndex = 0; columnIndex <= 2; columnIndex += 1) {
      for (let rowIndex = 0; rowIndex <= 2; rowIndex += 1) {
        expect(getBodyCell(rowIndex, columnIndex)).toHaveClass("data-table-cell-selected");
      }
    }
  });

  test("the per-column sort chevron is gone after Phase 4", () => {
    renderTable();

    // Phase 4 §4.9: per-column sort UI is removed. The header carries
    // only a plain label; sort lives only in the toolbar Sort popover
    // (Step 4). No `Sort by X` button exists in the header.
    const header = getColumnHeader("Name");
    expect(within(header).queryByRole("button", { name: /Sort by Name/ })).not.toBeInTheDocument();
  });

  test("read-only mode keeps the header click target for drag-select / copy", () => {
    renderTable({ readOnly: true });

    fireEvent.mouseDown(getColumnHeader("Name"), { button: 0 });
    expect(getBodyCell(0, 1)).toHaveClass("data-table-cell-selected");
  });

  test("non-primary mousedown is ignored", () => {
    renderTable();

    fireEvent.mouseDown(getColumnHeader("Name"), { button: 2 });

    expect(getBodyCell(0, 1)).not.toHaveClass("data-table-cell-selected");
  });
});
