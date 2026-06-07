// @size-exception: docs/code-reviews/2026-05-25/frontend-code-review.md#21-srp--file-length-violations
// EnvelopePage owns route guarding, active assembly selection, dialog dispatch,
// and zoom for the envelope workspace. Server state lives in the envelope hooks,
// while canvas/sidebar/specification layout details stay in feature components
// so browser and MCP mutations share the semantic command boundary.
import "../../assets/attachments.css";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { AppSubTabLink, AppSubTabs } from "../../../shared/ui/AppSubTabs";
import { useMaterialsQuery } from "../../catalogs/hooks";
import type { ProjectDetail } from "../../projects/types";
import {
  useAssemblyThermalQuery,
  useEnvelopeAttachmentMutation,
  useEnvelopeCommandMutation,
  useEnvelopeHbjsonExportMutation,
  useEnvelopeReadQuery,
  useMaterialCatalogDriftQuery,
} from "../hooks";
import { envelopeReadSource, naturalSortAssemblies } from "../lib";
import {
  envelopeAssembliesPath,
  envelopeAssemblyPath,
  activeAssemblyIdFromSubpath,
  envelopeSubpath,
  envelopeSpecificationsPath,
  isEnvelopeSubroute,
} from "../paths";
import { AssemblyWorkspace } from "../components/AssemblyWorkspace";
import {
  EnvelopeEditorDialogs,
  type EnvelopeEditorDialogState,
} from "../components/EnvelopeEditorDialogs";
import {
  EnvelopeEmptyState,
  EnvelopeErrorState,
  EnvelopeLoadingState,
} from "../components/EnvelopeStates";
import { MaterialDriftDialog } from "../components/MaterialDrift";
import { SpecificationsPanel } from "../components/SpecificationsPanel";
import { nextZoomStep, previousZoomStep } from "../canvas-constants";
import {
  assignmentFromSegment,
  assignmentsEqual,
  pasteAssignmentCommand,
  segmentCanvasKey,
  type AssemblyCanvasPaintController,
  type AssemblyCanvasPaintMode,
  type LastPaintAssignment,
  type PickedSegmentAssignment,
} from "../canvas-paint";
import type {
  AssemblyLayer,
  AssemblySegment,
  EnvelopeAttachmentChangeArgs,
  EnvelopeCommand,
} from "../types";
import {
  countAssemblyMaterialDrift,
  exportErrorDetails,
  hasCatalogOriginMaterials,
} from "./page-helpers";

export function EnvelopePage({ project }: { project: ProjectDetail }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isViewer = project.access_mode === "viewer";
  const isLocked = project.active_version?.locked ?? false;
  const canEdit = !isViewer && !isLocked;
  const source = envelopeReadSource(project);
  const query = useEnvelopeReadQuery(project.id, project.active_version_id, source);
  const materialDriftQuery = useMaterialCatalogDriftQuery(
    project.id,
    project.active_version_id,
    source,
    query.isSuccess && hasCatalogOriginMaterials(query.data.project_materials),
  );
  const [commandError, setCommandError] = useState<string | null>(null);
  const commandMutation = useEnvelopeCommandMutation(project.id, project.active_version_id);
  const exportMutation = useEnvelopeHbjsonExportMutation(project.id, project.active_version_id);
  const attachmentMutation = useEnvelopeAttachmentMutation({
    projectId: project.id,
    versionId: project.active_version_id,
    onError: setCommandError,
  });
  const [zoom, setZoom] = useState(1);
  const [dialog, setDialog] = useState<EnvelopeEditorDialogState | null>(null);
  const [paintMode, setPaintMode] = useState<AssemblyCanvasPaintMode>("idle");
  const [pickedAssignment, setPickedAssignment] = useState<PickedSegmentAssignment | null>(null);
  const [lastPaint, setLastPaint] = useState<LastPaintAssignment | null>(null);
  const [pastePulseKey, setPastePulseKey] = useState<string | null>(null);
  const commandInFlightRef = useRef(false);
  const paintCommandInFlightRef = useRef(false);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const catalogMaterialsQuery = useMaterialsQuery(
    canEdit && dialog?.kind === "segment" && catalogPickerOpen,
  );
  // The catalog picker only offers active materials; filter the unified
  // fetch (which includes deactivated rows) down to active here.
  const activeCatalogMaterials = useMemo(
    () => (catalogMaterialsQuery.data ?? []).filter((m) => m.is_active),
    [catalogMaterialsQuery.data],
  );
  const [refreshMaterialId, setRefreshMaterialId] = useState<string | null>(null);
  const subpath = envelopeSubpath(location.pathname, project.id);
  const isAssembliesRoute = isEnvelopeSubroute(subpath, "assemblies");
  const isSpecificationsRoute = isEnvelopeSubroute(subpath, "specifications");
  const assemblyId = activeAssemblyIdFromSubpath(subpath);
  const assemblies = useMemo(
    () => naturalSortAssemblies(query.data?.assemblies ?? []),
    [query.data?.assemblies],
  );
  const activeAssembly = assemblyId
    ? (assemblies.find((assembly) => assembly.id === assemblyId) ?? null)
    : (assemblies[0] ?? null);
  const thermalQuery = useAssemblyThermalQuery(
    project.id,
    project.active_version_id,
    activeAssembly?.id ?? null,
    source,
    isAssembliesRoute && activeAssembly !== null,
  );
  const driftByMaterialId = useMemo(
    () =>
      new Map(
        (materialDriftQuery.data?.materials ?? []).map((item) => [item.project_material_id, item]),
      ),
    [materialDriftQuery.data?.materials],
  );
  const activeAssemblyDriftCount = activeAssembly
    ? countAssemblyMaterialDrift(activeAssembly, driftByMaterialId)
    : 0;
  const refreshMaterial = refreshMaterialId
    ? (query.data?.project_materials.find((material) => material.id === refreshMaterialId) ?? null)
    : null;
  const refreshDriftItem = refreshMaterialId
    ? (driftByMaterialId.get(refreshMaterialId) ?? null)
    : null;

  useEffect(() => {
    if (catalogPickerOpen && dialog?.kind !== "segment") setCatalogPickerOpen(false);
  }, [catalogPickerOpen, dialog]);

  useEffect(() => {
    if (!canEdit) clearCanvasPaintMode();
  }, [canEdit]);

  useEffect(() => {
    clearCanvasPaintMode();
    setLastPaint(null);
  }, [activeAssembly?.id]);

  useEffect(() => {
    if (paintMode === "idle") return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Escape") return;
      event.preventDefault();
      clearCanvasPaintMode();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paintMode]);

  useEffect(() => {
    if (!pastePulseKey) return;
    const timeoutId = window.setTimeout(() => setPastePulseKey(null), 600);
    return () => window.clearTimeout(timeoutId);
  }, [pastePulseKey]);

  if (subpath === "" || subpath === "/") {
    return (
      <Navigate
        to={{ pathname: envelopeAssembliesPath(project.id), search: location.search }}
        replace
      />
    );
  }

  if (query.isLoading) return <EnvelopeLoadingState />;
  if (query.isError || !query.data) {
    return <EnvelopeErrorState message={errorMessage(query.error, "Could not load envelope.")} />;
  }

  if (isAssembliesRoute && !assemblyId && activeAssembly) {
    return (
      <Navigate
        to={{
          pathname: envelopeAssemblyPath(project.id, activeAssembly.id),
          search: location.search,
        }}
        replace
      />
    );
  }

  if (assemblyId && !activeAssembly && assemblies[0]) {
    return (
      <Navigate
        to={{
          pathname: envelopeAssemblyPath(project.id, assemblies[0].id),
          search: location.search,
        }}
        replace
      />
    );
  }

  if (!isAssembliesRoute && !isSpecificationsRoute) {
    return (
      <Navigate
        to={{ pathname: envelopeAssembliesPath(project.id), search: location.search }}
        replace
      />
    );
  }

  async function applyCommand(command: EnvelopeCommand): Promise<boolean> {
    const current = query.data;
    if (!current) return false;
    if (commandInFlightRef.current || commandMutation.isPending) return false;
    commandInFlightRef.current = true;
    setCommandError(null);
    try {
      await commandMutation.mutateAsync({ current, command });
      setDialog(null);
      return true;
    } catch (error) {
      setCommandError(errorMessage(error, "Envelope command failed."));
      return false;
    } finally {
      commandInFlightRef.current = false;
    }
  }

  function clearCanvasPaintMode(): void {
    setPaintMode("idle");
    setPickedAssignment(null);
  }

  function startPicking(): void {
    if (!canEdit) return;
    setPickedAssignment(null);
    setPaintMode("picking");
  }

  function startPasting(): void {
    if (!canEdit || !pickedAssignment) return;
    setPaintMode("pasting");
  }

  function pickSegment(layer: AssemblyLayer, segment: AssemblySegment): void {
    if (!canEdit) return;
    setPickedAssignment({
      ...assignmentFromSegment(segment),
      sourceLayerId: layer.id,
      sourceSegmentId: segment.id,
    });
    setPaintMode("picked");
  }

  async function paintSegment(layer: AssemblyLayer, segment: AssemblySegment): Promise<void> {
    if (!canEdit || !activeAssembly || !pickedAssignment) return;
    if (paintCommandInFlightRef.current || commandMutation.isPending) return;
    const previous = assignmentFromSegment(segment);
    if (assignmentsEqual(previous, pickedAssignment)) return;
    paintCommandInFlightRef.current = true;
    const success = await applyCommand(
      pasteAssignmentCommand({
        assemblyId: activeAssembly.id,
        layerId: layer.id,
        segmentId: segment.id,
        assignment: pickedAssignment,
      }),
    );
    paintCommandInFlightRef.current = false;
    if (!success) return;
    setLastPaint({ layerId: layer.id, segmentId: segment.id, previous });
    setPastePulseKey(segmentCanvasKey(layer.id, segment.id));
  }

  async function undoLastPaint(): Promise<void> {
    if (!canEdit || !activeAssembly || !lastPaint) return;
    if (paintCommandInFlightRef.current || commandMutation.isPending) return;
    paintCommandInFlightRef.current = true;
    const success = await applyCommand(
      pasteAssignmentCommand({
        assemblyId: activeAssembly.id,
        layerId: lastPaint.layerId,
        segmentId: lastPaint.segmentId,
        assignment: lastPaint.previous,
      }),
    );
    paintCommandInFlightRef.current = false;
    if (!success) return;
    setPastePulseKey(segmentCanvasKey(lastPaint.layerId, lastPaint.segmentId));
    setLastPaint(null);
  }

  async function exportHbjson(): Promise<void> {
    const current = query.data;
    if (!current) return;
    if (current.source === "draft" && current.draft_etag) {
      const confirmed = window.confirm(
        "Download constructions reads the last committed version, not your current draft. Save Version or Save As first if the draft should be included. Continue with the saved version?",
      );
      if (!confirmed) return;
    }
    setCommandError(null);
    try {
      await exportMutation.mutateAsync();
    } catch (error) {
      setCommandError(exportErrorDetails(error) ?? errorMessage(error, "Could not export HBJSON."));
    }
  }

  async function applyAttachmentChange(change: EnvelopeAttachmentChangeArgs): Promise<void> {
    const current = query.data;
    if (!current) return;
    setCommandError(null);
    await attachmentMutation.mutateAsync({ current, change });
  }

  const paintController: AssemblyCanvasPaintController = {
    mode: paintMode,
    pickedSourceKey: pickedAssignment
      ? segmentCanvasKey(pickedAssignment.sourceLayerId, pickedAssignment.sourceSegmentId)
      : null,
    pastePulseKey,
    canStartPasting: pickedAssignment !== null && !commandMutation.isPending,
    canUndoPaint: lastPaint !== null && !commandMutation.isPending,
    startPicking,
    startPasting,
    undoLastPaint: () => void undoLastPaint(),
    clear: clearCanvasPaintMode,
    pickSegment,
    paintSegment: (layer, segment) => void paintSegment(layer, segment),
  };

  return (
    <section
      id="envelope-assembly-builder-panel"
      className="tab-panel envelope-panel"
      aria-label="Assembly Builder"
    >
      <AppSubTabs id="envelope-subtabs" ariaLabel="Envelope views">
        <AppSubTabLink
          to={{ pathname: envelopeAssembliesPath(project.id), search: location.search }}
        >
          Assemblies
        </AppSubTabLink>
        <AppSubTabLink
          to={{
            pathname: envelopeSpecificationsPath(project.id),
            search: location.search,
          }}
        >
          Specifications
        </AppSubTabLink>
      </AppSubTabs>
      {activeAssemblyDriftCount > 0 && isAssembliesRoute ? (
        <div className="envelope-command-banner" role="status">
          {activeAssemblyDriftCount} material{" "}
          {activeAssemblyDriftCount === 1 ? "copy needs" : "copies need"} catalog review.
          <NavLink
            className="text-button"
            to={{ pathname: envelopeSpecificationsPath(project.id), search: location.search }}
          >
            Review all
          </NavLink>
        </div>
      ) : null}
      {isSpecificationsRoute ? (
        <SpecificationsPanel
          materials={query.data.project_materials}
          driftByMaterialId={driftByMaterialId}
          projectId={project.id}
          isViewer={isViewer}
          canEdit={canEdit}
          busy={commandMutation.isPending || attachmentMutation.isPending}
          error={commandError}
          onCommand={(command) => void applyCommand(command)}
          onAttachmentChange={(args) => applyAttachmentChange(args)}
          onRefreshMaterial={setRefreshMaterialId}
        />
      ) : assemblies.length === 0 || !activeAssembly ? (
        <div>
          <EnvelopeEmptyState />
          {canEdit ? (
            <button
              type="button"
              className="primary-button envelope-empty-action"
              onClick={() => setDialog({ kind: "create-assembly" })}
            >
              New assembly
            </button>
          ) : null}
        </div>
      ) : (
        <AssemblyWorkspace
          projectId={project.id}
          assemblies={assemblies}
          activeAssembly={activeAssembly}
          materials={query.data.project_materials}
          search={searchParams}
          zoom={zoom}
          canEdit={canEdit}
          thermal={thermalQuery.data ?? null}
          thermalLoading={thermalQuery.isFetching}
          exportBusy={exportMutation.isPending}
          commandBusy={commandMutation.isPending}
          paint={paintController}
          onAddAssembly={() => setDialog({ kind: "create-assembly" })}
          onZoomIn={() => setZoom(nextZoomStep)}
          onZoomOut={() => setZoom(previousZoomStep)}
          onExportHbjson={() => void exportHbjson()}
          onRename={(assembly) => setDialog({ kind: "rename-assembly", assembly })}
          onTypeChange={(assembly) => setDialog({ kind: "type-assembly", assembly })}
          onDuplicate={(assembly) => setDialog({ kind: "duplicate-assembly", assembly })}
          onDelete={(assembly) => setDialog({ kind: "delete-assembly", assembly })}
          onFlipOrientation={() =>
            void applyCommand({ kind: "flip_orientation", assembly_id: activeAssembly.id })
          }
          onFlipLayers={() =>
            void applyCommand({ kind: "flip_layers", assembly_id: activeAssembly.id })
          }
          onFlipSegments={() =>
            void applyCommand({ kind: "flip_segments", assembly_id: activeAssembly.id })
          }
          onDeleteLayer={(layer) =>
            setDialog({ kind: "delete-layer", assembly: activeAssembly, layer })
          }
          onUpdateLayerThickness={(layer, thicknessMm) =>
            void applyCommand({
              kind: "update_layer_thickness",
              assembly_id: activeAssembly.id,
              layer_id: layer.id,
              thickness_mm: thicknessMm,
            })
          }
          onAddLayer={(layer, position) =>
            setDialog({ kind: "add-layer", assembly: activeAssembly, layer, position })
          }
          onEditSegment={(layer, segment) =>
            setDialog({ kind: "segment", assembly: activeAssembly, layer, segment })
          }
          onAddSegment={(layer, segment, position) =>
            setDialog({
              kind: "add-segment",
              assembly: activeAssembly,
              layer,
              segment,
              position,
            })
          }
        >
          {commandError && !dialog ? (
            <p className="form-error" role="alert">
              {commandError}
            </p>
          ) : null}
        </AssemblyWorkspace>
      )}
      <EnvelopeEditorDialogs
        dialog={dialog}
        materials={query.data.project_materials}
        catalogMaterials={activeCatalogMaterials}
        catalogMaterialsLoading={catalogMaterialsQuery.isFetching}
        busy={commandMutation.isPending}
        error={commandError}
        onOpenCatalogPicker={() => setCatalogPickerOpen(true)}
        onClose={() => {
          setDialog(null);
          setCatalogPickerOpen(false);
          setCommandError(null);
        }}
        onReplaceDialog={setDialog}
        onCommand={(command) => void applyCommand(command)}
      />
      {refreshMaterial && refreshDriftItem ? (
        <MaterialDriftDialog
          material={refreshMaterial}
          item={refreshDriftItem}
          busy={commandMutation.isPending}
          error={commandError}
          onClose={() => {
            setRefreshMaterialId(null);
            setCommandError(null);
          }}
          onCommand={(command) => void applyCommand(command)}
        />
      ) : null}
    </section>
  );
}
