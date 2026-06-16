import { useCallback, useMemo, useState } from "react";
import { ApiRequestError } from "../../../../shared/api/client";
import { errorMessage } from "../../../../shared/lib/errors";
import {
  buildLinkedRecordOps,
  DataTable,
  type LinkedRecordCellOps,
  type WriteOp,
} from "../../../../shared/ui/data-table";
import { useAssetUrls } from "../../../assets/hooks";
import { roomsSliceFeature, ventilatorsSliceFeature } from "../../api";
import { LinkedRoomDialogHost } from "../../components/LinkedRoomDialogHost";
import type { RoomRow, VentilatorRow } from "../../types";
import { useHeatPumpOptionMutation, useHeatPumpPatchMutation } from "../api";
import {
  buildEmptyIndoorEquipRow,
  buildEmptyIndoorUnitRow,
  buildNewHeatPumpOption,
  indoorEquipLabel,
  outdoorUnitLabel,
  roomLabel,
  sortedIndoorUnits,
  uniqueTagForAdd,
} from "../lib";
import { firstLinkedId, HEAT_PUMP_LINK_TARGETS, linkedIds } from "../link-fields";
import {
  indoorUnitColumnDefs,
  indoorUnitDefaultHiddenColumns,
  indoorUnitFieldDefs,
} from "../indoor-unit-columns";
import {
  HEAT_PUMP_INDOOR_UNITS_TABLE_NAME,
  HEAT_PUMP_OPTION_KEYS,
  type CascadeReference,
  type HeatPumpIndoorEquipRow,
  type HeatPumpIndoorUnitRow,
  type HeatPumpOutdoorUnitRow,
  type HeatPumpOwnedOptionKey,
  type HeatPumpsSlice,
} from "../types";
import { useHeatPumpTableViewState } from "../useHeatPumpTableViewState";
import { IndoorEquipRowModal } from "./IndoorEquipRowModal";
import { IndoorUnitRowModal } from "./IndoorUnitRowModal";
import { OutdoorUnitRowModal } from "./OutdoorUnitRowModal";
import { BlockedDeleteDialog } from "./CascadePreviewDialog";

type ModalState =
  | { kind: "unit"; mode: "add" | "edit"; row: HeatPumpIndoorUnitRow }
  | { kind: "indoor-equip"; row: HeatPumpIndoorEquipRow }
  | { kind: "outdoor-unit"; row: HeatPumpOutdoorUnitRow }
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
  const [modal, setModal] = useState<ModalState>(null);
  const [blockedDialog, setBlockedDialog] = useState<{
    message: string;
    affected: CascadeReference[];
  } | null>(null);
  const [linkedRoomId, setLinkedRoomId] = useState<string | null>(null);
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
  const rooms: RoomRow[] = useMemo(() => roomsQuery.data?.rooms ?? [], [roomsQuery.data?.rooms]);
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
    rooms,
    assetUrlById,
    onDatasheetChange: (row, next) => replaceUnit({ ...row, datasheet_asset_ids: next }),
  });
  const fieldDefs = useMemo(() => indoorUnitFieldDefs(), []);
  const tableView = useHeatPumpTableViewState({
    projectId,
    tableKey: HEAT_PUMP_INDOOR_UNITS_TABLE_NAME,
    isEditor,
    columns,
    fieldDefs,
    sort: [{ fieldKey: "tag", direction: "asc" }],
    hiddenColumns: indoorUnitDefaultHiddenColumns,
  });
  const openIndoorEquipLink = useCallback(
    (rowId: string) => {
      const row = slice.indoor_equip.find((candidate) => candidate.id === rowId);
      if (row) setModal({ kind: "indoor-equip", row });
    },
    [slice.indoor_equip],
  );
  const openOutdoorUnitLink = useCallback(
    (rowId: string) => {
      const row = slice.outdoor_units.find((candidate) => candidate.id === rowId);
      if (row) setModal({ kind: "outdoor-unit", row });
    },
    [slice.outdoor_units],
  );
  const linkedRecordOps = useMemo<ReadonlyMap<string, LinkedRecordCellOps>>(() => {
    const manufacturerOptions =
      slice.single_select_options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
    const indoorEquipOps = buildLinkedRecordOps<HeatPumpIndoorEquipRow>({
      fieldDefs,
      targetTablePath: HEAT_PUMP_LINK_TARGETS.indoorEquip,
      targetRows: slice.indoor_equip,
      getRowId: (equip) => equip.id,
      getRecordId: (equip) => indoorEquipLabel(equip, manufacturerOptions),
      getDisplayName: (equip) => equip.model_number,
      onPillClick: openIndoorEquipLink,
    });
    const outdoorUnitOps = buildLinkedRecordOps<HeatPumpOutdoorUnitRow>({
      fieldDefs,
      targetTablePath: HEAT_PUMP_LINK_TARGETS.outdoorUnits,
      targetRows: slice.outdoor_units,
      getRowId: (unit) => unit.id,
      getRecordId: (unit) => outdoorUnitLabel(unit),
      onPillClick: openOutdoorUnitLink,
    });
    const roomOps = buildLinkedRecordOps<RoomRow>({
      fieldDefs,
      targetTablePath: ["rooms"],
      targetRows: rooms,
      getRowId: (room) => room.id,
      getRecordId: (room) => {
        const label = roomLabel(room);
        return label.length > 0 ? label : null;
      },
      // Chip click opens the standard Room modal in place. The legacy
      // /rooms?focus=...&open=1 route still exists for external deep links.
      onPillClick: setLinkedRoomId,
    });
    const next = new Map<string, LinkedRecordCellOps>([
      ...indoorEquipOps,
      ...outdoorUnitOps,
      ...roomOps,
    ]);
    if (roomsQuery.isLoading) {
      for (const [key, ops] of roomOps) {
        next.set(key, { ...ops, isLoading: true });
      }
    }
    return next;
  }, [
    fieldDefs,
    openIndoorEquipLink,
    openOutdoorUnitLink,
    rooms,
    roomsQuery.isLoading,
    slice.indoor_equip,
    slice.outdoor_units,
    slice.single_select_options,
  ]);

  // IndoorUnitRowModal does not expose inline-create for any options.
  // IndoorEquipRowModal — opened from this table for equip-create — still
  // gets a createOption for the manufacturer / model_type / install_type
  // lists owned by the heat-pumps slice.
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

  async function replaceIndoorEquip(row: HeatPumpIndoorEquipRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "indoor-equip",
      patch: { op: "replace", path: `/${row.id}`, value: row },
    });
    setModal(null);
  }

  async function replaceOutdoorUnit(row: HeatPumpOutdoorUnitRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "outdoor-units",
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
        await replaceUnit({
          ...row,
          [write.fieldKey]: indoorUnitWriteValue(write.fieldKey, write.value),
        } as HeatPumpIndoorUnitRow);
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
      {tableView.isLoading ? (
        <p className="form-note">Loading table view...</p>
      ) : (
        <DataTable
          rows={rows}
          getRowId={(row) => row.id}
          fieldDefs={fieldDefs}
          columnDefs={columns}
          view={tableView.view}
          onViewChange={tableView.onViewChange}
          onResetView={tableView.reset}
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
          linkedRecordOps={linkedRecordOps}
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
      )}
      {linkedRoomId && roomsQuery.data ? (
        <LinkedRoomDialogHost
          projectId={projectId}
          activeVersionId={slice.version_id}
          accessMode={accessMode}
          versionLocked={versionLocked}
          roomsSlice={roomsQuery.data}
          refetch={roomsQuery.refetch}
          roomId={linkedRoomId}
          onClose={() => setLinkedRoomId(null)}
        />
      ) : null}
      {modal?.kind === "unit" ? (
        <IndoorUnitRowModal
          mode={modal.mode}
          row={modal.row}
          indoorEquip={slice.indoor_equip}
          outdoorUnits={slice.outdoor_units}
          ventilators={ventilators}
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
      {modal?.kind === "indoor-equip" ? (
        <IndoorEquipRowModal
          mode="edit"
          row={modal.row}
          existingEquip={slice.indoor_equip}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={replaceIndoorEquip}
          onCreateOption={readOnly ? undefined : createOption}
        />
      ) : null}
      {modal?.kind === "outdoor-unit" ? (
        <OutdoorUnitRowModal
          mode="edit"
          row={modal.row}
          outdoorEquip={slice.outdoor_equip}
          existingUnits={slice.outdoor_units}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={replaceOutdoorUnit}
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

function indoorUnitWriteValue(fieldKey: string, value: unknown): unknown {
  if (fieldKey === "indoor_equip_id") {
    const next = firstLinkedId(value);
    if (!next) throw new Error("Indoor equipment is required.");
    return next;
  }
  if (fieldKey === "outdoor_unit_id") return firstLinkedId(value);
  if (fieldKey === "served_room_ids") return linkedIds(value);
  return value === "" ? null : value;
}
