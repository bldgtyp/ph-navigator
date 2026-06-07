import "../apertures.css";
import { useEffect, useMemo, useState } from "react";
import { Filter, Waypoints } from "lucide-react";
import { errorMessage } from "../../../shared/lib/errors";
import { AppMenu, AppMenuItem } from "../../../shared/ui/AppMenu";
import { AppSubTabButton, AppSubTabs } from "../../../shared/ui/AppSubTabs";
import type { ProjectDetail } from "../../projects/types";
import { ApertureCanvasContainer } from "../components/ApertureCanvasContainer";
import { ApertureEmptyState } from "../components/ApertureEmptyState";
import { ApertureSidebar } from "../components/ApertureSidebar";
import { AperturesHeader } from "../components/AperturesHeader";
import { BuilderDriftBanner } from "../components/BuilderDriftBanner";
import { DeleteApertureDialog } from "../components/DeleteApertureDialog";
import { DisplayFormatMenuGroup } from "../components/DisplayFormatSelector";
import { ExportHbjsonAction } from "../components/ExportHbjsonAction";
import { ManufacturerFiltersModal } from "../components/ManufacturerFiltersModal";
import { ProjectRefsView } from "../components/ProjectRefsView";
import { RefreshDialog } from "../components/RefreshDialog";
import type { ApertureDriftEntry } from "../drift-types";
import { useApplyApertureCommandMutation, useAperturesSliceQuery } from "../hooks";
import { useApertureDriftReport } from "../hooks/useApertureDriftReport";
import { useApertureDimFormat } from "../hooks/useApertureDimFormat";
import { useApertureUValues } from "../hooks/useApertureUValues";
import { DriftProvider } from "../hooks/useDriftContext";
import { ManufacturerFilterProvider } from "../hooks/useManufacturerFilter";
import { naturalSortApertures } from "../lib";
import type {
  ApertureCommand,
  ApertureTypeEntry,
  AperturesSlice,
  ManufacturerFilters,
} from "../types";

type DialogState = { kind: "none" } | { kind: "delete"; aperture: ApertureTypeEntry };

type AperturesSubtab = "apertures" | "glazings" | "frames";

const APERTURE_SUBTABS: { id: AperturesSubtab; label: string }[] = [
  { id: "apertures", label: "Apertures" },
  { id: "glazings", label: "Glazings" },
  { id: "frames", label: "Frames" },
];

export function AperturesTab({ project }: { project: ProjectDetail }) {
  const isViewer = project.access_mode === "viewer";
  const isLocked = project.active_version?.locked ?? false;
  const canEdit = !isViewer && !isLocked && Boolean(project.active_version_id);

  const sliceQuery = useAperturesSliceQuery(
    project.id,
    project.active_version_id,
    isViewer ? "viewer" : "editor",
  );
  const mutation = useApplyApertureCommandMutation(project.id, project.active_version_id);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [refsViewOpen, setRefsViewOpen] = useState(false);
  const [refreshEntry, setRefreshEntry] = useState<ApertureDriftEntry | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeSubtab, setActiveSubtab] = useState<AperturesSubtab>("apertures");
  const dimFormat = useApertureDimFormat();

  const slice = sliceQuery.data;
  const apertures = useMemo(() => slice?.apertures ?? [], [slice?.apertures]);
  const sorted = useMemo(() => naturalSortApertures(apertures), [apertures]);

  useEffect(() => {
    if (selectedId && sorted.some((a) => a.id === selectedId)) return;
    setSelectedId(sorted[0]?.id ?? null);
  }, [sorted, selectedId]);

  const activeAperture = sorted.find((a) => a.id === selectedId) ?? null;
  const uValueSource: "draft" | "version" = slice?.source === "draft" ? "draft" : "version";
  const uValueQuery = useApertureUValues(project.id, project.active_version_id, uValueSource);
  const driftQuery = useApertureDriftReport(project.id, project.active_version_id, uValueSource);
  const driftEntries = driftQuery.data?.entries ?? [];
  const activeUValue =
    uValueQuery.data?.apertures.find((r) => r.aperture_type_id === activeAperture?.id) ?? null;
  const elementUValueById = new Map(
    activeUValue?.elements.map((e) => [e.element_id, e.u_value_w_m2k]) ?? [],
  );

  const dispatch = async (
    command: ApertureCommand,
    onSuccess?: (next: AperturesSlice) => void,
  ): Promise<AperturesSlice | null> => {
    if (!slice) return null;
    setActionError(null);
    try {
      const next = await mutation.mutateAsync({ current: slice, command });
      onSuccess?.(next);
      return next;
    } catch (error) {
      setActionError(errorMessage(error, "Could not apply aperture command."));
      return null;
    }
  };

  const handleAdd = async () => {
    const next = await dispatch({ kind: "createApertureType" });
    if (!next) return;
    const newEntry = next.apertures.find(
      (entry) => !apertures.some((prior) => prior.id === entry.id),
    );
    if (newEntry) setSelectedId(newEntry.id);
  };

  const handleDuplicate = async (aperture: ApertureTypeEntry) => {
    const next = await dispatch({
      kind: "duplicateApertureType",
      aperture_type_id: aperture.id,
    });
    if (!next) return;
    const duplicateEntry = next.apertures.find(
      (entry) => !apertures.some((prior) => prior.id === entry.id),
    );
    if (duplicateEntry) setSelectedId(duplicateEntry.id);
  };

  const handleDelete = async () => {
    if (dialog.kind !== "delete") return;
    const target = dialog.aperture;
    const next = await dispatch({
      kind: "deleteApertureType",
      aperture_type_id: target.id,
    });
    setDialog({ kind: "none" });
    if (!next) return;
    const remainder = naturalSortApertures(next.apertures);
    setSelectedId(remainder[0]?.id ?? null);
  };

  if (sliceQuery.isLoading) {
    return <section className="tab-panel">Loading apertures...</section>;
  }
  if (sliceQuery.isError || !slice) {
    return (
      <section className="tab-panel">
        <p role="alert">{errorMessage(sliceQuery.error, "Could not load apertures.")}</p>
      </section>
    );
  }

  const exportContext =
    !isViewer && project.active_version_id
      ? {
          projectId: project.id,
          versionId: project.active_version_id,
          source: uValueSource,
          projectBtNumber: project.bt_number,
          versionLabel: project.active_version?.name ?? "version",
          hasApertures: sorted.length > 0,
          onError: setActionError,
        }
      : null;
  const filtersContext =
    !isViewer && project.active_version_id
      ? { onConfigureFilters: () => setFiltersModalOpen(true) }
      : null;
  const refsContext = project.active_version_id
    ? { onViewPickedRefs: () => setRefsViewOpen(true) }
    : null;

  return (
    <ManufacturerFilterProvider
      value={{
        filters: slice.manufacturer_filters,
        openManufacturerFilters: () => setFiltersModalOpen(true),
      }}
    >
      <DriftProvider value={{ entries: driftEntries, onOpenRefresh: setRefreshEntry }}>
        <section className="tab-panel apertures-page" aria-label="Apertures">
          <AppSubTabs
            id="aperture-subtabs"
            ariaLabel="Aperture views"
            actions={
              <>
                <DisplayFormatMenuGroup {...dimFormat} />
                <AppMenu label="Aperture actions">
                  {exportContext ? (
                    <ExportHbjsonAction
                      projectId={exportContext.projectId}
                      versionId={exportContext.versionId}
                      source={exportContext.source}
                      projectBtNumber={exportContext.projectBtNumber}
                      versionLabel={exportContext.versionLabel}
                      disabled={!exportContext.hasApertures}
                      onError={exportContext.onError}
                    />
                  ) : null}
                  {filtersContext ? (
                    <AppMenuItem icon={Filter} onClick={filtersContext.onConfigureFilters}>
                      Configure manufacturer filters
                    </AppMenuItem>
                  ) : null}
                  {refsContext ? (
                    <AppMenuItem icon={Waypoints} onClick={refsContext.onViewPickedRefs}>
                      View picked frames &amp; glazings
                    </AppMenuItem>
                  ) : null}
                </AppMenu>
              </>
            }
          >
            {APERTURE_SUBTABS.map((subtab) => (
              <AppSubTabButton
                key={subtab.id}
                active={activeSubtab === subtab.id}
                onClick={() => setActiveSubtab(subtab.id)}
              >
                {subtab.label}
              </AppSubTabButton>
            ))}
          </AppSubTabs>
          {activeSubtab !== "apertures" ? (
            <section
              className="apertures-placeholder-panel"
              aria-label={activeSubtab === "glazings" ? "Glazings" : "Frames"}
            />
          ) : null}
          <RefreshDialog
            open={refreshEntry !== null}
            entry={refreshEntry}
            busy={mutation.isPending}
            onClose={() => setRefreshEntry(null)}
            onSave={async (chosen) => {
              if (!refreshEntry) return;
              const result = await dispatch({
                kind: "refreshRefFromCatalog",
                aperture_type_id: refreshEntry.aperture_type_id,
                element_id: refreshEntry.element_id,
                target: refreshEntry.target,
                chosen_values: chosen,
              });
              if (result) setRefreshEntry(null);
            }}
          />
          <ProjectRefsView
            open={refsViewOpen}
            apertures={sorted}
            onClose={() => setRefsViewOpen(false)}
          />
          <ManufacturerFiltersModal
            open={filtersModalOpen}
            apertures={sorted}
            filters={slice.manufacturer_filters}
            readOnly={!canEdit}
            onClose={() => setFiltersModalOpen(false)}
            onSave={async (next: ManufacturerFilters) => {
              const result = await dispatch({
                kind: "setManufacturerFilters",
                frame_manufacturers_enabled: next.frame_manufacturers_enabled,
                glazing_manufacturers_enabled: next.glazing_manufacturers_enabled,
              });
              if (result) setFiltersModalOpen(false);
            }}
          />
          {actionError ? (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          ) : null}
          {activeSubtab === "apertures" ? (
            <div
              className={
                sidebarCollapsed
                  ? "apertures-page__body is-sidebar-collapsed"
                  : "apertures-page__body"
              }
            >
              <ApertureSidebar
                apertures={sorted}
                activeApertureId={activeAperture?.id ?? null}
                canEdit={canEdit}
                actionDisabled={!canEdit || mutation.isPending}
                collapsed={sidebarCollapsed}
                onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
                onSelect={setSelectedId}
                onAdd={() => void handleAdd()}
                onRename={(aperture, newName) =>
                  void dispatch({
                    kind: "renameApertureType",
                    aperture_type_id: aperture.id,
                    new_name: newName,
                  })
                }
                onDuplicate={(aperture) => void handleDuplicate(aperture)}
                onDelete={(aperture) => setDialog({ kind: "delete", aperture })}
              />
              <main className="apertures-page__main">
                <AperturesHeader
                  activeAperture={activeAperture}
                  apertures={sorted}
                  uValue={activeUValue}
                  loading={uValueQuery.isLoading}
                  canEdit={canEdit}
                  busy={mutation.isPending}
                  onRename={(newName) => {
                    if (!activeAperture) return;
                    void dispatch({
                      kind: "renameApertureType",
                      aperture_type_id: activeAperture.id,
                      new_name: newName,
                    });
                  }}
                />
                <BuilderDriftBanner apertureTypeId={activeAperture?.id ?? null} />
                {activeAperture ? (
                  <ApertureCanvasContainer
                    aperture={activeAperture}
                    canEdit={canEdit}
                    onSetElementName={(elementId, newName) =>
                      void dispatch({
                        kind: "setElementName",
                        aperture_type_id: activeAperture.id,
                        element_id: elementId,
                        new_name: newName,
                      })
                    }
                    onEditDimension={(axis, index, newMm) =>
                      void dispatch({
                        kind: "editDimension",
                        aperture_type_id: activeAperture.id,
                        axis,
                        index,
                        new_value_mm: newMm,
                      })
                    }
                    onAddRow={(at_index) =>
                      void dispatch({
                        kind: "addRow",
                        aperture_type_id: activeAperture.id,
                        at_index,
                        height_mm: 1000,
                      })
                    }
                    onAddColumn={(at_index) =>
                      void dispatch({
                        kind: "addColumn",
                        aperture_type_id: activeAperture.id,
                        at_index,
                        width_mm: 1000,
                      })
                    }
                    onDeleteRow={(index) =>
                      void dispatch({
                        kind: "deleteRow",
                        aperture_type_id: activeAperture.id,
                        index,
                      })
                    }
                    onDeleteColumn={(index) =>
                      void dispatch({
                        kind: "deleteColumn",
                        aperture_type_id: activeAperture.id,
                        index,
                      })
                    }
                    onPickFrame={(element_id, side, frame) =>
                      void dispatch({
                        kind: "pickFrame",
                        aperture_type_id: activeAperture.id,
                        element_id,
                        side,
                        frame,
                      })
                    }
                    onPickGlazing={(element_id, glazing) =>
                      void dispatch({
                        kind: "pickGlazing",
                        aperture_type_id: activeAperture.id,
                        element_id,
                        glazing,
                      })
                    }
                    onSetElementOperation={(element_id, operation) =>
                      void dispatch({
                        kind: "setElementOperation",
                        aperture_type_id: activeAperture.id,
                        element_id,
                        operation,
                      })
                    }
                    onMergeElements={(element_ids) =>
                      void dispatch({
                        kind: "mergeElements",
                        aperture_type_id: activeAperture.id,
                        element_ids,
                      })
                    }
                    onSplitElement={(element_id) =>
                      void dispatch({
                        kind: "splitElement",
                        aperture_type_id: activeAperture.id,
                        element_id,
                      })
                    }
                    onPasteAssignment={(source_element_id, target_element_ids) =>
                      dispatch({
                        kind: "pasteAssignment",
                        aperture_type_id: activeAperture.id,
                        source_element_id,
                        target_element_ids,
                      }).then(() => undefined)
                    }
                    uValueByElementId={elementUValueById}
                    dimFormat={dimFormat}
                  />
                ) : (
                  <ApertureEmptyState canEdit={canEdit} onAdd={() => void handleAdd()} />
                )}
              </main>
            </div>
          ) : null}
          {dialog.kind === "delete" ? (
            <DeleteApertureDialog
              aperture={dialog.aperture}
              busy={mutation.isPending}
              error={actionError}
              onClose={() => setDialog({ kind: "none" })}
              onConfirm={() => void handleDelete()}
            />
          ) : null}
        </section>
      </DriftProvider>
    </ManufacturerFilterProvider>
  );
}
