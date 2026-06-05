import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApertureCanvasOverlay } from "../components/ApertureCanvasOverlay";
import { useApertureBuilderStore } from "../store/builder-store";
import type { ApertureElement, ApertureTypeEntry, FrameRef, GlazingRef } from "../types";

function frame(widthMm: number): FrameRef {
  return {
    name: "F",
    manufacturer: null,
    brand: null,
    use: null,
    operation: null,
    location: null,
    mull_type: null,
    prefix: null,
    suffix: null,
    material: null,
    width_mm: widthMm,
    u_value_w_m2k: null,
    psi_g_w_mk: null,
    psi_install_w_mk: null,
    color: null,
    source: null,
    comments: null,
    catalog_origin: null,
  };
}

function glazing(): GlazingRef {
  return {
    name: "G",
    manufacturer: null,
    brand: null,
    suffix: null,
    u_value_w_m2k: null,
    g_value: null,
    color: null,
    source: null,
    comments: null,
    catalog_origin: null,
  };
}

function element(overrides: Partial<ApertureElement> = {}): ApertureElement {
  return {
    id: "aptel_1",
    name: "E",
    row_span: [0, 0],
    column_span: [0, 0],
    frames: { top: frame(50), right: frame(50), bottom: frame(50), left: frame(50) },
    glazing: glazing(),
    operation: null,
    ...overrides,
  };
}

function entry(overrides: Partial<ApertureTypeEntry> = {}): ApertureTypeEntry {
  return {
    id: "apt_1",
    name: "Type A",
    column_widths_mm: [1000],
    row_heights_mm: [1000],
    elements: [element()],
    ...overrides,
  };
}

function renderOverlay(props: Partial<Parameters<typeof ApertureCanvasOverlay>[0]> = {}) {
  return render(
    <ApertureCanvasOverlay
      aperture={props.aperture ?? entry()}
      zoom={props.zoom ?? 1}
      viewDirection={props.viewDirection ?? "exterior"}
      canEdit={props.canEdit ?? true}
      onSetElementName={props.onSetElementName ?? vi.fn()}
      onRegionClick={props.onRegionClick}
    />,
  );
}

beforeEach(() => {
  useApertureBuilderStore.setState({
    selectionByAperture: {},
    hoveredElementId: null,
    hoveredRegion: null,
    pickPasteMode: "idle",
  });
});

describe("ApertureCanvasOverlay", () => {
  it("renders one element hit and five region hits per element", () => {
    renderOverlay();
    const elementHit = screen.getByTestId("hit-element-aptel_1");
    expect(within(elementHit).getByTestId("hit-aptel_1-top")).toBeInTheDocument();
    expect(within(elementHit).getByTestId("hit-aptel_1-right")).toBeInTheDocument();
    expect(within(elementHit).getByTestId("hit-aptel_1-bottom")).toBeInTheDocument();
    expect(within(elementHit).getByTestId("hit-aptel_1-left")).toBeInTheDocument();
    expect(within(elementHit).getByTestId("hit-aptel_1-glazing")).toBeInTheDocument();
  });

  it("bare click selects the clicked element", () => {
    renderOverlay();
    fireEvent.click(screen.getByTestId("hit-element-aptel_1"));
    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual(["aptel_1"]);
  });

  it("shift-click extends the selection", () => {
    const a = element({ id: "aptel_a", column_span: [0, 0] });
    const b = element({ id: "aptel_b", column_span: [1, 1] });
    renderOverlay({
      aperture: entry({ column_widths_mm: [1000, 1000], elements: [a, b] }),
    });
    fireEvent.click(screen.getByTestId("hit-element-aptel_a"));
    fireEvent.click(screen.getByTestId("hit-element-aptel_b"), { shiftKey: true });
    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual([
      "aptel_a",
      "aptel_b",
    ]);
  });

  it("cmd-click toggles an element in and out of the selection", () => {
    const a = element({ id: "aptel_a", column_span: [0, 0] });
    const b = element({ id: "aptel_b", column_span: [1, 1] });
    renderOverlay({
      aperture: entry({ column_widths_mm: [1000, 1000], elements: [a, b] }),
    });
    fireEvent.click(screen.getByTestId("hit-element-aptel_a"));
    fireEvent.click(screen.getByTestId("hit-element-aptel_b"), { metaKey: true });
    fireEvent.click(screen.getByTestId("hit-element-aptel_a"), { metaKey: true });
    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual(["aptel_b"]);
  });

  it("clicking the overlay background clears selection", () => {
    renderOverlay();
    fireEvent.click(screen.getByTestId("hit-element-aptel_1"));
    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual(["aptel_1"]);
    fireEvent.click(screen.getByTestId("aperture-canvas-overlay"));
    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual([]);
  });

  it("marks a selected element with data-selected and aria-selected", () => {
    renderOverlay();
    fireEvent.click(screen.getByTestId("hit-element-aptel_1"));
    const hit = screen.getByTestId("hit-element-aptel_1");
    expect(hit.getAttribute("data-selected")).toBe("true");
    expect(hit.getAttribute("aria-selected")).toBe("true");
  });

  it("interior view: rightmost element renders at x=0 in pixel space", () => {
    const a = element({ id: "aptel_a", column_span: [0, 0] });
    const b = element({ id: "aptel_b", column_span: [1, 1] });
    const c = element({ id: "aptel_c", column_span: [2, 2] });
    renderOverlay({
      aperture: entry({
        column_widths_mm: [100, 200, 300],
        elements: [a, b, c],
      }),
      viewDirection: "interior",
    });
    const aHit = screen.getByTestId("hit-element-aptel_a");
    const cHit = screen.getByTestId("hit-element-aptel_c");
    const aLeft = parseFloat(aHit.style.left);
    const cLeft = parseFloat(cHit.style.left);
    expect(cLeft).toBeLessThan(aLeft);
  });

  it("fires onRegionClick when a region hit is clicked", () => {
    const onRegionClick = vi.fn();
    renderOverlay({ onRegionClick });
    fireEvent.click(screen.getByTestId("hit-aptel_1-glazing"));
    expect(onRegionClick).toHaveBeenCalledWith("aptel_1", "glazing");
  });
});
