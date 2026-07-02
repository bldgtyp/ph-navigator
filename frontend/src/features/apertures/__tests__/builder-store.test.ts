import { beforeEach, describe, expect, it } from "vitest";
import { useApertureBuilderStore } from "../store/builder-store";

const initial = useApertureBuilderStore.getState();

function reset() {
  useApertureBuilderStore.setState({
    canvasZoom: 1,
    hasCanvasZoom: false,
    selectionByAperture: {},
    hoveredElementId: null,
    hoveredRegion: null,
    pickPasteMode: "idle",
    pickedAssignment: null,
    undoStacksByAperture: {},
    dismissedOperationWarnings: {},
  });
}

describe("builder-store", () => {
  beforeEach(reset);

  it("selectSingle replaces the selection for an aperture", () => {
    initial.selectSingle("apt_1", "el_a");
    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual(["el_a"]);
    initial.selectSingle("apt_1", "el_b");
    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual(["el_b"]);
  });

  it("selectSingle on the same id clears the selection", () => {
    initial.selectSingle("apt_1", "el_a");
    initial.selectSingle("apt_1", "el_a");
    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual([]);
  });

  it("toggleSelection adds if missing and removes if present", () => {
    initial.toggleSelection("apt_1", "el_a");
    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual(["el_a"]);
    initial.toggleSelection("apt_1", "el_b");
    initial.toggleSelection("apt_1", "el_a");
    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual(["el_b"]);
  });

  it("clearSelection clears only the targeted aperture", () => {
    initial.selectSingle("apt_1", "el_a");
    initial.selectSingle("apt_2", "el_b");
    initial.clearSelection("apt_1");
    const state = useApertureBuilderStore.getState();
    expect(state.selectionByAperture["apt_1"]).toEqual([]);
    expect(state.selectionByAperture["apt_2"]).toEqual(["el_b"]);
  });

  it("hover setters update independently of selection", () => {
    initial.selectSingle("apt_1", "el_a");
    initial.setHoveredElement("el_b");
    initial.setHoveredRegion({ elementId: "el_b", region: "top" });
    const state = useApertureBuilderStore.getState();
    expect(state.hoveredElementId).toBe("el_b");
    expect(state.hoveredRegion).toEqual({ elementId: "el_b", region: "top" });
    expect(state.selectionByAperture["apt_1"]).toEqual(["el_a"]);
  });

  it("stores canvas zoom as session-scoped builder UI state", () => {
    initial.setCanvasZoom(2);
    expect(useApertureBuilderStore.getState().canvasZoom).toBe(2);
    expect(useApertureBuilderStore.getState().hasCanvasZoom).toBe(true);

    initial.setCanvasZoom((current) => current - 0.5);
    expect(useApertureBuilderStore.getState().canvasZoom).toBe(1.5);
  });

  it("arms paste mode and captures a source assignment after a valid pick", () => {
    const frames = { top: null, right: null, bottom: null, left: null };
    initial.pickPasteAction({ type: "click-eyedropper" });
    initial.pickPasteAction(
      { type: "click-element" },
      {
        source_element_id: "el_source",
        operation: { type: "swing", directions: ["left"] },
        glazing: null,
        frames,
      },
    );

    const state = useApertureBuilderStore.getState();
    expect(state.pickPasteMode).toBe("pasting");
    expect(state.pickedAssignment).toEqual({
      source_element_id: "el_source",
      operation: { type: "swing", directions: ["left"] },
      glazing: null,
      frames,
    });
  });

  it("does not arm paste mode from an invalid source/background click", () => {
    initial.pickPasteAction({ type: "click-eyedropper" });
    initial.pickPasteAction({ type: "click-background" });

    const state = useApertureBuilderStore.getState();
    expect(state.pickPasteMode).toBe("idle");
    expect(state.pickedAssignment).toBeNull();
  });

  it("does not arm paste mode when a source pick has no captured assignment", () => {
    initial.pickPasteAction({ type: "click-eyedropper" });
    initial.pickPasteAction({ type: "click-element" });

    const state = useApertureBuilderStore.getState();
    expect(state.pickPasteMode).toBe("picking");
    expect(state.pickedAssignment).toBeNull();
  });
});
