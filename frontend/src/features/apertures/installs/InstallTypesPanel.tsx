// The Installs sub-tab body: the aperture_install_types DataTable page —
// the ThermalBridgesPage recipe embedded in the Apertures tab. Affordances
// are parent-owned via useSliceTableController + SliceTableShell
// (DataTable iron law).
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { ProjectDetail } from "../../projects/types";
import {
  addRowButton,
  tableFieldDefsToFieldDefs,
  type ViewState,
} from "../../../shared/ui/data-table";
import {
  SliceTableShell,
  customFieldActionsForController,
  useSliceTableController,
} from "../../../shared/ui/data-table/feature";
import type { SlicePayloadBuilders } from "../../../shared/ui/data-table/feature";
import { generatedId } from "../../../shared/lib/ids";
import { wasLocalDraftTouched } from "../../equipment/lib";
import { InstallTypesTable } from "./InstallTypesTable";
import { fieldDefsToSanitizeColumns } from "../../../shared/ui/data-table/lib";
import {
  INSTALL_TYPE_CONFLICT_MESSAGES,
  INSTALL_TYPE_ID_PREFIX,
  installTypesFieldOverlay,
} from "./constants";
import {
  makeBuildEmptyInstallTypeRow,
  replaceInstallTypeOptionsPayload,
  installTypesPayloadFromCellWrites,
  installTypesPayloadFromRowDelete,
  installTypesPayloadFromRowDuplicate,
  installTypesPayloadFromRowInsert,
  validateInstallTypesPayload,
} from "./payloads";
import {
  useInstallTypesSchemaMutation,
  useInstallTypesSliceQuery,
  useReplaceInstallTypesSliceMutation,
} from "./api";
import {
  APERTURE_INSTALL_SOURCE_OPTION_KEY,
  APERTURE_INSTALL_TYPES_TABLE_NAME,
  type InstallTypeOptionKey,
  type InstallTypeRow,
  type InstallTypesReplacePayload,
  type InstallTypesSlice,
} from "./types";

export function InstallTypesPanel({ project }: { project: ProjectDetail }) {
  const [searchParams] = useSearchParams();
  const focusRowId = searchParams.get("focus");
  const installTypesQuery = useInstallTypesSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );

  if (installTypesQuery.isLoading) {
    return (
      <section className="tab-panel equipment-panel" aria-label="Installs">
        <p>Loading install types...</p>
      </section>
    );
  }

  if (installTypesQuery.isError || !installTypesQuery.data) {
    return (
      <section className="tab-panel equipment-panel" aria-label="Installs">
        <p className="form-error">
          {installTypesQuery.error instanceof Error
            ? installTypesQuery.error.message
            : "Could not load install types."}
        </p>
      </section>
    );
  }

  return (
    <InstallTypesPanelBody
      project={project}
      slice={installTypesQuery.data}
      refetch={installTypesQuery.refetch}
      focusRowId={focusRowId}
    />
  );
}

function InstallTypesPanelBody({
  project,
  slice,
  refetch,
  focusRowId,
}: {
  project: ProjectDetail;
  slice: InstallTypesSlice;
  refetch: () => Promise<unknown>;
  focusRowId: string | null;
}) {
  const activeVersionId = project.active_version_id;
  const fieldRenderOverlay = useMemo(() => installTypesFieldOverlay(slice), [slice]);
  const fieldDefs = slice.field_defs;
  const previewFieldDefs = useMemo(
    () =>
      tableFieldDefsToFieldDefs({
        tableKey: APERTURE_INSTALL_TYPES_TABLE_NAME,
        fieldDefs,
        fieldOverlay: fieldRenderOverlay,
        singleSelectOptions: slice.single_select_options,
      }),
    [fieldDefs, fieldRenderOverlay, slice.single_select_options],
  );
  const columnsForSanitize = useMemo(
    () => fieldDefsToSanitizeColumns(previewFieldDefs),
    [previewFieldDefs],
  );
  const buildEmptyRow = useMemo(() => makeBuildEmptyInstallTypeRow(), []);
  const replaceMutation = useReplaceInstallTypesSliceMutation(project.id, activeVersionId);
  const schemaMutation = useInstallTypesSchemaMutation(project.id, activeVersionId);
  const controller = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: APERTURE_INSTALL_TYPES_TABLE_NAME,
    slice,
    fieldDefs,
    fieldOverlay: fieldRenderOverlay,
    singleSelectOptions: slice.single_select_options,
    columnsForSanitize,
    payloadBuilders: installTypesPayloadBuilders,
    conflictMessages: INSTALL_TYPE_CONFLICT_MESSAGES,
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
      ariaLabel="Installs"
      className="tab-panel equipment-panel"
      showDraftRestoredBanner={
        slice.source === "draft" &&
        Boolean(activeVersionId) &&
        !wasLocalDraftTouched(project.id, activeVersionId!, slice.draft_etag)
      }
      draftRestoredMessage="Installs draft restored"
      isLocked={controller.isLocked}
      lockedMessage={INSTALL_TYPE_CONFLICT_MESSAGES.versionLocked}
      editBlocker={controller.editBlocker}
      onReloadDraft={() => void reloadDraft()}
      actionError={controller.actionError}
    >
      {controller.viewLoading ? (
        <p className="form-note">Loading table view...</p>
      ) : (
        <InstallTypesTable
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
          generateRowId={controller.canEdit ? () => generatedId(INSTALL_TYPE_ID_PREFIX) : undefined}
          sessionKey={`${project.id}:${activeVersionId ?? "none"}:${APERTURE_INSTALL_TYPES_TABLE_NAME}`}
          {...customFieldActionsForController(controller)}
          footerAction={addRowButton(
            "Add install type",
            controller.canEdit,
            () =>
              void controller.onWrite({
                kind: "rowInsert",
                rows: [
                  {
                    rowId: generatedId(INSTALL_TYPE_ID_PREFIX),
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

const installTypesPayloadBuilders: SlicePayloadBuilders<
  InstallTypesSlice,
  InstallTypeRow,
  InstallTypesReplacePayload
> = {
  rows: (slice) => slice.aperture_install_types,
  fromCellWrites(slice, writes, newOptions, removedOptions) {
    return installTypesPayloadFromCellWrites(slice, writes, newOptions, removedOptions);
  },
  fromRowInsert(slice, rows, build) {
    return installTypesPayloadFromRowInsert(slice, rows, build);
  },
  fromRowDelete(slice, rows) {
    return installTypesPayloadFromRowDelete(slice, rows);
  },
  fromRowDuplicate(slice, rows) {
    return installTypesPayloadFromRowDuplicate(slice, rows);
  },
  validate(payload) {
    return validateInstallTypesPayload(payload);
  },
  replaceOptions(slice, optionKey, options, replacements) {
    return replaceInstallTypeOptionsPayload(
      slice,
      optionKey as InstallTypeOptionKey,
      options,
      replacements,
    );
  },
  isLegacyOptionKey(key) {
    return key === APERTURE_INSTALL_SOURCE_OPTION_KEY;
  },
};
