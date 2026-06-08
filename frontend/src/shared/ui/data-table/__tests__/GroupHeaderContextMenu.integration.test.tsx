import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import { emptyViewState, type DataTableColumnDef, type FieldDef, type ViewState } from "../types";

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

function renderGroupedTable(view: ViewState, onViewChange: (next: ViewState) => void) {
  render(
    <DataTable<Row>
      rows={ROWS}
      getRowId={(row) => row.id}
      fieldDefs={FIELD_DEFS}
      columnDefs={COLUMN_DEFS}
      view={view}
      onViewChange={onViewChange}
      emptyMessage="No rows yet."
    />,
  );
}

function firstGroupRow(): HTMLTableRowElement {
  const row = document.querySelector(".data-table-group-row");
  if (!(row instanceof HTMLTableRowElement)) throw new Error("group row missing");
  return row;
}

describe("GroupHeaderContextMenu integration", () => {
  test("right-clicking a group header exposes Collapse all / Expand all actions", () => {
    const onViewChange = vi.fn<(next: ViewState) => void>();
    renderGroupedTable(
      {
        ...emptyViewState(),
        group: [{ fieldKey: "name", direction: "asc" }],
      },
      onViewChange,
    );

    fireEvent.contextMenu(firstGroupRow(), { clientX: 80, clientY: 120 });

    fireEvent.click(screen.getByRole("menuitem", { name: /Collapse all/ }));
    expect(onViewChange).toHaveBeenCalledTimes(1);
    const collapsed = onViewChange.mock.calls[0]![0] as ViewState;
    expect(Object.values(collapsed.expandedGroups)).toEqual([false, false, false]);

    onViewChange.mockClear();
    fireEvent.contextMenu(firstGroupRow(), { clientX: 80, clientY: 120 });
    fireEvent.click(screen.getByRole("menuitem", { name: /Expand all/ }));
    expect(onViewChange).not.toHaveBeenCalled();
  });

  test("right-clicking a group header expands all when any group is collapsed", () => {
    const onViewChange = vi.fn<(next: ViewState) => void>();
    renderGroupedTable(
      {
        ...emptyViewState(),
        group: [{ fieldKey: "name", direction: "asc" }],
        expandedGroups: { '"Bedroom"': false },
      },
      onViewChange,
    );

    fireEvent.contextMenu(firstGroupRow(), { clientX: 80, clientY: 120 });
    fireEvent.click(screen.getByRole("menuitem", { name: /Expand all/ }));

    expect(onViewChange).toHaveBeenCalledTimes(1);
    const expanded = onViewChange.mock.calls[0]![0] as ViewState;
    expect(expanded.expandedGroups).toEqual({});
  });
});
