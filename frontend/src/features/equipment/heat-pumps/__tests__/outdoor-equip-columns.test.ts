import { describe, expect, test } from "vitest";
import { OPTION_COLOR_PALETTE } from "../../../../shared/ui/data-table";
import { outdoorEquipFieldDefs } from "../outdoor-equip-columns";

describe("outdoorEquipFieldDefs", () => {
  test("renders heating and cooling data types as standard color-coded single-selects", () => {
    const fields = outdoorEquipFieldDefs({ options: {} });

    expect(dataTypeOptionColors(fields, "heating_data_type")).toEqual(
      OPTION_COLOR_PALETTE.slice(0, 3),
    );
    expect(dataTypeOptionColors(fields, "cooling_data_type")).toEqual(
      OPTION_COLOR_PALETTE.slice(0, 3),
    );
  });
});

function dataTypeOptionColors(fields: ReturnType<typeof outdoorEquipFieldDefs>, fieldKey: string) {
  const field = fields.find((candidate) => candidate.field_key === fieldKey);
  expect(field?.field_type).toBe("single_select");
  return field?.options?.map((option) => option.color);
}
