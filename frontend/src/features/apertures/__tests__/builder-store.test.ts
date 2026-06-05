import { beforeEach, describe, expect, it } from "vitest";
import { useApertureBuilderStore } from "../store/builder-store";

const initial = useApertureBuilderStore.getState();

function reset() {
  useApertureBuilderStore.setState({
    selectionByAperture: {},
    hoveredElementId: null,
    hoveredRegion: null,
    pickPasteMode: "idle",
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

  it("extendSelection appends and is idempotent", () => {
    initial.selectSingle("apt_1", "el_a");
    initial.extendSelection("apt_1", "el_b");
    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual([
      "el_a",
      "el_b",
    ]);
    initial.extendSelection("apt_1", "el_b");
    expect(useApertureBuilderStore.getState().selectionByAperture["apt_1"]).toEqual([
      "el_a",
      "el_b",
    ]);
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
});
