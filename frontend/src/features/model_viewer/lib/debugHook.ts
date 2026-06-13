import { useEffect, useMemo } from "react";
import { colorForThemedObject, legendForModel } from "./themes";
import { emptyModelObjectCounts, type BuildingModel } from "../loaders/building";
import { useModelViewerStore } from "../store";
import type { ModelObjectType, ModelViewerDebugState } from "../types";

declare global {
  interface Window {
    __phnModelViewer?: ModelViewerDebugState;
  }
}

const DEBUG_HOOK_ENABLED = import.meta.env.DEV || import.meta.env.MODE === "test";

export function useModelViewerDebugHook(model: BuildingModel | null): void {
  const activeFileId = useModelViewerStore((state) => state.activeFileId);
  const loadPhase = useModelViewerStore((state) => state.loadPhase);
  const errorKind = useModelViewerStore((state) => state.errorKind);
  const lens = useModelViewerStore((state) => state.lens);
  const theme = useModelViewerStore((state) => state.themesByLens[state.lens]);
  const selectionId = useModelViewerStore((state) => state.selectionId);
  const hoverId = useModelViewerStore((state) => state.hoverId);
  const setSelectionId = useModelViewerStore((state) => state.setSelectionId);
  const setLens = useModelViewerStore((state) => state.setLens);
  const setTheme = useModelViewerStore((state) => state.setTheme);
  const clearSelection = useModelViewerStore((state) => state.clearSelection);
  const objectIds = useMemo(
    () => (DEBUG_HOOK_ENABLED ? (model?.objects.map((object) => object.id) ?? []) : []),
    [model?.objects],
  );
  const visibleObjectIds = useMemo(
    () =>
      DEBUG_HOOK_ENABLED
        ? (model?.objects.filter((object) => object.lens === lens).map((object) => object.id) ?? [])
        : [],
    [lens, model?.objects],
  );
  const legend = useMemo(
    () => (DEBUG_HOOK_ENABLED && model ? legendForModel(model, lens, theme) : null),
    [lens, model, theme],
  );

  useEffect(() => {
    if (!DEBUG_HOOK_ENABLED) return;
    window.__phnModelViewer = {
      loadPhase,
      errorKind,
      activeFileId,
      objectCounts: model?.objectCounts ?? emptyModelObjectCounts(),
      objectIds,
      visibleObjectIds,
      lens,
      theme,
      legend,
      selectionId,
      hoverId,
      setLens,
      setTheme: (nextTheme) => setTheme(lens, nextTheme),
      themeColorForObject: (objectId) => {
        const meta = model?.metaById.get(objectId);
        if (!meta) return null;
        return colorForThemedObject(meta, lens, theme)?.color ?? null;
      },
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
    legend,
    loadPhase,
    model?.metaById,
    model?.objectCounts,
    model?.objects,
    objectIds,
    selectionId,
    setLens,
    setSelectionId,
    setTheme,
    theme,
    visibleObjectIds,
  ]);
}
