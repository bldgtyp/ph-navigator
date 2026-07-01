import { afterEach, describe, expect, test } from "vitest";
import { Box3, Vector3 } from "three";
import {
  clampSectionToBounds,
  clippingPlaneForSection,
  defaultSectionForBounds,
  isPointVisibleForSection,
  sectionForAxis,
  sectionRangeForBounds,
} from "../lib/section";
import { DEFAULT_MODEL_VIEWER_THEMES } from "../lib/themeState";
import { useModelViewerStore } from "../store";

afterEach(() => {
  useModelViewerStore.setState({
    activeFileId: null,
    lens: "building",
    themesByLens: { ...DEFAULT_MODEL_VIEWER_THEMES },
    hoverId: null,
    selectionId: null,
    legendFilter: null,
    measureActive: false,
    measureSnap: null,
    measurePendingPoint: null,
    measureLines: [],
    section: null,
    loadPhase: "idle",
    errorKind: null,
    cameraRequest: null,
  });
});

describe("model viewer section planes", () => {
  const bounds = new Box3(new Vector3(-10, -20, 0), new Vector3(30, 60, 12));

  test("maps model bounds to section slider ranges", () => {
    expect(sectionRangeForBounds(bounds, "x")).toEqual({ min: -10, max: 30, step: 0.2 });
    expect(defaultSectionForBounds(bounds, "z")).toEqual({ axis: "z", offset: 6 });
  });

  test("preserves section depth when switching axes", () => {
    expect(sectionForAxis(bounds, "y", { axis: "x", offset: 10 })).toEqual({
      axis: "y",
      offset: 20,
    });
  });

  test("builds a renderer plane and matching pick predicate", () => {
    const section = { axis: "x" as const, offset: 5 };
    const plane = clippingPlaneForSection(section);
    expect(plane.normal.toArray()).toEqual([-1, 0, 0]);
    expect(plane.constant).toBe(5);
    expect(plane.distanceToPoint(new Vector3(4.9, 0, 0))).toBeGreaterThan(0);
    expect(plane.distanceToPoint(new Vector3(5.1, 0, 0))).toBeLessThan(0);
    expect(isPointVisibleForSection(new Vector3(4.9, 0, 0), section)).toBe(true);
    expect(isPointVisibleForSection(new Vector3(5.1, 0, 0), section)).toBe(false);
  });

  test("clears section state on file switch", () => {
    const store = useModelViewerStore.getState();
    store.setSection({ axis: "z", offset: 3 });
    expect(useModelViewerStore.getState().section).toEqual({ axis: "z", offset: 3 });
    store.setActiveFileId("next-file");
    expect(useModelViewerStore.getState().section).toBeNull();
  });

  test("clamps stale section offsets to current model bounds", () => {
    expect(clampSectionToBounds(bounds, { axis: "z", offset: 100 })).toEqual({
      axis: "z",
      offset: 12,
    });
  });
});
