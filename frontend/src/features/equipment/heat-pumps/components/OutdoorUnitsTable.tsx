import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "../../../../shared/api/client";
import { errorMessage } from "../../../../shared/lib/errors";
import {
  DataTable,
  emptyViewState,
  type ViewState,
  type WriteOp,
} from "../../../../shared/ui/data-table";
import { useAssetUrls } from "../../../assets/hooks";
import { heatPumpsQueryKeys, previewHeatPumpDelete, useHeatPumpPatchMutation } from "../api";
import {
  buildEmptyOutdoorEquipRow,
  buildEmptyOutdoorUnitRow,
  sortedOutdoorUnits,
  uniqueTagForAdd,
} from "../lib";
import {
  outdoorUnitColumnDefs,
  outdoorUnitDefaultHiddenColumns,
  outdoorUnitFieldDefs,
} from "../outdoor-unit-columns";
import type {
  CascadeReference,
  HeatPumpOutdoorEquipRow,
  HeatPumpOutdoorUnitRow,
  HeatPumpsSlice,
} from "../types";
import { OutdoorEquipRowModal } from "./OutdoorEquipRowModal";
import { OutdoorUnitRowModal } from "./OutdoorUnitRowModal";
import { BlockedDeleteDialog, CascadePreviewDialog } from "./CascadePreviewDialog";

type ModalState =
  | { kind: "unit"; mode: "add" | "edit"; row: HeatPumpOutdoorUnitRow }
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
  const queryClient = useQueryClient();
  const rows = useMemo(() => sortedOutdoorUnits(slice.outdoor_units), [slice.outdoor_units]);
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
  const columns = outdoorUnitColumnDefs({
    projectId,
    isEditor: !readOnly,
    outdoorEquip: slice.outdoor_equip,
    assetUrlById,
    onDatasheetChange: (row, next) => replaceUnit({ ...row, datasheet_asset_ids: next }),
  });

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
        fieldDefs={outdoorUnitFieldDefs}
        columnDefs={columns}
        view={view}
        onViewChange={setView}
        onWrite={handleWrite}
        readOnly={readOnly}
        emptyMessage={
          noEquip
            ? "No outdoor units yet. Add an outdoor equipment row first under Equipment — Outdoor."
            : "No outdoor units yet."
        }
        onRowOpen={(row) => setModal({ kind: "unit", mode: "edit", row })}
        sessionKey={`${projectId}:heat-pumps:outdoor-units:${slice.version_id}`}
        generateRowId={() => buildEmptyOutdoorUnitRow().id}
        footerAction={
          <button
            type="button"
            disabled={readOnly || noEquip}
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
            Add outdoor unit
          </button>
        }
      />
      {modal?.kind === "unit" ? (
        <OutdoorUnitRowModal
          mode={modal.mode}
          row={modal.row}
          outdoorEquip={slice.outdoor_equip}
          existingUnits={slice.outdoor_units}
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
      {modal?.kind === "equip-create" ? (
        <OutdoorEquipRowModal
          mode="add"
          row={modal.row}
          indoorEquip={slice.indoor_equip}
          readOnly={false}
          onCancel={() => setModal(null)}
          onSubmit={(equip) => addOutdoorEquipAndSelect(equip, modal.selectForUnitId)}
          onCreateIndoorEquip={() => undefined}
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
