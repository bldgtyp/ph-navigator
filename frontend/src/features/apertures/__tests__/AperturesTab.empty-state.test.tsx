import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { UnitSystem } from "../../../lib/units";
import {
  UnitPreferenceContext,
  type UnitPreferenceContextValue,
} from "../../../lib/units/preference-context";
import type { ProjectDetail, ProjectVersion } from "../../projects/types";
import type { ApertureUValueReport } from "../hooks/useApertureUValueReport";
import { APERTURE_EXPORT_U_VALUE_REPORT } from "../lib";
import { aperturesBuilderPath, aperturesUValuesPath } from "../paths";
import { AperturesTab } from "../routes/AperturesTab";
import type { ApertureTypeEntry, AperturesSlice } from "../types";

const mocks = vi.hoisted(() => ({
  slice: null as unknown,
  applyMutateAsync: vi.fn(),
  uValueReportHook: vi.fn(),
  capabilities: [] as string[],
  draftSummary: {
    source: "draft",
    draft_etag: "draft-etag",
  } as { source: "draft" | "version"; draft_etag: string | null },
}));

vi.mock("../../auth/hooks", () => ({
  useSessionQuery: vi.fn(() => ({
    data: { capabilities: mocks.capabilities },
  })),
}));

vi.mock("../../project_document/hooks", () => ({
  useDraftSummaryQuery: vi.fn(() => ({
    data: mocks.draftSummary,
  })),
}));

vi.mock("../hooks", () => ({
  useAperturesSliceQuery: vi.fn(() => ({
    data: mocks.slice,
    error: null,
    isError: false,
    isLoading: false,
  })),
  useApertureSpecReportQuery: vi.fn(() => ({
    data: null,
    error: null,
    isError: false,
    isLoading: false,
  })),
  useApplyApertureCommandMutation: vi.fn(() => ({
    isPending: false,
    mutateAsync: mocks.applyMutateAsync,
  })),
  useApertureProductCommandMutation: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
  useApertureReportRefreshMutation: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
  useApertureReportAttachmentMutation: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
}));

vi.mock("../hooks/useApertureDimFormat", () => ({
  useApertureDimFormat: vi.fn(() => ({
    system: "si",
    format: "mm",
    setSiFormat: vi.fn(),
    setIpFormat: vi.fn(),
  })),
}));

vi.mock("../hooks/useApertureDriftReport", () => ({
  useApertureDriftReport: vi.fn(() => ({
    data: { entries: [] },
  })),
}));

vi.mock("../hooks/useApertureUValues", () => ({
  useApertureUValues: vi.fn(() => ({
    data: { apertures: [] },
    isLoading: false,
  })),
}));

vi.mock("../hooks/useApertureUValueReport", () => ({
  useApertureUValueReport: mocks.uValueReportHook,
}));

vi.mock("../hooks/useFramePickerFilterPreferences", () => ({
  useFramePickerFilterPreferences: vi.fn(() => ({
    filterFramesByOperation: false,
    filterFramesBySide: false,
    setFilterFramesByOperation: vi.fn(),
    setFilterFramesBySide: vi.fn(),
  })),
}));

const VERSION: ProjectVersion = {
  id: "version-1",
  project_id: "project-1",
  name: "Working",
  kind: "working",
  locked: false,
  schema_version: 1,
  body_size_bytes: 0,
  created_at: "2026-06-29T00:00:00Z",
  updated_at: "2026-06-29T00:00:00Z",
};

const PROJECT: ProjectDetail = {
  id: "project-1",
  name: "Apertures Fixture",
  public_alias: null,
  display_name: "Apertures Fixture",
  bt_number: "BT-001",
  client: null,
  cert_programs: ["phi"],
  phius_number: null,
  phius_dropbox_url: null,
  active_version_id: VERSION.id,
  last_saved_at: null,
  created_at: "2026-06-29T00:00:00Z",
  updated_at: "2026-06-29T00:00:00Z",
  versions: [VERSION],
  active_version: VERSION,
  access_mode: "editor",
  owner_display_name: null,
};

const CREATED_APERTURE: ApertureTypeEntry = {
  id: "apt-created",
  name: "Aperture Type 1",
  row_heights_mm: [1000],
  column_widths_mm: [1000],
  elements: [],
};

const ACTIVE_APERTURE: ApertureTypeEntry = {
  id: "apt-active",
  name: "Type A",
  row_heights_mm: [1000],
  column_widths_mm: [1000],
  elements: [
    {
      id: "aptel-active",
      name: "A",
      kind: "glazed",
      row_span: [0, 0],
      column_span: [0, 0],
      frames: { top: null, right: null, bottom: null, left: null },
      glazing: null,
      operation: null,
    },
  ],
};

function createSlice(apertures: ApertureTypeEntry[]): AperturesSlice {
  return {
    project_id: PROJECT.id,
    version_id: VERSION.id,
    source: "draft",
    version_etag: "version-etag",
    draft_etag: "draft-etag",
    apertures,
    project_glazings: [],
    project_frames: [],
    manufacturer_filters: null,
  };
}

function renderAperturesTab(
  project: ProjectDetail = PROJECT,
  initialPath = aperturesBuilderPath(project.id),
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <UnitStub>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route
              path="/projects/:projectId/apertures/*"
              element={<AperturesTab project={project} />}
            />
          </Routes>
        </MemoryRouter>
      </UnitStub>
    </QueryClientProvider>,
  );
}

function UnitStub({
  children,
  unitSystem = "SI",
}: {
  children: ReactNode;
  unitSystem?: UnitSystem;
}) {
  const value: UnitPreferenceContextValue = {
    unitSystem,
    source: "default",
    error: null,
    setUnitSystem: vi.fn(),
    toggleUnitSystem: vi.fn(),
  };
  return <UnitPreferenceContext.Provider value={value}>{children}</UnitPreferenceContext.Provider>;
}

describe("AperturesTab zero-type state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.slice = createSlice([]);
    mocks.capabilities = [APERTURE_EXPORT_U_VALUE_REPORT];
    mocks.draftSummary = { source: "draft", draft_etag: "draft-etag" };
    mocks.applyMutateAsync.mockResolvedValue(createSlice([CREATED_APERTURE]));
    mocks.uValueReportHook.mockReturnValue({
      data: U_VALUE_REPORT,
      error: null,
      isError: false,
      isLoading: false,
    });
  });

  test("renders one primary main-panel add action for editors", async () => {
    const emptySlice = mocks.slice;
    renderAperturesTab();

    const main = screen.getByRole("main");
    expect(within(main).queryByRole("heading", { name: "Apertures" })).not.toBeInTheDocument();
    expect(within(main).queryByText("U-Value")).not.toBeInTheDocument();
    expect(within(main).queryByText("No aperture types yet.")).not.toBeInTheDocument();

    const addButtons = within(main).getAllByRole("button", { name: "Add aperture type" });
    expect(addButtons).toHaveLength(1);
    expect(addButtons[0]).toHaveClass("primary-button");

    await userEvent.click(addButtons[0]!);

    expect(mocks.applyMutateAsync).toHaveBeenCalledWith({
      current: emptySlice,
      command: { kind: "createApertureType" },
    });
  });

  test("keeps the read-only zero-type main panel quiet", () => {
    renderAperturesTab({ ...PROJECT, access_mode: "viewer" });

    const main = screen.getByRole("main");
    expect(
      within(main).queryByRole("button", { name: "Add aperture type" }),
    ).not.toBeInTheDocument();
    expect(within(main).queryByText("No aperture types yet.")).not.toBeInTheDocument();
    expect(within(main).queryByText("U-Value")).not.toBeInTheDocument();
  });

  test("dispatches flipLeftRight from the builder toolbar", async () => {
    const activeSlice = createSlice([ACTIVE_APERTURE]);
    mocks.slice = activeSlice;
    mocks.applyMutateAsync.mockResolvedValue(activeSlice);

    renderAperturesTab();

    await userEvent.click(screen.getByRole("button", { name: "Flip left/right" }));

    expect(mocks.applyMutateAsync).toHaveBeenCalledWith({
      current: activeSlice,
      command: { kind: "flipLeftRight", aperture_type_id: ACTIVE_APERTURE.id },
    });
  });
});

describe("AperturesTab U-Values route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.slice = createSlice([]);
    mocks.capabilities = [APERTURE_EXPORT_U_VALUE_REPORT];
    mocks.draftSummary = { source: "draft", draft_etag: "draft-etag" };
    mocks.uValueReportHook.mockReturnValue({
      data: U_VALUE_REPORT,
      error: null,
      isError: false,
      isLoading: false,
    });
  });

  test("renders the fourth report sub-tab from the editor draft", () => {
    renderAperturesTab(PROJECT, aperturesUValuesPath(PROJECT.id));

    expect(screen.getByText("U-Value Detail Report")).toBeVisible();
    expect(screen.getAllByText("Route Test Window").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "U-Values" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "U-value report actions" })).toBeVisible();
    expect(mocks.uValueReportHook).toHaveBeenCalledWith(PROJECT.id, VERSION.id, "draft", true);
  });

  test("reads the saved version and hides export actions without the capability", () => {
    mocks.capabilities = [];
    const viewerProject = { ...PROJECT, access_mode: "viewer" as const };
    renderAperturesTab(viewerProject, aperturesUValuesPath(PROJECT.id));

    expect(mocks.uValueReportHook).toHaveBeenCalledWith(PROJECT.id, VERSION.id, "version", true);
    expect(
      screen.queryByRole("button", { name: "U-value report actions" }),
    ).not.toBeInTheDocument();
  });

  test("waits for the draft guard before exposing editor export actions", () => {
    mocks.draftSummary = undefined as unknown as typeof mocks.draftSummary;
    renderAperturesTab(PROJECT, aperturesUValuesPath(PROJECT.id));

    expect(
      screen.queryByRole("button", { name: "U-value report actions" }),
    ).not.toBeInTheDocument();
  });

  test("allows a saved-version viewer with the export capability", () => {
    const viewerProject = { ...PROJECT, access_mode: "viewer" as const };
    renderAperturesTab(viewerProject, aperturesUValuesPath(PROJECT.id));

    expect(screen.getByRole("button", { name: "U-value report actions" })).toBeVisible();
  });
});

const U_VALUE_REPORT: ApertureUValueReport = {
  project_id: PROJECT.id,
  version_id: VERSION.id,
  source: "draft",
  provenance: {
    project_name: PROJECT.name,
    bt_number: PROJECT.bt_number,
    version_label: VERSION.name,
    source: "draft",
    generated_note:
      "ISO 10077-1:2006 · uninstalled U-w (excludes ψ-install) · edges as seen from outside",
  },
  apertures: [
    {
      aperture_type_id: "aperture-route-test",
      name: "Route Test Window",
      overall_width_m: 1,
      overall_height_m: 1,
      element_count: 0,
      void_count: 0,
      unfinished_count: 0,
      total_area_m2: 1,
      window_u_value_w_m2k: 0.8,
      shgc_glazing_area_weighted: null,
      warnings: [],
      elements: [],
    },
  ],
};
