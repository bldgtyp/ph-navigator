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
import { aperturesBuilderPath } from "../paths";
import { AperturesTab } from "../routes/AperturesTab";
import type { ApertureTypeEntry, AperturesSlice } from "../types";

const mocks = vi.hoisted(() => ({
  slice: null as unknown,
  applyMutateAsync: vi.fn(),
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

function renderAperturesTab(project: ProjectDetail = PROJECT) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <UnitStub>
        <MemoryRouter initialEntries={[aperturesBuilderPath(project.id)]}>
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
    mocks.applyMutateAsync.mockResolvedValue(createSlice([CREATED_APERTURE]));
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
