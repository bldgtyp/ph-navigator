import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitSystem } from "../../../lib/units";
import { CondensationAssumptionsPanel } from "../components/CondensationAssumptionsPanel";
import { CondensationNumbersPanel } from "../components/CondensationNumbersPanel";
import { CondensationRiskModal } from "../components/CondensationRiskModal";
import { parseSettingsDraft, type SettingsDraft } from "../condensation-assumption-data";
import {
  condensationAssembly,
  condensationMaterials,
  screenedCondensationResult,
} from "./condensation-test-fixture";

describe("condensation Phase 5 panels", () => {
  test("renders all three shared number tables with unit headers and no view controls", () => {
    renderWithUnits(
      <CondensationNumbersPanel
        assembly={condensationAssembly}
        materials={condensationMaterials}
        result={screenedCondensationResult()}
      />,
      "IP",
    );

    expect(screen.getByRole("heading", { name: "Layer intermediates" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Monthly cycle" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Per-interface breakdown" })).toBeInTheDocument();
    expect(screen.getAllByText("gr/ft2")).toHaveLength(4);
    expect(screen.getAllByText("gr/(ft2-s)")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Filter" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sort" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Group" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide fields" })).not.toBeInTheDocument();
  });

  test("uses unit fields so layer cells stay bare while SI units live in headers", () => {
    renderWithUnits(
      <CondensationNumbersPanel
        assembly={condensationAssembly}
        materials={condensationMaterials}
        result={screenedCondensationResult()}
      />,
      "SI",
    );

    const layerTable = screen
      .getByRole("heading", { name: /Condensation layers/ })
      .closest(".data-table-shell");
    expect(layerTable).not.toBeNull();
    const table = within(layerTable as HTMLElement);
    expect(table.getByText("mm")).toBeInTheDocument();
    expect(table.getByText("W/(m-K)")).toBeInTheDocument();
    expect(table.getByText("m2-K/W")).toBeInTheDocument();
    expect(table.getByText("deg C")).toBeInTheDocument();
    expect(
      table
        .getAllByTestId("data-table-field-type-icon")
        .filter((icon) => icon.getAttribute("data-field-type-icon") === "unit"),
    ).toHaveLength(9);
    expect(
      table
        .getAllByRole("gridcell")
        .some((cell) => /(mm|W\/\(m-K\)|m2-K\/W|deg C|Pa|%)/.test(cell.textContent ?? "")),
    ).toBe(false);
    expect(table.getByText("12.0")).toBeInTheDocument();
    expect(table.getAllByText("0.100").length).toBeGreaterThan(0);
  });

  test("writes a complete fixed-setpoint settings block", async () => {
    const onApply = vi.fn().mockResolvedValue(true);
    renderWithUnits(
      <MemoryRouter>
        <CondensationAssumptionsPanel
          projectId="project"
          assembly={condensationAssembly}
          materials={condensationMaterials}
          result={screenedCondensationResult()}
          canEdit
          busy={false}
          commandError={null}
          onApply={onApply}
        />
      </MemoryRouter>,
      "SI",
    );

    expect(screen.getByRole("button", { name: "Apply assumptions" })).toBeDisabled();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Interior climate model" }),
      "fixed_setpoint",
    );
    await userEvent.clear(
      screen.getByRole("spinbutton", { name: "Interior setpoint temperature" }),
    );
    await userEvent.type(
      screen.getByRole("spinbutton", { name: "Interior setpoint temperature" }),
      "21",
    );
    await userEvent.clear(
      screen.getByRole("spinbutton", { name: "Interior setpoint relative humidity" }),
    );
    await userEvent.type(
      screen.getByRole("spinbutton", { name: "Interior setpoint relative humidity" }),
      "55",
    );
    await userEvent.clear(screen.getByRole("spinbutton", { name: "Accumulated moisture limit" }));
    await userEvent.type(
      screen.getByRole("spinbutton", { name: "Accumulated moisture limit" }),
      "150",
    );
    await userEvent.click(screen.getByRole("button", { name: "Apply assumptions" }));

    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith({
        interior_climate_model: "fixed_setpoint",
        occupancy_class: "normal",
        humidity_class: 2,
        setpoint_temp_c: 21,
        setpoint_rh: 0.55,
        ma_limit_g_m2: 150,
      }),
    );
  });

  test("shows versioned assumptions read-only when editing is unavailable", () => {
    renderWithUnits(
      <MemoryRouter>
        <CondensationAssumptionsPanel
          projectId="project"
          assembly={condensationAssembly}
          materials={condensationMaterials}
          result={screenedCondensationResult()}
          canEdit={false}
          busy={false}
          commandError={null}
          onApply={vi.fn()}
        />
      </MemoryRouter>,
      "SI",
    );

    expect(screen.getByText("ISO 13788 continental / tropical")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply assumptions" })).not.toBeInTheDocument();
  });

  test("lets an invalid persisted settings block be repaired from the modal", async () => {
    const onUpdateSettings = vi.fn().mockResolvedValue(true);
    const result = screenedCondensationResult({
      status: { state: "blocked", is_complete: false, flags: ["invalid_settings"] },
      settings: {
        interior_climate_model: "fixed_setpoint",
        occupancy_class: "normal",
        humidity_class: 2,
        setpoint_temp_c: null,
        setpoint_rh: null,
        ma_limit_g_m2: 200,
      },
      issues: [
        {
          code: "invalid_settings",
          message: "The fixed-setpoint model needs temperature and relative humidity.",
          assembly_id: "assembly",
          assembly_name: "Retrofit wall",
          layer_id: null,
          layer_order: null,
          segment_id: null,
          segment_order: null,
          project_material_id: null,
          project_material_name: null,
        },
      ],
    });
    renderWithUnits(
      <MemoryRouter>
        <CondensationRiskModal
          projectId="project"
          assembly={condensationAssembly}
          materials={condensationMaterials}
          result={result}
          loading={false}
          error={null}
          canEdit
          commandBusy={false}
          commandError={null}
          onClose={vi.fn()}
          onEditMaterial={vi.fn()}
          onUpdateSettings={onUpdateSettings}
        />
      </MemoryRouter>,
      "SI",
    );

    await userEvent.click(screen.getByRole("tab", { name: "Assumptions" }));
    await userEvent.type(
      screen.getByRole("spinbutton", { name: "Interior setpoint temperature" }),
      "21",
    );
    await userEvent.type(
      screen.getByRole("spinbutton", { name: "Interior setpoint relative humidity" }),
      "55",
    );
    await userEvent.click(screen.getByRole("button", { name: "Apply assumptions" }));

    expect(onUpdateSettings).toHaveBeenCalledWith({
      interior_climate_model: "fixed_setpoint",
      occupancy_class: "normal",
      humidity_class: 2,
      setpoint_temp_c: 21,
      setpoint_rh: 0.55,
      ma_limit_g_m2: 200,
    });
  });
});

describe("condensation settings draft validation", () => {
  const validFixedDraft: SettingsDraft = {
    model: "fixed_setpoint",
    occupancyClass: "normal",
    humidityClass: "2",
    setpointTemperature: "20",
    setpointRhPercent: "50",
    maLimit: "200",
  };

  test("rejects a blank required setpoint temperature", () => {
    expect(parseSettingsDraft({ ...validFixedDraft, setpointTemperature: "" }, "SI")).toEqual({
      settings: null,
      error: "Enter an interior setpoint temperature.",
    });
  });

  test("rejects a blank required setpoint relative humidity", () => {
    expect(parseSettingsDraft({ ...validFixedDraft, setpointRhPercent: "" }, "SI")).toEqual({
      settings: null,
      error: "Enter relative humidity from 0 to 100%.",
    });
  });
});

function renderWithUnits(node: ReactNode, unitSystem: UnitSystem) {
  return render(
    <UnitPreferenceContext.Provider
      value={{
        unitSystem,
        source: "local",
        error: null,
        setUnitSystem: vi.fn(),
        toggleUnitSystem: vi.fn(),
      }}
    >
      {node}
    </UnitPreferenceContext.Provider>,
  );
}
