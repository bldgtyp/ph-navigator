import { describe, expect, test, vi } from "vitest";
import type { SliceTableController } from "../../../../shared/ui/data-table/feature";
import { makeHeatPumpOptionCreator } from "../option-helpers";
import { HEAT_PUMP_OPTION_KEYS, type HeatPumpOutdoorEquipSlice } from "../types";

describe("makeHeatPumpOptionCreator", () => {
  test("adds an option via a generic editOptions write op on the bound controller", async () => {
    const onWrite = vi.fn().mockResolvedValue(undefined);
    const controller = {
      onWrite,
      tableSchema: { schemaFingerprint: "fp-1" },
    } as unknown as SliceTableController<HeatPumpOutdoorEquipSlice>;

    const createOption = makeHeatPumpOptionCreator({
      controller,
      tableKey: "heat_pumps_outdoor_equip",
      optionsByKey: {
        [HEAT_PUMP_OPTION_KEYS.manufacturer]: [
          { id: "opt_mitsubishi", label: "Mitsubishi", color: "#111111", order: 0 },
        ],
      },
    });

    const newId = await createOption(HEAT_PUMP_OPTION_KEYS.manufacturer, "Daikin");

    expect(newId).toMatch(/^opt_daikin_/);
    expect(onWrite).toHaveBeenCalledTimes(1);
    const op = onWrite.mock.calls[0]?.[0];
    expect(op).toMatchObject({ kind: "schemaMutation", variant: "typed" });
    // Routes by (tableKey, fieldId) — not the namespace key — and carries the
    // controller's schema fingerprint so the draft write isn't rejected as stale.
    expect(op.mutation).toMatchObject({
      kind: "editOptions",
      tableKey: "heat_pumps_outdoor_equip",
      fieldId: "manufacturer",
      expectedSchemaFingerprint: "fp-1",
    });
    // nextOptions is the full list: the existing option plus the minted one.
    expect(op.mutation.nextOptions).toHaveLength(2);
    expect(op.mutation.nextOptions[1]).toMatchObject({ id: newId, label: "Daikin" });
  });
});
