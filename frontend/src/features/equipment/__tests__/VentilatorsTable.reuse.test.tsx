import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyViewState } from "../../../shared/ui/data-table";
import { VentilatorsTable } from "../components/VentilatorsTable";
import type { HeatPumpIndoorUnitRow } from "../heat-pumps/types";
import {
  buildVentilator,
  buildVentilatorsSlice,
  schemaForVentilators,
} from "../testing/testFixtures";

describe("VentilatorsTable DataTable reuse", () => {
  test("renders AirTable-matched ventilator columns, units, and single-select labels", () => {
    const slice = buildVentilatorsSlice({ ventilators: [buildVentilator()] });
    const tableSchema = schemaForVentilators(slice);
    render(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor={false}
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
      />,
    );

    expect(screen.getByRole("columnheader", { name: /Tag/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Airflow Rate/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Electrical Efficiency/ })).toBeInTheDocument();
    expect(screen.getByText("m3/h")).toBeInTheDocument();
    expect(screen.getByText("Wh/m3")).toBeInTheDocument();
    expect(screen.getByText("ERV-1")).toBeInTheDocument();
    expect(screen.getByText("Inside")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /HP indoor units/i })).toBeInTheDocument();
  });

  test("renders incoming HP indoor unit links from linked_erv_unit_id", () => {
    const slice = buildVentilatorsSlice({ ventilators: [buildVentilator({ id: "vent_1" })] });
    const tableSchema = schemaForVentilators(slice);
    const onIncomingIndoorUnitOpen = vi.fn();
    render(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor={false}
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
        heatPumpIndoorUnits={[indoorUnit({ linked_erv_unit_id: "vent_1" })]}
        onIncomingIndoorUnitOpen={onIncomingIndoorUnitOpen}
      />,
    );

    const incomingHeader = screen.getByRole("columnheader", { name: /HP indoor units/ });
    expect(incomingHeader.querySelector('[data-field-type-icon="linked_record"]')).toBeTruthy();
    let incomingPill = screen.getByRole("button", { name: "AHU-1" });
    fireEvent.click(incomingPill);
    incomingPill = screen.getByRole("button", { name: "AHU-1" });
    fireEvent.click(incomingPill);
    expect(onIncomingIndoorUnitOpen).toHaveBeenCalledWith("hpiu_01HX0000000000000000000001");
  });

  test("wires DataTable row expansion to Ventilator edit", async () => {
    const user = userEvent.setup();
    const slice = buildVentilatorsSlice({ ventilators: [buildVentilator()] });
    const tableSchema = schemaForVentilators(slice);
    const onEdit = vi.fn();
    render(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={vi.fn()}
        onEdit={onEdit}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Expand row 1" }));
    expect(onEdit).toHaveBeenCalledWith(slice.ventilators[0]);
  });

  test("calls onWrite through inline cell editing", async () => {
    const user = userEvent.setup();
    const slice = buildVentilatorsSlice({ ventilators: [buildVentilator()] });
    const tableSchema = schemaForVentilators(slice);
    const onWrite = vi.fn().mockResolvedValue(undefined);
    render(
      <VentilatorsTable
        ventilatorsSlice={slice}
        tableSchema={tableSchema}
        isEditor
        view={emptyViewState()}
        onViewChange={() => undefined}
        onWrite={onWrite}
      />,
    );

    await user.dblClick(screen.getByText("ERV-1"));
    await user.keyboard("{Control>}a{/Control}ERV-2{Enter}");

    expect(onWrite).toHaveBeenCalled();
  });
});

function indoorUnit(overrides: Partial<HeatPumpIndoorUnitRow> = {}): HeatPumpIndoorUnitRow {
  return {
    id: "hpiu_01HX0000000000000000000001",
    tag: "AHU-1",
    indoor_equip_id: "hpie_01HX0000000000000000000001",
    outdoor_unit_id: null,
    linked_erv_unit_id: null,
    served_room_ids: [],
    datasheet_asset_ids: [],
    notes: null,
    ...overrides,
  };
}
