import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  test("renders all three shared number tables and IP moisture units", () => {
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
    expect(screen.getAllByText(/gr\/ft²/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("menuitem", { name: /Download/ })).not.toBeInTheDocument();
  });

  test("exposes numeric filter semantics for numeric intermediates", async () => {
    renderWithUnits(
      <CondensationNumbersPanel
        assembly={condensationAssembly}
        materials={condensationMaterials}
        result={screenedCondensationResult()}
      />,
      "SI",
    );

    await userEvent.click(screen.getAllByRole("button", { name: "Filter" })[0]!);
    const filterDialog = screen.getByRole("dialog", { name: "Filter rules" });
    await userEvent.click(screen.getByText("+ Add filter rule"));
    fireEvent.focus(within(filterDialog).getByRole("combobox", { name: "Filter field" }));
    fireEvent.click(screen.getByRole("option", { name: "R" }));

    expect(within(filterDialog).getByRole("combobox", { name: "Filter operator" })).toHaveValue(
      "=",
    );
    expect(
      within(filterDialog).getByRole("spinbutton", { name: "Filter value" }),
    ).toBeInTheDocument();
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
