import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BuilderDriftBanner } from "../components/BuilderDriftBanner";
import type { ApertureDriftEntry } from "../drift-types";
import { DriftProvider } from "../hooks/useDriftContext";

const DRIFT_ENTRIES: ApertureDriftEntry[] = [
  {
    aperture_type_id: "apt_1",
    aperture_type_name: "W-01",
    element_id: "el_1",
    element_name: "Left",
    target: "frame.top",
    kind: "field_delta",
    catalog_record_id: "rec1",
    deltas: [
      {
        field_key: "u_value_w_m2k",
        catalog_value: 1.1,
        yours_value: 1.2,
        in_local_overrides: false,
      },
    ],
  },
  {
    aperture_type_id: "apt_2",
    aperture_type_name: "W-02",
    element_id: "el_2",
    element_name: "Transom",
    target: "glazing",
    kind: "catalog_row_missing",
    catalog_record_id: "rec2",
    deltas: [],
  },
  {
    aperture_type_id: "apt_1",
    aperture_type_name: "W-01",
    element_id: "el_3",
    element_name: "Right",
    target: "glazing",
    kind: "field_delta",
    catalog_record_id: "rec3",
    deltas: [
      { field_key: "color", catalog_value: "#111", yours_value: "#222", in_local_overrides: true },
    ],
  },
];

describe("BuilderDriftBanner", () => {
  it("excludes customized-only entries and states project-wide + active scope honestly", () => {
    const onOpenRefresh = vi.fn();
    render(
      <DriftProvider value={{ entries: DRIFT_ENTRIES, onOpenRefresh }}>
        <BuilderDriftBanner apertureTypeId="apt_1" apertureTypeName="W-01" />
      </DriftProvider>,
    );

    // 2 review-worthy entries project-wide (1 on W-01); the customized-only entry is excluded.
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 catalog entries need review (1 on W-01).",
    );

    fireEvent.click(screen.getByRole("button", { name: "Review all" }));
    const dialog = screen.getByRole("dialog", { name: "Catalog review — all apertures" });
    // Review all includes EVERY entry counted in the banner (both W-01 and W-02),
    // with active aperture W-01 prioritized first.
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("W-01");
    expect(items[1]).toHaveTextContent("W-02");
    fireEvent.click(within(items[0]!).getByRole("button", { name: "Review" }));
    expect(onOpenRefresh).toHaveBeenCalledWith(DRIFT_ENTRIES[0]);
  });

  it("opens project-wide modal including catalog_row_missing when active aperture has no drift", () => {
    const onOpenRefresh = vi.fn();
    render(
      <DriftProvider value={{ entries: DRIFT_ENTRIES, onOpenRefresh }}>
        <BuilderDriftBanner apertureTypeId="apt_3" apertureTypeName="W-03" />
      </DriftProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "2 catalog entries need review on other apertures.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Review all" }));
    const dialog = screen.getByRole("dialog", { name: "Catalog review — all apertures" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Inspect" }));
    expect(onOpenRefresh).toHaveBeenCalledWith(DRIFT_ENTRIES[1]);
  });
});
