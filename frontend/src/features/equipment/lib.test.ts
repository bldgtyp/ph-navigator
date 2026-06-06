// @size-exception: docs/plans/2026-05-25/plan-23-frontend-refactor-phased.md#phase-8--ci-guards-execute-8th--last
import { describe, expect, test, vi } from "vitest";
import {
  appliancesPayloadFromCellWrites,
  appliancesPayloadFromRowDelete,
  appliancesPayloadFromRowDuplicate,
  appliancesPayloadFromRowInsert,
  deleteRoomPayload,
  electricHeatersPayloadFromCellWrites,
  electricHeatersPayloadFromRowDelete,
  electricHeatersPayloadFromRowDuplicate,
  electricHeatersPayloadFromRowInsert,
  emptyRoom,
  fansPayloadFromCellWrites,
  fansPayloadFromRowDelete,
  fansPayloadFromRowDuplicate,
  fansPayloadFromRowInsert,
  firstRoomFloorOptionId,
  hotWaterTanksPayloadFromCellWrites,
  hotWaterTanksPayloadFromRowDelete,
  hotWaterTanksPayloadFromRowDuplicate,
  hotWaterTanksPayloadFromRowInsert,
  isDraftStaleError,
  isInvalidProjectDocumentError,
  nextCopySuffix,
  replaceRoomOptionsPayload,
  nextRoomsPayload,
  optionLabel,
  pumpsPayloadFromCellWrites,
  pumpsPayloadFromRowDelete,
  pumpsPayloadFromRowDuplicate,
  pumpsPayloadFromRowInsert,
  remoteSliceChangesActiveRoom,
  roomsPayloadFromCellWrites,
  roomsPayloadFromRowDelete,
  roomsPayloadFromRowDuplicate,
  roomsPayloadFromRowInsert,
  roomsTableColumnsForSanitize,
  validateFansPayload,
  validateAppliancesPayload,
  validateElectricHeatersPayload,
  validateHotWaterTanksPayload,
  validateRoomsPayload,
  validateVentilatorsPayload,
  ventilatorsPayloadFromCellWrites,
  ventilatorsPayloadFromRowDelete,
  ventilatorsPayloadFromRowDuplicate,
  ventilatorsPayloadFromRowInsert,
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
  buildAppliance,
  buildAppliancesSlice,
  buildPump,
  buildCustomField as customField,
  buildElectricHeater,
  buildElectricHeatersSlice,
  buildFan,
  buildFansSlice,
  buildHotWaterTank,
  buildHotWaterTanksSlice,
  buildRoom,
  buildPumpsSlice,
  buildVentilator,
  buildVentilatorsSlice,
  appliancesBuiltInFieldDefs,
  electricHeatersBuiltInFieldDefs,
  fansBuiltInFieldDefs,
  hotWaterTanksBuiltInFieldDefs,
  pumpsBuiltInFieldDefs,
  roomsBuiltInFieldDefs,
  ventilatorsBuiltInFieldDefs,
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

  test("allows blank room labels, missing floor, and duplicate room numbers", () => {
    const blankRoom = {
      ...baseSlice,
      rooms: [roomFixture({ id: "rm_1", floor_level: null }, { number: "", name: "" })],
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

    expect(validateRoomsPayload(blankRoom)).toBeNull();
    expect(validateRoomsPayload(duplicate)).toBeNull();
  });

  test("keeps cleared numeric cell writes null and blocks deferred ERV assignments", () => {
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

    expect(payload.rooms[0]?.custom_values.num_people).toBeNull();
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
        roomFixture(
          { id: "rm_6", floor_level: ground.id, icfa_factor: 0.9 },
          { number: "6", name: "Kitchen", num_people: 1, num_bedrooms: 0 },
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
    expect(payload.rooms.map((room) => room.id)).toEqual(["rm_5", "tmp_row_1", "rm_6"]);
    const inserted = payload.rooms.find((room) => room.id === "tmp_row_1");
    expect(inserted?.custom_values.number).toBeNull();
    expect(inserted?.custom_values.name).toBeNull();
    expect(inserted?.floor_level).toBeNull();
    expect(inserted?.icfa_factor).toBe(1);
  });

  test("roomsPayloadFromRowInsert keeps blank room number null when Number is number-typed", () => {
    const current: RoomsSlice = {
      ...baseSlice,
      field_defs: baseSlice.field_defs.map((field) =>
        field.field_key === "number" ? { ...field, field_type: "number", default: null } : field,
      ),
      rooms: [roomFixture({ id: "rm_5", floor_level: null }, { number: 5, name: "Living" })],
      single_select_options: { "rooms.floor_level": [], "rooms.building_zone": [] },
    };

    const payload = roomsPayloadFromRowInsert(
      current,
      [{ rowId: "tmp_row_1", anchorRowId: "rm_5", fieldDefaults: { number: null } }],
      ({ rowId }) => ({
        ...emptyRoom(),
        id: rowId,
      }),
    );

    const inserted = payload.rooms.find((room) => room.id === "tmp_row_1");
    expect(inserted?.custom_values.number).toBeNull();
    expect(validateRoomsPayload(payload)).toBeNull();
  });

  test("roomsPayloadFromCellWrites keeps cleared room Number null when number-typed", () => {
    const current: RoomsSlice = {
      ...baseSlice,
      field_defs: baseSlice.field_defs.map((field) =>
        field.field_key === "number" ? { ...field, field_type: "number", default: null } : field,
      ),
      rooms: [roomFixture({ id: "rm_1", floor_level: null }, { number: 5, name: "Living" })],
      single_select_options: { "rooms.floor_level": [], "rooms.building_zone": [] },
    };

    const payload = roomsPayloadFromCellWrites(
      current,
      [{ rowId: "rm_1", fieldKey: "number", value: null }],
      {},
    );

    expect(payload.rooms[0]?.custom_values.number).toBeNull();
    expect(validateRoomsPayload(payload)).toBeNull();
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

  test("ventilatorsPayloadFromRowInsert preserves field_defs", () => {
    const current = buildVentilatorsSlice();

    const payload = ventilatorsPayloadFromRowInsert(
      current,
      [{ rowId: "vent_browser", anchorRowId: null, fieldDefaults: {} }],
      ({ rowId }) => ({ ...buildVentilator(), id: rowId }),
    );

    expect(payload.field_defs).toEqual(ventilatorsBuiltInFieldDefs);
  });

  test("ventilatorsPayloadFromCellWrites preserves field_defs", () => {
    const current = buildVentilatorsSlice({
      ventilators: [buildVentilator({ id: "vent_1" })],
    });

    const payload = ventilatorsPayloadFromCellWrites(
      current,
      [{ rowId: "vent_1", fieldKey: "record_id", value: "ERV-2" }],
      {},
    );

    expect(payload.field_defs).toEqual(ventilatorsBuiltInFieldDefs);
  });

  test("ventilatorsPayloadFromRowDelete preserves field_defs", () => {
    const ventilator = buildVentilator({ id: "vent_1" });
    const current = buildVentilatorsSlice({ ventilators: [ventilator] });

    const payload = ventilatorsPayloadFromRowDelete(current, [
      { rowId: "vent_1", row: ventilator, anchorRowId: null },
    ]);

    expect(payload.field_defs).toEqual(ventilatorsBuiltInFieldDefs);
  });

  test("fansPayloadFromRowInsert preserves field_defs and field defaults", () => {
    const current = buildFansSlice();

    const payload = fansPayloadFromRowInsert(
      current,
      [{ rowId: "fan_browser", anchorRowId: null, fieldDefaults: {} }],
      ({ rowId }) => ({ ...buildFan(), id: rowId }),
    );

    expect(payload.field_defs).toEqual(fansBuiltInFieldDefs);
    expect(payload.fans[0]?.custom_values.quantity).toBe(1);
    expect(payload.fans[0]?.custom_values.power_factor).toBe(0.8);
  });

  test("fansPayloadFromCellWrites preserves field_defs and routes datasheet writes", () => {
    const current = buildFansSlice({
      fans: [buildFan({ id: "fan_1" })],
    });

    const payload = fansPayloadFromCellWrites(
      current,
      [
        { rowId: "fan_1", fieldKey: "record_id", value: "F-2" },
        { rowId: "fan_1", fieldKey: "datasheet_asset_ids", value: ["asset_pdf_1"] },
      ],
      {},
    );

    expect(payload.field_defs).toEqual(fansBuiltInFieldDefs);
    expect(payload.fans[0]?.custom_values.record_id).toBe("F-2");
    expect(payload.fans[0]?.datasheet_asset_ids).toEqual(["asset_pdf_1"]);
  });

  test("fansPayloadFromRowDelete preserves field_defs", () => {
    const fan = buildFan({ id: "fan_1" });
    const current = buildFansSlice({ fans: [fan] });

    const payload = fansPayloadFromRowDelete(current, [
      { rowId: "fan_1", row: fan, anchorRowId: null },
    ]);

    expect(payload.field_defs).toEqual(fansBuiltInFieldDefs);
  });

  test("hotWaterTanksPayloadFromRowInsert preserves field_defs and field defaults", () => {
    const current = buildHotWaterTanksSlice();

    const payload = hotWaterTanksPayloadFromRowInsert(
      current,
      [{ rowId: "hwt_browser", anchorRowId: null, fieldDefaults: {} }],
      ({ rowId }) => ({ ...buildHotWaterTank(), id: rowId }),
    );

    expect(payload.field_defs).toEqual(hotWaterTanksBuiltInFieldDefs);
    expect(payload.hot_water_tanks[0]?.custom_values.quantity).toBe(1);
    expect(payload.hot_water_tanks[0]?.custom_values.power_factor).toBe(0.8);
  });

  test("hotWaterTanksPayloadFromCellWrites preserves field_defs and routes datasheet writes", () => {
    const current = buildHotWaterTanksSlice({
      hot_water_tanks: [buildHotWaterTank({ id: "hwt_1" })],
    });

    const payload = hotWaterTanksPayloadFromCellWrites(
      current,
      [
        { rowId: "hwt_1", fieldKey: "record_id", value: "HWT-2" },
        { rowId: "hwt_1", fieldKey: "datasheet_asset_ids", value: ["asset_pdf_1"] },
      ],
      {},
    );

    expect(payload.field_defs).toEqual(hotWaterTanksBuiltInFieldDefs);
    expect(payload.hot_water_tanks[0]?.custom_values.record_id).toBe("HWT-2");
    expect(payload.hot_water_tanks[0]?.datasheet_asset_ids).toEqual(["asset_pdf_1"]);
  });

  test("hotWaterTanksPayloadFromRowDelete preserves field_defs", () => {
    const tank = buildHotWaterTank({ id: "hwt_1" });
    const current = buildHotWaterTanksSlice({ hot_water_tanks: [tank] });

    const payload = hotWaterTanksPayloadFromRowDelete(current, [
      { rowId: "hwt_1", row: tank, anchorRowId: null },
    ]);

    expect(payload.field_defs).toEqual(hotWaterTanksBuiltInFieldDefs);
  });

  test("electricHeatersPayloadFromRowInsert preserves field_defs", () => {
    const current = buildElectricHeatersSlice();

    const payload = electricHeatersPayloadFromRowInsert(
      current,
      [{ rowId: "heatr_browser", anchorRowId: null, fieldDefaults: {} }],
      ({ rowId }) => ({ ...buildElectricHeater(), id: rowId }),
    );

    expect(payload.field_defs).toEqual(electricHeatersBuiltInFieldDefs);
    expect(payload.electric_heaters[0]?.custom_values.watt).toBe(1000);
  });

  test("electricHeatersPayloadFromCellWrites preserves field_defs and routes typed writes", () => {
    const current = buildElectricHeatersSlice({
      electric_heaters: [buildElectricHeater({ id: "heatr_1" })],
    });

    const payload = electricHeatersPayloadFromCellWrites(current, [
      { rowId: "heatr_1", fieldKey: "record_id", value: "EH-2" },
      { rowId: "heatr_1", fieldKey: "url", value: " https://example.com/heater.pdf " },
      { rowId: "heatr_1", fieldKey: "watt", value: null },
    ]);

    expect(payload.field_defs).toEqual(electricHeatersBuiltInFieldDefs);
    expect(payload.electric_heaters[0]?.custom_values.record_id).toBe("EH-2");
    expect(payload.electric_heaters[0]?.custom_values.watt).toBeNull();
    expect(payload.electric_heaters[0]?.url).toBe("https://example.com/heater.pdf");
  });

  test("electricHeatersPayloadFromRowDelete preserves field_defs", () => {
    const heater = buildElectricHeater({ id: "heatr_1" });
    const current = buildElectricHeatersSlice({ electric_heaters: [heater] });

    const payload = electricHeatersPayloadFromRowDelete(current, [
      { rowId: "heatr_1", row: heater, anchorRowId: null },
    ]);

    expect(payload.field_defs).toEqual(electricHeatersBuiltInFieldDefs);
  });
});

describe("nextCopySuffix", () => {
  test("first duplicate appends ' (copy)'", () => {
    expect(nextCopySuffix("Living Room", [])).toBe("Living Room (copy)");
  });

  test("second duplicate appends ' (copy 2)'", () => {
    expect(nextCopySuffix("Living Room", ["Living Room (copy)"])).toBe("Living Room (copy 2)");
  });

  test("advances past existing (copy N) siblings", () => {
    expect(nextCopySuffix("Foo", ["Foo (copy)", "Foo (copy 2)", "Foo (copy 3)"])).toBe(
      "Foo (copy 4)",
    );
  });

  test("strips the source's own suffix before resolving", () => {
    expect(nextCopySuffix("Foo (copy)", ["Foo (copy)"])).toBe("Foo (copy 2)");
    expect(nextCopySuffix("Foo (copy 5)", ["Foo", "Foo (copy)"])).toBe("Foo (copy 2)");
  });

  test("treats internal parens as literal text", () => {
    expect(nextCopySuffix("XPS (Type IV)", [])).toBe("XPS (Type IV) (copy)");
    expect(nextCopySuffix("XPS (Type IV)", ["XPS (Type IV) (copy)"])).toBe(
      "XPS (Type IV) (copy 2)",
    );
  });
});

describe("roomsPayloadFromRowDuplicate", () => {
  test("clones source row below the anchor with a ' (copy)' name suffix", () => {
    const source = roomFixture(
      { id: "rm_1", floor_level: "opt_ground" },
      { number: "5", name: "Living" },
    );
    const sibling = roomFixture(
      { id: "rm_2", floor_level: "opt_ground" },
      { number: "6", name: "Kitchen" },
    );
    const current: RoomsSlice = { ...baseSlice, rooms: [source, sibling] };

    const payload = roomsPayloadFromRowDuplicate(current, [
      {
        rowId: "tmp_dup",
        sourceRowId: "rm_1",
        sourceRow: source,
        anchorRowId: "rm_1",
      },
    ]);

    expect(payload.rooms.map((r) => r.id)).toEqual(["rm_1", "tmp_dup", "rm_2"]);
    const clone = payload.rooms.find((r) => r.id === "tmp_dup");
    expect(clone?.custom_values.name).toBe("Living (copy)");
    expect(clone?.floor_level).toBe("opt_ground");
  });

  test("advances suffix when ' (copy)' is already taken", () => {
    const source = roomFixture({ id: "rm_1" }, { number: "5", name: "Living" });
    const existingCopy = roomFixture({ id: "rm_copy" }, { number: "5", name: "Living (copy)" });
    const current: RoomsSlice = { ...baseSlice, rooms: [source, existingCopy] };

    const payload = roomsPayloadFromRowDuplicate(current, [
      {
        rowId: "tmp_dup",
        sourceRowId: "rm_1",
        sourceRow: source,
        anchorRowId: "rm_1",
      },
    ]);

    expect(payload.rooms.find((r) => r.id === "tmp_dup")?.custom_values.name).toBe(
      "Living (copy 2)",
    );
  });

  test("multi-duplicate picks distinct suffixes across the batch", () => {
    const source = roomFixture({ id: "rm_1" }, { number: "5", name: "Living" });
    const current: RoomsSlice = { ...baseSlice, rooms: [source] };

    const payload = roomsPayloadFromRowDuplicate(current, [
      { rowId: "tmp_a", sourceRowId: "rm_1", sourceRow: source, anchorRowId: "rm_1" },
      { rowId: "tmp_b", sourceRowId: "rm_1", sourceRow: source, anchorRowId: "rm_1" },
    ]);

    const names = payload.rooms.map((r) => r.custom_values.name);
    expect(names).toContain("Living (copy)");
    expect(names).toContain("Living (copy 2)");
  });

  test("appends at the end when anchorRowId is null", () => {
    const source = roomFixture({ id: "rm_1" }, { name: "Living" });
    const sibling = roomFixture({ id: "rm_2" }, { name: "Kitchen" });
    const current: RoomsSlice = { ...baseSlice, rooms: [source, sibling] };

    const payload = roomsPayloadFromRowDuplicate(current, [
      { rowId: "tmp_dup", sourceRowId: "rm_1", sourceRow: source, anchorRowId: null },
    ]);

    expect(payload.rooms.map((r) => r.id)).toEqual(["rm_1", "rm_2", "tmp_dup"]);
  });
});

describe("pumpsPayloadFromRowDuplicate", () => {
  test("clones source pump with a record_id ' (copy)' suffix, sorted into place", () => {
    const source = buildPump({ id: "pmp_1" });
    const current = buildPumpsSlice({
      pumps: [source],
    });
    // record_id lives in custom_values; seed it directly.
    source.custom_values = { ...source.custom_values, record_id: "P-1" };

    const payload = pumpsPayloadFromRowDuplicate(current, [
      { rowId: "tmp_dup", sourceRowId: "pmp_1", sourceRow: source, anchorRowId: "pmp_1" },
    ]);

    const clone = payload.pumps.find((p) => p.id === "tmp_dup");
    expect(clone?.custom_values.record_id).toBe("P-1 (copy)");
  });
});

describe("ventilatorsPayloadFromRowDuplicate", () => {
  test("clones source ventilator with a record_id ' (copy)' suffix, sorted into place", () => {
    const source = buildVentilator({ id: "vent_1" });
    const current = buildVentilatorsSlice({
      ventilators: [source],
    });

    const payload = ventilatorsPayloadFromRowDuplicate(current, [
      { rowId: "tmp_dup", sourceRowId: "vent_1", sourceRow: source, anchorRowId: "vent_1" },
    ]);

    const clone = payload.ventilators.find((ventilator) => ventilator.id === "tmp_dup");
    expect(clone?.custom_values.record_id).toBe("ERV-1 (copy)");
  });

  test("validates percent, MERV, URL, and inside/outside values", () => {
    const valid = buildVentilatorsSlice({
      ventilators: [buildVentilator()],
    });
    expect(validateVentilatorsPayload(valid)).toBeNull();

    expect(
      validateVentilatorsPayload({
        ...valid,
        ventilators: [
          buildVentilator({
            custom_values: { ...buildVentilator().custom_values, heat_recovery_percent: 101 },
          }),
        ],
      }),
    ).toBe("Heat Recovery % must be between 0 and 100.");

    expect(
      validateVentilatorsPayload({
        ...valid,
        ventilators: [
          buildVentilator({
            custom_values: { ...buildVentilator().custom_values, filter_merv_rating: 21 },
          }),
        ],
      }),
    ).toBe("Filter MERV Rating must be between 1 and 20.");

    expect(
      validateVentilatorsPayload({
        ...valid,
        ventilators: [buildVentilator({ url: "ftp://example.com/erv.pdf" })],
      }),
    ).toBe("Ventilator URL must start with http:// or https://.");
  });
});

describe("fansPayloadFromRowDuplicate", () => {
  test("clones source fan with a record_id ' (copy)' suffix, sorted into place", () => {
    const source = buildFan({ id: "fan_1" });
    const current = buildFansSlice({
      fans: [source],
    });

    const payload = fansPayloadFromRowDuplicate(current, [
      { rowId: "tmp_dup", sourceRowId: "fan_1", sourceRow: source, anchorRowId: "fan_1" },
    ]);

    const clone = payload.fans.find((fan) => fan.id === "tmp_dup");
    expect(clone?.custom_values.record_id).toBe("F-1 (copy)");
  });

  test("validates type, phase, power factor, URL, and nonnegative values", () => {
    const valid = buildFansSlice({
      fans: [buildFan()],
    });
    expect(validateFansPayload(valid)).toBeNull();

    expect(validateFansPayload({ ...valid, fans: [buildFan({ fan_type: "opt_missing" })] })).toBe(
      "Fan type option is missing.",
    );

    expect(validateFansPayload({ ...valid, fans: [buildFan({ phase: 2 })] })).toBe(
      "Phase must be 1 or 3.",
    );

    expect(
      validateFansPayload({
        ...valid,
        fans: [
          buildFan({
            custom_values: { ...buildFan().custom_values, power_factor: 1.2 },
          }),
        ],
      }),
    ).toBe("Power Factor must be between 0 and 1.");

    expect(
      validateFansPayload({
        ...valid,
        fans: [buildFan({ url: "ftp://example.com/fan.pdf" })],
      }),
    ).toBe("Fan URL must start with http:// or https://.");

    expect(
      validateFansPayload({
        ...valid,
        fans: [
          buildFan({
            custom_values: { ...buildFan().custom_values, annual_runtime_min_yr: -1 },
          }),
        ],
      }),
    ).toBe("Annual Runtime must be zero or greater.");
  });
});

describe("hotWaterTanksPayloadFromRowDuplicate", () => {
  test("clones source tank with a record_id ' (copy)' suffix, sorted into place", () => {
    const source = buildHotWaterTank({ id: "hwt_1" });
    const current = buildHotWaterTanksSlice({
      hot_water_tanks: [source],
    });

    const payload = hotWaterTanksPayloadFromRowDuplicate(current, [
      { rowId: "tmp_dup", sourceRowId: "hwt_1", sourceRow: source, anchorRowId: "hwt_1" },
    ]);

    const clone = payload.hot_water_tanks.find((tank) => tank.id === "tmp_dup");
    expect(clone?.custom_values.record_id).toBe("HWT-1 (copy)");
  });

  test("validates type, phase, power factor, URL, and nonnegative values", () => {
    const valid = buildHotWaterTanksSlice({
      hot_water_tanks: [buildHotWaterTank()],
    });
    expect(validateHotWaterTanksPayload(valid)).toBeNull();

    expect(
      validateHotWaterTanksPayload({
        ...valid,
        hot_water_tanks: [buildHotWaterTank({ tank_type: "opt_missing" })],
      }),
    ).toBe("Hot water tank type option is missing.");

    expect(
      validateHotWaterTanksPayload({
        ...valid,
        hot_water_tanks: [buildHotWaterTank({ phase: 2 })],
      }),
    ).toBe("Phase must be 1 or 3.");

    expect(
      validateHotWaterTanksPayload({
        ...valid,
        hot_water_tanks: [
          buildHotWaterTank({
            custom_values: { ...buildHotWaterTank().custom_values, power_factor: 1.2 },
          }),
        ],
      }),
    ).toBe("Power Factor must be between 0 and 1.");

    expect(
      validateHotWaterTanksPayload({
        ...valid,
        hot_water_tanks: [buildHotWaterTank({ url: "ftp://example.com/hwt.pdf" })],
      }),
    ).toBe("Hot water tank URL must start with http:// or https://.");

    expect(
      validateHotWaterTanksPayload({
        ...valid,
        hot_water_tanks: [
          buildHotWaterTank({
            custom_values: { ...buildHotWaterTank().custom_values, size_l: -1 },
          }),
        ],
      }),
    ).toBe("Size must be zero or greater.");
  });
});

describe("electricHeatersPayloadFromRowDuplicate", () => {
  test("clones source heater with a record_id ' (copy)' suffix, sorted into place", () => {
    const source = buildElectricHeater({ id: "heatr_1" });
    const current = buildElectricHeatersSlice({
      electric_heaters: [source],
    });

    const payload = electricHeatersPayloadFromRowDuplicate(current, [
      { rowId: "tmp_dup", sourceRowId: "heatr_1", sourceRow: source, anchorRowId: "heatr_1" },
    ]);

    const clone = payload.electric_heaters.find((heater) => heater.id === "tmp_dup");
    expect(clone?.custom_values.record_id).toBe("EH-1 (copy)");
  });

  test("validates URL and nonnegative Watt values", () => {
    const valid = buildElectricHeatersSlice({
      electric_heaters: [buildElectricHeater()],
    });
    expect(validateElectricHeatersPayload(valid)).toBeNull();

    expect(
      validateElectricHeatersPayload({
        ...valid,
        electric_heaters: [buildElectricHeater({ url: "ftp://example.com/heater.pdf" })],
      }),
    ).toBe("Electric heater URL must start with http:// or https://.");

    expect(
      validateElectricHeatersPayload({
        ...valid,
        electric_heaters: [
          buildElectricHeater({
            custom_values: { ...buildElectricHeater().custom_values, watt: -1 },
          }),
        ],
      }),
    ).toBe("Watt must be zero or greater.");
  });
});

describe("appliances payload helpers", () => {
  test("inserts, edits, duplicates, and deletes while preserving field defs", () => {
    const current = buildAppliancesSlice({
      appliances: [buildAppliance({ id: "appl_1" })],
    });

    const inserted = appliancesPayloadFromRowInsert(
      current,
      [{ rowId: "appl_2", anchorRowId: null, fieldDefaults: {} }],
      ({ rowId }) =>
        buildAppliance({
          id: rowId,
          custom_values: { ...buildAppliance().custom_values, record_id: "A-2" },
        }),
    );
    expect(inserted.field_defs).toEqual(appliancesBuiltInFieldDefs);
    expect(inserted.appliances.map((appliance) => appliance.id)).toContain("appl_2");

    const edited = appliancesPayloadFromCellWrites(
      current,
      [
        { rowId: "appl_1", fieldKey: "capacity_m3", value: null },
        { rowId: "appl_1", fieldKey: "energy_star", value: "opt_appl_energy_star_no" },
        { rowId: "appl_1", fieldKey: "datasheet_asset_ids", value: ["asset_pdf_1"] },
      ],
      {},
      {},
    );
    expect(edited.appliances[0]?.custom_values.capacity_m3).toBeNull();
    expect(edited.appliances[0]?.energy_star).toBe("opt_appl_energy_star_no");
    expect(edited.appliances[0]?.datasheet_asset_ids).toEqual(["asset_pdf_1"]);

    const duplicated = appliancesPayloadFromRowDuplicate(current, [
      {
        rowId: "appl_dup",
        sourceRowId: "appl_1",
        sourceRow: current.appliances[0]!,
        anchorRowId: "appl_1",
      },
    ]);
    expect(
      duplicated.appliances.find((appliance) => appliance.id === "appl_dup")?.custom_values
        .record_id,
    ).toBe("A-1 (copy)");

    const deleted = appliancesPayloadFromRowDelete(current, [
      { rowId: "appl_1", row: current.appliances[0]!, anchorRowId: null },
    ]);
    expect(deleted.appliances).toHaveLength(0);
  });

  test("validates type, EnergyStar, URL, and nonnegative values", () => {
    const valid = buildAppliancesSlice({
      appliances: [buildAppliance()],
    });
    expect(validateAppliancesPayload(valid)).toBeNull();

    expect(
      validateAppliancesPayload({
        ...valid,
        appliances: [buildAppliance({ appliance_type: "opt_missing" })],
      }),
    ).toBe("Appliance type option is missing.");

    expect(
      validateAppliancesPayload({
        ...valid,
        appliances: [buildAppliance({ energy_star: "opt_missing" })],
      }),
    ).toBe("Appliance EnergyStar option is missing.");

    expect(
      validateAppliancesPayload({
        ...valid,
        appliances: [buildAppliance({ url: "ftp://example.com/appliance.pdf" })],
      }),
    ).toBe("Appliance URL must start with http:// or https://.");

    expect(
      validateAppliancesPayload({
        ...valid,
        appliances: [
          buildAppliance({
            custom_values: { ...buildAppliance().custom_values, annual_energy_kwh: -1 },
          }),
        ],
      }),
    ).toBe("Annual Energy must be zero or greater.");
  });
});
