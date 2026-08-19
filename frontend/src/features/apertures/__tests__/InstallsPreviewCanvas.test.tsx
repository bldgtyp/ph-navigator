import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { InstallsPreviewCanvas } from "../components/InstallsPreviewCanvas";
import { APERTURE_INSTALL_DEFAULT_TYPE_ID } from "../install-psi";
import type { ApertureInstallTypeSummary } from "../types";
import { apertureElement, apertureEntry } from "./aperture-ui-test-fixtures";

const DEFAULT_TYPE: ApertureInstallTypeSummary = {
  id: APERTURE_INSTALL_DEFAULT_TYPE_ID,
  name: "Default",
  psi_w_mk: 0.052,
  source: "opt_apit_src_program_default",
  has_pdf: false,
};

let previewWidth = 400;
let previewHeight = 500;
let notifyResize: (() => void) | null = null;

class TestResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    notifyResize = () => callback([], this as unknown as ResizeObserver);
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("InstallsPreviewCanvas", () => {
  beforeEach(() => {
    previewWidth = 400;
    previewHeight = 500;
    notifyResize = null;
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains("installs-modal__preview") ? previewWidth : 2000;
    });
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains("installs-modal__preview") ? previewHeight : 2000;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("uses one measured viewport for the exact-size SVG and every overlay band", () => {
    render(
      <InstallsPreviewCanvas
        aperture={apertureEntry({
          column_widths_mm: [1000],
          row_heights_mm: [3000],
          elements: [apertureElement()],
        })}
        installTypes={[DEFAULT_TYPE]}
        armed={false}
        disabled={false}
        defaultTypeName="Default"
        formatPsi={(value) => String(value)}
        onEdgeClick={vi.fn()}
      />,
    );

    const canvas = screen.getByTestId("installs-preview-canvas");
    const svg = screen.getByTestId("aperture-svg-canvas");
    const overlay = screen.getByTestId("installs-preview-overlay");
    expect(Number(svg.getAttribute("width"))).toBeCloseTo(156);
    expect(Number(svg.getAttribute("height"))).toBeCloseTo(468);
    expect(canvas).toHaveStyle({ left: "122px", top: "16px", width: "156px", height: "468px" });
    expect(svg).toHaveAttribute("data-render-zoom", overlay.getAttribute("data-render-zoom"));

    for (const edge of screen.getAllByTestId(/^install-edge-/)) {
      const left = Number.parseFloat(edge.style.left);
      const top = Number.parseFloat(edge.style.top);
      const width = Number.parseFloat(edge.style.width);
      const height = Number.parseFloat(edge.style.height);
      expect(left + width).toBeLessThanOrEqual(156);
      expect(top + height).toBeLessThanOrEqual(468);
    }
  });

  test("recomputes from measured container geometry after resize", () => {
    render(
      <InstallsPreviewCanvas
        aperture={apertureEntry({
          column_widths_mm: [2000],
          row_heights_mm: [1000],
          elements: [apertureElement()],
        })}
        installTypes={[DEFAULT_TYPE]}
        armed={false}
        disabled={false}
        defaultTypeName="Default"
        formatPsi={(value) => String(value)}
        onEdgeClick={vi.fn()}
      />,
    );

    expect(Number(screen.getByTestId("aperture-svg-canvas").getAttribute("width"))).toBeCloseTo(
      368,
    );

    previewWidth = 700;
    previewHeight = 300;
    act(() => notifyResize?.());

    const resizedSvg = screen.getByTestId("aperture-svg-canvas");
    expect(Number(resizedSvg.getAttribute("height"))).toBeCloseTo(268);
    expect(Number(resizedSvg.getAttribute("width"))).toBeCloseTo(536);
  });

  test("retains the last valid viewport through a transient zero-size observation", () => {
    render(
      <InstallsPreviewCanvas
        aperture={apertureEntry()}
        installTypes={[DEFAULT_TYPE]}
        armed={false}
        disabled={false}
        defaultTypeName="Default"
        formatPsi={(value) => String(value)}
        onEdgeClick={vi.fn()}
      />,
    );

    const svg = screen.getByTestId("aperture-svg-canvas");
    const width = svg.getAttribute("width");
    previewWidth = 0;
    previewHeight = 0;
    act(() => notifyResize?.());

    expect(screen.getByTestId("installs-preview")).toHaveAttribute("data-ready", "true");
    expect(screen.getByTestId("aperture-svg-canvas")).toHaveAttribute("width", width);
  });
});
