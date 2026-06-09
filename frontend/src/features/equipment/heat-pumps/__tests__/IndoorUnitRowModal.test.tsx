import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IndoorUnitRowModal } from "../components/IndoorUnitRowModal";
import { buildEmptyIndoorUnitRow } from "../lib";
import type { HeatPumpIndoorEquipRow, HeatPumpOutdoorUnitRow } from "../types";

function indoorEquip(): HeatPumpIndoorEquipRow {
  return {
    id: "hpie_01HX0000000000000000000000",
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
    building_zone: null,
    datasheet_asset_ids: [],
    notes: null,
  };
}

describe("IndoorUnitRowModal", () => {
  test("renders the Phase 4 disabled stubs and submits a unit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <IndoorUnitRowModal
        mode="add"
        row={buildEmptyIndoorUnitRow()}
        indoorEquip={[indoorEquip()]}
        outdoorUnits={[outdoorUnit()]}
        existingUnits={[]}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={onSubmit}
        onCreateIndoorEquip={() => undefined}
      />,
    );

    expect(screen.getAllByText(/Configured in Phase 4/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText(/Served rooms/i)).toBeDisabled();
    expect(screen.getByLabelText(/Linked ERV unit/i)).toBeDisabled();

    await user.type(screen.getByLabelText("Tag"), "AHU-1");
    await user.selectOptions(
      screen.getByLabelText(/Indoor equipment/i),
      "hpie_01HX0000000000000000000000",
    );
    await user.selectOptions(
      screen.getByLabelText(/Outdoor unit/i),
      "hpou_01HX0000000000000000000000",
    );
    await user.click(screen.getByRole("button", { name: "Create indoor unit" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: "AHU-1",
        indoor_equip_id: "hpie_01HX0000000000000000000000",
        outdoor_unit_id: "hpou_01HX0000000000000000000000",
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
        existingUnits={[]}
        readOnly={false}
        onCancel={() => undefined}
        onSubmit={() => Promise.resolve()}
        onCreateIndoorEquip={() => undefined}
      />,
    );

    expect(screen.getByLabelText(/Outdoor unit/i)).toBeDisabled();
    expect(screen.getByText(/Add an outdoor unit first in Units — Outdoor\./i)).toBeInTheDocument();
  });
});
