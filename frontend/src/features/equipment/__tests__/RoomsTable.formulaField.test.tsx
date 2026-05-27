import { renderHook } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RoomsTable } from "../components/RoomsTable";
import {
  emptyViewState,
  useTableSchema,
  type CustomFieldDef,
  type TableSchema,
} from "../../../shared/ui/data-table";
import { roomsTableFieldDefs } from "../lib";
import { ROOMS_TABLE_NAME, type RoomRow, type RoomsSlice } from "../types";

// Plan-17 P4.9: the grid renders formula custom-field columns via
// `<ComputedCell>` reading `rows_computed[rowId][cf_id]`. Successful
// scalars render verbatim; structured `{error: token}` overlays render
// the `#ERROR` glyph with a descriptive aria-label.

function buildFormulaField(overrides: Partial<CustomFieldDef> = {}): CustomFieldDef {
  return {
    id: "cf_label",
    field_key: "cf_label",
    display_name: "Label",
    field_type: "formula",
    config: {
      source: 'concat({Number}, " — ", upper({Name}))',
      ast: null,
      deps: ["number", "name"],
      result_type: "text",
    },
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
  return renderHook(() =>
    useTableSchema({
      tableKey: ROOMS_TABLE_NAME,
      coreFieldDefs: roomsTableFieldDefs(slice),
      customFields: slice.custom_fields,
    }),
  ).result.current;
}

describe("RoomsTable formula columns (plan-17 P4.9)", () => {
  test("renders the computed scalar from rows_computed", () => {
    const slice = buildSlice({
      rooms: [buildRoom()],
      custom_fields: [buildFormulaField()],
      rows_computed: { rm_1: { cf_label: "101 — LIVING ROOM" } },
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
        rowsComputed={slice.rows_computed}
      />,
    );
    expect(screen.getByText("101 — LIVING ROOM")).toBeInTheDocument();
  });

  test("renders #ERROR glyph for structured-error overlay values", () => {
    const slice = buildSlice({
      rooms: [buildRoom()],
      custom_fields: [buildFormulaField()],
      rows_computed: { rm_1: { cf_label: { error: "div_by_zero" } } },
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
        rowsComputed={slice.rows_computed}
      />,
    );
    const errorCell = screen.getByLabelText(/Formula error:/);
    expect(errorCell).toBeInTheDocument();
    expect(errorCell).toHaveTextContent("#ERROR");
  });

  test("renders an empty cell when no overlay entry exists for the row", () => {
    const slice = buildSlice({
      rooms: [buildRoom()],
      custom_fields: [buildFormulaField()],
      rows_computed: {},
    });
    const { container } = render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaFor(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={vi.fn()}
        rowsComputed={slice.rows_computed}
      />,
    );
    // No `#ERROR` glyph appears.
    expect(screen.queryByText("#ERROR")).toBeNull();
    // The formula cell itself rendered (locate by the column header).
    expect(container.querySelector('[data-field-key="cf_label"]')).not.toBeNull();
  });
});
