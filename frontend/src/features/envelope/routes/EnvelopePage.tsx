// @size-exception: docs/code-reviews/2026-05-25/frontend-code-review.md#21-srp--file-length-violations
// EnvelopePage owns route guarding, active assembly selection, dialog dispatch,
// zoom, and the copy/paste buffer for the envelope workspace. Server state lives
// in the envelope hooks, while canvas/sidebar/specification layout details stay
// in feature components so browser and MCP mutations share the semantic command
// boundary.
import "../../assets/attachments.css";
import { Navigate, NavLink, useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
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
import { type CopiedAssignment } from "../components/AssemblyCanvas";
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
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../canvas-constants";
import type {
  AssemblyLayer,
  AssemblySegment,
  EnvelopeAttachmentChangeArgs,
  EnvelopeCommand,
} from "../types";
import {
  countAssemblyMaterialDrift,
  envelopeShellNotice,
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
  const [copiedAssignment, setCopiedAssignment] = useState<CopiedAssignment | null>(null);
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
    if (!copiedAssignment) return undefined;
    function clearOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") setCopiedAssignment(null);
    }
    window.addEventListener("keydown", clearOnEscape);
    return () => window.removeEventListener("keydown", clearOnEscape);
  }, [copiedAssignment]);

  useEffect(() => {
    if (catalogPickerOpen && dialog?.kind !== "segment") setCatalogPickerOpen(false);
  }, [catalogPickerOpen, dialog]);

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

  const shellNotice = envelopeShellNotice({
    isViewer,
    isLocked,
    source: query.data.source,
  });

  async function applyCommand(command: EnvelopeCommand): Promise<void> {
    const current = query.data;
    if (!current) return;
    setCommandError(null);
    try {
      await commandMutation.mutateAsync({ current, command });
      setDialog(null);
    } catch (error) {
      setCommandError(errorMessage(error, "Envelope command failed."));
    }
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

  function pasteAssignment(layer: AssemblyLayer, segment: AssemblySegment): void {
    if (!copiedAssignment || !activeAssembly) return;
    void applyCommand({
      kind: "paste_assignment",
      assembly_id: activeAssembly.id,
      layer_id: layer.id,
      segment_id: segment.id,
      project_material_id: copiedAssignment.project_material_id,
      is_continuous_insulation: copiedAssignment.is_continuous_insulation,
      steel_stud_spacing_mm: copiedAssignment.steel_stud_spacing_mm,
    });
  }

  return (
    <section className="tab-panel envelope-panel" aria-labelledby="envelope-title">
      <header className="envelope-topline">
        <div>
          <p className="eyebrow">Envelope</p>
          <h1 id="envelope-title">Assembly Builder</h1>
        </div>
        <span className="read-only-pill">{shellNotice}</span>
      </header>
      <nav className="envelope-subtabs" aria-label="Envelope views">
        <NavLink to={{ pathname: envelopeAssembliesPath(project.id), search: location.search }}>
          Assemblies
        </NavLink>
        <NavLink
          to={{
            pathname: envelopeSpecificationsPath(project.id),
            search: location.search,
          }}
        >
          Specifications
        </NavLink>
      </nav>
      {copiedAssignment && canEdit ? (
        <div className="envelope-command-banner" role="status">
          Assignment copied. Paste onto a segment.
          <button type="button" className="text-button" onClick={() => setCopiedAssignment(null)}>
            Clear
          </button>
        </div>
      ) : null}
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
          driftByMaterialId={driftByMaterialId}
          search={searchParams}
          zoom={zoom}
          canEdit={canEdit}
          thermal={thermalQuery.data ?? null}
          thermalLoading={thermalQuery.isFetching}
          exportBusy={exportMutation.isPending}
          copiedAssignment={copiedAssignment}
          onAddAssembly={() => setDialog({ kind: "create-assembly" })}
          onZoomIn={() => setZoom((current) => Math.min(ZOOM_MAX, current + ZOOM_STEP))}
          onZoomOut={() => setZoom((current) => Math.max(ZOOM_MIN, current - ZOOM_STEP))}
          onExportHbjson={() => void exportHbjson()}
          onRename={() => setDialog({ kind: "rename-assembly", assembly: activeAssembly })}
          onTypeChange={() => setDialog({ kind: "type-assembly", assembly: activeAssembly })}
          onDuplicate={() => setDialog({ kind: "duplicate-assembly", assembly: activeAssembly })}
          onDelete={() => setDialog({ kind: "delete-assembly", assembly: activeAssembly })}
          onFlipOrientation={() =>
            void applyCommand({ kind: "flip_orientation", assembly_id: activeAssembly.id })
          }
          onFlipLayers={() =>
            void applyCommand({ kind: "flip_layers", assembly_id: activeAssembly.id })
          }
          onEditLayer={(layer) => setDialog({ kind: "layer", assembly: activeAssembly, layer })}
          onAddLayer={(layer, position) =>
            setDialog({ kind: "add-layer", assembly: activeAssembly, layer, position })
          }
          onDeleteLayer={(layer) =>
            setDialog({ kind: "delete-layer", assembly: activeAssembly, layer })
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
          onDeleteSegment={(layer, segment) =>
            setDialog({ kind: "delete-segment", assembly: activeAssembly, layer, segment })
          }
          onCopyAssignment={setCopiedAssignment}
          onPasteAssignment={pasteAssignment}
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
