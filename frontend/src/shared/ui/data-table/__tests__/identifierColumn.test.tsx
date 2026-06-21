import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import { RECORD_ID_FIELD_KEY } from "../lib/identifier/recordId";
import { emptyViewState, type DataTableColumnDef, type FieldDef, type ViewState } from "../types";

type Pump = { id: string; record_id: string | null; flow: number | null };
const pumpRows: Pump[] = [
  { id: "pmp_1", record_id: "P-01", flow: 10 },
  { id: "pmp_2", record_id: "P-02", flow: 20 },
  { id: "pmp_3", record_id: "P-01", flow: 30 },
];
const pumpFieldDefs: FieldDef[] = [
  { field_key: RECORD_ID_FIELD_KEY, field_type: "text", display_name: "Tag", default: null },
  { field_key: "flow", field_type: "number", display_name: "Flow", default: null },
];
const pumpColumns: DataTableColumnDef<Pump>[] = [
  { id: "col-flow", fieldKey: "flow", header: "Flow", accessor: (row) => row.flow },
  {
    id: "col-record-id",
    fieldKey: RECORD_ID_FIELD_KEY,
    header: "Display Name",
    accessor: (row) => row.record_id,
    isIdentifier: true,
  },
];

function renderPumps(view: ViewState = emptyViewState()) {
  return render(
    <DataTable<Pump>
      tableName="Test"
      rows={pumpRows}
      getRowId={(row) => row.id}
      fieldDefs={pumpFieldDefs}
      columnDefs={pumpColumns}
      view={view}
      onViewChange={vi.fn()}
      onWrite={vi.fn()}
      emptyMessage="No pumps."
    />,
  );
}

type Room = { id: string; number: string; name: string; record_id: string };
const roomRows: Room[] = [
  { id: "rm_1", number: "101", name: "Living", record_id: "101 - Living" },
  { id: "rm_2", number: "102", name: "Kitchen", record_id: "102 - Kitchen" },
];
const roomFieldDefs: FieldDef[] = [
  {
    field_key: RECORD_ID_FIELD_KEY,
    field_type: "computed",
    display_name: "Record-ID",
    default: null,
  },
  { field_key: "number", field_type: "text", display_name: "Number", default: "" },
  { field_key: "name", field_type: "text", display_name: "Name", default: "" },
];
const roomColumns: DataTableColumnDef<Room>[] = [
  { id: "col-number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  {
    id: "col-record-id",
    fieldKey: RECORD_ID_FIELD_KEY,
    header: "Display Name",
    accessor: (row) => row.record_id,
    isIdentifier: true,
  },
  { id: "col-name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
];

function renderRooms() {
  return render(
    <DataTable<Room>
      tableName="Test"
      rows={roomRows}
      getRowId={(row) => row.id}
      fieldDefs={roomFieldDefs}
      columnDefs={roomColumns}
      view={emptyViewState()}
      onViewChange={vi.fn()}
      onWrite={vi.fn()}
      emptyMessage="No rooms."
    />,
  );
}

describe("DataTable identifier column", () => {
  test("pins the flagged identifier column to slot 0", () => {
    renderPumps();
    const headers = screen.getAllByRole("columnheader");
    expect(headers[1]?.textContent).toContain("Display Name");
    expect(headers[2]?.textContent).toContain("Flow");
  });

  test("identifier pinning overrides saved column order", () => {
    renderPumps({ ...emptyViewState(), columnOrder: ["col-flow", "col-record-id"] });
    const headers = screen.getAllByRole("columnheader");
    expect(headers[1]?.textContent).toContain("Display Name");
    expect(headers[2]?.textContent).toContain("Flow");
  });

  test("renders the duplicate-value chip on conflicting rows only", () => {
    renderPumps();
    const chips = screen.getAllByTestId("data-table-identifier-duplicate");
    expect(chips).toHaveLength(2);
    for (const chip of chips) {
      expect(chip.getAttribute("title")).toMatch(/Also used on row/);
    }
  });

  test("no chip surfaces when no duplicates exist", () => {
    render(
      <DataTable<Pump>
        tableName="Test"
        rows={[{ id: "pmp_1", record_id: "P-01", flow: 10 }]}
        getRowId={(row) => row.id}
        fieldDefs={pumpFieldDefs}
        columnDefs={pumpColumns}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
        emptyMessage="None."
      />,
    );
    expect(screen.queryAllByTestId("data-table-identifier-duplicate")).toHaveLength(0);
  });

  test("right-click context menu omits Hide field on the pinned slot", () => {
    renderPumps();
    const pinnedHeader = screen.getAllByRole("columnheader")[1];
    expect(pinnedHeader).toBeTruthy();
    if (!pinnedHeader) return;
    fireEvent.contextMenu(pinnedHeader);
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByText("Hide field")).toBeNull();
    expect(within(menu).getByText("Sort A → Z")).toBeTruthy();
  });

  test("right-click on a non-pinned column still surfaces Hide field", () => {
    renderPumps();
    const flowHeader = screen.getAllByRole("columnheader")[2];
    expect(flowHeader).toBeTruthy();
    if (!flowHeader) return;
    fireEvent.contextMenu(flowHeader);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Hide field")).toBeTruthy();
  });

  test("supports a computed Display Name identifier as a real column", () => {
    renderRooms();
    const headers = screen.getAllByRole("columnheader");
    expect(headers[1]?.textContent).toContain("Display Name");
    expect(screen.getByText("101 - Living")).toBeTruthy();
    expect(screen.getByText("102 - Kitchen")).toBeTruthy();
  });
});
