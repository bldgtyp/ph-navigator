import { useMemo, useState } from "react";
import { ApiRequestError } from "../../../../shared/api/client";
import { errorMessage } from "../../../../shared/lib/errors";
import {
  DataTable,
  emptyViewState,
  type ViewState,
  type WriteOp,
} from "../../../../shared/ui/data-table";
import { useAssetUrls } from "../../../assets/hooks";
import { roomsSliceFeature, ventilatorsSliceFeature } from "../../api";
import type { RoomRow, VentilatorRow } from "../../types";
import { useHeatPumpOptionMutation, useHeatPumpPatchMutation } from "../api";
import {
  buildEmptyIndoorEquipRow,
  buildEmptyIndoorUnitRow,
  buildNewHeatPumpOption,
  sortedIndoorUnits,
  uniqueTagForAdd,
} from "../lib";
import {
  indoorUnitColumnDefs,
  indoorUnitDefaultHiddenColumns,
  indoorUnitFieldDefs,
} from "../indoor-unit-columns";
import type {
  CascadeReference,
  HeatPumpIndoorEquipRow,
  HeatPumpIndoorUnitRow,
  HeatPumpOwnedOptionKey,
  HeatPumpsSlice,
} from "../types";
import { IndoorEquipRowModal } from "./IndoorEquipRowModal";
import { IndoorUnitRowModal } from "./IndoorUnitRowModal";
import { BlockedDeleteDialog } from "./CascadePreviewDialog";

type ModalState =
  | { kind: "unit"; mode: "add" | "edit"; row: HeatPumpIndoorUnitRow }
  | { kind: "equip-create"; row: HeatPumpIndoorEquipRow; selectForUnitId: string }
  | null;

export function IndoorUnitsTable({
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
    hiddenColumns: indoorUnitDefaultHiddenColumns,
  }));
  const [modal, setModal] = useState<ModalState>(null);
  const [blockedDialog, setBlockedDialog] = useState<{
    message: string;
    affected: CascadeReference[];
  } | null>(null);
  const patchMutation = useHeatPumpPatchMutation(projectId);
  const optionMutation = useHeatPumpOptionMutation(projectId);
  const accessMode = isEditor ? "editor" : "viewer";
  const ventilatorsQuery = ventilatorsSliceFeature.useSliceQuery(
    projectId,
    slice.version_id,
    accessMode,
  );
  const roomsQuery = roomsSliceFeature.useSliceQuery(projectId, slice.version_id, accessMode);
  const ventilators: VentilatorRow[] = ventilatorsQuery.data?.ventilators ?? [];
  const rooms: RoomRow[] = roomsQuery.data?.rooms ?? [];
  const rows = useMemo(() => sortedIndoorUnits(slice.indoor_units), [slice.indoor_units]);
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
  const noEquip = slice.indoor_equip.length === 0;
  const columns = indoorUnitColumnDefs({
    projectId,
    isEditor: !readOnly,
    assetUrlById,
    onDatasheetChange: (row, next) => replaceUnit({ ...row, datasheet_asset_ids: next }),
  });
  const fieldDefs = useMemo(
    () =>
      indoorUnitFieldDefs({
        options: slice.single_select_options,
        indoorEquip: slice.indoor_equip,
        outdoorUnits: slice.outdoor_units,
      }),
    [slice.single_select_options, slice.indoor_equip, slice.outdoor_units],
  );

  // floor_level is rooms-owned (see HEAT_PUMP_VISIBLE_OPTION_KEYS in
  // backend/features/heat_pumps/models.py), so IndoorUnitRowModal does not
  // expose inline-create. IndoorEquipRowModal — opened from this table for
  // equip-create — still gets a createOption for the manufacturer / model_type
  // / install_type lists owned by the heat-pumps slice.
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

  async function addUnit(row: HeatPumpIndoorUnitRow) {
    const tag = uniqueTagForAdd(row.tag, slice.indoor_units);
    await patchMutation.mutateAsync({
      current: slice,
      table: "indoor-units",
      patch: { op: "add", path: "/-", value: { ...row, tag } },
    });
    setModal(null);
  }

  async function replaceUnit(row: HeatPumpIndoorUnitRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "indoor-units",
      patch: { op: "replace", path: `/${row.id}`, value: row },
    });
    setModal(null);
  }

  async function deleteUnit(row: HeatPumpIndoorUnitRow) {
    setModal(null);
    try {
      await patchMutation.mutateAsync({
        current: slice,
        table: "indoor-units",
        patch: { op: "remove", path: `/${row.id}` },
      });
    } catch (err) {
      handleDeleteError(err);
    }
  }

  async function addIndoorEquipAndSelect(equip: HeatPumpIndoorEquipRow, unitId: string) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "indoor-equip",
      patch: { op: "add", path: "/-", value: equip },
    });
    const unit = slice.indoor_units.find((candidate) => candidate.id === unitId);
    setModal({
      kind: "unit",
      mode: unit ? "edit" : "add",
      row: unit
        ? { ...unit, indoor_equip_id: equip.id }
        : buildEmptyIndoorUnitRow({ id: unitId, indoor_equip_id: equip.id }),
    });
  }

  function handleDeleteError(err: unknown) {
    if (err instanceof ApiRequestError && err.status === 409) {
      const referenced = (err.details.referenced_by as CascadeReference[] | undefined) ?? [];
      setBlockedDialog({ message: err.message, affected: referenced });
    } else {
      setBlockedDialog({
        message: errorMessage(err, "Could not delete indoor unit."),
        affected: [],
      });
    }
  }

  async function handleWrite(op: WriteOp) {
    if (readOnly) return;
    if (op.kind === "cell" || op.kind === "fill") {
      for (const write of op.writes) {
        const row = slice.indoor_units.find((candidate) => candidate.id === write.rowId);
        if (!row) continue;
        const nextValue = write.value === "" ? null : write.value;
        await replaceUnit({ ...row, [write.fieldKey]: nextValue } as HeatPumpIndoorUnitRow);
      }
      return;
    }
    if (op.kind === "rowDelete") {
      for (const deleted of op.rows) {
        const row = slice.indoor_units.find((candidate) => candidate.id === deleted.rowId);
        if (row) await deleteUnit(row);
      }
      return;
    }
    if (op.kind === "rowInsert") {
      if (noEquip) return;
      for (const inserted of op.rows) {
        await addUnit(
          buildEmptyIndoorUnitRow({
            id: inserted.rowId,
            tag: String(inserted.fieldDefaults.tag ?? "AHU"),
            indoor_equip_id: slice.indoor_equip[0]?.id ?? "",
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
        emptyMessage={
          noEquip
            ? "No indoor units yet. Add an indoor equipment row first under Equipment — Indoor."
            : "No indoor units yet."
        }
        onRowOpen={(row) => setModal({ kind: "unit", mode: "edit", row })}
        sessionKey={`${projectId}:heat-pumps:indoor-units:${slice.version_id}`}
        generateRowId={() => buildEmptyIndoorUnitRow().id}
        footerAction={
          readOnly ? null : (
            <button
              type="button"
              className="data-table-add-row-button"
              aria-label="Add indoor unit"
              title={
                noEquip
                  ? "Add an indoor equipment row first under Equipment — Indoor"
                  : "Add indoor unit"
              }
              disabled={noEquip}
              onClick={() =>
                setModal({
                  kind: "unit",
                  mode: "add",
                  row: buildEmptyIndoorUnitRow({
                    indoor_equip_id: slice.indoor_equip[0]?.id ?? "",
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
        <IndoorUnitRowModal
          mode={modal.mode}
          row={modal.row}
          indoorEquip={slice.indoor_equip}
          outdoorUnits={slice.outdoor_units}
          ventilators={ventilators}
          rooms={rooms}
          existingUnits={slice.indoor_units}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={modal.mode === "add" ? addUnit : replaceUnit}
          onDelete={modal.mode === "edit" ? () => void deleteUnit(modal.row) : undefined}
          onCreateIndoorEquip={() =>
            setModal({
              kind: "equip-create",
              row: buildEmptyIndoorEquipRow(),
              selectForUnitId: modal.row.id,
            })
          }
        />
      ) : null}
      {modal?.kind === "equip-create" ? (
        <IndoorEquipRowModal
          mode="add"
          row={modal.row}
          options={slice.single_select_options}
          readOnly={false}
          onCancel={() => setModal(null)}
          onSubmit={(equip) => addIndoorEquipAndSelect(equip, modal.selectForUnitId)}
          onCreateOption={createOption}
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
