// @size-exception: planning/features/apertures-glazings-frames-reports/phases/phase-02-wire-and-retire-modal.md
import "../apertures.css";
import { useEffect, useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { errorMessage } from "../../../shared/lib/errors";
import { AppMenu, AppMenuItem } from "../../../shared/ui/AppMenu";
import { AppSubTabLink, AppSubTabs } from "../../../shared/ui/AppSubTabs";
import { useSessionQuery } from "../../auth/hooks";
import { useDraftSummaryQuery } from "../../project_document/hooks";
import type { ProjectDetail } from "../../projects/types";
import { ApertureCanvasContainer } from "../components/ApertureCanvasContainer";
import { ApertureEmptyState } from "../components/ApertureEmptyState";
import { ApertureSidebar } from "../components/ApertureSidebar";
import { AperturesHeader } from "../components/AperturesHeader";
import { BuilderDriftBanner } from "../components/BuilderDriftBanner";
import { DeleteApertureDialog } from "../components/DeleteApertureDialog";
import { DisplayFormatMenuGroup } from "../components/DisplayFormatSelector";
import { ExportHbjsonAction } from "../components/ExportHbjsonAction";
import { FramePickerFilterMenuItems } from "../components/FramePickerFilterMenuItems";
import { FramesPanel } from "../components/FramesPanel";
import { GlazingsPanel } from "../components/GlazingsPanel";
import { ManufacturerFiltersModal } from "../components/ManufacturerFiltersModal";
import { RefreshDialog } from "../components/RefreshDialog";
import { UValueReportPanel } from "../components/UValueReportPanel";
import { UValueReportActions } from "../components/UValueReportActions";
import type { ApertureDriftEntry } from "../drift-types";
import {
  useApplyApertureCommandMutation,
  useApertureProductCommandMutation,
  useApertureReportAttachmentMutation,
  useApertureReportRefreshMutation,
  useApertureSpecReportQuery,
  useAperturesSliceQuery,
} from "../hooks";
import { useApertureDriftReport } from "../hooks/useApertureDriftReport";
import { useApertureDimFormat } from "../hooks/useApertureDimFormat";
import { useApertureUValues } from "../hooks/useApertureUValues";
import { useApertureUValueReport } from "../hooks/useApertureUValueReport";
import { DriftProvider } from "../hooks/useDriftContext";
import { FramePickerFilterProvider } from "../hooks/useFramePickerFilters";
import { useFramePickerFilterPreferences } from "../hooks/useFramePickerFilterPreferences";
import { ManufacturerFilterProvider } from "../hooks/useManufacturerFilter";
import { InstallTypesProvider } from "../hooks/useInstallTypes";
import { canExportApertureUValueReport, naturalSortApertures } from "../lib";
import {
  APERTURE_SUBROUTES,
  apertureSubpath,
  aperturesBuilderPath,
  aperturesFramesPath,
  aperturesGlazingsPath,
  aperturesInstallsPath,
  aperturesUValuesPath,
  isApertureSubroute,
} from "../paths";
import { InstallTypesPanel } from "../installs/InstallTypesPanel";
import { InstallsModal } from "../components/InstallsModal";
import type {
  ApertureAttachmentChangeArgs,
  ApertureCommand,
  ApertureProductCommand,
  ApertureReadSource,
  ApertureTypeEntry,
  AperturesSlice,
  ManufacturerFilters,
} from "../types";

type DialogState = { kind: "none" } | { kind: "delete"; aperture: ApertureTypeEntry };

export function AperturesTab({ project }: { project: ProjectDetail }) {
  const location = useLocation();
  const sessionQuery = useSessionQuery();
  const isViewer = project.access_mode === "viewer";
  const isLocked = project.active_version?.locked ?? false;
  const canEdit = !isViewer && !isLocked && Boolean(project.active_version_id);
  const reportSource: ApertureReadSource = isViewer || isLocked ? "version" : "draft";
  const subpath = apertureSubpath(location.pathname, project.id);
  const isBuilderRoute = isApertureSubroute(subpath, "builder");
  const isGlazingsRoute = isApertureSubroute(subpath, "glazings");
  const isFramesRoute = isApertureSubroute(subpath, "frames");
  const isInstallsRoute = isApertureSubroute(subpath, "installs");
  const isUValuesRoute = isApertureSubroute(subpath, "u-values");
  const isProductReportRoute = isGlazingsRoute || isFramesRoute;
  const canExportUValueReport = canExportApertureUValueReport(sessionQuery.data);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [actionError, setActionError] = useState<string | null>(null);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [installsModalOpen, setInstallsModalOpen] = useState(false);
  const [refreshEntry, setRefreshEntry] = useState<ApertureDriftEntry | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const dimFormat = useApertureDimFormat();
  const framePickerFilterPreferences = useFramePickerFilterPreferences(project.id);
  const framePickerFilterContext = useMemo(
    () => ({
      filterFramesBySide: framePickerFilterPreferences.filterFramesBySide,
      filterFramesByOperation: framePickerFilterPreferences.filterFramesByOperation,
    }),
    [
      framePickerFilterPreferences.filterFramesByOperation,
      framePickerFilterPreferences.filterFramesBySide,
    ],
  );

  const sliceQuery = useAperturesSliceQuery(
    project.id,
    project.active_version_id,
    isViewer ? "viewer" : "editor",
    isBuilderRoute,
  );
  const specReportQuery = useApertureSpecReportQuery(
    project.id,
    project.active_version_id,
    reportSource,
    isProductReportRoute,
  );
  const uValueReportQuery = useApertureUValueReport(
    project.id,
    project.active_version_id,
    reportSource,
    isUValuesRoute,
  );
  const savedUValueReportQuery = useApertureUValueReport(
    project.id,
    project.active_version_id,
    "version",
    isUValuesRoute && reportSource === "draft" && canExportUValueReport,
  );
  const draftSummaryQuery = useDraftSummaryQuery(
    project.id,
    project.active_version_id,
    isUValuesRoute && !isViewer && canExportUValueReport,
  );
  const mutation = useApplyApertureCommandMutation(project.id, project.active_version_id);
  const productCommandMutation = useApertureProductCommandMutation(
    project.id,
    project.active_version_id,
  );
  const reportRefreshMutation = useApertureReportRefreshMutation(
    project.id,
    project.active_version_id,
  );
  const reportAttachmentMutation = useApertureReportAttachmentMutation({
    projectId: project.id,
    versionId: project.active_version_id,
    onError: setActionError,
  });

  const slice = sliceQuery.data;
  const apertures = useMemo(() => slice?.apertures ?? [], [slice?.apertures]);
  const sorted = useMemo(() => naturalSortApertures(apertures), [apertures]);

  useEffect(() => {
    if (selectedId && sorted.some((a) => a.id === selectedId)) return;
    setSelectedId(sorted[0]?.id ?? null);
  }, [sorted, selectedId]);

  const activeAperture = sorted.find((a) => a.id === selectedId) ?? sorted[0] ?? null;
  const uValueSource: "draft" | "version" = slice?.source === "draft" ? "draft" : "version";
  const builderVersionId = isBuilderRoute ? project.active_version_id : null;
  const uValueQuery = useApertureUValues(project.id, builderVersionId, uValueSource);
  const driftQuery = useApertureDriftReport(
    project.id,
    isBuilderRoute || isProductReportRoute ? project.active_version_id : null,
    isBuilderRoute ? uValueSource : reportSource,
    isBuilderRoute || isProductReportRoute,
  );
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

  /** Apply several commands as one user action (the Installs modal's Save).
   *  Each write bumps the draft etag, so the accepted slice has to be threaded
   *  into the next `If-Match` — `dispatch` closes over the slice from its own
   *  render and would send a superseded etag on the second command. */
  const dispatchSequence = async (commands: readonly ApertureCommand[]): Promise<boolean> => {
    if (!slice) return false;
    setActionError(null);
    let current = slice;
    try {
      for (const command of commands) {
        current = await mutation.mutateAsync({ current, command });
      }
      return true;
    } catch (error) {
      setActionError(errorMessage(error, "Could not apply aperture command."));
      return false;
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

  const applyProductCommand = async (command: ApertureProductCommand): Promise<boolean> => {
    const current = specReportQuery.data;
    if (!current) return false;
    setActionError(null);
    try {
      await productCommandMutation.mutateAsync({ current, command });
      return true;
    } catch (error) {
      setActionError(errorMessage(error, "Could not update aperture specification."));
      return false;
    }
  };

  const applyReportAttachmentChange = async (
    change: ApertureAttachmentChangeArgs,
  ): Promise<void> => {
    const current = specReportQuery.data;
    if (!current) return;
    setActionError(null);
    await reportAttachmentMutation.mutateAsync({ current, change });
  };

  const handleRefreshSave = async (chosen: Record<string, string | number | null>) => {
    if (!refreshEntry) return;
    const command: Extract<ApertureCommand, { kind: "refreshRefFromCatalog" }> = {
      kind: "refreshRefFromCatalog",
      aperture_type_id: refreshEntry.aperture_type_id,
      element_id: refreshEntry.element_id,
      target: refreshEntry.target,
      chosen_values: chosen,
    };
    if (isBuilderRoute) {
      const result = await dispatch(command);
      if (result) setRefreshEntry(null);
      return;
    }
    const current = specReportQuery.data;
    if (!current) return;
    setActionError(null);
    try {
      await reportRefreshMutation.mutateAsync({ current, command });
      setRefreshEntry(null);
    } catch (error) {
      setActionError(errorMessage(error, "Could not refresh aperture specification."));
    }
  };

  if (subpath === "" || subpath === "/") {
    return (
      <Navigate
        to={{ pathname: aperturesBuilderPath(project.id), search: location.search }}
        replace
      />
    );
  }

  if (!APERTURE_SUBROUTES.some((route) => isApertureSubroute(subpath, route))) {
    return (
      <Navigate
        to={{ pathname: aperturesBuilderPath(project.id), search: location.search }}
        replace
      />
    );
  }

  if (isBuilderRoute && sliceQuery.isLoading) {
    return <section className="tab-panel">Loading apertures...</section>;
  }
  if (isBuilderRoute && (sliceQuery.isError || !slice)) {
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
  const apertureActions = (
    <>
      <button
        type="button"
        className="secondary-button"
        title="Window install psi-values"
        onClick={() => setInstallsModalOpen(true)}
      >
        Installs
      </button>
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
        <FramePickerFilterMenuItems {...framePickerFilterPreferences} />
        {filtersContext ? (
          <AppMenuItem icon={Filter} onClick={filtersContext.onConfigureFilters}>
            Configure manufacturer filters
          </AppMenuItem>
        ) : null}
      </AppMenu>
    </>
  );
  const reportBusy =
    productCommandMutation.isPending ||
    reportAttachmentMutation.isPending ||
    reportRefreshMutation.isPending;
  const exportReport =
    reportSource === "version" ? uValueReportQuery.data : savedUValueReportQuery.data;
  const draftGuardReady =
    isViewer || Boolean(draftSummaryQuery.data && "draft_etag" in draftSummaryQuery.data);
  const uValueReportActions =
    isUValuesRoute && exportReport && canExportUValueReport && draftGuardReady ? (
      <UValueReportActions
        projectId={project.id}
        versionId={project.active_version_id}
        report={exportReport}
        hasUnsavedDraft={
          draftSummaryQuery.data?.source === "draft" &&
          "draft_etag" in draftSummaryQuery.data &&
          Boolean(draftSummaryQuery.data.draft_etag)
        }
        canExport
        onError={setActionError}
      />
    ) : null;

  return (
    <ManufacturerFilterProvider
      value={{
        filters: slice?.manufacturer_filters ?? null,
        openManufacturerFilters: () => setFiltersModalOpen(true),
      }}
    >
      <InstallTypesProvider value={slice?.aperture_install_types ?? []}>
        <FramePickerFilterProvider value={framePickerFilterContext}>
          <DriftProvider value={{ entries: driftEntries, onOpenRefresh: setRefreshEntry }}>
            <section className="tab-panel apertures-page" aria-label="Apertures">
              <AppSubTabs
                id="aperture-subtabs"
                ariaLabel="Aperture views"
                actions={uValueReportActions}
              >
                <AppSubTabLink
                  to={{ pathname: aperturesBuilderPath(project.id), search: location.search }}
                >
                  Apertures
                </AppSubTabLink>
                <AppSubTabLink
                  to={{ pathname: aperturesGlazingsPath(project.id), search: location.search }}
                >
                  Glazings
                </AppSubTabLink>
                <AppSubTabLink
                  to={{ pathname: aperturesFramesPath(project.id), search: location.search }}
                >
                  Frames
                </AppSubTabLink>
                <AppSubTabLink
                  to={{ pathname: aperturesInstallsPath(project.id), search: location.search }}
                >
                  Installs
                </AppSubTabLink>
                <AppSubTabLink
                  to={{ pathname: aperturesUValuesPath(project.id), search: location.search }}
                >
                  U-Values
                </AppSubTabLink>
              </AppSubTabs>
              <RefreshDialog
                open={refreshEntry !== null}
                entry={refreshEntry}
                onClose={() => setRefreshEntry(null)}
                busy={mutation.isPending || reportRefreshMutation.isPending}
                onSave={(chosen) => void handleRefreshSave(chosen)}
              />
              {installsModalOpen && activeAperture ? (
                <InstallsModal
                  project={project}
                  aperture={activeAperture}
                  apertures={sorted}
                  canEdit={canEdit}
                  onDispatchAll={dispatchSequence}
                  onClose={() => setInstallsModalOpen(false)}
                />
              ) : null}
              <ManufacturerFiltersModal
                open={filtersModalOpen}
                apertures={sorted}
                filters={slice?.manufacturer_filters ?? null}
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
              <div className="apertures-body">
                {actionError ? (
                  <p className="form-error" role="alert">
                    {actionError}
                  </p>
                ) : null}
                {isInstallsRoute ? <InstallTypesPanel project={project} /> : null}
                {isUValuesRoute ? (
                  uValueReportQuery.isLoading ? (
                    <section className="apertures-placeholder-panel">
                      <p>Loading U-Value report...</p>
                    </section>
                  ) : uValueReportQuery.isError || !uValueReportQuery.data ? (
                    <section className="apertures-placeholder-panel">
                      <p role="alert">
                        {errorMessage(
                          uValueReportQuery.error,
                          "Could not load the U-Value report.",
                        )}
                      </p>
                    </section>
                  ) : (
                    <UValueReportPanel
                      report={uValueReportQuery.data}
                      builderPath={aperturesBuilderPath(project.id)}
                      canEdit={canEdit}
                    />
                  )
                ) : null}
                {isProductReportRoute ? (
                  <section
                    className="apertures-placeholder-panel"
                    aria-label={isGlazingsRoute ? "Glazings" : "Frames"}
                  >
                    {specReportQuery.isLoading ? (
                      <p>Loading {isGlazingsRoute ? "glazings" : "frames"}...</p>
                    ) : null}
                    {specReportQuery.isError || !specReportQuery.data ? (
                      specReportQuery.isLoading ? null : (
                        <p role="alert">
                          {errorMessage(
                            specReportQuery.error,
                            "Could not load aperture specifications.",
                          )}
                        </p>
                      )
                    ) : isGlazingsRoute ? (
                      <GlazingsPanel
                        glazings={specReportQuery.data.project_glazings}
                        projectId={project.id}
                        isViewer={isViewer}
                        canEdit={canEdit}
                        busy={reportBusy}
                        driftEntries={driftEntries}
                        onCommand={(command) => void applyProductCommand(command)}
                        onAttachmentChange={(change) => applyReportAttachmentChange(change)}
                        onRefreshEntry={setRefreshEntry}
                      />
                    ) : (
                      <FramesPanel
                        frames={specReportQuery.data.project_frames}
                        projectId={project.id}
                        isViewer={isViewer}
                        canEdit={canEdit}
                        busy={reportBusy}
                        driftEntries={driftEntries}
                        onCommand={(command) => void applyProductCommand(command)}
                        onAttachmentChange={(change) => applyReportAttachmentChange(change)}
                        onRefreshEntry={setRefreshEntry}
                      />
                    )}
                  </section>
                ) : null}
                {isBuilderRoute ? (
                  <div
                    className={
                      sidebarCollapsed
                        ? "apertures-page__body is-sidebar-collapsed"
                        : "apertures-page__body"
                    }
                  >
                    <ApertureSidebar
                      projectId={project.id}
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
                      {activeAperture ? (
                        <>
                          <AperturesHeader
                            activeAperture={activeAperture}
                            apertures={sorted}
                            uValue={activeUValue}
                            loading={uValueQuery.isLoading}
                            canEdit={canEdit}
                            busy={mutation.isPending}
                            actions={apertureActions}
                            onRename={(newName) => {
                              void dispatch({
                                kind: "renameApertureType",
                                aperture_type_id: activeAperture.id,
                                new_name: newName,
                              });
                            }}
                          />
                          <BuilderDriftBanner apertureTypeId={activeAperture.id} />
                          <ApertureCanvasContainer
                            aperture={activeAperture}
                            canEdit={canEdit}
                            commandBusy={mutation.isPending}
                            commandError={actionError}
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
                            onSetElementKind={(element_ids, element_kind) =>
                              dispatch({
                                kind: "setElementKind",
                                aperture_type_id: activeAperture.id,
                                element_ids,
                                element_kind,
                              }).then((result) => result !== null)
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
                            onFlipLeftRight={() =>
                              void dispatch({
                                kind: "flipLeftRight",
                                aperture_type_id: activeAperture.id,
                              })
                            }
                            onPasteAssignment={(source_element_id, target_element_ids) =>
                              dispatch({
                                kind: "pasteAssignment",
                                aperture_type_id: activeAperture.id,
                                source_element_id,
                                target_element_ids,
                              }).then((result) => result !== null)
                            }
                            onRestoreAssignment={(target_element_id, restore_assignment) =>
                              dispatch({
                                kind: "pasteAssignment",
                                aperture_type_id: activeAperture.id,
                                source_element_id: target_element_id,
                                target_element_ids: [target_element_id],
                                restore_assignment,
                              }).then((result) => result !== null)
                            }
                            uValueByElementId={elementUValueById}
                            dimFormat={dimFormat}
                          />
                        </>
                      ) : (
                        <ApertureEmptyState canEdit={canEdit} onAdd={() => void handleAdd()} />
                      )}
                    </main>
                  </div>
                ) : null}
              </div>
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
        </FramePickerFilterProvider>
      </InstallTypesProvider>
    </ManufacturerFilterProvider>
  );
}
