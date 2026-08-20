import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { AssemblyCanvasLayerGeometry } from "../canvas-geometry";
import { AssemblyLayerDimensions } from "../components/AssemblyLayerDimensions";
import type { AssemblyCanvasOverlayActions } from "../components/AssemblyCanvasOverlay";

const actions: AssemblyCanvasOverlayActions = {
  onDeleteLayer: vi.fn(),
  onUpdateLayerThickness: vi.fn(),
  onAddLayer: vi.fn(),
  onSegmentActivate: vi.fn(),
  onAddSegment: vi.fn(),
};

function layerGeometry(isMembrane = false): AssemblyCanvasLayerGeometry {
  return {
    layer: {
      id: "lyr_1",
      order: 0,
      thickness_mm: isMembrane ? 0.15 : 50,
      segments: [
        {
          id: "seg_1",
          order: 0,
          width_mm: 1000,
          is_continuous_insulation: false,
          steel_stud_spacing_mm: null,
          project_material_id: isMembrane ? "pmat_membrane" : "pmat_insulation",
          photo_asset_ids: [],
          use_site_notes: null,
        },
      ],
    },
    yMm: 0,
    heightMm: isMembrane ? 8 : 50,
    isMembrane,
    isAirBarrier: false,
  };
}

describe("AssemblyLayerDimensions", () => {
  test("read-only layers keep semantic thickness text and dimension chrome without controls", () => {
    const { container } = render(
      <AssemblyLayerDimensions
        layerGeometry={layerGeometry()}
        unitSystem="SI"
        zoom={1}
        canEdit={false}
        actions={actions}
      />,
    );

    const value = screen.getByText("50");
    expect(value.tagName).toBe("SPAN");
    expect(value).toHaveAttribute("aria-label", "Layer 1 thickness: 50 mm");
    expect(container.querySelectorAll(".dimension-tick")).toHaveLength(2);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  test("read-only membrane layers render no thickness dimension or controls", () => {
    const { container } = render(
      <AssemblyLayerDimensions
        layerGeometry={layerGeometry(true)}
        unitSystem="SI"
        zoom={1}
        canEdit={false}
        actions={actions}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("editor membrane layers retain delete and add controls without dimension chrome", () => {
    const { container } = render(
      <AssemblyLayerDimensions
        layerGeometry={layerGeometry(true)}
        unitSystem="SI"
        zoom={1}
        canEdit
        actions={actions}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete layer 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add layer above layer 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add layer below layer 1" })).toBeInTheDocument();
    expect(container.querySelectorAll(".dimension-tick")).toHaveLength(0);
    expect(container.querySelector(".dimension-chrome-cell--vertical")).not.toBeInTheDocument();
  });
});
