import { useEffect } from "react";
import type { BuildingModel } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { ModelObjectCounts, ModelViewerDebugState } from "../types";

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
  const clearSelection = useModelViewerStore((state) => state.clearSelection);

  useEffect(() => {
    if (!(import.meta.env.DEV || import.meta.env.MODE === "test")) return;
    window.__phnModelViewer = {
      loadPhase,
      errorKind,
      activeFileId,
      objectCounts: model?.objectCounts ?? emptyObjectCounts(),
      objectIds: model?.objects.map((object) => object.id) ?? [],
      lens,
      selectionId,
      hoverId,
      selectObject: setSelectionId,
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
    selectionId,
    setSelectionId,
  ]);
}

function emptyObjectCounts(): ModelObjectCounts {
  return { faceMesh: 0, apertureMeshFace: 0 };
}
