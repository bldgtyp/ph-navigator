import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { UValueReportActions } from "../components/UValueReportActions";
import type { ApertureUValueReport } from "../hooks/useApertureUValueReport";

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  busy: false,
  busyFormat: null as "csv" | "xlsx" | null,
}));

vi.mock("../hooks/useApertureUValueReportExport", async (importOriginal) => {
  const original = await importOriginal<typeof import("../hooks/useApertureUValueReportExport")>();
  return {
    ...original,
    useApertureUValueReportExport: vi.fn(() => ({
      download: mocks.download,
      busy: mocks.busy,
      busyFormat: mocks.busyFormat,
      unitSystem: "IP",
    })),
  };
});

const REPORT: ApertureUValueReport = {
  project_id: "project-1",
  version_id: "version-1",
  source: "draft",
  provenance: {
    project_name: "Fixture",
    bt_number: "BT-01",
    version_label: "Working",
    source: "draft",
    generated_note: "ISO 10077-1",
  },
  apertures: [
    {
      aperture_type_id: "aperture-1",
      name: "Type A",
      overall_width_m: 1,
      overall_height_m: 1,
      element_count: 1,
      void_count: 0,
      unfinished_count: 0,
      total_area_m2: 1,
      window_u_value_w_m2k: 0.8,
      shgc_glazing_area_weighted: 0.5,
      warnings: [],
      elements: [],
    },
  ],
};

function renderActions({
  report = REPORT,
  hasUnsavedDraft = false,
  canExport = true,
}: {
  report?: ApertureUValueReport;
  hasUnsavedDraft?: boolean;
  canExport?: boolean;
} = {}) {
  return render(
    <UValueReportActions
      projectId="project-1"
      versionId="version-1"
      report={report}
      hasUnsavedDraft={hasUnsavedDraft}
      canExport={canExport}
      onError={vi.fn()}
    />,
  );
}

describe("UValueReportActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.download.mockResolvedValue(true);
    mocks.busy = false;
    mocks.busyFormat = null;
  });

  test("hides the report menu without the export capability", () => {
    renderActions({ canExport: false });
    expect(
      screen.queryByRole("button", { name: "U-value report actions" }),
    ).not.toBeInTheDocument();
  });

  test("warns that a dirty draft is excluded and cancel does not download", async () => {
    const user = userEvent.setup();
    renderActions({ hasUnsavedDraft: true });

    await user.click(screen.getByRole("button", { name: "U-value report actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Download CSV (raw data)" }));

    expect(
      screen.getByText(
        /Export uses the last saved version — your unsaved changes are not included/,
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.download).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "U-value report actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Download CSV (raw data)" }));
    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(mocks.download).toHaveBeenCalledWith("csv");
  });

  test("warns about unfinished elements before a formula workbook download", async () => {
    const user = userEvent.setup();
    const report = {
      ...REPORT,
      apertures: [{ ...REPORT.apertures[0]!, unfinished_count: 2 }],
    };
    renderActions({ report });

    await user.click(screen.getByRole("button", { name: "U-value report actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Download XLSX (with formulas)" }));

    expect(screen.getByText(/contains 2 unfinished elements/)).toBeInTheDocument();
    expect(screen.getByText(/marks them/)).toHaveTextContent("UNFINISHED");
    await user.click(screen.getByRole("button", { name: "Download XLSX" }));
    expect(mocks.download).toHaveBeenCalledWith("xlsx");
  });

  test("combines saved-version and unfinished warnings in one consent dialog", async () => {
    const user = userEvent.setup();
    const report = {
      ...REPORT,
      apertures: [{ ...REPORT.apertures[0]!, unfinished_count: 1 }],
    };
    renderActions({ report, hasUnsavedDraft: true });

    await user.click(screen.getByRole("button", { name: "U-value report actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Download CSV (raw data)" }));

    expect(screen.getByText(/your unsaved changes are not included/)).toBeInTheDocument();
    expect(screen.getByText(/contains 1 unfinished element/)).toBeInTheDocument();
  });

  test("downloads immediately when no warning applies", async () => {
    const user = userEvent.setup();
    renderActions();

    await user.click(screen.getByRole("button", { name: "U-value report actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Download CSV (raw data)" }));

    expect(mocks.download).toHaveBeenCalledWith("csv");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
