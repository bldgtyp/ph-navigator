// @size-exception: docs/plans/2026-05-25/plan-23-frontend-refactor-phased.md#phase-8--ci-guards-execute-8th--last
import { describe, expect, test, vi } from "vitest";
import {
  deleteRoomPayload,
  emptyRoom,
  firstRoomFloorOptionId,
  isDraftStaleError,
  isInvalidProjectDocumentError,
  replaceRoomOptionsPayload,
  nextRoomsPayload,
  optionLabel,
  pumpsPayloadFromCellWrites,
  pumpsPayloadFromRowDelete,
  pumpsPayloadFromRowInsert,
  remoteSliceChangesActiveRoom,
  roomsPayloadFromCellWrites,
  roomsPayloadFromRowDelete,
  roomsPayloadFromRowInsert,
  roomsTableColumnsForSanitize,
  validateRoomsPayload,
} from "./lib";
import { ApiRequestError } from "../../shared/api/client";
import type { TableFieldDef } from "../../shared/ui/data-table";
import { tableFieldDefsToFieldDefs } from "../../shared/ui/data-table";
import {
  ROOM_BUILDING_ZONE_COLUMN_ID,
  ROOM_FLOOR_LEVEL_COLUMN_ID,
  type RoomRow,
  type RoomsSlice,
} from "./types";
import {
  buildPump,
  buildCustomField as customField,
  buildRoom,
  buildPumpsSlice,
  pumpsBuiltInFieldDefs,
  roomsBuiltInFieldDefs,
  withRoomCustomValues as withCustomValues,
} from "./testing/testFixtures";

function roomFixture(
  overrides: Partial<Omit<RoomRow, "custom_values">> = {},
  customValues: Partial<RoomRow["custom_values"]> = {},
): RoomRow {
  return withCustomValues(buildRoom(overrides), customValues);
}

const baseSlice: RoomsSlice = {
  project_id: "project-1",
  version_id: "version-1",
  source: "version",
  version_etag: "version-etag",
  draft_etag: null,
  rooms: [],
  field_defs: roomsBuiltInFieldDefs,
  single_select_options: {
    "rooms.floor_level": [],
    "rooms.building_zone": [],
  },
};

describe("equipment room helpers", () => {
  test("creates room options in the same Rooms payload as the row write", () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000000")
      .mockReturnValueOnce("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa")
      .mockReturnValueOnce("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb");
    const room = withCustomValues(
      {
        ...emptyRoom(),
        id: "rm_living",
        floor_level: null,
        building_zone: null,
      },
      { number: " 101 ", name: " Living Room ", num_people: 2 },
    );

    const payload = nextRoomsPayload(baseSlice, room, {
      floorLevel: "Ground",
      buildingZone: "Residential",
    });

    expect(payload.rooms).toHaveLength(1);
    expect(payload.rooms[0]?.custom_values.number).toBe("101");
    expect(payload.rooms[0]?.custom_values.name).toBe("Living Room");
    expect(payload.rooms[0]?.floor_level).toBe("opt_aaaaaaaaaaaa4aaaaaaaaaaaaaaaaaaa");
    expect(payload.rooms[0]?.building_zone).toBe("opt_bbbbbbbbbbbb4bbbbbbbbbbbbbbbbbbb");
    expect(payload.single_select_options["rooms.floor_level"][0]?.label).toBe("Ground");
    expect(payload.single_select_options["rooms.building_zone"][0]?.label).toBe("Residential");
  });

  test("reuses existing options case-insensitively", () => {
    const current: RoomsSlice = {
      ...baseSlice,
      single_select_options: {
        "rooms.floor_level": [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
        "rooms.building_zone": [],
      },
    };
    const payload = nextRoomsPayload(
      current,
      roomFixture({ id: "rm_1" }, { number: "101", name: "Living" }),
      { floorLevel: " ground ", buildingZone: "" },
    );

    expect(payload.rooms[0]?.floor_level).toBe("opt_ground");
    expect(payload.single_select_options["rooms.floor_level"]).toHaveLength(1);
    expect(payload.rooms[0]?.building_zone).toBeNull();
  });

  test("uses the first floor option by order for new room defaults", () => {
    const current: RoomsSlice = {
      ...baseSlice,
      single_select_options: {
        "rooms.floor_level": [
          { id: "opt_roof", label: "Roof", color: "#10b981", order: 2 },
          { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
        ],
        "rooms.building_zone": [],
      },
    };
    const room = emptyRoom("opt_ground");

    expect(firstRoomFloorOptionId(current)).toBe("opt_ground");
    expect(room.floor_level).toBe("opt_ground");
    expect(room.icfa_factor).toBe(1);
  });

  test("deletes rows without changing options", () => {
    const room = roomFixture({ id: "rm_1" }, { number: "101", name: "Living" });
    const other = roomFixture({ id: "rm_2" }, { number: " 101 ", name: "Kitchen" });
    const current: RoomsSlice = { ...baseSlice, rooms: [room, other] };

    expect(deleteRoomPayload(current, "rm_1").rooms).toEqual([other]);
  });

  test("resolves option labels and reports missing ids", () => {
    expect(
      optionLabel([{ id: "opt_1", label: "Ground", color: "#3b82f6", order: 0 }], "opt_1"),
    ).toBe("Ground");
    expect(optionLabel([], "opt_missing")).toBe("Missing option");
    expect(optionLabel([], null)).toBe("");
  });

  test("classifies document workflow API errors", () => {
    const stale = new ApiRequestError(new Response(null, { status: 409, statusText: "Conflict" }), {
      error_code: "draft_etag_mismatch",
      message: "Draft changed.",
      request_id: "req-1",
      details: {},
    });
    const invalid = new ApiRequestError(
      new Response(null, { status: 422, statusText: "Unprocessable Entity" }),
      {
        error_code: "invalid_project_document",
        message: "Project document failed validation.",
        request_id: "req-2",
        details: {},
      },
    );

    expect(isDraftStaleError(stale)).toBe(true);
    expect(isDraftStaleError(invalid)).toBe(false);
    expect(isInvalidProjectDocumentError(invalid)).toBe(true);
  });

  test("detects whether a remote Rooms slice changes the active room scope", () => {
    const room = roomFixture({ id: "rm_1" }, { number: "101", name: "Living" });
    const otherRoom = roomFixture({ id: "rm_2" }, { number: "102", name: "Kitchen" });
    const current: RoomsSlice = {
      ...baseSlice,
      rooms: [room],
      single_select_options: {
        "rooms.floor_level": [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
        "rooms.building_zone": [],
      },
    };

    expect(
      remoteSliceChangesActiveRoom(current, { ...current, rooms: [room, otherRoom] }, room),
    ).toBe(false);
    expect(
      remoteSliceChangesActiveRoom(
        current,
        { ...current, rooms: [withCustomValues(room, { name: "Living Room" })] },
        room,
      ),
    ).toBe(true);
    expect(remoteSliceChangesActiveRoom(current, { ...current, rooms: [] }, room)).toBe(true);
    expect(
      remoteSliceChangesActiveRoom(
        { ...current, rooms: [{ ...room, floor_level: "opt_ground" }] },
        {
          ...current,
          rooms: [{ ...room, floor_level: "opt_ground" }],
          single_select_options: {
            "rooms.floor_level": [
              { id: "opt_ground", label: "Level 1", color: "#3b82f6", order: 0 },
            ],
            "rooms.building_zone": [],
          },
        },
        { ...room, floor_level: "opt_ground" },
      ),
    ).toBe(true);
  });

  test("applies paste writes and created options in one Rooms payload", () => {
    const current: RoomsSlice = {
      ...baseSlice,
      rooms: [roomFixture({ id: "rm_1" }, { number: "101", name: "Living" })],
    };

    const payload = roomsPayloadFromCellWrites(
      current,
      [
        { rowId: "rm_1", fieldKey: "floor_level", value: "opt_ground" },
        { rowId: "rm_1", fieldKey: "num_people", value: 3 },
      ],
      {
        "rooms.floor_level": [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
      },
    );

    expect(payload.rooms[0]?.floor_level).toBe("opt_ground");
    expect(payload.rooms[0]?.custom_values.num_people).toBe(3);
    expect(payload.single_select_options["rooms.floor_level"]).toEqual([
      { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
    ]);
  });

  test("removedOptions strips option ids from the relevant single-select list", () => {
    const current: RoomsSlice = {
      ...baseSlice,
      rooms: [
        roomFixture({ id: "rm_1", floor_level: "opt_mez" }, { number: "101", name: "Living" }),
      ],
      single_select_options: {
        "rooms.floor_level": [
          { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
          { id: "opt_mez", label: "Mezzanine", color: "#10b981", order: 1 },
        ],
        "rooms.building_zone": [],
      },
    };

    const payload = roomsPayloadFromCellWrites(
      current,
      [{ rowId: "rm_1", fieldKey: "floor_level", value: "opt_ground" }],
      {},
      { "rooms.floor_level": ["opt_mez"] },
    );

    expect(payload.rooms[0]?.floor_level).toBe("opt_ground");
    expect(payload.single_select_options["rooms.floor_level"]).toEqual([
      { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
    ]);
  });

  test("validates required floor before draft writes and allows duplicate room numbers", () => {
    const missingFloor = {
      ...baseSlice,
      rooms: [roomFixture({ id: "rm_1" }, { number: "101", name: "Living" })],
    };
    const duplicate = {
      ...baseSlice,
      rooms: [
        roomFixture({ id: "rm_1", floor_level: "opt_ground" }, { number: "101", name: "Living" }),
        roomFixture(
          { id: "rm_2", floor_level: "opt_ground" },
          { number: " 101 ", name: "Kitchen" },
        ),
      ],
      single_select_options: {
        "rooms.floor_level": [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
        "rooms.building_zone": [],
      },
    };

    expect(validateRoomsPayload(missingFloor)).toBe("Floor level is required.");
    expect(validateRoomsPayload(duplicate)).toBeNull();
  });

  test("normalizes cleared numeric cell writes and blocks deferred ERV assignments", () => {
    const current: RoomsSlice = {
      ...baseSlice,
      rooms: [
        roomFixture(
          { id: "rm_1", floor_level: "opt_ground", erv_unit_ids: ["erv_fake"] },
          { number: "101", name: "Living", num_people: 3 },
        ),
      ],
      single_select_options: {
        "rooms.floor_level": [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
        "rooms.building_zone": [],
      },
    };

    const payload = roomsPayloadFromCellWrites(
      current,
      [{ rowId: "rm_1", fieldKey: "num_people", value: null }],
      {},
    );

    expect(payload.rooms[0]?.custom_values.num_people).toBe(0);
    expect(validateRoomsPayload(payload)).toBe(
      "ERV assignments are deferred until ERV units are available.",
    );
  });

  test("renames, reorders, and deletes options with reference replacement", () => {
    const current: RoomsSlice = {
      ...baseSlice,
      rooms: [
        roomFixture({ id: "rm_1", floor_level: "opt_ground" }, { number: "101", name: "Living" }),
      ],
      single_select_options: {
        "rooms.floor_level": [
          { id: "opt_basement", label: "Basement", color: "#6b7280", order: 0 },
          { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 1 },
        ],
        "rooms.building_zone": [],
      },
    };

    const payload = replaceRoomOptionsPayload(
      current,
      "rooms.floor_level",
      [{ id: "opt_basement", label: "Cellar", color: "#10b981", order: 0 }],
      { opt_ground: "opt_basement" },
    );

    expect(payload.rooms[0]?.floor_level).toBe("opt_basement");
    expect(payload.single_select_options["rooms.floor_level"]).toEqual([
      { id: "opt_basement", label: "Cellar", color: "#10b981", order: 0 },
    ]);
  });

  test("rejects deleting a referenced option without an explicit replacement decision", () => {
    const current: RoomsSlice = {
      ...baseSlice,
      rooms: [
        roomFixture({ id: "rm_1", floor_level: "opt_ground" }, { number: "101", name: "Living" }),
      ],
      single_select_options: {
        "rooms.floor_level": [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
        "rooms.building_zone": [],
      },
    };

    expect(() => replaceRoomOptionsPayload(current, "rooms.floor_level", [])).toThrow(
      "Missing replacement for referenced rooms.floor_level option opt_ground.",
    );
  });

  test("roomsPayloadFromRowInsert appends truly blank rows built from fieldDefaults only", () => {
    const ground = { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 };
    const current: RoomsSlice = {
      ...baseSlice,
      rooms: [
        roomFixture(
          { id: "rm_5", floor_level: ground.id, icfa_factor: 0.85 },
          { number: "5", name: "Living", num_people: 2, num_bedrooms: 1 },
        ),
      ],
      single_select_options: { "rooms.floor_level": [ground], "rooms.building_zone": [] },
    };
    // Plan-30 D10: Shift-Enter creates a truly blank row; anchor
    // values are not cloned. fieldDefaults is empty for a default-only
    // insert.
    const payload = roomsPayloadFromRowInsert(
      current,
      [{ rowId: "tmp_row_1", anchorRowId: "rm_5", fieldDefaults: {} }],
      ({ rowId }) => ({
        ...emptyRoom(),
        id: rowId,
      }),
    );
    expect(payload.rooms).toHaveLength(2);
    const inserted = payload.rooms.find((room) => room.id === "tmp_row_1");
    expect(inserted?.custom_values.number).toBe("");
    expect(inserted?.custom_values.name).toBe("");
    expect(inserted?.floor_level).toBeNull();
    expect(inserted?.icfa_factor).toBe(1);
  });

  test("roomsPayloadFromRowDelete removes by id and preserves the option lists", () => {
    const ground = { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 };
    const current: RoomsSlice = {
      ...baseSlice,
      rooms: [
        roomFixture({ id: "rm_1", floor_level: ground.id }, { number: "1", name: "Living" }),
        roomFixture({ id: "rm_2", floor_level: ground.id }, { number: "2", name: "Kitchen" }),
      ],
      single_select_options: { "rooms.floor_level": [ground], "rooms.building_zone": [] },
    };
    const payload = roomsPayloadFromRowDelete(current, [
      { rowId: "rm_1", row: current.rooms[0], anchorRowId: null },
    ]);
    expect(payload.rooms.map((room) => room.id)).toEqual(["rm_2"]);
    expect(payload.single_select_options["rooms.floor_level"]).toEqual([ground]);
  });

  // Regression: sanitize-columns must use the same ids as the real
  // RoomsTable columns. The single-select fields have namespaced
  // `field_key` ("rooms.floor_level") but the column uses the short id
  // ("floor_level"). When the two diverge, sanitizeViewStateForSchema
  // silently filters dragged-reorder entries out of view.columnOrder
  // and the user's drag is undone on render.
  test("roomsTableColumnsForSanitize emits ids that match RoomsTable column ids", () => {
    const columns = roomsTableColumnsForSanitize(
      tableFieldDefsToFieldDefs({ tableKey: "rooms", fieldDefs: baseSlice.field_defs }),
    );
    const ids = columns.map((column) => column.id);
    expect(ids).toEqual([
      "record_id",
      "number",
      "name",
      ROOM_FLOOR_LEVEL_COLUMN_ID,
      ROOM_BUILDING_ZONE_COLUMN_ID,
      "num_people",
      "num_bedrooms",
      "icfa_factor",
      "erv_unit_ids",
    ]);
    expect(ROOM_FLOOR_LEVEL_COLUMN_ID).toBe("floor_level");
    expect(ROOM_BUILDING_ZONE_COLUMN_ID).toBe("building_zone");
  });

  // ---------------------------------------------------------------
  // Plan-18 regression: every RoomsReplacePayload builder must carry
  // `field_defs` so the backend whole-table-replace path does not
  // wipe user-added columns. Plan-13 D16 + plan-14 §1.5 keep type
  // coercion server-authoritative, so these tests do not assert any
  // per-type validation on the client.
  // ---------------------------------------------------------------

  const cfText = customField({ field_key: "cf_text" });
  const cfPalette = customField({
    field_key: "cf_palette",
    display_name: "Palette",
    field_type: "single_select",
  });

  function sliceWithCustomFields(custom: TableFieldDef[], extra: Partial<RoomsSlice> = {}) {
    return {
      ...baseSlice,
      field_defs: [...baseSlice.field_defs, ...custom],
      ...extra,
    } satisfies RoomsSlice;
  }

  test("roomsPayloadFromCellWrites preserves field_defs on a built-in field write", () => {
    const ground = { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 };
    const current = sliceWithCustomFields([cfText], {
      rooms: [
        roomFixture({ id: "rm_1", floor_level: "opt_ground" }, { number: "101", name: "Living" }),
      ],
      single_select_options: { "rooms.floor_level": [ground], "rooms.building_zone": [] },
    });

    const payload = roomsPayloadFromCellWrites(
      current,
      [{ rowId: "rm_1", fieldKey: "num_people", value: 4 }],
      {},
    );

    expect(payload.field_defs).toEqual([...roomsBuiltInFieldDefs, cfText]);
    // Cloned reference — mutating the input slice's field_defs must
    // not leak into the produced payload.
    expect(payload.field_defs).not.toBe(current.field_defs);
  });

  test("roomsPayloadFromCellWrites routes cf_* writes through setCustomValue", () => {
    const ground = { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 };
    const current = sliceWithCustomFields([cfText], {
      rooms: [
        roomFixture({ id: "rm_1", floor_level: "opt_ground" }, { number: "101", name: "Living" }),
      ],
      single_select_options: { "rooms.floor_level": [ground], "rooms.building_zone": [] },
    });

    const payload = roomsPayloadFromCellWrites(
      current,
      [{ rowId: "rm_1", fieldKey: "cf_text", value: "hello" }],
      {},
    );

    expect(payload.rooms[0]?.custom_values.cf_text).toBe("hello");
    expect(payload.field_defs).toEqual([...roomsBuiltInFieldDefs, cfText]);
  });

  test("roomsPayloadFromCellWrites clears a cf_* value when written undefined", () => {
    const ground = { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 };
    const current = sliceWithCustomFields([cfText], {
      rooms: [
        roomFixture(
          { id: "rm_1", floor_level: "opt_ground" },
          { number: "101", name: "Living", cf_text: "old" },
        ),
      ],
      single_select_options: { "rooms.floor_level": [ground], "rooms.building_zone": [] },
    });

    const payload = roomsPayloadFromCellWrites(
      current,
      [{ rowId: "rm_1", fieldKey: "cf_text", value: undefined }],
      {},
    );

    expect(payload.rooms[0]?.custom_values.cf_text).toBeUndefined();
  });

  test("roomsPayloadFromCellWrites drops writes to unknown cf_* keys without synthesizing the field", () => {
    const ground = { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 };
    const current = sliceWithCustomFields([cfText], {
      rooms: [
        roomFixture({ id: "rm_1", floor_level: "opt_ground" }, { number: "101", name: "Living" }),
      ],
      single_select_options: { "rooms.floor_level": [ground], "rooms.building_zone": [] },
    });

    const payload = roomsPayloadFromCellWrites(
      current,
      [{ rowId: "rm_1", fieldKey: "cf_ghost", value: "drift" }],
      {},
    );

    expect(payload.rooms[0]?.custom_values.cf_ghost).toBeUndefined();
    expect(payload.field_defs).toEqual([...roomsBuiltInFieldDefs, cfText]);
  });

  test("roomsPayloadFromCellWrites preserves namespaced rooms.cf_* option lists", () => {
    const ground = { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 };
    const paletteRed = { id: "opt_red", label: "Red", color: "#ef4444", order: 0 };
    const current = sliceWithCustomFields([cfPalette], {
      rooms: [
        roomFixture({ id: "rm_1", floor_level: "opt_ground" }, { number: "101", name: "Living" }),
      ],
      single_select_options: {
        "rooms.floor_level": [ground],
        "rooms.building_zone": [],
        "rooms.cf_palette": [paletteRed],
      } as RoomsSlice["single_select_options"],
    });

    const payload = roomsPayloadFromCellWrites(
      current,
      [{ rowId: "rm_1", fieldKey: "num_people", value: 1 }],
      {},
    );

    expect(payload.single_select_options["rooms.cf_palette"]).toEqual([paletteRed]);
    expect(payload.field_defs).toEqual([...roomsBuiltInFieldDefs, cfPalette]);
  });

  test("roomsPayloadFromCellWrites merges newOptions into a rooms.cf_* list", () => {
    const ground = { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 };
    const paletteRed = { id: "opt_red", label: "Red", color: "#ef4444", order: 0 };
    const paletteBlue = { id: "opt_blue", label: "Blue", color: "#3b82f6", order: 1 };
    const current = sliceWithCustomFields([cfPalette], {
      rooms: [
        roomFixture({ id: "rm_1", floor_level: "opt_ground" }, { number: "101", name: "Living" }),
      ],
      single_select_options: {
        "rooms.floor_level": [ground],
        "rooms.building_zone": [],
        "rooms.cf_palette": [paletteRed],
      } as RoomsSlice["single_select_options"],
    });

    const payload = roomsPayloadFromCellWrites(
      current,
      [{ rowId: "rm_1", fieldKey: "cf_palette", value: "opt_blue" }],
      { "rooms.cf_palette": [paletteBlue] },
    );

    expect(payload.single_select_options["rooms.cf_palette"]).toEqual([paletteRed, paletteBlue]);
    expect(payload.rooms[0]?.custom_values.cf_palette).toBe("opt_blue");
  });

  test("roomsPayloadFromCellWrites strips removed ids from a rooms.cf_* list", () => {
    const ground = { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 };
    const paletteRed = { id: "opt_red", label: "Red", color: "#ef4444", order: 0 };
    const paletteBlue = { id: "opt_blue", label: "Blue", color: "#3b82f6", order: 1 };
    const current = sliceWithCustomFields([cfPalette], {
      rooms: [
        roomFixture({ id: "rm_1", floor_level: "opt_ground" }, { number: "101", name: "Living" }),
      ],
      single_select_options: {
        "rooms.floor_level": [ground],
        "rooms.building_zone": [],
        "rooms.cf_palette": [paletteRed, paletteBlue],
      } as RoomsSlice["single_select_options"],
    });

    const payload = roomsPayloadFromCellWrites(
      current,
      [{ rowId: "rm_1", fieldKey: "num_people", value: 1 }],
      {},
      { "rooms.cf_palette": ["opt_red"] },
    );

    expect(payload.single_select_options["rooms.cf_palette"]).toEqual([
      { ...paletteBlue, order: 0 },
    ]);
  });

  test("nextRoomsPayload preserves field_defs", () => {
    const room = roomFixture({ id: "rm_1" }, { number: "101", name: "Living" });
    const current = sliceWithCustomFields([cfText]);

    const payload = nextRoomsPayload(current, room, {
      floorLevel: "Ground",
      buildingZone: "Residential",
    });

    expect(payload.field_defs).toEqual([...roomsBuiltInFieldDefs, cfText]);
  });

  test("deleteRoomPayload preserves field_defs", () => {
    const current = sliceWithCustomFields([cfText], {
      rooms: [
        roomFixture({ id: "rm_1", floor_level: "opt_ground" }, { number: "101", name: "Living" }),
      ],
    });

    const payload = deleteRoomPayload(current, "rm_1");

    expect(payload.rooms).toEqual([]);
    expect(payload.field_defs).toEqual([...roomsBuiltInFieldDefs, cfText]);
  });

  test("roomsPayloadFromRowInsert preserves field_defs", () => {
    const ground = { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 };
    const current = sliceWithCustomFields([cfText], {
      rooms: [
        roomFixture({ id: "rm_5", floor_level: "opt_ground" }, { number: "5", name: "Living" }),
      ],
      single_select_options: { "rooms.floor_level": [ground], "rooms.building_zone": [] },
    });

    const payload = roomsPayloadFromRowInsert(
      current,
      [{ rowId: "tmp_row_1", anchorRowId: "rm_5", fieldDefaults: {} }],
      ({ rowId }) => ({
        ...emptyRoom(),
        id: rowId,
      }),
    );

    expect(payload.field_defs).toEqual([...roomsBuiltInFieldDefs, cfText]);
  });

  test("roomsPayloadFromRowDelete preserves field_defs", () => {
    const current = sliceWithCustomFields([cfText], {
      rooms: [
        roomFixture({ id: "rm_1", floor_level: "opt_ground" }, { number: "1", name: "Living" }),
      ],
    });

    const payload = roomsPayloadFromRowDelete(current, [
      { rowId: "rm_1", row: current.rooms[0], anchorRowId: null },
    ]);

    expect(payload.field_defs).toEqual([...roomsBuiltInFieldDefs, cfText]);
  });

  test("replaceRoomOptionsPayload preserves field_defs", () => {
    const current = sliceWithCustomFields([cfText], {
      rooms: [
        roomFixture({ id: "rm_1", floor_level: "opt_ground" }, { number: "101", name: "Living" }),
      ],
      single_select_options: {
        "rooms.floor_level": [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
        "rooms.building_zone": [],
      },
    });

    const payload = replaceRoomOptionsPayload(current, "rooms.floor_level", [
      { id: "opt_ground", label: "Cellar", color: "#10b981", order: 0 },
    ]);

    expect(payload.field_defs).toEqual([...roomsBuiltInFieldDefs, cfText]);
  });

  test("pumpsPayloadFromRowInsert preserves field_defs", () => {
    const current = buildPumpsSlice();

    const payload = pumpsPayloadFromRowInsert(
      current,
      [{ rowId: "pmp_browser", anchorRowId: null, fieldDefaults: {} }],
      ({ rowId }) => ({ ...buildPump(), id: rowId }),
    );

    expect(payload.field_defs).toEqual(pumpsBuiltInFieldDefs);
  });

  test("pumpsPayloadFromCellWrites preserves field_defs", () => {
    const current = buildPumpsSlice({
      pumps: [buildPump({ id: "pmp_1" })],
    });

    const payload = pumpsPayloadFromCellWrites(
      current,
      [{ rowId: "pmp_1", fieldKey: "record_id", value: "P-2" }],
      {},
    );

    expect(payload.field_defs).toEqual(pumpsBuiltInFieldDefs);
  });

  test("pumpsPayloadFromRowDelete preserves field_defs", () => {
    const pump = buildPump({ id: "pmp_1" });
    const current = buildPumpsSlice({ pumps: [pump] });

    const payload = pumpsPayloadFromRowDelete(current, [
      { rowId: "pmp_1", row: pump, anchorRowId: null },
    ]);

    expect(payload.field_defs).toEqual(pumpsBuiltInFieldDefs);
  });
});
