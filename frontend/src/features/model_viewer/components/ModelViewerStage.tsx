import { useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../../shared/api/client";
import { errorMessage } from "../../../shared/lib/errors";
import { useModelViewerDebugHook } from "../lib/debugHook";
import { buildBuildingModel, disposeBuildingModel, type BuildingModel } from "../loaders/building";
import { ViewerCanvas } from "../scene/ViewerCanvas";
import { useModelViewerStore } from "../store";
import { useModelDataQuery } from "../hooks";
import type { HbjsonFile, ModelViewerErrorKind } from "../types";
import { CameraCluster } from "./CameraCluster";
import { InspectorPanel } from "./InspectorPanel";
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
  const clearSelection = useModelViewerStore((state) => state.clearSelection);
  const requestCamera = useModelViewerStore((state) => state.requestCamera);
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
  useModelViewerDebugHook(model);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) return;
      if (event.key === "Escape") {
        clearSelection();
      } else if (event.key.toLowerCase() === "f") {
        requestCamera("fit");
      } else if (event.key.toLowerCase() === "h") {
        requestCamera("home");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection, requestCamera]);

  const loadPhase = useModelViewerStore((state) => state.loadPhase);
  const storeErrorKind = useModelViewerStore((state) => state.errorKind);
  const selectedMeta = selectionId ? (model?.metaById.get(selectionId) ?? null) : null;

  return (
    <>
      {renderedModel ? (
        <div className="model-canvas-wrap">
          <ViewerCanvas key={renderedModel.fileId} model={renderedModel.model} />
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
