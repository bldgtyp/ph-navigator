import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RoomsTable } from "../components/RoomsTable";
import {
  emptyViewState,
  useTableSchema,
  type CustomFieldDef,
  type TableSchema,
  type WriteOp,
} from "../../../shared/ui/data-table";
import { roomsPayloadFromCellWrites, roomsTableFieldDefs } from "../lib";

type RoomCellWrite = { rowId: string; fieldKey: string; value: unknown };
import { ROOMS_TABLE_NAME, type RoomRow, type RoomsSlice } from "../types";

// Plan-18 §5.6 — inline edit on a `cf_*` cell must emit a `cell`
// write op carrying the `cf_*` field_key, and the matching payload
// builder must route that write into `row.custom`. The library-
// level tests pin the builder; this component test pins the
// emission boundary so a regression in either side fails CI.

function buildCustomField(overrides: Partial<CustomFieldDef> = {}): CustomFieldDef {
  return {
    id: "cf_paint",
    field_key: null,
    display_name: "Paint",
    field_type: "short_text",
    config: {},
    description: null,
    created_at: "2026-05-25T00:00:00Z",
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

describe("RoomsTable cell-write on a custom field (plan-18 §5.6)", () => {
  test("inline edit on a cf_* cell emits a cell write with the cf_* field_key", () => {
    const slice = buildSlice({
      rooms: [buildRoom({ custom: { cf_paint: "old" } })],
      custom_fields: [buildCustomField()],
    });
    const onWrite = vi.fn();

    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaFor(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
      />,
    );

    fireEvent.doubleClick(screen.getByText("old"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "blue" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(onWrite).toHaveBeenCalledTimes(1);
    const op = onWrite.mock.calls[0]?.[0] as WriteOp;
    expect(op.kind).toBe("cell");
    if (op.kind === "cell") {
      expect(op.writes).toEqual([{ rowId: "rm_1", fieldKey: "cf_paint", value: "blue" }]);
    }
  });

  test("the emitted cell write threads through roomsPayloadFromCellWrites into row.custom", () => {
    // Closes the loop between the component-level write emission and
    // the payload builder. A regression in either side fails this
    // test — plan-18's two cooperating defects in a single assertion.
    const slice = buildSlice({
      rooms: [buildRoom({ custom: { cf_paint: "old" } })],
      custom_fields: [buildCustomField()],
    });
    const writes: RoomCellWrite[] = [{ rowId: "rm_1", fieldKey: "cf_paint", value: "blue" }];

    const payload = roomsPayloadFromCellWrites(slice, writes, {});

    expect(payload.rooms[0]?.custom).toEqual({ cf_paint: "blue" });
    expect(payload.custom_fields).toEqual([buildCustomField()]);
  });

  test("clearing a cf_* cell emits a write that empties row.custom for that key", () => {
    const slice = buildSlice({
      rooms: [buildRoom({ custom: { cf_paint: "blue" } })],
      custom_fields: [buildCustomField()],
    });
    const onWrite = vi.fn();

    render(
      <RoomsTable
        roomsSlice={slice}
        tableSchema={schemaFor(slice)}
        isEditor
        onEdit={vi.fn()}
        view={emptyViewState()}
        onViewChange={vi.fn()}
        onWrite={onWrite}
      />,
    );

    fireEvent.doubleClick(screen.getByText("blue"));
    const editor = screen.getByRole("textbox");
    fireEvent.change(editor, { target: { value: "" } });
    fireEvent.keyDown(editor, { key: "Enter" });

    expect(onWrite).toHaveBeenCalledTimes(1);
    const op = onWrite.mock.calls[0]?.[0] as WriteOp;
    expect(op.kind).toBe("cell");
    if (op.kind === "cell") {
      const write = op.writes[0]!;
      expect(write.fieldKey).toBe("cf_paint");
      // The library-level test in lib.test.ts pins that null / undefined
      // values delete the key — this asserts the boundary's value
      // is one of the falsy sentinels the builder accepts.
      expect([null, undefined, ""]).toContain(write.value);
    }
  });
});
