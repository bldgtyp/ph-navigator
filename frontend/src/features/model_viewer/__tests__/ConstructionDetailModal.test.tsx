import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { UnitPreferenceContext } from "../../../lib/units/preference-context";
import type { UnitSystem } from "../../../lib/units";
import { ConstructionDetailModal } from "../components/ConstructionDetailModal";
import type { ConstructionMaterial, DetailedOpaqueConstruction } from "../types";

function material(overrides: Partial<ConstructionMaterial> = {}): ConstructionMaterial {
  return {
    type: "EnergyMaterial",
    identifier: "Cellulose",
    display_name: null,
    thickness: 0.14,
    conductivity: 0.04,
    properties: {
      ph: {
        ph_color: { a: 255, r: 200, g: 180, b: 140 },
        divisions: { column_widths: [], row_heights: [], steel_stud_spacing_mm: null, cells: [] },
      },
    },
    ...overrides,
  };
}

function construction(
  materials: ConstructionMaterial[],
  overrides: Partial<DetailedOpaqueConstruction> = {},
): DetailedOpaqueConstruction {
  return {
    identifier: "Test Wall Assembly",
    type: "OpaqueConstruction",
    u_factor: 0.25,
    u_value: 0.28,
    r_factor: 4.0,
    r_value: 3.5,
    materials,
    ...overrides,
  };
}

const framedMaterial = material({
  identifier: "Cellulose+Stud Cavity",
  conductivity: 0.05,
  properties: {
    ph: {
      ph_color: null,
      divisions: {
        column_widths: [0.4, 0.038, 0.4],
        row_heights: [1.0],
        steel_stud_spacing_mm: null,
        cells: [
          { row: 0, column: 0, material: material({ identifier: "Cellulose" }) },
          {
            row: 0,
            column: 1,
            material: material({ identifier: "Wood Stud", conductivity: 0.12 }),
          },
          { row: 0, column: 2, material: material({ identifier: "Cellulose" }) },
        ],
      },
    },
  },
});

const steelStudMaterial = material({
  identifier: "Steel Stud Cavity",
  thickness: 0.089,
  properties: {
    ph: {
      ph_color: null,
      divisions: {
        column_widths: [0.4, 0.0508, 0.4],
        row_heights: [1.0],
        steel_stud_spacing_mm: 406.4,
        cells: [
          { row: 0, column: 0, material: material() },
          { row: 0, column: 1, material: material({ identifier: "Steel Stud" }) },
          { row: 0, column: 2, material: material() },
        ],
      },
    },
  },
});

function Harness({
  construction: target,
  onClose = () => undefined,
}: {
  construction: DetailedOpaqueConstruction;
  onClose?: () => void;
}) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("SI");
  return (
    <UnitPreferenceContext.Provider
      value={{
        unitSystem,
        source: "default",
        error: null,
        setUnitSystem,
        toggleUnitSystem: () => undefined,
      }}
    >
      <button type="button" onClick={() => setUnitSystem("IP")}>
        switch-to-ip
      </button>
      <ConstructionDetailModal construction={target} onClose={onClose} />
    </UnitPreferenceContext.Provider>
  );
}

describe("ConstructionDetailModal — flat construction", () => {
  const flat = construction([
    material({ identifier: "XPS", thickness: 0.1, conductivity: 0.029 }),
    material({ identifier: "Gypsum Board", thickness: 0.0127, conductivity: 0.25 }),
  ]);

  it("renders the dialog with header figures via the shared formatters", () => {
    render(<Harness construction={flat} />);
    expect(screen.getByRole("dialog", { name: "Test Wall Assembly" })).toBeInTheDocument();
    expect(screen.getByText(/OpaqueConstruction · 2 layers/)).toBeInTheDocument();
    // Σ thickness = 112.7 mm (stat tile + totals row); header R-Value 3.5 m2-K/W (SI).
    expect(screen.getAllByText("112.7 mm").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("3.5 m2-K/W").length).toBeGreaterThanOrEqual(1);
  });

  it("renders one table row and one full-width SVG rect per layer, no expanders", () => {
    render(<Harness construction={flat} />);
    expect(screen.getAllByTestId("construction-layer-row")).toHaveLength(2);
    expect(screen.queryAllByTestId("construction-cell-row")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /segments of/i })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("construction-stack-cell")).toHaveLength(2);
    expect(screen.getByRole("img", { name: /assembly section/i })).toBeInTheDocument();
  });

  it("shows the totals row reconciling layer math", () => {
    render(<Harness construction={flat} />);
    const totals = screen.getByRole("row", { name: /Σ layers/ });
    // R = 0.1/0.029 + 0.0127/0.25 ≈ 3.499 → formatter rounds to 3.5.
    expect(within(totals).getByText("3.5 m2-K/W")).toBeInTheDocument();
    expect(within(totals).getByText("112.7 mm")).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<Harness construction={flat} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("flips units with the IP/SI preference", async () => {
    render(<Harness construction={flat} />);
    expect(screen.getAllByText("112.7 mm").length).toBeGreaterThanOrEqual(1);
    await userEvent.click(screen.getByRole("button", { name: "switch-to-ip" }));
    expect(screen.queryByText("112.7 mm")).not.toBeInTheDocument();
    // 112.7 mm → 4.44 in via formatLengthFromMm (2 fraction digits in IP).
    expect(screen.getAllByText("4.44 in").length).toBeGreaterThanOrEqual(1);
  });
});

describe("ConstructionDetailModal — framed construction", () => {
  const hybrid = construction([material({ identifier: "XPS", thickness: 0.1 }), framedMaterial]);

  it("auto-expands framed layers into segment sub-rows with widths and λ", () => {
    render(<Harness construction={hybrid} />);
    const cellRows = screen.getAllByTestId("construction-cell-row");
    expect(cellRows).toHaveLength(3);
    expect(within(cellRows[1]!).getByText("Wood Stud")).toBeInTheDocument();
    expect(within(cellRows[1]!).getByText("↔ 38 mm")).toBeInTheDocument();
    // SVG: 1 flat rect + 3 segment rects.
    expect(screen.getAllByTestId("construction-stack-cell")).toHaveLength(4);
  });

  it("collapses and re-expands via the layer expander", async () => {
    render(<Harness construction={hybrid} />);
    const expander = screen.getByRole("button", { name: /Collapse segments of/ });
    await userEvent.click(expander);
    expect(screen.queryAllByTestId("construction-cell-row")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: /Expand segments of/ }));
    expect(screen.getAllByTestId("construction-cell-row")).toHaveLength(3);
  });

  it("renders fallback fill for null colors without crashing", () => {
    render(<Harness construction={hybrid} />);
    // The framed layer's homogenized color is null, but its cells carry
    // colors — every rect must still have a fill.
    for (const rect of screen.getAllByTestId("construction-stack-cell")) {
      expect(rect.getAttribute("fill")).toBeTruthy();
    }
  });
});

describe("ConstructionDetailModal — steel-stud construction", () => {
  const steel = construction([steelStudMaterial]);

  it("annotates stud spacing and overlays the marker", () => {
    render(<Harness construction={steel} />);
    expect(screen.getByTestId("steel-stud-note")).toHaveTextContent("Steel studs @ 406.4 mm o.c.");
    expect(screen.getByTestId("construction-steel-marker")).toBeInTheDocument();
  });

  it("annotates spacing even for a single-cell (homogenized) steel layer with no expander", () => {
    const singleCellSteel = material({
      identifier: "Homogenized Steel Layer",
      properties: {
        ph: {
          ph_color: null,
          divisions: {
            column_widths: [1.0],
            row_heights: [1.0],
            steel_stud_spacing_mm: 406.4,
            cells: [{ row: 0, column: 0, material: material() }],
          },
        },
      },
    });
    render(<Harness construction={construction([singleCellSteel])} />);
    expect(screen.queryByRole("button", { name: /segments of/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("steel-stud-note")).toHaveTextContent("Steel studs @ 406.4 mm o.c.");
    expect(screen.getByTestId("construction-steel-marker")).toBeInTheDocument();
  });
});

describe("ConstructionDetailModal — empty state", () => {
  it("shows the no-detail message instead of drawing/table", () => {
    render(<Harness construction={construction([])} />);
    expect(
      screen.getByText("No layer detail available for this construction."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("construction-layer-row")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
