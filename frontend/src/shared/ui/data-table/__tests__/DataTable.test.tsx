import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import {
  emptyViewState,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
  type ViewState,
} from "../types";

type Row = { id: string; number: string; name: string; count: number };

const rows: Row[] = [{ id: "rm_1", number: "101", name: "Living Room", count: 2 }];
const fieldDefs: FieldDef[] = [
  { field_key: "number", field_type: "text", display_name: "Number" },
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "count", field_type: "number", display_name: "Count" },
];
const columnDefs: DataTableColumnDef<Row>[] = [
  { id: "number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
  { id: "count", fieldKey: "count", header: "Count", accessor: (row) => row.count },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

function pasteClipboardData(tsv: string) {
  return {
    clipboardData: { getData: (type: string) => (type === "text/plain" ? tsv : "") },
  };
}

describe("DataTable", () => {
  test("announces that paste is unavailable when no write handler is provided", async () => {
    renderTable();

    fireEvent.paste(screen.getByRole("grid"), pasteClipboardData("102"));

    expect(await screen.findByText("Paste is not enabled for this table yet.")).toBeVisible();
  });

  test("does not paste in read-only mode", () => {
    const onWrite = vi.fn();
    renderTable({ readOnly: true, onWrite });

    fireEvent.paste(screen.getByRole("grid"), pasteClipboardData("102"));

    expect(onWrite).not.toHaveBeenCalled();
    expect(screen.queryByText(/cells pasted/i)).not.toBeInTheDocument();
  });

  test("emits a paste write when a write handler is provided", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    fireEvent.paste(screen.getByRole("grid"), pasteClipboardData("102"));

    expect(await screen.findByText("1 cells pasted.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "paste",
      writes: [{ rowId: "rm_1", fieldKey: "number", value: "102" }],
      rowsInserted: [],
      newOptions: {},
    });
  });

  test("shows filtered empty state separately from source empty state", () => {
    renderTable({
      view: {
        ...emptyViewState(),
        filter: [{ fieldKey: "name", operator: "contains", value: "missing" }],
      },
    });

    expect(screen.getByText("No rows match the current table view.")).toBeVisible();
    expect(screen.queryByText("No rooms yet.")).not.toBeInTheDocument();
  });

  test("keeps header and gutter buttons out of the tab order", () => {
    renderTable();

    expect(screen.getByRole("button", { name: "Number" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: "Highlight row 1" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
    expect(screen.getByRole("checkbox", { name: "Select row 1" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  test("emits a cell write for inline text edits", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    fireEvent.doubleClick(screen.getByText("Living Room"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "Living" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(await screen.findByText("Name updated.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "name", value: "Living" }],
    });
  });

  test("skips no-op inline edits", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    fireEvent.doubleClick(screen.getByText("Living Room"));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });

    expect(onWrite).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  test("coerces cleared inline number edits to zero", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    fireEvent.doubleClick(screen.getByText("2"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(await screen.findByText("Count updated.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "count", value: 0 }],
    });
  });

  test("commits inline edits on Tab", async () => {
    const onWrite = vi.fn();
    renderTable({ onWrite });

    fireEvent.doubleClick(screen.getByText("Living Room"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "Living" } });
    fireEvent.keyDown(editor, { key: "Tab" });

    expect(await screen.findByText("Name updated.")).toBeVisible();
    expect(onWrite).toHaveBeenCalledWith({
      kind: "cell",
      writes: [{ rowId: "rm_1", fieldKey: "name", value: "Living" }],
    });
  });
});

function renderTable({
  view = emptyViewState(),
  readOnly = false,
  onWrite,
}: {
  view?: ViewState;
  readOnly?: boolean;
  onWrite?: DataTableProps<Row>["onWrite"];
} = {}) {
  return render(
    <DataTable
      rows={rows}
      getRowId={(row) => row.id}
      fieldDefs={fieldDefs}
      columnDefs={columnDefs}
      view={view}
      onViewChange={vi.fn()}
      onWrite={onWrite}
      readOnly={readOnly}
      emptyMessage="No rooms yet."
    />,
  );
}
