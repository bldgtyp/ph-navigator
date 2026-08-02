import { describe, expect, test } from "vitest";

import { numberUnitsForType } from "../../../../../lib/units";
import type { FieldDef } from "../../types";
import { fieldDefsWithRenderOverrides } from "./renderOverrides";

const backendPowerUnits = numberUnitsForType("power", {
  mode: "fixed",
  precision_si: 2,
  precision_ip: 1,
});

const staleFallbackUnits = numberUnitsForType("power", {
  mode: "fixed",
  precision_si: 3,
  precision_ip: 1,
});

describe("fieldDefsWithRenderOverrides", () => {
  test("keeps backend-owned number units when applying feature render metadata", () => {
    const schemaField: FieldDef = {
      field_key: "capacity_kw",
      field_type: "number",
      display_name: "Capacity",
      numberUnits: backendPowerUnits,
    };
    const renderOverride: FieldDef = {
      ...schemaField,
      locked: ["field_type"],
      numberUnits: staleFallbackUnits,
    };

    const [merged] = fieldDefsWithRenderOverrides([schemaField], [renderOverride]);

    expect(merged?.numberUnits).toEqual(backendPowerUnits);
    expect(merged?.locked).toEqual(["field_type"]);
  });

  test("does not restore feature units omitted by the backend schema", () => {
    const schemaField: FieldDef = {
      field_key: "capacity_kw",
      field_type: "number",
      display_name: "Capacity",
    };
    const renderOverride: FieldDef = {
      ...schemaField,
      numberUnits: backendPowerUnits,
    };

    const [merged] = fieldDefsWithRenderOverrides([schemaField], [renderOverride]);

    expect(merged?.numberUnits).toBeUndefined();
  });
});
