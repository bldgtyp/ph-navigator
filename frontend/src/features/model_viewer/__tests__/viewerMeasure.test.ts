import { afterEach, describe, expect, test } from "vitest";
import { PerspectiveCamera } from "three";
import {
  formatMeasureDistance,
  nearestMeasureSnap,
  type MeasureSnapCandidate,
} from "../lib/measure";
import { DEFAULT_MODEL_VIEWER_THEMES } from "../lib/themeState";
import { useModelViewerStore } from "../store";

afterEach(() => {
  useModelViewerStore.setState({
    activeFileId: null,
    lens: "building",
    themesByLens: { ...DEFAULT_MODEL_VIEWER_THEMES },
    hoverId: null,
    selectionId: null,
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

describe("model viewer measure mode", () => {
  test("formats measured meter distances in both unit systems", () => {
    expect(formatMeasureDistance(3.4544, "SI")).toBe("3.45 m");
    expect(formatMeasureDistance(3.4544, "IP")).toBe("11' 4\"");
    expect(formatMeasureDistance(0.1524, "IP")).toBe('6"');
  });

  test("selects the nearest projected vertex within the screen threshold", () => {
    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const candidates: MeasureSnapCandidate[] = [
      point("center", [0, 0, 0]),
      point("right", [2, 0, 0]),
    ];

    expect(
      nearestMeasureSnap(candidates, { clientX: 51, clientY: 51 }, camera, {
        left: 0,
        top: 0,
        width: 100,
        height: 100,
      })?.id,
    ).toBe("center");
    expect(
      nearestMeasureSnap(candidates, { clientX: 5, clientY: 5 }, camera, {
        left: 0,
        top: 0,
        width: 100,
        height: 100,
      }),
    ).toBeNull();
  });

  test("commits two-click dimension lines and clears on lens switch", () => {
    const store = useModelViewerStore.getState();
    store.setMeasureActive(true);
    expect(useModelViewerStore.getState().selectionId).toBeNull();

    expect(store.commitMeasurePoint(point("a", [0, 0, 0]))).toBeNull();
    const line = store.commitMeasurePoint(point("b", [3, 4, 0]));
    expect(line?.distanceM).toBe(5);
    expect(useModelViewerStore.getState().measureLines).toHaveLength(1);

    store.setLens("spaces");
    const state = useModelViewerStore.getState();
    expect(state.measureActive).toBe(false);
    expect(state.measureLines).toEqual([]);
  });
});

function point(id: string, position: [number, number, number]): MeasureSnapCandidate {
  return {
    id,
    sourceObjectId: "face:wall",
    position,
  };
}
