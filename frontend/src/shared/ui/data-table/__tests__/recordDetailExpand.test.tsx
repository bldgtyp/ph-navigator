import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import {
  emptyViewState,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type ViewState,
} from "../types";

// Integration coverage for the BUILT-IN record-detail modal — the
// always-available expand target DataTable opens when a consumer does not
// supply a custom `onRowOpen`. This is the guarantee that makes a dead
// expand button impossible: any table, with zero per-table wiring, gets a
// working modal that reads every field and edits the safe ones through the
// normal write pipeline.

type Row = {
  id: string;
  name: string;
  count: number | null;
  status: string | null;
  code: string;
};

const ROWS: Row[] = [{ id: "r1", name: "Pump A", count: 2, status: "active", code: "P-1" }];

const FIELD_DEFS: FieldDef[] = [
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "count", field_type: "number", display_name: "Count" },
  {
    field_key: "status",
    field_type: "single_select",
    display_name: "Status",
    options: [
      { id: "active", label: "Active", color: "#16a34a", order: 0 },
      { id: "idle", label: "Idle", color: "#9ca3af", order: 1 },
    ],
  },
  // `read_only` resolves to no editor, so the modal renders it as a
  // read-only value, not an input.
  { field_key: "code", field_type: "text", display_name: "Code", read_only: true },
];

const COLUMN_DEFS: DataTableColumnDef<Row>[] = [
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name, isIdentifier: true },
  { id: "count", fieldKey: "count", header: "Count", accessor: (row) => row.count },
  { id: "status", fieldKey: "status", header: "Status", accessor: (row) => row.status },
  { id: "code", fieldKey: "code", header: "Code", accessor: (row) => row.code },
];

function renderTable(overrides: Partial<DataTableProps<Row>> = {}) {
  const [view, setView] = [emptyViewState(), vi.fn<(next: ViewState) => void>()];
  return render(
    <DataTable<Row>
      tableName="Test"
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

function openModal() {
  fireEvent.click(screen.getByRole("button", { name: "Expand row 1" }));
  return screen.getByRole("dialog");
}

describe("built-in record-detail modal", () => {
  test("opens with editable inputs for safe types and a read-only value for read_only fields", () => {
    renderTable({ onWrite: vi.fn() });
    const dialog = openModal();

    // Editable fields render real inputs prefilled from the row.
    expect(within(dialog).getByLabelText("Name")).toHaveValue("Pump A");
    expect(within(dialog).getByLabelText("Count")).toHaveValue(2);
    // The read_only field shows its value but offers no input.
    const codeValue = within(dialog).getByText("P-1");
    expect(codeValue.closest(".data-table-record-detail-readonly-value")).not.toBeNull();
  });

  test("editing a field and saving dispatches a cell write through onWrite", async () => {
    const onWrite = vi.fn().mockResolvedValue(undefined);
    renderTable({ onWrite });
    const dialog = openModal();

    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Pump B" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onWrite).toHaveBeenCalledTimes(1));
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "r1", fieldKey: "name", value: "Pump B" }],
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  test("saving with no edits closes the modal without any write", () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });
    const dialog = openModal();

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(onWrite).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("a read-only table opens a view-only modal: no inputs, no Save", () => {
    renderTable(); // no onWrite → table is effectively read-only
    const dialog = openModal();

    expect(within(dialog).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Name")).not.toBeInTheDocument();
    // Every field renders as a read-only value box (no inputs), including
    // the Name field that is editable in the writable variant above.
    const readonlyValues = [...dialog.querySelectorAll(".data-table-record-detail-readonly-value")];
    expect(readonlyValues.some((el) => el.textContent === "Pump A")).toBe(true);
    // The shared modal shell still offers a way out.
    expect(within(dialog).getAllByRole("button", { name: "Close" }).length).toBeGreaterThan(0);
  });

  test("a consumer-supplied onRowOpen overrides the built-in modal", () => {
    const onRowOpen = vi.fn();
    renderTable({ onWrite: vi.fn(), onRowOpen });

    fireEvent.click(screen.getByRole("button", { name: "Expand row 1" }));

    expect(onRowOpen).toHaveBeenCalledWith(ROWS[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
