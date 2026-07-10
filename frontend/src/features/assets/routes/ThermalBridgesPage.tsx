import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ProjectDetail } from "../../projects/types";
import { tableFieldDefsToFieldDefs, type ViewState } from "../../../shared/ui/data-table";
import {
  SliceTableShell,
  customFieldActionsForController,
  useSliceTableController,
} from "../../../shared/ui/data-table/feature";
import type { SlicePayloadBuilders } from "../../../shared/ui/data-table/feature";
import { generatedId } from "../../../shared/lib/ids";
import { ThermalBridgesTable } from "../thermal-bridges/ThermalBridgesTable";
import {
  THERMAL_BRIDGE_BUILT_IN_FIELD_DEFS,
  THERMAL_BRIDGE_CONFLICT_MESSAGES,
  THERMAL_BRIDGE_ID_PREFIX,
  thermalBridgesFieldOverlay,
  thermalBridgesTableColumnsForSanitize,
} from "../thermal-bridges/constants";
import {
  makeBuildEmptyThermalBridgeRow,
  replaceThermalBridgeOptionsPayload,
  thermalBridgesPayloadFromCellWrites,
  thermalBridgesPayloadFromRowDelete,
  thermalBridgesPayloadFromRowDuplicate,
  thermalBridgesPayloadFromRowInsert,
  validateThermalBridgesPayload,
} from "../thermal-bridges/payloads";
import {
  useReplaceThermalBridgesSliceMutation,
  useThermalBridgesSchemaMutation,
  useThermalBridgesSliceQuery,
} from "../../equipment/hooks";
import { wasLocalDraftTouched } from "../../equipment/lib";
import {
  THERMAL_BRIDGES_TABLE_NAME,
  THERMAL_BRIDGE_TYPE_OPTION_KEY,
  type ThermalBridgeOptionKey,
  type ThermalBridgeRow,
  type ThermalBridgesReplacePayload,
  type ThermalBridgesSlice,
} from "../../equipment/types";

export function ThermalBridgesPage({ project }: { project: ProjectDetail }) {
  const [searchParams] = useSearchParams();
  const focusRowId = searchParams.get("focus");
  const thermalBridgesQuery = useThermalBridgesSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );

  if (thermalBridgesQuery.isLoading) {
    return (
      <section className="tab-panel equipment-panel" aria-label="Thermal Bridges">
        <p>Loading thermal bridges...</p>
      </section>
    );
  }

  if (thermalBridgesQuery.isError || !thermalBridgesQuery.data) {
    return (
      <section className="tab-panel equipment-panel" aria-label="Thermal Bridges">
        <p className="form-error">
          {thermalBridgesQuery.error instanceof Error
            ? thermalBridgesQuery.error.message
            : "Could not load thermal bridges."}
        </p>
      </section>
    );
  }

  return (
    <ThermalBridgesPageBody
      project={project}
      slice={thermalBridgesQuery.data}
      refetch={thermalBridgesQuery.refetch}
      focusRowId={focusRowId}
    />
  );
}

function ThermalBridgesPageBody({
  project,
  slice,
  refetch,
  focusRowId,
}: {
  project: ProjectDetail;
  slice: ThermalBridgesSlice;
  refetch: () => Promise<unknown>;
  focusRowId: string | null;
}) {
  const activeVersionId = project.active_version_id;
  const fieldRenderOverlay = useMemo(() => thermalBridgesFieldOverlay(slice), [slice]);
  const fieldDefs = useMemo(
    () => slice.field_defs ?? THERMAL_BRIDGE_BUILT_IN_FIELD_DEFS,
    [slice.field_defs],
  );
  const previewFieldDefs = useMemo(
    () =>
      tableFieldDefsToFieldDefs({
        tableKey: THERMAL_BRIDGES_TABLE_NAME,
        fieldDefs,
        fieldOverlay: fieldRenderOverlay,
        singleSelectOptions: slice.single_select_options,
      }),
    [fieldDefs, fieldRenderOverlay, slice.single_select_options],
  );
  const columnsForSanitize = useMemo(
    () => thermalBridgesTableColumnsForSanitize(previewFieldDefs),
    [previewFieldDefs],
  );
  const buildEmptyRow = useMemo(() => makeBuildEmptyThermalBridgeRow(), []);
  const replaceMutation = useReplaceThermalBridgesSliceMutation(project.id, activeVersionId);
  const schemaMutation = useThermalBridgesSchemaMutation(project.id, activeVersionId);
  const controller = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: THERMAL_BRIDGES_TABLE_NAME,
    slice,
    fieldDefs,
    fieldOverlay: fieldRenderOverlay,
    singleSelectOptions: slice.single_select_options,
    columnsForSanitize,
    payloadBuilders: thermalBridgesPayloadBuilders,
    conflictMessages: THERMAL_BRIDGE_CONFLICT_MESSAGES,
    buildEmptyRow,
    activeRow: null,
    replaceMutation,
    schemaMutation,
    refetch,
  });

  const reloadDraft = async () => {
    await controller.reloadDraft();
  };

  return (
    <SliceTableShell
      ariaLabel="Thermal Bridges"
      className="tab-panel equipment-panel"
      showDraftRestoredBanner={
        slice.source === "draft" &&
        Boolean(activeVersionId) &&
        !wasLocalDraftTouched(project.id, activeVersionId!, slice.draft_etag)
      }
      draftRestoredMessage="Thermal Bridges draft restored"
      isLocked={controller.isLocked}
      lockedMessage={THERMAL_BRIDGE_CONFLICT_MESSAGES.versionLocked}
      editBlocker={controller.editBlocker}
      onReloadDraft={() => void reloadDraft()}
      actionError={controller.actionError}
    >
      {controller.viewLoading ? (
        <p className="form-note">Loading table view...</p>
      ) : (
        <ThermalBridgesTable
          slice={slice}
          focusRowId={focusRowId}
          tableSchema={controller.tableSchema}
          isEditor={controller.canEdit}
          projectId={project.id}
          view={controller.view as ViewState}
          onViewChange={controller.onViewChange}
          onResetView={controller.onResetView}
          onWrite={controller.onWrite}
          buildEmptyRow={controller.canEdit ? buildEmptyRow : undefined}
          generateRowId={
            controller.canEdit ? () => generatedId(THERMAL_BRIDGE_ID_PREFIX) : undefined
          }
          sessionKey={`${project.id}:${activeVersionId ?? "none"}:${THERMAL_BRIDGES_TABLE_NAME}`}
          {...customFieldActionsForController(controller)}
          footerAction={addRowButton(
            "Add thermal bridge",
            controller.canEdit,
            () =>
              void controller.onWrite({
                kind: "rowInsert",
                rows: [
                  {
                    rowId: generatedId(THERMAL_BRIDGE_ID_PREFIX),
                    anchorRowId: null,
                    fieldDefaults: {},
                  },
                ],
              }),
          )}
        />
      )}
    </SliceTableShell>
  );
}

const thermalBridgesPayloadBuilders: SlicePayloadBuilders<
  ThermalBridgesSlice,
  ThermalBridgeRow,
  ThermalBridgesReplacePayload
> = {
  rows: (slice) => slice.thermal_bridges,
  fromCellWrites(slice, writes, newOptions, removedOptions) {
    return thermalBridgesPayloadFromCellWrites(slice, writes, newOptions, removedOptions);
  },
  fromRowInsert(slice, rows, build) {
    return thermalBridgesPayloadFromRowInsert(slice, rows, build);
  },
  fromRowDelete(slice, rows) {
    return thermalBridgesPayloadFromRowDelete(slice, rows);
  },
  fromRowDuplicate(slice, rows) {
    return thermalBridgesPayloadFromRowDuplicate(slice, rows);
  },
  validate(payload) {
    return validateThermalBridgesPayload(payload);
  },
  replaceOptions(slice, optionKey, options, replacements) {
    return replaceThermalBridgeOptionsPayload(
      slice,
      optionKey as ThermalBridgeOptionKey,
      options,
      replacements,
    );
  },
  isLegacyOptionKey(key) {
    return key === THERMAL_BRIDGE_TYPE_OPTION_KEY;
  },
};

function addRowButton(label: string, enabled: boolean, onClick: () => void) {
  if (!enabled) return null;
  return (
    <button
      type="button"
      className="data-table-add-row-button"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      +
    </button>
  );
}
