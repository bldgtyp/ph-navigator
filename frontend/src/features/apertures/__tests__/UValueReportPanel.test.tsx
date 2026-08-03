import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UValueReportPanel } from "../components/UValueReportPanel";
import { formatWindowUValue } from "../format-u-value";
import type { ApertureUValueReport } from "../hooks/useApertureUValueReport";

let unitSystem: "SI" | "IP" = "SI";

vi.mock("../../../lib/units", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/units")>();
  return {
    ...actual,
    useUnitPreference: () => ({
      unitSystem,
      source: "default",
      error: null,
      setUnitSystem: vi.fn(),
      toggleUnitSystem: vi.fn(),
    }),
  };
});

describe("UValueReportPanel", () => {
  beforeEach(() => {
    unitSystem = "SI";
  });

  it("renders sections, chip-parity footer, unfinished treatment, and four edges", () => {
    const report = makeReport();
    renderPanel(report);

    expect(screen.getAllByText("Synthetic Window").length).toBeGreaterThan(0);
    const footer = screen.getByText(formatWindowUValue(1.2, "si"));
    expect(footer).toHaveTextContent("Window U-Value: 1.20 W/m²K");
    expect(screen.getByText("Includes 1 element needing attention as U = 0.")).toBeVisible();
    const unfinishedRow = screen.getByText("Unfinished Element").closest('[role="row"]');
    expect(unfinishedRow).not.toBeNull();
    const unfinishedCells = within(unfinishedRow as HTMLElement).getAllByRole("cell");
    for (const resultCell of unfinishedCells.slice(5)) {
      expect(resultCell).toHaveTextContent(/^—$/);
      expect(resultCell).not.toHaveTextContent("0.00");
    }
    expect(screen.getByText("Element is missing glazing and frame assignments.")).toBeVisible();

    fireEvent.click(screen.getAllByRole("button", { name: "Expand row" })[0]!);
    for (const side of ["Top", "Right", "Bottom", "Left"]) {
      expect(screen.getByText(side)).toBeVisible();
    }
    expect(screen.getByText("Ψ-install (excluded from U-w)")).toBeVisible();
    expect(screen.getByText("Right mullion borders a void panel.")).toBeVisible();
  });

  it("switches every report surface to IP units", () => {
    const report = makeReport();
    const view = renderPanel(report);
    expect(screen.getAllByText("W/m2-K").length).toBeGreaterThan(0);

    unitSystem = "IP";
    view.rerender(
      <MemoryRouter>
        <UValueReportPanel report={report} builderPath="/builder" canEdit />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Btu/(h-ft2-F)").length).toBeGreaterThan(0);
    expect(screen.getByText(formatWindowUValue(1.2, "ip"))).toBeVisible();
    expect(screen.getAllByText("ft²").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0.211").length).toBeGreaterThan(0);
    expect(screen.getByText("1.159")).toBeVisible();
  });

  it("shows the editor empty state and builder link", () => {
    renderPanel({ ...makeReport(), apertures: [] });
    expect(screen.getByRole("status")).toHaveTextContent("No apertures yet");
    expect(screen.getByRole("link", { name: "Open Apertures builder" })).toHaveAttribute(
      "href",
      "/builder",
    );
  });
});

function renderPanel(report: ApertureUValueReport) {
  return render(
    <MemoryRouter>
      <UValueReportPanel report={report} builderPath="/builder" canEdit />
    </MemoryRouter>,
  );
}

function makeReport(): ApertureUValueReport {
  const edge = (side: "top" | "right" | "bottom" | "left") => ({
    side,
    frame_id: `frame-${side}`,
    frame_name: `${side} frame`,
    width_m: 0.08,
    u_value_w_m2k: 1,
    psi_g_w_mk: 0.04,
    psi_install_w_mk: 0.03,
    edge_length_m: 1,
    interior_length_m: 0.84,
    center_strip_area_m2: 0.0672,
    corner_area_a_m2: 0.0032,
    corner_area_b_m2: 0.0032,
    frame_area_m2: 0.0736,
    q_frame_w_k: 0.0736,
    q_spacer_w_k: 0.0336,
  });
  const elements = [
    {
      element_id: "element-complete",
      element_name: "Complete Element",
      grid_label: "C1_R1",
      glazing_id: "glazing-1",
      glazing_name: "Triple glazing",
      glazing_u_w_m2k: 0.7,
      glazing_g_value: 0.5,
      width_m: 1.2,
      height_m: 1,
      interior_width_m: 1.04,
      interior_height_m: 0.84,
      u_value_w_m2k: 1.2,
      area_m2: 1.2,
      glazing_area_m2: 0.8736,
      frame_area_m2: 0.3264,
      q_glazing_w_k: 0.6115,
      q_frame_total_w_k: 0.3264,
      q_spacer_total_w_k: 0.1344,
      unfinished: false,
      edges: ["top", "right", "bottom", "left"].map((side) =>
        edge(side as "top" | "right" | "bottom" | "left"),
      ),
      warnings: [
        {
          kind: "mullion_frame_at_void_boundary" as const,
          element_id: "element-complete",
          side: "right" as const,
          axis: "column" as const,
          message: "Right mullion borders a void panel.",
        },
      ],
    },
    {
      element_id: "element-unfinished",
      element_name: "Unfinished Element",
      grid_label: "C2_R1",
      glazing_id: null,
      glazing_name: null,
      glazing_u_w_m2k: null,
      glazing_g_value: null,
      width_m: 1,
      height_m: 1,
      interior_width_m: null,
      interior_height_m: null,
      u_value_w_m2k: 0,
      area_m2: 1,
      glazing_area_m2: 0,
      frame_area_m2: 0,
      q_glazing_w_k: null,
      q_frame_total_w_k: null,
      q_spacer_total_w_k: null,
      unfinished: true,
      edges: ["top", "right", "bottom", "left"].map((side) =>
        edge(side as "top" | "right" | "bottom" | "left"),
      ),
      warnings: [
        {
          kind: "missing_glazing" as const,
          element_id: "element-unfinished",
          side: null,
          axis: null,
          message: "Element is missing glazing and frame assignments.",
        },
      ],
    },
  ];
  return {
    project_id: "project-1",
    version_id: "version-1",
    source: "draft",
    provenance: {
      project_name: "Synthetic House",
      bt_number: "TEST-01",
      version_label: "Saved v1",
      source: "draft",
      generated_note: "Exterior-view edge convention",
    },
    apertures: [
      {
        aperture_type_id: "aperture-1",
        name: "Synthetic Window",
        overall_width_m: 2.2,
        overall_height_m: 1,
        element_count: 2,
        void_count: 0,
        unfinished_count: 1,
        total_area_m2: 2.2,
        window_u_value_w_m2k: 1.2,
        shgc_glazing_area_weighted: 0.5,
        warnings: [
          {
            kind: "missing_glazing" as const,
            element_id: "element-unfinished",
            side: null,
            axis: null,
            message: "Element is missing glazing and frame assignments.",
          },
        ],
        elements,
      },
    ],
  };
}
