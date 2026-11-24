import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnitPreferenceProvider, useUnitPreference } from "../../../lib/units";
import type { ApertureThermalComfortResult } from "../comfort-types";
import { ThermalComfortModal } from "../components/ThermalComfortModal";
import type { ApertureCommand, ApertureTypeEntry } from "../types";

const APERTURE: ApertureTypeEntry = {
  id: "apt_sf",
  name: "SF-01",
  sill_height_mm: 207,
  row_heights_mm: [500, 2853],
  column_widths_mm: [1200],
  elements: [
    {
      id: "aptel_transom",
      name: "Top Transom",
      kind: "glazed",
      row_span: [0, 0],
      column_span: [0, 0],
      frames: { top: null, right: null, bottom: null, left: null },
      installs: { top: null, right: null, bottom: null, left: null },
      glazing: null,
      operation: null,
    },
    {
      id: "aptel_vision",
      name: "Lower Vision",
      kind: "glazed",
      row_span: [1, 1],
      column_span: [0, 0],
      frames: { top: null, right: null, bottom: null, left: null },
      installs: { top: null, right: null, bottom: null, left: null },
      glazing: null,
      operation: null,
    },
  ],
};

const RESULT: ApertureThermalComfortResult = {
  aperture_type_id: "apt_sf",
  aperture_type_name: "SF-01",
  sill_height_mm: 207,
  state: "fail",
  blocked_reasons: [],
  failing_count: 1,
  governing_element_id: "aptel_transom",
  governing_element_name: "Top Transom",
  heating_990_db_c: -10,
  climate_source_label: "JFK Synthetic",
  climate_source_basis: "ASHRAE 2021",
  ruleset: "phius-2024-r1",
  elements: [
    {
      element_id: "aptel_transom",
      element_name: "Top Transom",
      row_span: [0, 0],
      column_span: [0, 0],
      lite_height_mm: 500,
      head_height_mm: 3560,
      delta_t_max_f: 6.0,
      u_max_w_m2k: 0.85,
      u_project_specific_w_m2k: 1.05,
      u_nfrc_standard_w_m2k: 0.8531,
      u_nfrc_standard_note: "Original note",
      governing_route: "nfrc_standard",
      margin: 1.004,
      state: "fail",
      comfort_exempt: false,
      comfort_exempt_reason: null,
      perimeter_heat_within_3ft: false,
      perimeter_heat_note: null,
      perimeter_heat_ineligible: false,
      nfrc_route_missing_caveat: false,
    },
    {
      element_id: "aptel_vision",
      element_name: "Lower Vision",
      row_span: [1, 1],
      column_span: [0, 0],
      lite_height_mm: 2853,
      head_height_mm: 3060,
      delta_t_max_f: 7.25,
      u_max_w_m2k: 1.03,
      u_project_specific_w_m2k: 0.88,
      u_nfrc_standard_w_m2k: null,
      u_nfrc_standard_note: null,
      governing_route: "project_specific",
      margin: 0.854,
      state: "pass",
      comfort_exempt: false,
      comfort_exempt_reason: null,
      perimeter_heat_within_3ft: false,
      perimeter_heat_note: null,
      perimeter_heat_ineligible: false,
      nfrc_route_missing_caveat: true,
    },
  ],
};

function IpToggleButton() {
  const { setUnitSystem } = useUnitPreference();
  return (
    <button type="button" onClick={() => setUnitSystem("IP")}>
      Switch to IP
    </button>
  );
}

function renderModal(
  onCommand: (command: ApertureCommand) => Promise<string | null> = vi.fn().mockResolvedValue(null),
  canEdit = true,
  result: ApertureThermalComfortResult | null = RESULT,
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <UnitPreferenceProvider>
        <IpToggleButton />
        <ThermalComfortModal
          open
          aperture={APERTURE}
          result={result}
          canEdit={canEdit}
          onClose={vi.fn()}
          onCommand={onCommand}
        />
      </UnitPreferenceProvider>
    </QueryClientProvider>,
  );
}

describe("ThermalComfortModal", () => {
  it("renders Verdict, Where, Numbers, and Assumptions with Phius applet disclaimer", () => {
    renderModal();
    expect(screen.getByText("Comfort: 1 lite fails")).toBeInTheDocument();
    expect(screen.getByText(/Governing lite:/)).toBeInTheDocument();
    expect(screen.getByText("NFRC standard-size U not supplied")).toBeInTheDocument();
    expect(screen.getByText(/official Phius Window Comfort Applet/i)).toBeInTheDocument();
  });

  it("dispatches setApertureComfortParams when saving modified sill height", async () => {
    const onCommand = vi.fn().mockResolvedValue(null);
    renderModal(onCommand);
    const sillInput = screen.getByLabelText(/Sill height above finished floor/i);
    fireEvent.change(sillInput, { target: { value: "900" } });
    fireEvent.click(screen.getByRole("button", { name: "Save sill height" }));
    await waitFor(() => {
      expect(onCommand).toHaveBeenCalledWith({
        kind: "setApertureComfortParams",
        aperture_type_id: "apt_sf",
        sill_height_mm: 900,
      });
    });
  });

  it("preserves exact NFRC U in IP mode when editing only the NFRC note", async () => {
    const onCommand = vi.fn().mockResolvedValue(null);
    renderModal(onCommand);
    fireEvent.click(screen.getByRole("button", { name: "Switch to IP" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]!);
    const noteInput = screen.getByLabelText(/NFRC standard size note/i);
    fireEvent.change(noteInput, { target: { value: "2.00 m x 2.00 m" } });
    fireEvent.click(screen.getByRole("button", { name: "Save flags" }));
    await waitFor(() => {
      expect(onCommand).toHaveBeenCalledTimes(1);
    });
    const dispatched = onCommand.mock.calls[0]![0];
    expect(dispatched).toEqual({
      kind: "setElementComfortFlags",
      aperture_type_id: "apt_sf",
      element_id: "aptel_transom",
      comfort_exempt: false,
      comfort_exempt_reason: null,
      perimeter_heat_within_3ft: false,
      perimeter_heat_note: null,
      nfrc_standard_size_note: "2.00 m x 2.00 m",
    });
    expect("nfrc_whole_window_u_w_m2k" in dispatched).toBe(false);
  });

  it("keeps the flag editor open and shows an inline error when save fails", async () => {
    const onCommand = vi.fn().mockResolvedValue("Draft conflict: reload and retry.");
    renderModal(onCommand);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]!);
    fireEvent.click(screen.getByLabelText(/Comfort-exempt lite/i));
    fireEvent.change(screen.getByLabelText("Exemption reason"), { target: { value: "ada_door" } });
    fireEvent.click(screen.getByRole("button", { name: "Save flags" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Draft conflict: reload and retry.");
    expect(screen.getByRole("button", { name: "Save flags" })).toBeInTheDocument();
  });

  it("explains no_glazed_elements distinctly and directs the user to the aperture grid", () => {
    renderModal(vi.fn().mockResolvedValue(null), true, {
      ...RESULT,
      state: "blocked",
      blocked_reasons: ["no_glazed_elements"],
      failing_count: 0,
      governing_element_id: null,
      governing_element_name: null,
      elements: [],
    });
    expect(screen.getByText(/no glazed lites/i)).toBeInTheDocument();
    expect(screen.getByText(/aperture grid/i)).toBeInTheDocument();
  });
});
