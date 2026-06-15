import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IndoorUnitRowModal } from "../components/IndoorUnitRowModal";
import { buildEmptyIndoorUnitRow } from "../lib";
import type { HeatPumpIndoorEquipRow, HeatPumpOutdoorUnitRow } from "../types";
import type { VentilatorRow } from "../../types";

function indoorEquip(): HeatPumpIndoorEquipRow {
  return {
    id: "hpie_01HX0000000000000000000000",
    tag: "IE-A",
    manufacturer: "opt_mitsubishi",
    model_type: null,
    model_number: "PLA-A18EA8",
    install_type: null,
    nominal_tons: null,
    fan_speed_cfm: null,
    cooling_btuh: null,
    heating_btuh_47f: null,
    heating_btuh_17f: null,
    heating_cop: null,
    seer: null,
    eer: null,
    hspf: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
  };
}

function outdoorUnit(): HeatPumpOutdoorUnitRow {
  return {
    id: "hpou_01HX0000000000000000000000",
    tag: "HP-1",
    outdoor_equip_id: "hpoe_01HX0000000000000000000000",
    datasheet_asset_ids: [],
    notes: null,
  };
}

function ventilator(id: string, recordId: string): VentilatorRow {
  return {
    id,
    inside_outside: null,
    url: null,
    notes: null,
    custom_values: { record_id: recordId, name: `ERV ${recordId}` },
  };
}

describe("IndoorUnitRowModal", () => {
  test("submits a unit with linked ERV; room links are edited in the table chip cell", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <IndoorUnitRowModal
        mode="add"
        row={buildEmptyIndoorUnitRow()}
        indoorEquip={[indoorEquip()]}
        outdoorUnits={[outdoorUnit()]}
        ventilators={[ventilator("vent_n2", "ERV-N2"), ventilator("vent_n5", "ERV-N5")]}
        existingUnits={[]}
        options={{}}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={onSubmit}
        onCreateIndoorEquip={() => undefined}
      />,
    );

    // The "Served rooms" fieldset was removed in favour of the
    // linked_record chip cell on the indoor-units table.
    expect(screen.queryByText(/Served rooms/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Linked ERV unit/i)).not.toBeDisabled();

    await user.type(screen.getByLabelText("Tag"), "AHU-1");
    await user.selectOptions(
      screen.getByLabelText(/Indoor equipment/i),
      "hpie_01HX0000000000000000000000",
    );
    await user.selectOptions(screen.getByLabelText(/Linked ERV unit/i), "vent_n2");
    await user.click(screen.getByRole("button", { name: "Create indoor unit" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: "AHU-1",
        indoor_equip_id: "hpie_01HX0000000000000000000000",
        linked_erv_unit_id: "vent_n2",
      }),
    );
  });

  test("disables the outdoor-unit picker with helper text when no outdoor units exist", () => {
    render(
      <IndoorUnitRowModal
        mode="add"
        row={buildEmptyIndoorUnitRow()}
        indoorEquip={[indoorEquip()]}
        outdoorUnits={[]}
        ventilators={[]}
        existingUnits={[]}
        options={{}}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={() => Promise.resolve()}
        onCreateIndoorEquip={() => undefined}
      />,
    );

    expect(screen.getByLabelText(/Outdoor unit/i)).toBeDisabled();
    expect(screen.getByText(/Add an outdoor unit first in Units — Outdoor\./i)).toBeInTheDocument();
  });

  test("disables the ERV picker with helper text when no ventilators exist", () => {
    render(
      <IndoorUnitRowModal
        mode="add"
        row={buildEmptyIndoorUnitRow()}
        indoorEquip={[indoorEquip()]}
        outdoorUnits={[outdoorUnit()]}
        ventilators={[]}
        existingUnits={[]}
        options={{}}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={() => Promise.resolve()}
        onCreateIndoorEquip={() => undefined}
      />,
    );

    expect(screen.getByLabelText(/Linked ERV unit/i)).toBeDisabled();
    expect(screen.getByText(/Add an ERV first under Equipment → ERVs\./i)).toBeInTheDocument();
  });
});
