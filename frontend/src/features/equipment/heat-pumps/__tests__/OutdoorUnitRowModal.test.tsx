import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OutdoorUnitRowModal } from "../components/OutdoorUnitRowModal";
import { buildEmptyOutdoorUnitRow } from "../lib";
import type { HeatPumpOutdoorEquipRow, HeatPumpOutdoorUnitRow } from "../types";

function outdoorEquip(): HeatPumpOutdoorEquipRow {
  return {
    id: "hpoe_01HX0000000000000000000000",
    tag: "OE-A",
    manufacturer: "opt_mitsubishi",
    model_number: "PUZ-A18NKA7",
    paired_indoor_equip_id: null,
    system_family: null,
    refrigerant: null,
    heating_data_type: null,
    heating_cap_kbtuh_17f: null,
    heating_cap_kbtuh_47f: null,
    heating_cop_17f: null,
    heating_cop_47f: null,
    hspf2: null,
    hspf: null,
    cooling_data_type: null,
    cooling_cap_kbtuh_95f: null,
    eer2: null,
    seer2: null,
    ieer: null,
    eer: null,
    seer: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
  };
}

describe("OutdoorUnitRowModal", () => {
  test("renders the equipment picker and submits a new unit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <OutdoorUnitRowModal
        mode="add"
        row={buildEmptyOutdoorUnitRow()}
        outdoorEquip={[outdoorEquip()]}
        existingUnits={[]}
        options={{}}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={onSubmit}
        onCreateOutdoorEquip={() => undefined}
      />,
    );

    await user.type(screen.getByLabelText("Tag"), "HP-1");
    await user.selectOptions(
      screen.getByLabelText(/Outdoor equipment/i),
      "hpoe_01HX0000000000000000000000",
    );
    await user.click(screen.getByRole("button", { name: "Create outdoor unit" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: "HP-1",
        outdoor_equip_id: "hpoe_01HX0000000000000000000000",
      }),
    );
  });

  test("blocks submission when tag is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <OutdoorUnitRowModal
        mode="add"
        row={buildEmptyOutdoorUnitRow()}
        outdoorEquip={[outdoorEquip()]}
        existingUnits={[]}
        options={{}}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={onSubmit}
        onCreateOutdoorEquip={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create outdoor unit" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Tag is required.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("rejects duplicate tag on rename", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const rowA = buildEmptyOutdoorUnitRow({
      id: "hpou_aaaaaaaaaaaaaaaaaaaaaaaaaa",
      tag: "HP-1",
      outdoor_equip_id: "hpoe_01HX0000000000000000000000",
    });
    const rowB = buildEmptyOutdoorUnitRow({
      id: "hpou_bbbbbbbbbbbbbbbbbbbbbbbbbb",
      tag: "HP-2",
      outdoor_equip_id: "hpoe_01HX0000000000000000000000",
    });
    const existing: HeatPumpOutdoorUnitRow[] = [rowA, rowB];
    render(
      <OutdoorUnitRowModal
        mode="edit"
        row={rowB}
        outdoorEquip={[outdoorEquip()]}
        existingUnits={existing}
        options={{}}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={onSubmit}
        onCreateOutdoorEquip={() => undefined}
      />,
    );

    const tagInput = screen.getByLabelText("Tag");
    await user.clear(tagInput);
    await user.type(tagInput, "HP-1");
    await user.click(screen.getByRole("button", { name: "Save outdoor unit" }));

    expect(screen.getByRole("alert")).toHaveTextContent('Tag "HP-1" is already in use');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
