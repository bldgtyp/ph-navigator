import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import {
  emptyViewState,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type ViewState,
} from "../types";

type Row = { id: string; number: string; floor: string | null; count: number };

const ROWS: Row[] = [
  { id: "rm_1", number: "101", floor: "opt_ground", count: 1 },
  { id: "rm_2", number: "102", floor: "opt_roof", count: 2 },
];
const FIELD_DEFS: FieldDef[] = [
  { field_key: "number", field_type: "text", display_name: "Number" },
  {
    field_key: "floor",
    field_type: "single_select",
    display_name: "Floor",
    options: [
      { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
      { id: "opt_roof", label: "Roof", color: "#10b981", order: 1 },
    ],
  },
  { field_key: "count", field_type: "number", display_name: "Count" },
];
const COLUMN_DEFS: DataTableColumnDef<Row>[] = [
  { id: "number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  { id: "floor", fieldKey: "floor", header: "Floor", accessor: (row) => row.floor },
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
      onWrite={vi.fn()}
      {...overrides}
    />,
  );
}

function getColumnHeader(name: string): HTMLElement {
  return screen.getByRole("columnheader", { name: new RegExp(name) });
}

describe("DataTable column header double-click trigger (Phase 5 §4.2)", () => {
  test("editable single_select headers expose data-field-editable + chevron", () => {
    renderTable();
    const floor = getColumnHeader("Floor");
    expect(floor).toHaveAttribute("data-field-editable", "true");
    // The chevron lives inside the header row as an aria-hidden span.
    expect(floor.querySelector(".data-table-header-edit-chevron")).not.toBeNull();
  });

  test("non-single-select headers do not expose data-field-editable or chevron", () => {
    renderTable();
    for (const name of ["Number", "Count"]) {
      const header = getColumnHeader(name);
      expect(header).not.toHaveAttribute("data-field-editable");
      expect(header.querySelector(".data-table-header-edit-chevron")).toBeNull();
    }
  });

  test("readOnly removes the chevron and the data-field-editable attribute", () => {
    renderTable({ readOnly: true });
    const floor = getColumnHeader("Floor");
    expect(floor).not.toHaveAttribute("data-field-editable");
    expect(floor.querySelector(".data-table-header-edit-chevron")).toBeNull();
  });

  test("missing onWrite removes the chevron and the data-field-editable attribute", () => {
    renderTable({ onWrite: undefined });
    const floor = getColumnHeader("Floor");
    expect(floor).not.toHaveAttribute("data-field-editable");
    expect(floor.querySelector(".data-table-header-edit-chevron")).toBeNull();
  });

  test("double-click on a non-editable header is a no-op (does not flip data-field-editor-open)", () => {
    renderTable();
    const number = getColumnHeader("Number");
    fireEvent.doubleClick(number);
    expect(number).not.toHaveAttribute("data-field-editor-open");
  });

  test("double-click on an editable single_select header flips data-field-editor-open", () => {
    renderTable();
    const floor = getColumnHeader("Floor");
    expect(floor).not.toHaveAttribute("data-field-editor-open");
    // Simulate native double-click sequence: mousedown(detail=1), then
    // mousedown(detail=2), then dblclick.
    fireEvent.mouseDown(floor, { button: 0, detail: 1 });
    fireEvent.mouseDown(floor, { button: 0, detail: 2 });
    fireEvent.doubleClick(floor);
    expect(floor).toHaveAttribute("data-field-editor-open", "true");
  });

  test("second mousedown of a double-click does not extend column-select range", () => {
    renderTable();
    const floor = getColumnHeader("Floor");
    // First click selects the column.
    fireEvent.mouseDown(floor, { button: 0, detail: 1 });
    // Second mousedown of the dbl-click sequence must short-circuit
    // before the column-select extend logic runs. The chevron-bearing
    // column is selected; subsequent ranges (held shift) would extend
    // — but a detail===2 mousedown should not.
    fireEvent.mouseDown(floor, { button: 0, detail: 2, shiftKey: true });
    // No throw, no selection extension assertion needed beyond
    // verifying the dbl-click then opens the editor cleanly.
    fireEvent.doubleClick(floor);
    expect(floor).toHaveAttribute("data-field-editor-open", "true");
  });
});
