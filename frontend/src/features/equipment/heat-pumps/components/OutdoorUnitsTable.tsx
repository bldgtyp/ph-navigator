import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "../../../../shared/api/client";
import { errorMessage } from "../../../../shared/lib/errors";
import {
  buildLinkedRecordOps,
  DataTable,
  emptyViewState,
  type LinkedRecordCellOps,
  type ViewState,
  type WriteOp,
} from "../../../../shared/ui/data-table";
import { useAssetUrls } from "../../../assets/hooks";
import { ventilatorsSliceFeature } from "../../api";
import type { VentilatorRow } from "../../types";
import {
  heatPumpsQueryKeys,
  previewHeatPumpDelete,
  useHeatPumpOptionMutation,
  useHeatPumpPatchMutation,
} from "../api";
import {
  buildEmptyOutdoorEquipRow,
  buildEmptyOutdoorUnitRow,
  buildNewHeatPumpOption,
  sortedIndoorUnits,
  sortedOutdoorUnits,
  uniqueTagForAdd,
} from "../lib";
import {
  outdoorUnitColumnDefs,
  outdoorUnitDefaultHiddenColumns,
  outdoorUnitFieldDefs,
} from "../outdoor-unit-columns";
import { HEAT_PUMP_LINK_TARGETS, indoorUnitIdsByOutdoorUnit } from "../link-fields";
import type {
  CascadeReference,
  HeatPumpIndoorUnitRow,
  HeatPumpOutdoorEquipRow,
  HeatPumpOutdoorUnitRow,
  HeatPumpOwnedOptionKey,
  HeatPumpsSlice,
} from "../types";
import { OutdoorEquipRowModal } from "./OutdoorEquipRowModal";
import { IndoorUnitRowModal } from "./IndoorUnitRowModal";
import { OutdoorUnitRowModal } from "./OutdoorUnitRowModal";
import { BlockedDeleteDialog, CascadePreviewDialog } from "./CascadePreviewDialog";

type ModalState =
  | { kind: "unit"; mode: "add" | "edit"; row: HeatPumpOutdoorUnitRow }
  | { kind: "indoor-unit"; row: HeatPumpIndoorUnitRow }
  | { kind: "equip-create"; row: HeatPumpOutdoorEquipRow; selectForUnitId: string }
  | null;

type DeleteState = {
  kind: "preview";
  row: HeatPumpOutdoorUnitRow;
  affected: CascadeReference[];
} | null;

export function OutdoorUnitsTable({
  projectId,
  slice,
  isEditor,
  versionLocked,
}: {
  projectId: string;
  slice: HeatPumpsSlice;
  isEditor: boolean;
  versionLocked: boolean;
}) {
  const [view, setView] = useState<ViewState>(() => ({
    ...emptyViewState(),
    sort: [{ fieldKey: "tag", direction: "asc" }],
    hiddenColumns: outdoorUnitDefaultHiddenColumns,
  }));
  const [modal, setModal] = useState<ModalState>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [blockedDialog, setBlockedDialog] = useState<{
    message: string;
    affected: CascadeReference[];
  } | null>(null);
  const patchMutation = useHeatPumpPatchMutation(projectId);
  const optionMutation = useHeatPumpOptionMutation(projectId);
  const queryClient = useQueryClient();
  const accessMode = isEditor ? "editor" : "viewer";
  const indoorUnitModalOpen = modal?.kind === "indoor-unit";
  const ventilatorsQuery = ventilatorsSliceFeature.useSliceQuery(
    projectId,
    slice.version_id,
    accessMode,
    indoorUnitModalOpen,
  );
  const ventilators: VentilatorRow[] = ventilatorsQuery.data?.ventilators ?? [];
  const rows = useMemo(() => sortedOutdoorUnits(slice.outdoor_units), [slice.outdoor_units]);
  const indoorUnits = useMemo(() => sortedIndoorUnits(slice.indoor_units), [slice.indoor_units]);
  const incomingIndoorUnitIdsByRowId = useMemo(
    () => indoorUnitIdsByOutdoorUnit(indoorUnits),
    [indoorUnits],
  );
  const assetIds = useMemo(
    () => Array.from(new Set(rows.flatMap((row) => row.datasheet_asset_ids))),
    [rows],
  );
  const assetUrls = useAssetUrls(projectId, assetIds);
  const assetUrlById = useMemo(
    () => new Map((assetUrls.data ?? []).map((item) => [item.asset_id, item])),
    [assetUrls.data],
  );
  const readOnly = !isEditor || versionLocked;
  const noEquip = slice.outdoor_equip.length === 0;
  const openIndoorUnitLink = useCallback(
    (unitId: string) => {
      const row = slice.indoor_units.find((candidate) => candidate.id === unitId);
      if (row) setModal({ kind: "indoor-unit", row });
    },
    [slice.indoor_units],
  );
  const fieldDefs = useMemo(
    () =>
      outdoorUnitFieldDefs({
        options: slice.single_select_options,
        outdoorEquip: slice.outdoor_equip,
      }),
    [slice.single_select_options, slice.outdoor_equip],
  );
  const linkedRecordOps = useMemo<ReadonlyMap<string, LinkedRecordCellOps>>(
    () =>
      buildLinkedRecordOps<HeatPumpIndoorUnitRow>({
        fieldDefs,
        targetTablePath: HEAT_PUMP_LINK_TARGETS.indoorUnits,
        targetRows: indoorUnits,
        getRowId: (unit) => unit.id,
        getRecordId: (unit) => unit.tag || unit.id,
        onPillClick: openIndoorUnitLink,
      }),
    [fieldDefs, indoorUnits, openIndoorUnitLink],
  );
  const columns = outdoorUnitColumnDefs({
    projectId,
    isEditor: !readOnly,
    assetUrlById,
    onDatasheetChange: (row, next) => replaceUnit({ ...row, datasheet_asset_ids: next }),
    indoorUnits,
    incomingIndoorUnitIdsByRowId,
  });

  // OutdoorEquipRowModal opens here for paired equipment and still gets a
  // createOption callback for the manufacturer/system_family/refrigerant lists.
  async function createOption(optionKey: HeatPumpOwnedOptionKey, label: string): Promise<string> {
    const existing = slice.single_select_options[optionKey] ?? [];
    const newOption = buildNewHeatPumpOption(label, existing);
    await optionMutation.mutateAsync({
      current: slice,
      optionKey,
      patch: { op: "add", option: newOption },
    });
    return newOption.id;
  }

  async function addUnit(row: HeatPumpOutdoorUnitRow) {
    const tag = uniqueTagForAdd(row.tag, slice.outdoor_units);
    await patchMutation.mutateAsync({
      current: slice,
      table: "outdoor-units",
      patch: { op: "add", path: "/-", value: { ...row, tag } },
    });
    setModal(null);
  }

  async function replaceUnit(row: HeatPumpOutdoorUnitRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "outdoor-units",
      patch: { op: "replace", path: `/${row.id}`, value: row },
    });
    setModal(null);
  }

  async function replaceIndoorUnit(row: HeatPumpIndoorUnitRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "indoor-units",
      patch: { op: "replace", path: `/${row.id}`, value: row },
    });
    setModal(null);
  }

  async function addOutdoorEquipAndSelect(equip: HeatPumpOutdoorEquipRow, unitId: string) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "outdoor-equip",
      patch: { op: "add", path: "/-", value: equip },
    });
    const unit = slice.outdoor_units.find((candidate) => candidate.id === unitId);
    setModal({
      kind: "unit",
      mode: unit ? "edit" : "add",
      row: unit
        ? { ...unit, outdoor_equip_id: equip.id }
        : buildEmptyOutdoorUnitRow({ id: unitId, outdoor_equip_id: equip.id }),
    });
  }

  async function startDelete(row: HeatPumpOutdoorUnitRow) {
    setModal(null);
    try {
      const preview = await previewHeatPumpDelete(projectId, slice, "outdoor-units", row.id);
      if (preview.affected.length === 0) {
        await patchMutation.mutateAsync({
          current: slice,
          table: "outdoor-units",
          patch: { op: "remove", path: `/${row.id}` },
        });
        return;
      }
      setDeleteState({ kind: "preview", row, affected: preview.affected });
    } catch (err) {
      setBlockedDialog({
        message: errorMessage(err, "Could not delete outdoor unit."),
        affected: [],
      });
    }
  }

  async function confirmDelete(row: HeatPumpOutdoorUnitRow) {
    // Re-read the slice from cache so the etag/draft_etag headers reflect any
    // mutation that landed while the confirmation dialog was open.
    const current =
      queryClient.getQueryData<HeatPumpsSlice>(heatPumpsQueryKeys.slice(projectId, "editor")) ??
      slice;
    try {
      await patchMutation.mutateAsync({
        current,
        table: "outdoor-units",
        patch: { op: "remove", path: `/${row.id}` },
      });
      setDeleteState(null);
    } catch (err) {
      setDeleteState(null);
      handleDeleteError(err);
    }
  }

  function handleDeleteError(err: unknown) {
    if (err instanceof ApiRequestError && err.status === 409) {
      const referenced = (err.details.referenced_by as CascadeReference[] | undefined) ?? [];
      setBlockedDialog({ message: err.message, affected: referenced });
    } else {
      setBlockedDialog({
        message: errorMessage(err, "Could not delete outdoor unit."),
        affected: [],
      });
    }
  }

  async function handleWrite(op: WriteOp) {
    if (readOnly) return;
    if (op.kind === "cell" || op.kind === "fill") {
      for (const write of op.writes) {
        const row = slice.outdoor_units.find((candidate) => candidate.id === write.rowId);
        if (!row) continue;
        const nextValue = write.value === "" ? null : write.value;
        await replaceUnit({ ...row, [write.fieldKey]: nextValue } as HeatPumpOutdoorUnitRow);
      }
      return;
    }
    if (op.kind === "rowDelete") {
      for (const deleted of op.rows) {
        const row = slice.outdoor_units.find((candidate) => candidate.id === deleted.rowId);
        if (row) await startDelete(row);
      }
      return;
    }
    if (op.kind === "rowInsert") {
      if (noEquip) return;
      for (const inserted of op.rows) {
        await addUnit(
          buildEmptyOutdoorUnitRow({
            id: inserted.rowId,
            tag: String(inserted.fieldDefaults.tag ?? "HP"),
            outdoor_equip_id: slice.outdoor_equip[0]?.id ?? "",
          }),
        );
      }
    }
  }

  return (
    <>
      <DataTable
        rows={rows}
        getRowId={(row) => row.id}
        fieldDefs={fieldDefs}
        columnDefs={columns}
        view={view}
        onViewChange={setView}
        onWrite={handleWrite}
        readOnly={readOnly}
        linkedRecordOps={linkedRecordOps}
        emptyMessage={
          noEquip
            ? "No outdoor units yet. Add an outdoor equipment row first under Equipment — Outdoor."
            : "No outdoor units yet."
        }
        onRowOpen={(row) => setModal({ kind: "unit", mode: "edit", row })}
        sessionKey={`${projectId}:heat-pumps:outdoor-units:${slice.version_id}`}
        generateRowId={() => buildEmptyOutdoorUnitRow().id}
        footerAction={
          readOnly ? null : (
            <button
              type="button"
              className="data-table-add-row-button"
              aria-label="Add outdoor unit"
              title={
                noEquip
                  ? "Add an outdoor equipment row first under Equipment — Outdoor"
                  : "Add outdoor unit"
              }
              disabled={noEquip}
              onClick={() =>
                setModal({
                  kind: "unit",
                  mode: "add",
                  row: buildEmptyOutdoorUnitRow({
                    outdoor_equip_id: slice.outdoor_equip[0]?.id ?? "",
                  }),
                })
              }
            >
              +
            </button>
          )
        }
      />
      {modal?.kind === "unit" ? (
        <OutdoorUnitRowModal
          mode={modal.mode}
          row={modal.row}
          outdoorEquip={slice.outdoor_equip}
          existingUnits={slice.outdoor_units}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={modal.mode === "add" ? addUnit : replaceUnit}
          onDelete={modal.mode === "edit" ? () => void startDelete(modal.row) : undefined}
          onCreateOutdoorEquip={() =>
            setModal({
              kind: "equip-create",
              row: buildEmptyOutdoorEquipRow(),
              selectForUnitId: modal.row.id,
            })
          }
        />
      ) : null}
      {modal?.kind === "indoor-unit" ? (
        <IndoorUnitRowModal
          mode="edit"
          row={modal.row}
          indoorEquip={slice.indoor_equip}
          outdoorUnits={slice.outdoor_units}
          ventilators={ventilators}
          existingUnits={slice.indoor_units}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={replaceIndoorUnit}
        />
      ) : null}
      {modal?.kind === "equip-create" ? (
        <OutdoorEquipRowModal
          mode="add"
          row={modal.row}
          indoorEquip={slice.indoor_equip}
          options={slice.single_select_options}
          readOnly={false}
          onCancel={() => setModal(null)}
          onSubmit={(equip) => addOutdoorEquipAndSelect(equip, modal.selectForUnitId)}
          onCreateIndoorEquip={() => undefined}
          onCreateOption={createOption}
        />
      ) : null}
      {deleteState?.kind === "preview" ? (
        <CascadePreviewDialog
          title={`Delete outdoor unit ${deleteState.row.tag || ""}?`}
          description={`This will clear the outdoor link on ${deleteState.affected.length} indoor unit(s):`}
          affected={deleteState.affected}
          confirmLabel="Delete and clear links"
          isConfirming={patchMutation.isPending}
          onCancel={() => setDeleteState(null)}
          onConfirm={() => void confirmDelete(deleteState.row)}
        />
      ) : null}
      {blockedDialog ? (
        <BlockedDeleteDialog
          title="Cannot delete"
          message={blockedDialog.message}
          affected={blockedDialog.affected}
          onClose={() => setBlockedDialog(null)}
        />
      ) : null}
    </>
  );
}
