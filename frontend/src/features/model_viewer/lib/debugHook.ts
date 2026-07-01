import { useEffect, useMemo } from "react";
import { isHiddenByFilter } from "./legendFilter";
import { distanceBetweenMeasurePoints } from "./measure";
import { isTupleVisibleForSection } from "./section";
import { colorForThemedObject, legendForModel } from "./themes";
import { emptyModelObjectCounts, type BuildingModel } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { ModelObjectType, ModelViewerDebugState, ModelViewerLens } from "../types";

declare global {
  interface Window {
    __phnModelViewer?: ModelViewerDebugState;
  }
}

const DEBUG_HOOK_ENABLED = import.meta.env.DEV || import.meta.env.MODE === "test";

export function isModelViewerDebugHookEnabled(): boolean {
  return DEBUG_HOOK_ENABLED;
}

export function ModelViewerDebugBridge({
  model,
  sunPathReady,
}: {
  model: BuildingModel | null;
  sunPathReady: boolean;
}) {
  useModelViewerDebugHook(model, sunPathReady);
  return null;
}

function useModelViewerDebugHook(model: BuildingModel | null, sunPathReady: boolean): void {
  const activeFileId = useModelViewerStore((state) => state.activeFileId);
  const loadPhase = useModelViewerStore((state) => state.loadPhase);
  const errorKind = useModelViewerStore((state) => state.errorKind);
  const lens = useModelViewerStore((state) => state.lens);
  const theme = useModelViewerStore((state) => state.themesByLens[state.lens]);
  const legendFilter = useModelViewerStore((state) => state.legendFilter);
  const selectionId = useModelViewerStore((state) => state.selectionId);
  const hoverId = useModelViewerStore((state) => state.hoverId);
  const measureActive = useModelViewerStore((state) => state.measureActive);
  const measureSnap = useModelViewerStore((state) => state.measureSnap);
  const measureLines = useModelViewerStore((state) => state.measureLines);
  const section = useModelViewerStore((state) => state.section);
  const setSelectionId = useModelViewerStore((state) => state.setSelectionId);
  const setLens = useModelViewerStore((state) => state.setLens);
  const setTheme = useModelViewerStore((state) => state.setTheme);
  const clearSelection = useModelViewerStore((state) => state.clearSelection);
  const setSection = useModelViewerStore((state) => state.setSection);
  const clearSection = useModelViewerStore((state) => state.clearSection);
  const setMeasureActive = useModelViewerStore((state) => state.setMeasureActive);
  const objectIds = useMemo(
    () => model?.objects.map((object) => object.id) ?? [],
    [model?.objects],
  );
  const visibleObjectIds = useMemo(
    () =>
      selectableObjectsForLens(model, lens)
        .filter((object) => !isHiddenByFilter(object, lens, theme, legendFilter))
        .map((object) => object.id),
    [lens, model, theme, legendFilter],
  );
  const sectionClippedObjectIds = useMemo(
    () => () =>
      selectableObjectsForLens(model, lens)
        .filter((object) =>
          object.meta.vertices.every((point) => !isTupleVisibleForSection(point, section)),
        )
        .map((object) => object.id),
    [lens, model, section],
  );
  const legend = useMemo(
    () => (model ? legendForModel(model, lens, theme) : null),
    [lens, model, theme],
  );

  useEffect(() => {
    window.__phnModelViewer = {
      loadPhase,
      errorKind,
      activeFileId,
      objectCounts: model?.objectCounts ?? emptyModelObjectCounts(),
      shadeCount: model?.shadeObjects.length ?? 0,
      sunPathReady,
      objectIds,
      visibleObjectIds,
      section,
      sectionClippedObjectIds,
      lens,
      theme,
      legend,
      legendFilter: legendFilter
        ? { theme: legendFilter.theme, keys: [...legendFilter.keys] }
        : null,
      selectionId,
      hoverId,
      measureActive,
      measureSnap,
      measureLines,
      setLens,
      setTheme: (nextTheme) => setTheme(lens, nextTheme),
      themeColorForObject: (objectId) => {
        const meta = model?.metaById.get(objectId);
        if (!meta) return null;
        return colorForThemedObject(meta, lens, theme)?.color ?? null;
      },
      selectObject: setSelectionId,
      selectAnyModelObject: (type?: ModelObjectType) => {
        const objects = selectableObjectsForLens(model, lens);
        const object = objects.find((candidate) => !type || candidate.meta.type === type);
        if (!object) return null;
        setSelectionId(object.id);
        return object.id;
      },
      clearSelection,
      setSection,
      clearSection,
      setMeasureActive,
      measureBetweenVertices: (sourceObjectId, startIndex = 0, endIndex = 1) => {
        const meta = model?.metaById.get(sourceObjectId);
        const startPosition = meta?.vertices[startIndex];
        const endPosition = meta?.vertices[endIndex];
        if (!meta || !startPosition || !endPosition) return null;
        const start = {
          id: `${sourceObjectId}:vertex:${startIndex}`,
          sourceObjectId,
          position: startPosition,
        };
        const end = {
          id: `${sourceObjectId}:vertex:${endIndex}`,
          sourceObjectId,
          position: endPosition,
        };
        const line = {
          id: `measure:debug:${sourceObjectId}:${startIndex}:${endIndex}`,
          start,
          end,
          distanceM: distanceBetweenMeasurePoints(start, end),
        };
        useModelViewerStore.setState((state) => ({
          measureActive: true,
          measureSnap: end,
          measurePendingPoint: null,
          measureLines: [...state.measureLines, line],
          hoverId: null,
          selectionId: null,
        }));
        return line;
      },
    };
    return () => {
      delete window.__phnModelViewer;
    };
  }, [
    activeFileId,
    clearSelection,
    clearSection,
    errorKind,
    hoverId,
    legendFilter,
    lens,
    legend,
    loadPhase,
    measureActive,
    measureLines,
    measureSnap,
    model,
    objectIds,
    section,
    sectionClippedObjectIds,
    selectionId,
    setLens,
    setMeasureActive,
    setSelectionId,
    setSection,
    setTheme,
    sunPathReady,
    theme,
    visibleObjectIds,
  ]);
}

function selectableObjectsForLens(model: BuildingModel | null, lens: ModelViewerLens) {
  if (!model) return [];
  if (lens === "site-sun") return model.buildingObjects;
  return model.objects.filter((object) => object.lens === lens);
}
