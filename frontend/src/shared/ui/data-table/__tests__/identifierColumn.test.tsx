import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { DataTable } from "../DataTable";
import {
  IDENTIFIER_COLUMN_ID,
  IDENTIFIER_HEADER_LABEL,
  emptyViewState,
  type DataTableColumnDef,
  type FieldDef,
  type IdentifierConfig,
} from "../types";

// Pumps-like row exercises `kind: "field"` (Tag is the identifier).
type Pump = { id: string; tag: string | null; flow: number | null };
const pumpRows: Pump[] = [
  { id: "pmp_1", tag: "P-01", flow: 10 },
  { id: "pmp_2", tag: "P-02", flow: 20 },
  { id: "pmp_3", tag: "P-01", flow: 30 }, // duplicate identifier
];
const pumpFieldDefs: FieldDef[] = [
  { field_key: "tag", field_type: "text", display_name: "Tag", default: null },
  { field_key: "flow", field_type: "number", display_name: "Flow", default: null },
];
const pumpColumns: DataTableColumnDef<Pump>[] = [
  // Tag is declared as the SECOND column. The identifier promotes it.
  { id: "col-flow", fieldKey: "flow", header: "Flow", accessor: (row) => row.flow },
  { id: "col-tag", fieldKey: "tag", header: "Tag", accessor: (row) => row.tag },
];

function renderPumps(overrides: { identifier?: IdentifierConfig<Pump> }) {
  return render(
    <DataTable<Pump>
      rows={pumpRows}
      getRowId={(row) => row.id}
      fieldDefs={pumpFieldDefs}
      columnDefs={pumpColumns}
      view={emptyViewState()}
      onViewChange={vi.fn()}
      onWrite={vi.fn()}
      identifier={overrides.identifier}
      emptyMessage="No pumps."
    />,
  );
}

// Rooms-like row exercises `kind: "computed"`.
type Room = { id: string; number: string; name: string };
const roomRows: Room[] = [
  { id: "rm_1", number: "101", name: "Living" },
  { id: "rm_2", number: "102", name: "Kitchen" },
];
const roomFieldDefs: FieldDef[] = [
  { field_key: "number", field_type: "text", display_name: "Number", default: "" },
  { field_key: "name", field_type: "text", display_name: "Name", default: "" },
];
const roomColumns: DataTableColumnDef<Room>[] = [
  { id: "col-number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  { id: "col-name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
];

function renderRooms(overrides: { identifier?: IdentifierConfig<Room> }) {
  return render(
    <DataTable<Room>
      rows={roomRows}
      getRowId={(row) => row.id}
      fieldDefs={roomFieldDefs}
      columnDefs={roomColumns}
      view={emptyViewState()}
      onViewChange={vi.fn()}
      onWrite={vi.fn()}
      identifier={overrides.identifier}
      emptyMessage="No rooms."
    />,
  );
}

describe("DataTable identifier column — kind: 'field'", () => {
  test("promotes the backing column to slot 0 with the 'Record-ID' header", () => {
    renderPumps({ identifier: { kind: "field", field: "tag" } });
    const headers = screen.getAllByRole("columnheader");
    // gutter is the first columnheader; the identifier column is next.
    expect(headers[1]?.textContent).toContain(IDENTIFIER_HEADER_LABEL);
    expect(headers[2]?.textContent).toContain("Flow");
  });

  test("renders the duplicate-value chip on conflicting rows only", () => {
    renderPumps({ identifier: { kind: "field", field: "tag" } });
    const chips = screen.getAllByTestId("data-table-identifier-duplicate");
    // pmp_1 (P-01) and pmp_3 (P-01) collide; pmp_2 (P-02) does not.
    expect(chips).toHaveLength(2);
    for (const chip of chips) {
      expect(chip.getAttribute("title")).toMatch(/Also used on row/);
    }
  });

  test("no chip surfaces when no duplicates exist", () => {
    render(
      <DataTable<Pump>
        rows={[{ id: "pmp_1", tag: "P-01", flow: 10 }]}
        getRowId={(row) => row.id}
        fieldDefs={pumpFieldDefs}
        columnDefs={pumpColumns}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
        identifier={{ kind: "field", field: "tag" }}
        emptyMessage="None."
      />,
    );
    expect(screen.queryAllByTestId("data-table-identifier-duplicate")).toHaveLength(0);
  });

  test("broken-identifier renders ERROR cells and a header warning glyph", () => {
    renderPumps({
      identifier: { kind: "field", field: "does_not_exist" as keyof Pump & string },
    });
    expect(screen.getByTestId("data-table-identifier-broken")).toBeTruthy();
    expect(screen.getAllByText("ERROR").length).toBe(pumpRows.length);
  });

  test("right-click context menu omits 'Hide field' on the pinned slot", () => {
    renderPumps({ identifier: { kind: "field", field: "tag" } });
    const headers = screen.getAllByRole("columnheader");
    const pinnedHeader = headers[1];
    expect(pinnedHeader).toBeTruthy();
    if (!pinnedHeader) return;
    fireEvent.contextMenu(pinnedHeader);
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByText("Hide field")).toBeNull();
    // Sort items remain available.
    expect(within(menu).getByText("Sort A → Z")).toBeTruthy();
  });

  test("right-click on a NON-pinned column still surfaces 'Hide field'", () => {
    renderPumps({ identifier: { kind: "field", field: "tag" } });
    const headers = screen.getAllByRole("columnheader");
    const flowHeader = headers[2];
    expect(flowHeader).toBeTruthy();
    if (!flowHeader) return;
    fireEvent.contextMenu(flowHeader);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Hide field")).toBeTruthy();
  });
});

describe("DataTable identifier column — kind: 'computed'", () => {
  test("prepends synthetic __record_id__ column showing the compute output", () => {
    renderRooms({
      identifier: {
        kind: "computed",
        deps: ["number", "name"],
        compute: (room) => `${room.number} — ${room.name}`,
      },
    });
    const headers = screen.getAllByRole("columnheader");
    expect(headers[1]?.textContent).toContain(IDENTIFIER_HEADER_LABEL);
    // Per-row compute output rendered in the cells.
    expect(screen.getByText("101 — Living")).toBeTruthy();
    expect(screen.getByText("102 — Kitchen")).toBeTruthy();
  });

  test("context menu on synthetic identifier suppresses Filter and Group items", () => {
    renderRooms({
      identifier: {
        kind: "computed",
        deps: ["number", "name"],
        compute: (room) => `${room.number} — ${room.name}`,
      },
    });
    const headers = screen.getAllByRole("columnheader");
    const pinnedHeader = headers[1];
    expect(pinnedHeader).toBeTruthy();
    if (!pinnedHeader) return;
    fireEvent.contextMenu(pinnedHeader);
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByText("Filter by this field")).toBeNull();
    expect(within(menu).queryByText("Group by this field")).toBeNull();
    expect(within(menu).queryByText("Hide field")).toBeNull();
    // Sort items are kept (D5).
    expect(within(menu).getByText("Sort A → Z")).toBeTruthy();
  });

  test("synthetic column id matches the reserved IDENTIFIER_COLUMN_ID", () => {
    renderRooms({
      identifier: {
        kind: "computed",
        deps: ["number", "name"],
        compute: (room) => `${room.number} — ${room.name}`,
      },
    });
    // The DOM exposes the field key on each cell via `data-field-key`.
    // The summary-bar row emits its own td with the same field key —
    // restrict the query to the body rows.
    const identifierCells = document.querySelectorAll(
      `tbody td[data-field-key="${IDENTIFIER_COLUMN_ID}"]`,
    );
    expect(identifierCells.length).toBe(roomRows.length);
  });
});
