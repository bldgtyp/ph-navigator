import "../../assets/attachments.css";
import "../equipment.css";
import { useMemo } from "react";
import { SliceTableShell, useSliceTableController } from "../../../shared/ui/data-table/feature";
import type { ProjectDetail } from "../../projects/types";
import { AttachmentTablePanel } from "../../assets/components/AttachmentTablePanel";
import { PumpsTableSlot } from "../components/PumpsTableSlot";
import { usePumpsSchemaMutation, usePumpsSliceQuery, useReplacePumpsSliceMutation } from "../hooks";
import {
  PUMPS_SCHEMA_CORE_FIELD_KEYS,
  pumpsTableColumnsForSanitize,
  pumpsTableFieldDefs,
  wasLocalDraftTouched,
} from "../lib";
import { makeBuildEmptyPumpRow } from "../lib/buildEmptyPumpRow";
import { pumpsPayloadBuilders } from "../lib/pumpsController";
import { PUMPS_TABLE_NAME, type PumpsSlice } from "../types";
import { generatedId } from "../../../shared/lib/ids";

const DATASHEET_CONFIG = {
  assetKind: "datasheet" as const,
  allowedTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  maxCount: 5,
  maxFileSizeMb: 25,
};

const PUMPS_CONFLICT_MESSAGES = {
  activeRowConflict: "The Pumps draft changed in another tab. Reload the draft before editing.",
  deleteConflict: "Could not delete pump.",
  versionLocked: "This version is locked. Save As to copy it into a new version.",
};

export function EquipmentPage({ project }: { project: ProjectDetail }) {
  const pumpsQuery = usePumpsSliceQuery(project.id, project.active_version_id, project.access_mode);
  if (pumpsQuery.isLoading) {
    return (
      <section className="tab-panel equipment-panel" aria-label="Equipment">
        <p>Loading pumps...</p>
      </section>
    );
  }
  if (pumpsQuery.isError || !pumpsQuery.data) {
    return (
      <section className="tab-panel equipment-panel" aria-label="Equipment">
        <p className="form-error" role="alert">
          Could not load Pumps.
        </p>
      </section>
    );
  }
  return (
    <EquipmentPageBody
      project={project}
      pumpsSlice={pumpsQuery.data}
      refetchPumps={pumpsQuery.refetch}
    />
  );
}

function EquipmentPageBody(props: {
  project: ProjectDetail;
  pumpsSlice: PumpsSlice;
  refetchPumps: () => Promise<unknown>;
}) {
  const { project, pumpsSlice, refetchPumps } = props;
  const activeVersionId = project.active_version_id;
  const coreFieldDefs = useMemo(() => pumpsTableFieldDefs(pumpsSlice), [pumpsSlice]);
  const columnsForSanitize = useMemo(
    () => pumpsTableColumnsForSanitize(coreFieldDefs),
    [coreFieldDefs],
  );
  const buildEmptyPumpRow = useMemo(() => makeBuildEmptyPumpRow(), []);
  const replaceMutation = useReplacePumpsSliceMutation(project.id, activeVersionId);
  const schemaMutation = usePumpsSchemaMutation(project.id, activeVersionId);

  const controller = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: PUMPS_TABLE_NAME,
    slice: pumpsSlice,
    coreFieldDefs,
    fingerprintCoreFieldKeys: PUMPS_SCHEMA_CORE_FIELD_KEYS,
    customFields: null,
    singleSelectOptions: pumpsSlice.single_select_options,
    columnsForSanitize,
    payloadBuilders: pumpsPayloadBuilders,
    conflictMessages: PUMPS_CONFLICT_MESSAGES,
    buildEmptyRow: buildEmptyPumpRow,
    activeRow: null,
    replaceMutation,
    schemaMutation,
    refetch: refetchPumps,
  });

  const reloadDraft = async () => {
    await controller.reloadDraft();
  };

  return (
    <SliceTableShell
      ariaLabel="Equipment"
      className="tab-panel equipment-panel"
      showDraftRestoredBanner={
        pumpsSlice.source === "draft" &&
        Boolean(activeVersionId) &&
        !wasLocalDraftTouched(project.id, activeVersionId!, pumpsSlice.draft_etag)
      }
      draftRestoredMessage="Unsaved Pumps draft restored"
      isLocked={controller.isLocked}
      lockedMessage={PUMPS_CONFLICT_MESSAGES.versionLocked}
      editBlocker={controller.editBlocker}
      onReloadDraft={() => void reloadDraft()}
      actionError={controller.actionError}
    >
      <PumpsTableSlot
        controller={controller}
        pumpsSlice={pumpsSlice}
        projectId={project.id}
        activeVersionId={activeVersionId}
        buildEmptyRow={buildEmptyPumpRow}
        footerAction={
          <AddPumpButton
            canEdit={controller.canEdit}
            onAdd={() =>
              void controller.onWrite({
                kind: "rowInsert",
                rows: [{ rowId: generatedId("pmp"), fieldDefaults: {}, anchorRowId: null }],
              })
            }
          />
        }
      />
      <div className="equipment-attachment-panels">
        <AttachmentTablePanel
          projectId={project.id}
          versionId={project.active_version_id}
          accessMode={project.access_mode}
          versionLocked={project.active_version?.locked ?? false}
          tableName="equipment_pumps"
          title="Pump Datasheets"
          fieldKey="datasheet_asset_ids"
          fieldLabel="Datasheet"
          config={DATASHEET_CONFIG}
        />
      </div>
    </SliceTableShell>
  );
}

function AddPumpButton({ canEdit, onAdd }: { canEdit: boolean; onAdd: () => void }) {
  return (
    <button type="button" className="primary-button" disabled={!canEdit} onClick={onAdd}>
      Add pump
    </button>
  );
}
