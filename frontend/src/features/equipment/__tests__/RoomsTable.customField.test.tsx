import { renderHook } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RoomsTable } from "../components/RoomsTable";
import {
  emptyViewState,
  useTableSchema,
  type CustomFieldDef,
  type TableSchema,
  type WriteOp,
} from "../../../shared/ui/data-table";
import { roomsTableFieldDefs } from "../lib";
import { ROOMS_TABLE_NAME, type RoomRow, type RoomsSlice } from "../types";

function buildCustomField(overrides: Partial<CustomFieldDef> = {}): CustomFieldDef {
  return {
    id: "cf_paint",
    field_key: "cf_paint",
    display_name: "Paint",
    field_type: "short_text",
    config: {},
    description: null,
    created_at: "2026-05-24T12:00:00Z",
    created_by: null,
    ...overrides,
  };
}

function buildRoom(overrides: Partial<RoomRow> = {}): RoomRow {
  return {
    id: "rm_1",
    number: "101",
    name: "Living Room",
    floor_level: "opt_ground",
    building_zone: null,
    num_people: 0,
    num_bedrooms: 0,
    icfa_factor: 1,
    erv_unit_ids: [],
    catalog_origin: null,
    notes: null,
    custom: {},
    ...overrides,
  };
}

function buildSlice(overrides: Partial<RoomsSlice> = {}): RoomsSlice {
  return {
    project_id: "00000000-0000-0000-0000-000000000001",
    version_id: "00000000-0000-0000-0000-000000000002",
    source: "draft",
    version_etag: "v-etag",
    draft_etag: "d-etag",
    rooms: [],
    custom_fields: [],
    single_select_options: {
      "rooms.floor_level": [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
      "rooms.building_zone": [],
    },
    ...overrides,
  };
}

function schemaFor(slice: RoomsSlice): TableSchema {
  // Mirror RoomsPage's wiring: one `useTableSchema` call seeded
  // with the table's core field defs + the slice's custom fields.
  return renderHook(() =>
    useTableSchema({
      tableKey: ROOMS_TABLE_NAME,
      coreFieldDefs: roomsTableFieldDefs(slice),
      customFields: slice.custom_fields,
    }),
  ).result.current;
}

describe("RoomsTable custom-field column (plan-14 P1.6)", () => {
  test("renders a seeded custom column at the right with its display name", () => {
    const customField = buildCustomField();
    const slice = buildSlice({
      rooms: [buildRoom({ custom: { cf_paint: "needs paint" } })],
      custom_fields: [customField],
    });

    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaFor(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
      />,
    );

    const paintHeader = screen.getByRole("columnheader", { name: /Paint/ });
    expect(paintHeader).toBeInTheDocument();
    expect(screen.getByText("needs paint")).toBeInTheDocument();
  });

  test("uses the cf_* id as the column id (D12 identity)", () => {
    const customField = buildCustomField();
    const onWriteCalls: WriteOp[] = [];
    const slice = buildSlice({
      rooms: [buildRoom({ custom: { cf_paint: "blue" } })],
      custom_fields: [customField],
    });

    const { container } = render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaFor(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={(op) => {
          onWriteCalls.push(op);
        }}
      />,
    );

    const cells = container.querySelectorAll('[data-field-key="cf_paint"]');
    expect(cells.length).toBeGreaterThan(0);
  });

  test("renders no custom column when the slice has no custom fields", () => {
    const slice = buildSlice({
      rooms: [buildRoom()],
      custom_fields: [],
    });

    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaFor(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
      />,
    );

    expect(screen.queryByRole("columnheader", { name: /Paint/ })).not.toBeInTheDocument();
  });
});
