import { Navigate, NavLink, useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { useMaterialsQuery } from "../../catalogs/hooks";
import type { ProjectDetail } from "../../projects/types";
import {
  useAssemblyThermalQuery,
  useEnvelopeCommandMutation,
  useEnvelopeHbjsonExportMutation,
  useEnvelopeReadQuery,
} from "../hooks";
import { envelopeReadSource, naturalSortAssemblies } from "../lib";
import {
  envelopeAssembliesPath,
  envelopeAssemblyPath,
  envelopeSpecificationsPath,
  isEnvelopeSubroute,
} from "../paths";
import { AssemblyCanvas, type CopiedAssignment } from "../components/AssemblyCanvas";
import { AssemblyHeader } from "../components/AssemblyHeader";
import {
  EnvelopeEditorDialogs,
  type EnvelopeEditorDialogState,
} from "../components/EnvelopeEditorDialogs";
import {
  EnvelopeEmptyState,
  EnvelopeErrorState,
  EnvelopeLoadingState,
} from "../components/EnvelopeStates";
import { EnvelopeSidebar } from "../components/EnvelopeSidebar";
import { MaterialLegend } from "../components/MaterialLegend";
import { SpecificationsPanel } from "../components/SpecificationsPanel";
import type { AssemblyLayer, AssemblySegment, EnvelopeCommand } from "../types";

export function EnvelopePage({ project }: { project: ProjectDetail }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isViewer = project.access_mode === "viewer";
  const isLocked = project.active_version?.locked ?? false;
  const canEdit = !isViewer && !isLocked;
  const source = envelopeReadSource(project);
  const query = useEnvelopeReadQuery(project.id, project.active_version_id, source);
  const commandMutation = useEnvelopeCommandMutation(project.id, project.active_version_id);
  const exportMutation = useEnvelopeHbjsonExportMutation(project.id, project.active_version_id);
  const [zoom, setZoom] = useState(1);
  const [dialog, setDialog] = useState<EnvelopeEditorDialogState | null>(null);
  const catalogMaterialsQuery = useMaterialsQuery(false, canEdit && dialog?.kind === "segment");
  const [commandError, setCommandError] = useState<string | null>(null);
  const [copiedAssignment, setCopiedAssignment] = useState<CopiedAssignment | null>(null);
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

  useEffect(() => {
    function clearOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") setCopiedAssignment(null);
    }
    window.addEventListener("keydown", clearOnEscape);
    return () => window.removeEventListener("keydown", clearOnEscape);
  }, []);

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
        "Download constructions reads the last saved version, not your unsaved draft. Save or Save As first if the draft should be included. Continue with the saved version?",
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
      {isSpecificationsRoute ? (
        <SpecificationsPanel
          materials={query.data.project_materials}
          isViewer={isViewer}
          canEdit={canEdit}
          busy={commandMutation.isPending}
          error={commandError}
          onCommand={(command) => void applyCommand(command)}
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
        <div className="envelope-workbench">
          <EnvelopeSidebar
            projectId={project.id}
            assemblies={assemblies}
            activeId={activeAssembly.id}
            search={searchParams}
            canEdit={canEdit}
            onAddAssembly={() => setDialog({ kind: "create-assembly" })}
          />
          <div className="assembly-workspace">
            <AssemblyHeader
              projectId={project.id}
              assemblies={assemblies}
              activeAssembly={activeAssembly}
              search={searchParams}
              zoom={zoom}
              canEdit={canEdit}
              thermal={thermalQuery.data ?? null}
              thermalLoading={thermalQuery.isFetching}
              exportBusy={exportMutation.isPending}
              onZoomIn={() => setZoom((current) => Math.min(2, current + 0.1))}
              onZoomOut={() => setZoom((current) => Math.max(0.6, current - 0.1))}
              onExportHbjson={() => void exportHbjson()}
              onRename={() => setDialog({ kind: "rename-assembly", assembly: activeAssembly })}
              onTypeChange={() => setDialog({ kind: "type-assembly", assembly: activeAssembly })}
              onDuplicate={() =>
                setDialog({ kind: "duplicate-assembly", assembly: activeAssembly })
              }
              onDelete={() => setDialog({ kind: "delete-assembly", assembly: activeAssembly })}
              onFlipOrientation={() =>
                void applyCommand({ kind: "flip_orientation", assembly_id: activeAssembly.id })
              }
              onFlipLayers={() =>
                void applyCommand({ kind: "flip_layers", assembly_id: activeAssembly.id })
              }
            />
            {commandError && !dialog ? (
              <p className="form-error" role="alert">
                {commandError}
              </p>
            ) : null}
            <AssemblyCanvas
              assembly={activeAssembly}
              materials={query.data.project_materials}
              zoom={zoom}
              canEdit={canEdit}
              copiedAssignment={copiedAssignment}
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
            />
            <MaterialLegend materials={query.data.project_materials} />
          </div>
        </div>
      )}
      <EnvelopeEditorDialogs
        dialog={dialog}
        materials={query.data.project_materials}
        catalogMaterials={catalogMaterialsQuery.data ?? []}
        busy={commandMutation.isPending}
        error={commandError}
        onClose={() => {
          setDialog(null);
          setCommandError(null);
        }}
        onCommand={(command) => void applyCommand(command)}
      />
    </section>
  );
}

function envelopeSubpath(pathname: string, projectId: string): string {
  return pathname.replace(`/projects/${projectId}/envelope`, "");
}

function activeAssemblyIdFromSubpath(subpath: string): string | null {
  const match = subpath.match(/^\/assemblies\/([^/]+)(?:\/.*)?$/);
  return match?.[1] ?? null;
}

function exportErrorDetails(error: unknown): string | null {
  if (!(error instanceof Error) || !("details" in error)) return null;
  const details = (error as { details?: Record<string, unknown> }).details;
  const errors = details?.errors;
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const lines = errors
    .slice(0, 5)
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const assemblyName =
        typeof record.assembly_name === "string" ? record.assembly_name : "Assembly";
      const code =
        typeof record.code === "string" ? record.code.replaceAll("_", " ") : "export issue";
      return `${assemblyName}: ${code}`;
    })
    .filter(Boolean);
  if (!lines.length) return null;
  const suffix = errors.length > lines.length ? ` (${errors.length - lines.length} more)` : "";
  return `HBJSON export needs attention: ${lines.join("; ")}${suffix}`;
}

function envelopeShellNotice({
  isViewer,
  isLocked,
  source,
}: {
  isViewer: boolean;
  isLocked: boolean;
  source: "draft" | "version";
}): string {
  if (isViewer) return "Viewer mode";
  if (isLocked) return "Locked version";
  return source === "draft" ? "Draft view" : "Saved version";
}
