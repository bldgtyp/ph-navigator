import { afterEach, describe, expect, test } from "vitest";
import { DEFAULT_MODEL_VIEWER_THEMES } from "../lib/themeState";
import { useModelViewerStore } from "../store";

afterEach(() => {
  resetStore();
});

describe("model viewer focused segment state", () => {
  test("toggles one focused segment at a time", () => {
    const store = useModelViewerStore.getState();

    store.toggleFocusedSegment("duct:run-1:seg-1");
    expect(useModelViewerStore.getState().focusedSegmentId).toBe("duct:run-1:seg-1");

    store.toggleFocusedSegment("duct:run-1:seg-1");
    expect(useModelViewerStore.getState().focusedSegmentId).toBeNull();

    store.toggleFocusedSegment("duct:run-1:seg-1");
    store.toggleFocusedSegment("duct:run-1:seg-2");
    expect(useModelViewerStore.getState().focusedSegmentId).toBe("duct:run-1:seg-2");
  });

  test.each([
    ["clearSelection", () => useModelViewerStore.getState().clearSelection()],
    ["setActiveFileId", () => useModelViewerStore.getState().setActiveFileId("file-2")],
    ["setLens", () => useModelViewerStore.getState().setLens("spaces")],
    [
      "setUrlViewState lens change",
      () => useModelViewerStore.getState().setUrlViewState("spaces", "shaded"),
    ],
  ])("clears focused segment on %s", (_name, resetAction) => {
    seedFocusedSelection();

    resetAction();

    expect(useModelViewerStore.getState().selectionId).toBeNull();
    expect(useModelViewerStore.getState().hoverId).toBeNull();
    expect(useModelViewerStore.getState().focusedSegmentId).toBeNull();
  });

  test("preserves focused segment when same-lens URL theme hydrates", () => {
    seedFocusedSelection();

    useModelViewerStore.getState().setUrlViewState("ventilation", "shaded");

    expect(useModelViewerStore.getState().selectionId).toBe("element:duct:run-1");
    expect(useModelViewerStore.getState().focusedSegmentId).toBe("duct:run-1:seg-1");
  });
});

function seedFocusedSelection(): void {
  const store = useModelViewerStore.getState();
  store.setLens("ventilation");
  store.setSelectionId("element:duct:run-1");
  store.setHoverId("duct:run-1:seg-1");
  store.toggleFocusedSegment("duct:run-1:seg-1");
}

function resetStore(): void {
  useModelViewerStore.setState({
    activeFileId: null,
    lens: "building",
    themesByLens: { ...DEFAULT_MODEL_VIEWER_THEMES },
    hoverId: null,
    selectionId: null,
    focusedSegmentId: null,
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
}
