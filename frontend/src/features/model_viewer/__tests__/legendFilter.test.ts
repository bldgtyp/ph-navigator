import { afterEach, describe, expect, test } from "vitest";
import { bucketKeyForObject, isBucketHidden, isHiddenByFilter } from "../lib/legendFilter";
import { DEFAULT_MODEL_VIEWER_THEMES } from "../lib/themes";
import type { ModelRenderable } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { LegendFilter } from "../types";

afterEach(() => {
  useModelViewerStore.setState({
    activeFileId: null,
    lens: "building",
    themesByLens: { ...DEFAULT_MODEL_VIEWER_THEMES },
    hoverId: null,
    selectionId: null,
    legendFilter: null,
  });
});

function faceMesh(id: string, boundary: string): ModelRenderable {
  return {
    id,
    lens: "building",
    kind: "mesh",
    geometries: [],
    meta: {
      id,
      type: "faceMesh",
      face_type: "Wall",
      boundary_condition: { type: boundary },
      properties: { energy: { construction: { identifier: "WALL-C3" } } },
    },
  } as unknown as ModelRenderable;
}

function aperture(id: string): ModelRenderable {
  return {
    id,
    lens: "building",
    kind: "mesh",
    geometries: [],
    meta: { id, type: "apertureMeshFace" },
  } as unknown as ModelRenderable;
}

function ductLine(id: string, lineStyle: "duct-supply" | "duct-exhaust"): ModelRenderable {
  return {
    id,
    lens: "ventilation",
    kind: "line",
    lineStyle,
    points: [
      [0, 0, 0],
      [1, 0, 0],
    ],
    meta: { id, type: "ductSegmentLine" },
  } as unknown as ModelRenderable;
}

describe("bucketKeyForObject", () => {
  test("themed mesh resolves to its color-by-theme key", () => {
    const wall = faceMesh("face:wall", "Outdoors");
    expect(bucketKeyForObject(wall, "building", "boundary")).toBe("Outdoors");
    expect(bucketKeyForObject(wall, "building", "surface-type")).toBe("Wall");
  });

  test("line object resolves to its line style, regardless of theme", () => {
    const duct = ductLine("duct:1", "duct-supply");
    expect(bucketKeyForObject(duct, "ventilation", "shaded")).toBe("duct-supply");
  });

  test("returns null when the theme does not classify the object", () => {
    // The Boundary theme only colors faces; an aperture has no boundary bucket.
    expect(bucketKeyForObject(aperture("ap:1"), "building", "boundary")).toBeNull();
  });
});

describe("isBucketHidden / isHiddenByFilter", () => {
  const filter: LegendFilter = { theme: "boundary", keys: new Set(["Outdoors"]) };

  test("nothing is hidden without an active filter", () => {
    expect(isBucketHidden("Ground", "boundary", null)).toBe(false);
    expect(isHiddenByFilter(faceMesh("f", "Ground"), "building", "boundary", null)).toBe(false);
  });

  test("nothing is hidden when the filter's theme is stale", () => {
    // A filter built for Boundary must not apply once the theme is Surface Type.
    expect(isBucketHidden("Ground", "surface-type", filter)).toBe(false);
  });

  test("matched bucket stays visible, others hide", () => {
    expect(isHiddenByFilter(faceMesh("f1", "Outdoors"), "building", "boundary", filter)).toBe(
      false,
    );
    expect(isHiddenByFilter(faceMesh("f2", "Ground"), "building", "boundary", filter)).toBe(true);
  });

  test("an object the theme cannot classify hides while filtering (null bucket)", () => {
    expect(isHiddenByFilter(aperture("ap:1"), "building", "boundary", filter)).toBe(true);
  });
});

describe("legend-filter store actions", () => {
  test("single-select replaces the set; re-clicking the sole key clears it", () => {
    const store = useModelViewerStore.getState();
    store.toggleLegendFilterKey("boundary", "Outdoors");
    expect(useModelViewerStore.getState().legendFilter).toEqual({
      theme: "boundary",
      keys: new Set(["Outdoors"]),
    });

    store.toggleLegendFilterKey("boundary", "Ground");
    expect(useModelViewerStore.getState().legendFilter).toEqual({
      theme: "boundary",
      keys: new Set(["Ground"]),
    });

    store.toggleLegendFilterKey("boundary", "Ground");
    expect(useModelViewerStore.getState().legendFilter).toBeNull();
  });

  test("clearLegendFilter resets to null", () => {
    const store = useModelViewerStore.getState();
    store.toggleLegendFilterKey("boundary", "Outdoors");
    store.clearLegendFilter();
    expect(useModelViewerStore.getState().legendFilter).toBeNull();
  });

  test.each([
    ["setLens", () => useModelViewerStore.getState().setLens("spaces")],
    ["setTheme", () => useModelViewerStore.getState().setTheme("building", "construction")],
    [
      "setUrlViewState",
      () => useModelViewerStore.getState().setUrlViewState("building", "construction"),
    ],
    ["setActiveFileId", () => useModelViewerStore.getState().setActiveFileId("file-2")],
  ])("%s clears the active filter (context change)", (_name, mutate) => {
    useModelViewerStore.getState().toggleLegendFilterKey("boundary", "Outdoors");
    expect(useModelViewerStore.getState().legendFilter).not.toBeNull();
    mutate();
    expect(useModelViewerStore.getState().legendFilter).toBeNull();
  });
});
