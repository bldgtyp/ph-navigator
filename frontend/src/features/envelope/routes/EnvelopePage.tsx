// @size-exception: planning/features/assembly-builder-hardening/phases/phase-04-frontend-refactors.md
// EnvelopePage owns route guarding, active assembly selection, dialog dispatch,
// and zoom for the envelope workspace. Paint-mode and dialog state live in
// `usePaintMode` / `useEnvelopeDialogs`; server state lives in the envelope
// hooks; canvas/sidebar/specification layout details stay in feature
// components so browser and MCP mutations share the semantic command boundary.
import "../envelope.css";
import { Download } from "lucide-react";
import { Navigate, NavLink, useLocation, useSearchParams } from "react-router-dom";
import { useMemo, useRef, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { AppSubTabLink, AppSubTabs } from "../../../shared/ui/AppSubTabs";
import { AppMenu, AppMenuItem } from "../../../shared/ui/AppMenu";
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
  envelopeMaterialsPath,
  isEnvelopeSubroute,
} from "../paths";
import { AssemblyWorkspace } from "../components/AssemblyWorkspace";
import { EnvelopeEditorDialogs } from "../components/EnvelopeEditorDialogs";
import { usePaintMode } from "../hooks/usePaintMode";
import { useEnvelopeDialogs } from "../hooks/useEnvelopeDialogs";
import {
  EnvelopeEmptyState,
  EnvelopeErrorState,
  EnvelopeLoadingState,
} from "../components/EnvelopeStates";
import { MaterialDriftDialog } from "../components/MaterialDrift";
import { MaterialsPanel } from "../components/MaterialsPanel";
import { nextZoomStep, previousZoomStep } from "../canvas-constants";
import type { EnvelopeAttachmentChangeArgs, EnvelopeCommand } from "../types";
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
  const {
    dialog,
    setDialog,
    catalogPickerOpen,
    setCatalogPickerOpen,
    refreshMaterialId,
    setRefreshMaterialId,
    commandError,
    setCommandError,
    closeDialog,
    closeRefresh,
  } = useEnvelopeDialogs();
  const commandMutation = useEnvelopeCommandMutation(project.id, project.active_version_id);
  const exportMutation = useEnvelopeHbjsonExportMutation(project.id, project.active_version_id);
  const attachmentMutation = useEnvelopeAttachmentMutation({
    projectId: project.id,
    versionId: project.active_version_id,
    onError: setCommandError,
  });
  const [zoom, setZoom] = useState(1);
  const commandInFlightRef = useRef(false);
  const catalogMaterialsQuery = useMaterialsQuery(
    canEdit && dialog?.kind === "segment" && catalogPickerOpen,
  );
  // The catalog picker only offers active materials; filter the unified
  // fetch (which includes deactivated rows) down to active here.
  const activeCatalogMaterials = useMemo(
    () => (catalogMaterialsQuery.data ?? []).filter((m) => m.is_active),
    [catalogMaterialsQuery.data],
  );
  const subpath = envelopeSubpath(location.pathname, project.id);
  const isAssembliesRoute = isEnvelopeSubroute(subpath, "assemblies");
  const isMaterialsRoute = isEnvelopeSubroute(subpath, "materials");
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

  const paintController = usePaintMode({
    canEdit,
    activeAssembly,
    applyCommand: (command) => applyCommand(command),
    commandPending: commandMutation.isPending,
  });

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

  if (!isAssembliesRoute && !isMaterialsRoute) {
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

  return (
    <section
      id="envelope-assembly-builder-panel"
      className="tab-panel envelope-panel"
      aria-label="Assembly Builder"
    >
      <AppSubTabs
        id="envelope-subtabs"
        ariaLabel="Envelope views"
        actions={
          isAssembliesRoute ? (
            <AppMenu label="Assembly actions">
              <AppMenuItem
                id="assembly-builder-export-hbjson"
                icon={Download}
                disabled={exportMutation.isPending}
                onClick={() => void exportHbjson()}
              >
                Download constructions HBJSON
              </AppMenuItem>
            </AppMenu>
          ) : null
        }
      >
        <AppSubTabLink
          to={{ pathname: envelopeAssembliesPath(project.id), search: location.search }}
        >
          Assemblies
        </AppSubTabLink>
        <AppSubTabLink
          to={{
            pathname: envelopeMaterialsPath(project.id),
            search: location.search,
          }}
        >
          Materials
        </AppSubTabLink>
      </AppSubTabs>
      {activeAssemblyDriftCount > 0 && isAssembliesRoute ? (
        <div className="envelope-command-banner" role="status">
          {activeAssemblyDriftCount} material{" "}
          {activeAssemblyDriftCount === 1 ? "copy needs" : "copies need"} catalog review.
          <NavLink
            className="text-button"
            to={{ pathname: envelopeMaterialsPath(project.id), search: location.search }}
          >
            Review all
          </NavLink>
        </div>
      ) : null}
      {isMaterialsRoute ? (
        <MaterialsPanel
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
          commandBusy={commandMutation.isPending}
          paint={paintController}
          onAddAssembly={() => setDialog({ kind: "create-assembly" })}
          onRenameActive={(name) =>
            void applyCommand({
              kind: "rename_assembly",
              assembly_id: activeAssembly.id,
              name,
            })
          }
          onZoomIn={() => setZoom(nextZoomStep)}
          onZoomOut={() => setZoom(previousZoomStep)}
          onRename={(assembly, name) =>
            void applyCommand({
              kind: "rename_assembly",
              assembly_id: assembly.id,
              name,
            })
          }
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
        onClose={closeDialog}
        onReplaceDialog={setDialog}
        onCommand={(command) => void applyCommand(command)}
      />
      {refreshMaterial && refreshDriftItem ? (
        <MaterialDriftDialog
          material={refreshMaterial}
          item={refreshDriftItem}
          busy={commandMutation.isPending}
          error={commandError}
          onClose={closeRefresh}
          onCommand={(command) => void applyCommand(command)}
        />
      ) : null}
    </section>
  );
}
