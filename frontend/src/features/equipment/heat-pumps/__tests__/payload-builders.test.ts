import { describe, expect, test } from "vitest";
import { tableFieldDef } from "../../testing/testFixtures";
import { buildEmptyOutdoorEquipRow, heatPumpOutdoorEquipPayloadBuilders } from "../lib";
import type { HeatPumpOutdoorEquipSlice } from "../types";

describe("heat pump payload builders", () => {
  test("routes custom value and linked-record writes through the custom bags", () => {
    const slice = outdoorEquipSlice({
      field_defs: [
        tableFieldDef({
          field_key: "cf_voltage",
          display_name: "cf_voltage",
          field_type: "number",
        }),
        tableFieldDef({
          field_key: "cf_rooms",
          display_name: "cf_rooms",
          field_type: "linked_record",
        }),
      ],
    });

    const payload = heatPumpOutdoorEquipPayloadBuilders.fromCellWrites(
      slice,
      [
        { rowId: "hpoe_a", fieldKey: "cf_voltage", value: 208 },
        { rowId: "hpoe_a", fieldKey: "cf_rooms", value: ["room_a", "room_b"] },
      ],
      {},
      {},
    );

    expect(payload.outdoor_equip[0]?.custom_values).toEqual({ cf_voltage: 208 });
    expect(payload.outdoor_equip[0]?.custom_links).toEqual({
      cf_rooms: ["room_a", "room_b"],
    });
    expect(payload.outdoor_equip[0]).not.toHaveProperty("cf_voltage");
    expect(payload.outdoor_equip[0]).not.toHaveProperty("cf_rooms");
  });

  test("carries inline single-select option deltas into the replace payload", () => {
    const slice = outdoorEquipSlice({
      single_select_options: {
        "heat_pumps.manufacturer": [
          { id: "opt_a", label: "A", color: "#111111", order: 0 },
          { id: "opt_b", label: "B", color: "#222222", order: 1 },
        ],
      },
    });

    const payload = heatPumpOutdoorEquipPayloadBuilders.fromCellWrites(
      slice,
      [{ rowId: "hpoe_a", fieldKey: "manufacturer", value: "opt_c" }],
      {
        "heat_pumps.manufacturer": [{ id: "opt_c", label: "C", color: "#333333", order: 2 }],
      },
      { "heat_pumps.manufacturer": ["opt_b"] },
    );

    expect(payload.outdoor_equip[0]?.manufacturer).toBe("opt_c");
    expect(
      payload.single_select_options["heat_pumps.manufacturer"]?.map((option) => option.id),
    ).toEqual(["opt_a", "opt_c"]);
  });

  test("applies shared row insert, delete, and duplicate operations", () => {
    const slice = outdoorEquipSlice({
      outdoor_equip: [
        outdoorEquipRow({ id: "hpoe_a", tag: "OE-A" }),
        outdoorEquipRow({ id: "hpoe_b", tag: "OE-B" }),
      ],
    });

    const inserted = heatPumpOutdoorEquipPayloadBuilders.fromRowInsert(
      slice,
      [
        {
          rowId: "hpoe_inserted",
          anchorRowId: "hpoe_a",
          fieldDefaults: { tag: "OE-Inserted", model_number: "PX-12" },
        },
      ],
      ({ rowId, fieldDefaults }) =>
        outdoorEquipRow({
          id: rowId,
          tag: requiredStringDefault(fieldDefaults, "tag"),
          model_number: requiredStringDefault(fieldDefaults, "model_number"),
        }),
    );
    expect(inserted.outdoor_equip.map((row) => row.id)).toEqual([
      "hpoe_a",
      "hpoe_inserted",
      "hpoe_b",
    ]);

    const sourceRow = slice.outdoor_equip[0];
    if (!sourceRow) throw new Error("Expected source row.");
    const duplicated = heatPumpOutdoorEquipPayloadBuilders.fromRowDuplicate(slice, [
      {
        sourceRowId: "hpoe_a",
        sourceRow,
        rowId: "hpoe_dup",
        anchorRowId: "hpoe_a",
      },
    ]);
    expect(duplicated.outdoor_equip.map((row) => row.id)).toEqual(["hpoe_a", "hpoe_dup", "hpoe_b"]);
    expect(duplicated.outdoor_equip[1]?.tag).toBe("OE-A (copy)");

    const deleted = heatPumpOutdoorEquipPayloadBuilders.fromRowDelete(slice, [
      { rowId: "hpoe_a", row: sourceRow, anchorRowId: null },
    ]);
    expect(deleted.outdoor_equip.map((row) => row.id)).toEqual(["hpoe_b"]);
  });

  test("cell-write payloads support fill-style multi-row updates", () => {
    const slice = outdoorEquipSlice({
      outdoor_equip: [
        outdoorEquipRow({ id: "hpoe_a", tag: "OE-A", heating_cap_kw_47f: 5.28 }),
        outdoorEquipRow({ id: "hpoe_b", tag: "OE-B", heating_cap_kw_47f: null }),
      ],
    });

    const payload = heatPumpOutdoorEquipPayloadBuilders.fromCellWrites(
      slice,
      [
        { rowId: "hpoe_a", fieldKey: "heating_cap_kw_47f", value: "6.1" },
        { rowId: "hpoe_b", fieldKey: "heating_cap_kw_47f", value: "6.1" },
      ],
      {},
      {},
    );

    expect(payload.outdoor_equip.map((row) => row.heating_cap_kw_47f)).toEqual([6.1, 6.1]);
  });
});

function outdoorEquipSlice(
  overrides: Partial<HeatPumpOutdoorEquipSlice> = {},
): HeatPumpOutdoorEquipSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "version_1",
    draft_etag: "draft_1",
    outdoor_equip: [outdoorEquipRow()],
    field_defs: [],
    single_select_options: {},
    ...overrides,
  };
}

function outdoorEquipRow(
  overrides: Partial<HeatPumpOutdoorEquipSlice["outdoor_equip"][number]> = {},
): HeatPumpOutdoorEquipSlice["outdoor_equip"][number] {
  return buildEmptyOutdoorEquipRow({ id: "hpoe_a", tag: "OE-A", ...overrides });
}

function requiredStringDefault(defaults: Record<string, unknown>, fieldKey: string): string {
  const value = defaults[fieldKey];
  if (typeof value !== "string") {
    throw new Error(`Expected string default for ${fieldKey}.`);
  }
  return value;
}
