import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitPreferenceContextValue } from "../../../lib/units/preference-context";
import { ApertureSpecReportPanel } from "../components/ApertureSpecReportPanel";
import type { ApertureDriftEntry } from "../drift-types";
import type { ProjectFrameRead, ProjectGlazingRead } from "../types";

vi.mock("../../assets/hooks", () => ({
  uploadAsset: vi.fn(),
  useAssetUrls: () => ({
    data: [
      {
        asset_id: "asset_ds_1",
        original_filename: "glazing-datasheet.pdf",
        content_type: "application/pdf",
      },
      {
        asset_id: "asset_ds_2",
        original_filename: "frame-datasheet.pdf",
        content_type: "application/pdf",
      },
    ],
  }),
}));

function UnitStub({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const value: UnitPreferenceContextValue = {
    unitSystem: "SI",
    source: "default",
    error: null,
    setUnitSystem: vi.fn(),
    toggleUnitSystem: vi.fn(),
  };
  return (
    <QueryClientProvider client={queryClient}>
      <UnitPreferenceContext.Provider value={value}>{children}</UnitPreferenceContext.Provider>
    </QueryClientProvider>
  );
}

function glazing(overrides: Partial<ProjectGlazingRead> = {}): ProjectGlazingRead {
  return {
    id: "glz_1",
    name: "Triple Pane A",
    manufacturer: "Alpen",
    brand: null,
    suffix: null,
    u_value_w_m2k: 0.72,
    g_value: 0.51,
    color: null,
    source: null,
    comments: null,
    catalog_origin: null,
    specification_status: "missing",
    datasheet_asset_ids: ["asset_ds_1"],
    use_sites: [
      {
        aperture_type_id: "apt_1",
        aperture_type_name: "Window Type A",
        element_id: "el_1",
        element_name: "Center lite",
      },
    ],
    ...overrides,
  };
}

function frame(overrides: Partial<ProjectFrameRead> = {}): ProjectFrameRead {
  return {
    id: "frm_1",
    name: "Insulated Frame A",
    manufacturer: "Zola",
    brand: null,
    use: null,
    operation: null,
    location: null,
    mull_type: null,
    prefix: null,
    suffix: null,
    material: null,
    width_mm: 92,
    u_value_w_m2k: 0.88,
    psi_g_w_mk: null,
    psi_install_w_mk: 0.031,
    color: null,
    source: null,
    comments: null,
    catalog_origin: null,
    specification_status: "question",
    datasheet_asset_ids: ["asset_ds_2"],
    use_sites: [
      {
        aperture_type_id: "apt_1",
        aperture_type_name: "Window Type A",
        element_id: "el_1",
        element_name: "Center lite",
        side: "left",
      },
    ],
    ...overrides,
  };
}

function renderGlazings(rows: ProjectGlazingRead[], options: { isViewer?: boolean } = {}) {
  render(
    <UnitStub>
      <ApertureSpecReportPanel
        rows={rows}
        kind="glazing"
        productLabel="Glazings"
        productColumnLabel="Glazing"
        emptyMessage="Project glazing specifications will appear here after apertures reference them."
        projectId="project_1"
        isViewer={options.isViewer ?? false}
        canEdit={false}
        busy={false}
        driftEntries={DRIFT_ENTRIES}
        onCommand={vi.fn()}
        onAttachmentChange={vi.fn()}
        onRefreshEntry={vi.fn()}
      />
    </UnitStub>,
  );
}

function renderFrames(rows: ProjectFrameRead[]) {
  render(
    <UnitStub>
      <ApertureSpecReportPanel
        rows={rows}
        kind="frame"
        productLabel="Frames"
        productColumnLabel="Frame"
        emptyMessage="Project frame specifications will appear here after apertures reference them."
        projectId="project_1"
        isViewer={false}
        canEdit={false}
        busy={false}
        driftEntries={DRIFT_ENTRIES}
        onCommand={vi.fn()}
        onAttachmentChange={vi.fn()}
        onRefreshEntry={vi.fn()}
      />
    </UnitStub>,
  );
}

const DRIFT_ENTRIES: ApertureDriftEntry[] = [
  {
    aperture_type_id: "apt_1",
    aperture_type_name: "Window Type A",
    element_id: "el_1",
    element_name: "Center lite",
    target: "glazing",
    kind: "field_delta",
    catalog_record_id: "cat_glz_1",
    deltas: [
      {
        field_key: "u_value_w_m2k",
        catalog_value: 0.7,
        yours_value: 0.72,
        in_local_overrides: false,
      },
    ],
  },
  {
    aperture_type_id: "apt_1",
    aperture_type_name: "Window Type A",
    element_id: "el_1",
    element_name: "Center lite",
    target: "frame.left",
    kind: "field_delta",
    catalog_record_id: "cat_frm_1",
    deltas: [
      {
        field_key: "psi_install_w_mk",
        catalog_value: 0.03,
        yours_value: 0.031,
        in_local_overrides: false,
      },
    ],
  },
];

describe("ApertureSpecReportPanel", () => {
  it("groups glazing rows, filters by status, and exposes datasheet/use-site evidence", () => {
    renderGlazings([
      glazing(),
      glazing({
        id: "glz_2",
        name: "Background Glazing",
        specification_status: "na",
        datasheet_asset_ids: [],
      }),
      glazing({
        id: "glz_3",
        name: "Unused Glazing",
        specification_status: "complete",
        datasheet_asset_ids: [],
        use_sites: [],
      }),
    ]);

    expect(screen.getByRole("heading", { name: "In scope" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "N/A" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unused" })).toBeInTheDocument();
    expect(screen.getByText("2/3 resolved")).toBeInTheDocument();

    const activeRow = screen.getByRole("row", { name: /Triple Pane A/ });
    expect(within(activeRow).getByLabelText(/^\d+ datasheets?$/)).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Unused Glazing/ })).getByLabelText("No datasheets"),
    ).toBeInTheDocument();

    fireEvent.click(activeRow);
    expect(screen.getByRole("region", { name: "Triple Pane A datasheets" })).toBeInTheDocument();
    const useSitesRegion = screen.getByRole("region", { name: "Triple Pane A use sites" });
    expect(within(useSitesRegion).getByText("Used in 1 element")).toBeInTheDocument();
    expect(screen.getByText("Grouped under Window Type A across 1 aperture.")).toBeInTheDocument();
    expect(within(useSitesRegion).queryByText("Center lite")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const drawer = screen.getByRole("dialog", { name: "Triple Pane A" });
    expect(within(drawer).getByText("Window Type A")).toBeInTheDocument();
    expect(within(drawer).getByText("Center lite")).toBeInTheDocument();
    expect(screen.getByText("1 catalog drift")).toBeInTheDocument();
    expect(screen.getByText("Glazing · 1 field differs")).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole("button", { name: "Close use sites" }));
    fireEvent.click(screen.getByRole("button", { name: /Missing\s+1/ }));
    expect(screen.getByText("Triple Pane A")).toBeInTheDocument();
    expect(screen.queryByText("Background Glazing")).not.toBeInTheDocument();
    expect(screen.queryByText("Unused Glazing")).not.toBeInTheDocument();
  });

  it("renders frame-only columns and side-aware use sites", () => {
    renderFrames([
      frame({
        use_sites: [
          {
            aperture_type_id: "apt_1",
            aperture_type_name: "Window Type A",
            element_id: "el_1",
            element_name: "A",
            side: "left",
          },
          {
            aperture_type_id: "apt_1",
            aperture_type_name: "Window Type A",
            element_id: "el_1",
            element_name: "A",
            side: "right",
          },
          {
            aperture_type_id: "apt_1",
            aperture_type_name: "Window Type A",
            element_id: "el_2",
            element_name: "B",
            side: "top",
          },
        ],
      }),
    ]);

    expect(screen.getByRole("columnheader", { name: /Psi-install/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Width/ })).toBeInTheDocument();

    const row = screen.getByRole("row", { name: /Insulated Frame A/ });
    expect(within(row).getByLabelText(/^\d+ datasheets?$/)).toBeInTheDocument();
    fireEvent.click(row);

    const useSitesRegion = screen.getByRole("region", { name: "Insulated Frame A use sites" });
    expect(screen.getByText("Grouped under Window Type A across 2 apertures.")).toBeInTheDocument();
    expect(within(useSitesRegion).queryByText("A")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const drawer = screen.getByRole("dialog", { name: "Insulated Frame A" });
    expect(within(drawer).getByText("Window Type A")).toBeInTheDocument();
    expect(within(drawer).getByText("2 apertures · Used in 3 elements")).toBeInTheDocument();
    expect(within(drawer).getByText("A")).toBeInTheDocument();
    expect(within(drawer).getByText("2 sides")).toBeInTheDocument();
    expect(within(drawer).getByText("B")).toBeInTheDocument();
    expect(within(drawer).getByText("1 side")).toBeInTheDocument();
    expect(within(drawer).getByText("Left")).toBeInTheDocument();
    expect(within(drawer).getByText("Right")).toBeInTheDocument();
    expect(within(drawer).getByText("Top")).toBeInTheDocument();
    expect(screen.getByText("Frame Left · 1 field differs")).toBeInTheDocument();
  });

  it("groups frame rows by manufacturer by default and can regroup by brand", () => {
    renderFrames([
      frame({ id: "frm_1", name: "Alpha Frame", manufacturer: "Zola", brand: "Classic" }),
      frame({ id: "frm_2", name: "Beta Frame", manufacturer: "Zola", brand: "Passive" }),
      frame({ id: "frm_3", name: "Gamma Frame", manufacturer: "Optiwin", brand: "Classic" }),
    ]);

    expect(screen.getByRole("combobox", { name: "Frame group field" })).toHaveValue("manufacturer");
    expect(screen.getAllByText("Zola").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("2 Frames")).toBeInTheDocument();
    expect(screen.getAllByText("Optiwin").length).toBeGreaterThanOrEqual(2);

    fireEvent.change(screen.getByRole("combobox", { name: "Frame group field" }), {
      target: { value: "brand" },
    });

    expect(screen.getByText("Classic")).toBeInTheDocument();
    expect(screen.getByText("2 Frames")).toBeInTheDocument();
    expect(screen.getByText("Passive")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Frame group field" }), {
      target: { value: "none" },
    });

    expect(screen.queryByText("2 Frames")).not.toBeInTheDocument();
    expect(screen.getByText("Alpha Frame")).toBeInTheDocument();
    expect(screen.getByText("Beta Frame")).toBeInTheDocument();
    expect(screen.getByText("Gamma Frame")).toBeInTheDocument();
  });

  it("hides N/A and unused products for viewer reports", () => {
    renderGlazings(
      [
        glazing({ id: "glz_1", name: "Visible Glazing", specification_status: "question" }),
        glazing({ id: "glz_2", name: "Background Glazing", specification_status: "na" }),
        glazing({ id: "glz_3", name: "Unused Glazing", use_sites: [] }),
      ],
      { isViewer: true },
    );

    expect(screen.getByText("Visible Glazing")).toBeInTheDocument();
    expect(screen.queryByText("Background Glazing")).not.toBeInTheDocument();
    expect(screen.queryByText("Unused Glazing")).not.toBeInTheDocument();
  });
});
