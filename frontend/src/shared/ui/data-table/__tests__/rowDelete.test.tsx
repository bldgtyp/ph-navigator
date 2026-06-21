import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import {
  emptyViewState,
  type BuildEmptyRow,
  type DataTableColumnDef,
  type FieldDef,
} from "../types";

type Row = { id: string; number: string; name: string };

const rows: Row[] = [
  { id: "rm_1", number: "101", name: "Living" },
  { id: "rm_2", number: "102", name: "Kitchen" },
  { id: "rm_3", number: "103", name: "Bedroom" },
];
const fieldDefs: FieldDef[] = [
  { field_key: "number", field_type: "text", display_name: "Number" },
  { field_key: "name", field_type: "text", display_name: "Name" },
];
const columnDefs: DataTableColumnDef<Row>[] = [
  { id: "number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
];

const buildEmptyRow: BuildEmptyRow<Row> = ({ rowId, fieldDefaults }) => ({
  id: rowId,
  number: String(fieldDefaults.number ?? ""),
  name: String(fieldDefaults.name ?? ""),
});

function renderTable(onWrite: (op: unknown) => void | Promise<void>) {
  return render(
    <DataTable
      tableName="Test"
      rows={rows}
      getRowId={(row) => row.id}
      fieldDefs={fieldDefs}
      columnDefs={columnDefs}
      view={emptyViewState()}
      onViewChange={vi.fn()}
      onWrite={onWrite}
      buildEmptyRow={buildEmptyRow}
      emptyMessage="No rows yet."
    />,
  );
}

describe("Toolbar row delete", () => {
  test("Delete button is absent when no rows are selected", () => {
    renderTable(vi.fn());
    expect(screen.queryByRole("button", { name: /Delete .* selected/i })).toBeNull();
  });

  test("checkbox click surfaces the toolbar Delete action with the selection count", () => {
    renderTable(vi.fn());
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 2" }));
    expect(screen.getByRole("button", { name: /Delete 1 selected row$/i })).toBeInTheDocument();
  });

  test("shift-click on a second checkbox extends the selection", () => {
    renderTable(vi.fn());
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 3" }), { shiftKey: true });
    expect(screen.getByRole("button", { name: /Delete 3 selected rows$/i })).toBeInTheDocument();
  });

  test("confirm dispatches one rowDelete with all selected rows and clears the set", async () => {
    const onWrite = vi.fn();
    renderTable(onWrite);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 3" }), { shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: /Delete 3 selected rows$/i }));

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onWrite).toHaveBeenCalled());
    const op = onWrite.mock.calls[0]?.[0] as {
      kind: string;
      rows: { rowId: string; anchorRowId: string | null }[];
    };
    expect(op.kind).toBe("rowDelete");
    expect(op.rows.map((r) => r.rowId)).toEqual(["rm_1", "rm_2", "rm_3"]);
    expect(op.rows[0]?.anchorRowId).toBeNull();
    expect(op.rows[1]?.anchorRowId).toBe("rm_1");

    // Toolbar action cleared after delete.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Delete .* selected/i })).toBeNull(),
    );
  });

  test("cancel closes the dialog without dispatching", async () => {
    const onWrite = vi.fn();
    renderTable(onWrite);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 2" }));
    fireEvent.click(screen.getByRole("button", { name: /Delete 1 selected row$/i }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(onWrite).not.toHaveBeenCalled();
    // Selection persists so the user can adjust before re-opening.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Delete 1 selected row$/i })).toBeInTheDocument(),
    );
  });
});
