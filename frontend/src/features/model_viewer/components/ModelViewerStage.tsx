import { useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../../shared/api/client";
import { errorMessage } from "../../../shared/lib/errors";
import { isModelViewerDebugHookEnabled, ModelViewerDebugBridge } from "../lib/debugHook";
import { dispatchModelViewerPopoverEscape } from "../lib/events";
import { MODEL_VIEWER_LENSES } from "../lib/lenses";
import { buildBuildingModel, disposeBuildingModel, type BuildingModel } from "../loaders/building";
import { ViewerCanvas } from "../scene/ViewerCanvas";
import { useModelViewerStore } from "../store";
import { useModelDataQuery, useSunPathQuery } from "../hooks";
import type { HbjsonFile, ModelViewerErrorKind } from "../types";
import { CameraCluster } from "./CameraCluster";
import { ElementInspectorPanel } from "./ElementInspectorPanel";
import { InspectorPanel } from "./InspectorPanel";
import { LegendCard } from "./LegendCard";
import { LensBar } from "./LensBar";
import { LoadingChip } from "./LoadingChip";
import { ModelViewerPerfOverlay } from "./PerfOverlay";
import { ModelViewerStagePlaceholder } from "./ModelViewerStagePlaceholder";
import { SunStudyBar } from "./SunStudyBar";
import { ViewerRenderControls } from "./ViewerRenderControls";

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
  // Project-scoped + location-reactive: independent of the active file.
  const sunPathQuery = useSunPathQuery(projectId);
  const sunPath = sunPathQuery.data ?? null;
  const setLoadState = useModelViewerStore((state) => state.setLoadState);
  const selectionId = useModelViewerStore((state) => state.selectionId);
  const lens = useModelViewerStore((state) => state.lens);
  const setLens = useModelViewerStore((state) => state.setLens);
  const clearSelection = useModelViewerStore((state) => state.clearSelection);
  const legendFilter = useModelViewerStore((state) => state.legendFilter);
  const clearLegendFilter = useModelViewerStore((state) => state.clearLegendFilter);
  const requestCamera = useModelViewerStore((state) => state.requestCamera);
  const measureActive = useModelViewerStore((state) => state.measureActive);
  const setMeasureActive = useModelViewerStore((state) => state.setMeasureActive);
  const toggleMeasure = useModelViewerStore((state) => state.toggleMeasure);
  const sunStudyEngaged = useModelViewerStore((state) => state.sunStudy?.engaged === true);
  const disengageSunStudy = useModelViewerStore((state) => state.disengageSunStudy);
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
      // Viewer hotkeys (m/f/h, lens digits, ⌘C) must not fire behind an open
      // modal. Escape specifically never reaches this window listener —
      // ModalDialog consumes it (stopPropagation at document level).
      if (document.querySelector(".modal-backdrop")) return;
      if (event.key === "Escape") {
        if (measureActive) {
          setMeasureActive(false);
          return;
        }
        if (selectionId) {
          clearSelection();
          return;
        }
        if (legendFilter) {
          clearLegendFilter();
          return;
        }
        // Collapse the sun-study bar (PRD §4.3) — after selection/filter so a
        // first Esc still means "deselect", a second collapses the bar.
        if (lens === "site-sun" && sunStudyEngaged) {
          disengageSunStudy();
          return;
        }
        dispatchModelViewerPopoverEscape();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
        const identifier = selectionId
          ? (model?.metaById.get(selectionId)?.identifier ??
            model?.elementsById.get(selectionId)?.identifier ??
            null)
          : null;
        if (!identifier) return;
        event.preventDefault();
        void navigator.clipboard?.writeText(identifier);
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
    clearLegendFilter,
    clearSelection,
    disengageSunStudy,
    legendFilter,
    lens,
    measureActive,
    model,
    requestCamera,
    selectionId,
    setLens,
    setMeasureActive,
    sunStudyEngaged,
    toggleMeasure,
  ]);

  const loadPhase = useModelViewerStore((state) => state.loadPhase);
  const storeErrorKind = useModelViewerStore((state) => state.errorKind);
  const selectedMeta = selectionId ? (model?.metaById.get(selectionId) ?? null) : null;
  const selectedElement = selectionId ? (model?.elementsById.get(selectionId) ?? null) : null;

  return (
    <>
      {isModelViewerDebugHookEnabled() ? (
        <ModelViewerDebugBridge model={model} sunPath={sunPath} />
      ) : null}
      {renderedModel ? (
        <div className={measureActive ? "model-canvas-wrap measuring" : "model-canvas-wrap"}>
          <ViewerCanvas
            key={renderedModel.fileId}
            model={renderedModel.model}
            activeFileName={activeFile.display_name}
            sunPath={sunPath}
          />
          {isModelViewerDebugHookEnabled() ? <ModelViewerPerfOverlay model={model} /> : null}
          {isModelViewerDebugHookEnabled() ? <ViewerRenderControls /> : null}
        </div>
      ) : (
        <ModelViewerStagePlaceholder />
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
      {model && lens === "site-sun" && !sunPath && !measureActive ? (
        <div className="model-site-sun-hint">Set project location to see the sun path.</div>
      ) : null}
      {model && lens === "site-sun" && sunPath && !measureActive ? (
        <SunStudyBar grid={sunPath.sun_positions} />
      ) : null}
      {measureActive ? (
        <div className="model-measure-hint">Click two points to measure · Esc to exit</div>
      ) : null}
      <CameraCluster modelBounds={model?.bounds ?? null} />
      <InspectorPanel meta={selectedMeta} constructions={model?.constructions ?? null} />
      <ElementInspectorPanel element={selectedElement} model={model} />
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

/** Input types that never take typed text — viewer shortcuts (Esc, lens
 *  digits, m/f/h) stay live while one of these holds focus, e.g. the
 *  sun-study scrubbers. */
const NON_TEXT_INPUT_TYPES = new Set(["range", "checkbox", "radio", "button"]);

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const control = target.closest("input, textarea, select, [contenteditable='true']");
  if (control === null) return false;
  return !(control instanceof HTMLInputElement && NON_TEXT_INPUT_TYPES.has(control.type));
}
