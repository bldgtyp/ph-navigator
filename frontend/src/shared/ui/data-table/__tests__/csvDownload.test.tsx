import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

// Mock the download trigger so the test asserts the serialized payload
// without touching the DOM's URL/anchor machinery. The specifier resolves
// to the same module DataTable imports ("../../../lib/downloadBlob").
vi.mock("../../../lib/downloadBlob", () => ({ downloadBlob: vi.fn() }));

import { DataTable } from "../DataTable";
import { downloadBlob } from "../../../lib/downloadBlob";
import {
  emptyViewState,
  type DataTableColumnDef,
  type DataTableProps,
  type FieldDef,
} from "../types";

type Row = { id: string; name: string; count: number };

const rows: Row[] = [
  { id: "r1", name: "Alpha", count: 2 },
  { id: "r2", name: "Beta", count: 5 },
];
const fieldDefs: FieldDef[] = [
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "count", field_type: "number", display_name: "Count" },
];
const columnDefs: DataTableColumnDef<Row>[] = [
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name, isIdentifier: true },
  { id: "count", fieldKey: "count", header: "Count", accessor: (row) => row.count },
];

function renderTable(overrides: Partial<DataTableProps<Row>> = {}) {
  return render(
    <DataTable
      rows={rows}
      getRowId={(row) => row.id}
      fieldDefs={fieldDefs}
      columnDefs={columnDefs}
      view={emptyViewState()}
      onViewChange={vi.fn()}
      emptyMessage="No rows yet."
      tableName="Rooms"
      {...overrides}
    />,
  );
}

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "More view actions" }));
}

// jsdom's Blob does not implement async `.text()`, so record the parts and
// MIME type synchronously instead. DataTable builds `new Blob([content], …)`.
class RecordingBlob {
  readonly content: string;
  readonly type: string;
  constructor(parts: string[], options?: { type?: string }) {
    this.content = parts.join("");
    this.type = options?.type ?? "";
  }
}

function readDownloadedCsv(): { filename: string; type: string; lines: string[] } {
  const mock = downloadBlob as unknown as Mock;
  expect(mock).toHaveBeenCalledTimes(1);
  const [blob, filename] = mock.mock.calls[0] as [RecordingBlob, string];
  expect(blob.content.charCodeAt(0)).toBe(0xfeff); // leading BOM
  return {
    filename,
    type: blob.type,
    lines: blob.content.replace(/^\uFEFF/, "").split("\r\n"),
  };
}

beforeEach(() => {
  (downloadBlob as unknown as Mock).mockClear();
  vi.stubGlobal("Blob", RecordingBlob);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DataTable CSV download", () => {
  test("the overflow menu always offers a Download CSV item", () => {
    renderTable();
    openMenu();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeEnabled();
  });

  test("clicking Download CSV downloads the current view with the table-name filename", () => {
    renderTable();
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));

    const { filename, type, lines } = readDownloadedCsv();
    expect(filename).toBe("Rooms.csv");
    expect(type).toBe("text/csv;charset=utf-8");
    expect(lines[0]).toBe("Name,Count");
    expect(lines[1]).toBe("Alpha,2");
    expect(lines[2]).toBe("Beta,5");
  });

  test("download works in read-only mode (it is a read action)", () => {
    renderTable({ readOnly: true });
    openMenu();
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));

    const { filename, lines } = readDownloadedCsv();
    expect(filename).toBe("Rooms.csv");
    expect(lines[0]).toBe("Name,Count");
  });
});
