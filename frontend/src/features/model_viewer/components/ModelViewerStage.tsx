import { useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../../shared/api/client";
import { errorMessage } from "../../../shared/lib/errors";
import { isModelViewerDebugHookEnabled, ModelViewerDebugBridge } from "../lib/debugHook";
import { dispatchModelViewerPopoverEscape } from "../lib/events";
import { MODEL_VIEWER_LENSES } from "../lib/lenses";
import { buildBuildingModel, disposeBuildingModel, type BuildingModel } from "../loaders/building";
import { ViewerCanvas } from "../scene/ViewerCanvas";
import { useModelViewerStore } from "../store";
import { useModelDataQuery } from "../hooks";
import type { HbjsonFile, ModelViewerErrorKind } from "../types";
import { CameraCluster } from "./CameraCluster";
import { InspectorPanel } from "./InspectorPanel";
import { LegendCard } from "./LegendCard";
import { LensBar } from "./LensBar";
import { LoadingChip } from "./LoadingChip";

type ModelViewerStageProps = {
  projectId: string;
  activeFile: HbjsonFile;
};

type RenderedModel = {
  fileId: string;
  model: BuildingModel;
};

export function ModelViewerStage({ projectId, activeFile }: ModelViewerStageProps) {
  const query = useModelDataQuery(projectId, activeFile.id);
  const setLoadState = useModelViewerStore((state) => state.setLoadState);
  const selectionId = useModelViewerStore((state) => state.selectionId);
  const lens = useModelViewerStore((state) => state.lens);
  const setLens = useModelViewerStore((state) => state.setLens);
  const clearSelection = useModelViewerStore((state) => state.clearSelection);
  const requestCamera = useModelViewerStore((state) => state.requestCamera);
  const measureActive = useModelViewerStore((state) => state.measureActive);
  const setMeasureActive = useModelViewerStore((state) => state.setMeasureActive);
  const toggleMeasure = useModelViewerStore((state) => state.toggleMeasure);
  const [renderedModel, setRenderedModel] = useState<RenderedModel | null>(null);
  const renderedModelRef = useRef<RenderedModel | null>(null);

  useEffect(() => {
    if (query.isFetching && !query.data) {
      setLoadState("downloading");
      replaceRenderedModel(null);
      return;
    }
    if (query.isError) {
      setLoadState("error", errorKind(query.error));
      replaceRenderedModel(null);
      return;
    }
    if (query.data) {
      let cancelled = false;
      setLoadState("building");
      const model = buildBuildingModel(query.data);
      if (cancelled) {
        disposeBuildingModel(model);
        return;
      }
      replaceRenderedModel({ fileId: activeFile.id, model });
      setLoadState("ready");
      return () => {
        cancelled = true;
      };
    }
    setLoadState("idle");
    replaceRenderedModel(null);
  }, [activeFile.id, query.data, query.error, query.isError, query.isFetching, setLoadState]);

  useEffect(() => {
    return () => {
      if (renderedModelRef.current) {
        disposeBuildingModel(renderedModelRef.current.model);
      }
    };
  }, []);

  const model = renderedModel?.model ?? null;

  useEffect(() => {
    if (!model || model.lensAvailability[lens]) return;
    setLens("building");
  }, [lens, model, setLens]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) return;
      if (event.key === "Escape") {
        if (measureActive) {
          setMeasureActive(false);
          return;
        }
        if (selectionId) {
          clearSelection();
          return;
        }
        dispatchModelViewerPopoverEscape();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        const meta = selectionId ? model?.metaById.get(selectionId) : null;
        if (!meta) return;
        event.preventDefault();
        void navigator.clipboard?.writeText(meta.identifier);
        return;
      }
      const numberKey = Number(event.key);
      if (
        Number.isInteger(numberKey) &&
        numberKey >= 1 &&
        numberKey <= MODEL_VIEWER_LENSES.length
      ) {
        const nextLens = MODEL_VIEWER_LENSES[numberKey - 1]?.id;
        if (nextLens && model?.lensAvailability[nextLens]) setLens(nextLens);
        return;
      }
      if (event.key.toLowerCase() === "m") {
        toggleMeasure();
      } else if (event.key.toLowerCase() === "f") {
        requestCamera("fit");
      } else if (event.key.toLowerCase() === "h") {
        requestCamera("home");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clearSelection,
    measureActive,
    model,
    requestCamera,
    selectionId,
    setLens,
    setMeasureActive,
    toggleMeasure,
  ]);

  const loadPhase = useModelViewerStore((state) => state.loadPhase);
  const storeErrorKind = useModelViewerStore((state) => state.errorKind);
  const selectedMeta = selectionId ? (model?.metaById.get(selectionId) ?? null) : null;

  return (
    <>
      {isModelViewerDebugHookEnabled() ? <ModelViewerDebugBridge model={model} /> : null}
      {renderedModel ? (
        <div className={measureActive ? "model-canvas-wrap measuring" : "model-canvas-wrap"}>
          <ViewerCanvas
            key={renderedModel.fileId}
            model={renderedModel.model}
            activeFileName={activeFile.display_name}
          />
        </div>
      ) : (
        <div className="model-viewer-placeholder">
          <p className="model-viewer-placeholder-title">Preparing 3D scene</p>
        </div>
      )}
      <LoadingChip
        phase={loadPhase}
        errorKind={storeErrorKind}
        errorMessage={
          query.isError ? errorMessage(query.error, "Could not load model data.") : null
        }
        loadSummary={loadPhase === "ready" ? (query.data?.load_summary ?? null) : null}
        onRetry={() => void query.refetch()}
      />
      <LensBar availability={model?.lensAvailability ?? null} />
      <LegendCard
        model={model}
        activeFile={activeFile}
        loadSummary={query.data?.load_summary ?? null}
      />
      {model && lens === "site-sun" && !model.sunPath && !measureActive ? (
        <div className="model-site-sun-hint">Set project location to see the sun path.</div>
      ) : null}
      {measureActive ? (
        <div className="model-measure-hint">Click two points to measure · Esc to exit</div>
      ) : null}
      <CameraCluster />
      <InspectorPanel meta={selectedMeta} />
    </>
  );

  function replaceRenderedModel(next: RenderedModel | null): void {
    const previous = renderedModelRef.current;
    if (previous?.model === next?.model) return;
    if (previous) {
      disposeBuildingModel(previous.model);
    }
    renderedModelRef.current = next;
    setRenderedModel(next);
  }
}

function errorKind(error: unknown): ModelViewerErrorKind {
  if (error instanceof ApiRequestError && error.details.kind === "permanent") {
    return "permanent";
  }
  return "transient";
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest("input, textarea, select, [contenteditable='true']") !== null;
}
