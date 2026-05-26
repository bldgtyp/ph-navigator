import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
];
const fieldDefs: FieldDef[] = [
  { field_key: "number", field_type: "text", display_name: "Number", default: "" },
  { field_key: "name", field_type: "text", display_name: "Name", default: "" },
];
const columnDefs: DataTableColumnDef<Row>[] = [
  { id: "number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
];

// Plan 30 D10 — Shift-Enter creates a truly blank row: `fieldDefaults`
// is sourced from FieldDef.default / natural zero only, never from the
// anchor row. `anchorRow` remains on the signature for the future
// explicit "Duplicate record" gesture and is intentionally unused here.
const buildEmptyRow: BuildEmptyRow<Row> = ({ rowId, fieldDefaults }) => ({
  id: rowId,
  number: String(fieldDefaults.number ?? ""),
  name: String(fieldDefaults.name ?? ""),
});

function renderTable(overrides: {
  onWrite?: (op: unknown) => void | Promise<void>;
  readOnly?: boolean;
  withBuildEmptyRow?: boolean;
}) {
  const { onWrite, readOnly = false, withBuildEmptyRow = true } = overrides;
  return render(
    <DataTable
      rows={rows}
      getRowId={(row) => row.id}
      fieldDefs={fieldDefs}
      columnDefs={columnDefs}
      view={emptyViewState()}
      onViewChange={vi.fn()}
      onWrite={onWrite}
      buildEmptyRow={withBuildEmptyRow ? buildEmptyRow : undefined}
      readOnly={readOnly}
      emptyMessage="No rows yet."
    />,
  );
}

describe("Shift+Enter row insert", () => {
  test("dispatches a rowInsert anchored on the active row", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    // Activate row 0, cell "name".
    fireEvent.click(screen.getByText("Living"));
    fireEvent.keyDown(screen.getByRole("grid"), { key: "Enter", shiftKey: true });

    await waitFor(() => expect(onWrite).toHaveBeenCalled());
    const op = onWrite.mock.calls[0]?.[0] as {
      kind: string;
      rows: { rowId: string; anchorRowId: string | null; fieldDefaults: Record<string, unknown> }[];
    };
    expect(op.kind).toBe("rowInsert");
    expect(op.rows).toHaveLength(1);
    expect(op.rows[0]?.anchorRowId).toBe("rm_1");
    expect(op.rows[0]?.rowId).toMatch(/^tmp_row_/);
    // Plan 30 D10 — defaults come from FieldDef.default / natural
    // zero, NOT from the anchor row (P-01 / Living). Empty strings
    // reflect the `default: ""` on both Field types above.
    expect(op.rows[0]?.fieldDefaults).toEqual({ number: "", name: "" });
  });

  test("is a no-op when buildEmptyRow is not provided", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite, withBuildEmptyRow: false });

    fireEvent.click(screen.getByText("Living"));
    fireEvent.keyDown(screen.getByRole("grid"), { key: "Enter", shiftKey: true });

    // Allow any async write to settle.
    await Promise.resolve();
    expect(onWrite).not.toHaveBeenCalled();
  });

  test("is silent in read-only mode", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite, readOnly: true });

    fireEvent.click(screen.getByText("Living"));
    fireEvent.keyDown(screen.getByRole("grid"), { key: "Enter", shiftKey: true });

    await Promise.resolve();
    expect(onWrite).not.toHaveBeenCalled();
  });
});
