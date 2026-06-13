import { useEffect, useMemo } from "react";
import { emptyModelObjectCounts, type BuildingModel } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { ModelObjectType, ModelViewerDebugState } from "../types";

declare global {
  interface Window {
    __phnModelViewer?: ModelViewerDebugState;
  }
}

export function useModelViewerDebugHook(model: BuildingModel | null): void {
  const activeFileId = useModelViewerStore((state) => state.activeFileId);
  const loadPhase = useModelViewerStore((state) => state.loadPhase);
  const errorKind = useModelViewerStore((state) => state.errorKind);
  const lens = useModelViewerStore((state) => state.lens);
  const selectionId = useModelViewerStore((state) => state.selectionId);
  const hoverId = useModelViewerStore((state) => state.hoverId);
  const setSelectionId = useModelViewerStore((state) => state.setSelectionId);
  const setLens = useModelViewerStore((state) => state.setLens);
  const clearSelection = useModelViewerStore((state) => state.clearSelection);
  const objectIds = useMemo(
    () => model?.objects.map((object) => object.id) ?? [],
    [model?.objects],
  );
  const visibleObjectIds = useMemo(
    () => model?.objects.filter((object) => object.lens === lens).map((object) => object.id) ?? [],
    [lens, model?.objects],
  );

  useEffect(() => {
    if (!(import.meta.env.DEV || import.meta.env.MODE === "test")) return;
    window.__phnModelViewer = {
      loadPhase,
      errorKind,
      activeFileId,
      objectCounts: model?.objectCounts ?? emptyModelObjectCounts(),
      objectIds,
      visibleObjectIds,
      lens,
      selectionId,
      hoverId,
      setLens,
      selectObject: setSelectionId,
      selectAnyModelObject: (type?: ModelObjectType) => {
        const object = model?.objects.find(
          (candidate) => candidate.lens === lens && (!type || candidate.meta.type === type),
        );
        if (!object) return null;
        setSelectionId(object.id);
        return object.id;
      },
      clearSelection,
    };
    return () => {
      delete window.__phnModelViewer;
    };
  }, [
    activeFileId,
    clearSelection,
    errorKind,
    hoverId,
    lens,
    loadPhase,
    model?.objectCounts,
    model?.objects,
    objectIds,
    selectionId,
    setLens,
    setSelectionId,
    visibleObjectIds,
  ]);
}
