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
    expect(within(activeRow).getByLabelText("Attached")).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Unused Glazing/ })).getByLabelText("Missing"),
    ).toBeInTheDocument();

    fireEvent.click(activeRow);
    expect(screen.getByRole("region", { name: "Triple Pane A datasheets" })).toBeInTheDocument();
    expect(screen.getByText("Used in 1 elements")).toBeInTheDocument();
    expect(screen.getByText("Window Type A")).toBeInTheDocument();
    expect(screen.getAllByText("Center lite").length).toBeGreaterThan(0);
    expect(screen.getByText("1 catalog drift")).toBeInTheDocument();
    expect(screen.getByText("Glazing · 1 field differs")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Missing\s+1/ }));
    expect(screen.getByText("Triple Pane A")).toBeInTheDocument();
    expect(screen.queryByText("Background Glazing")).not.toBeInTheDocument();
    expect(screen.queryByText("Unused Glazing")).not.toBeInTheDocument();
  });

  it("renders frame-only columns and side-aware use sites", () => {
    renderFrames([frame()]);

    expect(screen.getByRole("columnheader", { name: /Psi-install/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Width/ })).toBeInTheDocument();

    const row = screen.getByRole("row", { name: /Insulated Frame A/ });
    expect(within(row).getByLabelText("Attached")).toBeInTheDocument();
    fireEvent.click(row);

    expect(screen.getByRole("region", { name: "Insulated Frame A use sites" })).toBeInTheDocument();
    expect(screen.getByText("Center lite · Left")).toBeInTheDocument();
    expect(screen.getByText("Frame Left · 1 field differs")).toBeInTheDocument();
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
