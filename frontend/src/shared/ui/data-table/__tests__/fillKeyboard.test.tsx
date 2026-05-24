import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import { emptyViewState, type DataTableColumnDef, type FieldDef, type WriteOp } from "../types";

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

describe("DataTable — ⌘D / ⌘R fill", () => {
  test("⌘D over a multi-row, single-column selection dispatches one fill op", async () => {
    const onWrite = vi.fn();
    render(
      <DataTable<Row>
        rows={ROWS}
        getRowId={(row) => row.id}
        fieldDefs={FIELD_DEFS}
        columnDefs={COLUMN_DEFS}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
        emptyMessage="No rows yet."
      />,
    );
    const grid = screen.getByRole("grid");
    // Active cell is (0,0) → extend down to (2,0).
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(grid, { key: "d", metaKey: true });
    expect(await screen.findByText("2 cells filled.")).toBeVisible();
    const op = onWrite.mock.calls[0]![0] as WriteOp;
    expect(op.kind).toBe("fill");
    if (op.kind === "fill") {
      expect(op.writes).toEqual([
        { rowId: "rm_2", fieldKey: "number", value: "101" },
        { rowId: "rm_3", fieldKey: "number", value: "101" },
      ]);
    }
  });

  test("⌘D on a 1-row selection announces no-op message", async () => {
    const onWrite = vi.fn();
    render(
      <DataTable<Row>
        rows={ROWS}
        getRowId={(row) => row.id}
        fieldDefs={FIELD_DEFS}
        columnDefs={COLUMN_DEFS}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
        emptyMessage="No rows yet."
      />,
    );
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "d", metaKey: true });
    expect(await screen.findByText("Select more than one row to fill down.")).toBeVisible();
    expect(onWrite).not.toHaveBeenCalled();
  });

  test("⌘R over a multi-column row dispatches one fill op", async () => {
    const onWrite = vi.fn();
    render(
      <DataTable<Row>
        rows={ROWS}
        getRowId={(row) => row.id}
        fieldDefs={FIELD_DEFS}
        columnDefs={COLUMN_DEFS}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
        emptyMessage="No rows yet."
      />,
    );
    const grid = screen.getByRole("grid");
    // Active is (0,0); extend right to (0,2).
    fireEvent.keyDown(grid, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(grid, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(grid, { key: "r", metaKey: true });
    expect(await screen.findByText("2 cells filled.")).toBeVisible();
    const op = onWrite.mock.calls[0]![0] as WriteOp;
    if (op.kind !== "fill") throw new Error("expected fill op");
    expect(op.writes.map((w) => w.fieldKey)).toEqual(["name", "count"]);
    expect(op.writes.map((w) => w.value)).toEqual(["101", "101"]);
  });

  test("⌘Z after ⌘D reverts all written cells in one step", async () => {
    const onWrite = vi.fn();
    render(
      <DataTable<Row>
        rows={ROWS}
        getRowId={(row) => row.id}
        fieldDefs={FIELD_DEFS}
        columnDefs={COLUMN_DEFS}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
        emptyMessage="No rows yet."
      />,
    );
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(grid, { key: "d", metaKey: true });
    expect(await screen.findByText("2 cells filled.")).toBeVisible();
    onWrite.mockClear();
    fireEvent.keyDown(grid, { key: "z", metaKey: true });
    // ⌘Z fires the inverse op once with the previous values.
    expect(onWrite).toHaveBeenCalledTimes(1);
    const inverse = onWrite.mock.calls[0]![0] as WriteOp;
    expect(inverse.kind).toBe("cell");
    if (inverse.kind === "cell") {
      expect(inverse.writes).toEqual([
        { rowId: "rm_2", fieldKey: "number", value: "102" },
        { rowId: "rm_3", fieldKey: "number", value: "103" },
      ]);
    }
  });

  test("⌘⇧D over a multi-row, single-column selection fills upward", async () => {
    const onWrite = vi.fn();
    render(
      <DataTable<Row>
        rows={ROWS}
        getRowId={(row) => row.id}
        fieldDefs={FIELD_DEFS}
        columnDefs={COLUMN_DEFS}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
        emptyMessage="No rows yet."
      />,
    );
    const grid = screen.getByRole("grid");
    // Active is (0,0); extend down to (0..2, 0).
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(grid, { key: "d", metaKey: true, shiftKey: true });
    expect(await screen.findByText("2 cells filled.")).toBeVisible();
    const op = onWrite.mock.calls[0]![0] as WriteOp;
    if (op.kind !== "fill") throw new Error("expected fill op");
    // Source is row 2 ("103"). Targets: rows 0, 1.
    expect(op.writes).toEqual([
      { rowId: "rm_1", fieldKey: "number", value: "103" },
      { rowId: "rm_2", fieldKey: "number", value: "103" },
    ]);
  });

  test("⌘⇧D on a 1-row selection announces fill-up no-op message", async () => {
    const onWrite = vi.fn();
    render(
      <DataTable<Row>
        rows={ROWS}
        getRowId={(row) => row.id}
        fieldDefs={FIELD_DEFS}
        columnDefs={COLUMN_DEFS}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
        emptyMessage="No rows yet."
      />,
    );
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "d", metaKey: true, shiftKey: true });
    expect(await screen.findByText("Select more than one row to fill up.")).toBeVisible();
    expect(onWrite).not.toHaveBeenCalled();
  });

  test("⌘⇧R over a multi-column row fills leftward", async () => {
    const onWrite = vi.fn();
    render(
      <DataTable<Row>
        rows={ROWS}
        getRowId={(row) => row.id}
        fieldDefs={FIELD_DEFS}
        columnDefs={COLUMN_DEFS}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
        emptyMessage="No rows yet."
      />,
    );
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(grid, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(grid, { key: "r", metaKey: true, shiftKey: true });
    expect(await screen.findByText("2 cells filled.")).toBeVisible();
    const op = onWrite.mock.calls[0]![0] as WriteOp;
    if (op.kind !== "fill") throw new Error("expected fill op");
    // Source is col "count" (rightmost). Targets: "number", "name".
    expect(op.writes.map((w) => w.fieldKey)).toEqual(["number", "name"]);
    expect(op.writes.map((w) => w.value)).toEqual([1, 1]);
  });

  test("readOnly disables ⌘D entirely (no announce, no preventDefault)", () => {
    const onWrite = vi.fn();
    render(
      <DataTable<Row>
        rows={ROWS}
        getRowId={(row) => row.id}
        fieldDefs={FIELD_DEFS}
        columnDefs={COLUMN_DEFS}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
        readOnly
        emptyMessage="No rows yet."
      />,
    );
    const grid = screen.getByRole("grid");
    fireEvent.keyDown(grid, { key: "ArrowDown", shiftKey: true });
    fireEvent.keyDown(grid, { key: "d", metaKey: true });
    expect(onWrite).not.toHaveBeenCalled();
    expect(screen.queryByText(/cells filled/)).not.toBeInTheDocument();
  });
});
