import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import { emptyViewState, type DataTableColumnDef, type FieldDef } from "../types";

type Row = { id: string; name: string };

const rows: Row[] = [
  { id: "rec_1", name: "First" },
  { id: "rec_2", name: "Second" },
  { id: "rec_3", name: "Third" },
];
const fieldDefs: FieldDef[] = [{ field_key: "name", field_type: "text", display_name: "Name" }];
const columnDefs: DataTableColumnDef<Row>[] = [
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
];

describe("DataTable bulkSelectionActions", () => {
  test("renderer is not called when no rows are selected", () => {
    const renderer = vi.fn(() => null);
    render(
      <DataTable
        tableName="Test"
        rows={rows}
        getRowId={(row) => row.id}
        fieldDefs={fieldDefs}
        columnDefs={columnDefs}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
        emptyMessage="No rows yet."
        bulkSelectionActions={renderer}
      />,
    );
    expect(renderer).not.toHaveBeenCalled();
  });

  test("renderer receives the live selection set and its output renders in the toolbar", () => {
    const renderer = vi.fn((selected: ReadonlySet<string>) => (
      <button type="button">Custom action ({selected.size})</button>
    ));
    render(
      <DataTable
        tableName="Test"
        rows={rows}
        getRowId={(row) => row.id}
        fieldDefs={fieldDefs}
        columnDefs={columnDefs}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
        emptyMessage="No rows yet."
        bulkSelectionActions={renderer}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 3" }), { shiftKey: true });

    expect(screen.getByRole("button", { name: "Custom action (3)" })).toBeInTheDocument();
    const lastCallArg = renderer.mock.calls.at(-1)?.[0];
    expect(lastCallArg).toBeInstanceOf(Set);
    expect(lastCallArg && Array.from(lastCallArg).sort()).toEqual(["rec_1", "rec_2", "rec_3"]);
  });

  test("renderer returning null hides the action while built-in Delete still shows", () => {
    render(
      <DataTable
        tableName="Test"
        rows={rows}
        getRowId={(row) => row.id}
        fieldDefs={fieldDefs}
        columnDefs={columnDefs}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
        emptyMessage="No rows yet."
        bulkSelectionActions={() => null}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select row 2" }));
    expect(screen.getByRole("button", { name: /Delete 1 selected row$/i })).toBeInTheDocument();
  });
});
