import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnitPreferenceProvider } from "../../../lib/units";
import type { ApertureThermalComfortResult } from "../comfort-types";
import { ThermalComfortModal } from "../components/ThermalComfortModal";
import type { ApertureTypeEntry } from "../types";

const APERTURE: ApertureTypeEntry = {
  id: "apt_sf",
  name: "SF-01",
  sill_height_mm: 207,
  nfrc_whole_window_u_w_m2k: null,
  nfrc_standard_size_note: null,
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
  nfrc_whole_window_u_w_m2k: null,
  nfrc_standard_size_note: null,
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
      head_height_mm: 3560,
      delta_t_max_f: 6.0,
      u_max_w_m2k: 0.85,
      u_project_specific_w_m2k: 1.05,
      u_nfrc_standard_w_m2k: null,
      governing_route: "project_specific",
      margin: 1.235,
      state: "fail",
      comfort_exempt: false,
      comfort_exempt_reason: null,
      perimeter_heat_within_3ft: false,
      perimeter_heat_note: null,
      nfrc_route_missing_caveat: true,
    },
    {
      element_id: "aptel_vision",
      element_name: "Lower Vision",
      row_span: [1, 1],
      column_span: [0, 0],
      head_height_mm: 3060,
      delta_t_max_f: 7.25,
      u_max_w_m2k: 1.03,
      u_project_specific_w_m2k: 0.88,
      u_nfrc_standard_w_m2k: null,
      governing_route: "project_specific",
      margin: 0.854,
      state: "pass",
      comfort_exempt: false,
      comfort_exempt_reason: null,
      perimeter_heat_within_3ft: false,
      perimeter_heat_note: null,
      nfrc_route_missing_caveat: false,
    },
  ],
};

function renderModal(onCommand = vi.fn(), canEdit = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <UnitPreferenceProvider>
        <ThermalComfortModal
          open
          aperture={APERTURE}
          result={RESULT}
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

  it("dispatches setApertureComfortParams when saving sill height and NFRC U", () => {
    const onCommand = vi.fn();
    renderModal(onCommand);
    const sillInput = screen.getByLabelText(/Sill height above finished floor/i);
    fireEvent.change(sillInput, { target: { value: "900" } });
    const nfrcInput = screen.getByLabelText(/NFRC standard-size whole-window U/i);
    fireEvent.change(nfrcInput, { target: { value: "0.75" } });
    const noteInput = screen.getByLabelText(/NFRC standard size note/i);
    fireEvent.change(noteInput, { target: { value: "2.00 m x 2.00 m" } });
    fireEvent.click(screen.getByRole("button", { name: "Save parameters" }));
    expect(onCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "setApertureComfortParams",
        aperture_type_id: "apt_sf",
        nfrc_standard_size_note: "2.00 m x 2.00 m",
      }),
    );
  });

  it("dispatches setElementComfortFlags when marking a lite exempt", () => {
    const onCommand = vi.fn();
    renderModal(onCommand);
    const editButtons = screen.getAllByRole("button", { name: "Edit" });
    fireEvent.click(editButtons[0]!);
    fireEvent.click(screen.getByLabelText(/Comfort-exempt lite/i));
    fireEvent.change(screen.getByLabelText("Exemption reason"), { target: { value: "ada_door" } });
    fireEvent.click(screen.getByRole("button", { name: "Save flags" }));
    expect(onCommand).toHaveBeenCalledWith({
      kind: "setElementComfortFlags",
      aperture_type_id: "apt_sf",
      element_id: "aptel_transom",
      comfort_exempt: true,
      comfort_exempt_reason: "ada_door",
      perimeter_heat_within_3ft: false,
      perimeter_heat_note: null,
    });
  });
});
