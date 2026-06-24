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

  test("exposes status as an editable color-coded single-select with the slice options", () => {
    const statusOptions = [
      { id: "opt_status_complete", label: "Complete", color: "#16a34a", order: 0 },
      { id: "opt_status_needed", label: "Needed", color: "#d97706", order: 1 },
    ];
    const fields = outdoorEquipFieldDefs({
      options: { "heat_pumps_outdoor_equip.status": statusOptions },
    });
    const field = fields.find((candidate) => candidate.field_key === "status");

    expect(field?.field_type).toBe("single_select");
    expect(field?.read_only).toBeUndefined();
    expect(field?.defaultOptionId).toBe("opt_status_needed");
    expect(field?.options?.map((option) => option.id)).toEqual([
      "opt_status_complete",
      "opt_status_needed",
    ]);
    // The option list is locked for editing, but the cell value stays editable.
    expect(field?.locked).toContain("options");
    expect(field?.locked).not.toContain("value");
  });

  test("paired indoor equipment is a standard editable single linked-record field", () => {
    const fields = outdoorEquipFieldDefs({ options: {} });
    const field = fields.find((candidate) => candidate.field_key === "paired_indoor_equip_id");

    expect(field?.field_type).toBe("linked_record");
    expect(field?.read_only).toBeUndefined();
    expect(field?.linked_record_config).toEqual({
      target_table_path: ["equipment", "heat_pumps", "indoor_equip"],
      max_links: 1,
    });
  });
});

function dataTypeOptionColors(fields: ReturnType<typeof outdoorEquipFieldDefs>, fieldKey: string) {
  const field = fields.find((candidate) => candidate.field_key === fieldKey);
  expect(field?.field_type).toBe("single_select");
  return field?.options?.map((option) => option.color);
}
