import { useMemo, useState } from "react";
import {
  DataTable,
  emptyViewState,
  type ViewState,
  type WriteOp,
} from "../../../../shared/ui/data-table";
import { useAssetUrls } from "../../../assets/hooks";
import { useHeatPumpPatchMutation } from "../api";
import { buildEmptyIndoorEquipRow, numericValue, sortedIndoorEquip } from "../lib";
import {
  indoorEquipColumnDefs,
  indoorEquipDefaultHiddenColumns,
  indoorEquipFieldDefs,
} from "../indoor-equip-columns";
import type { HeatPumpIndoorEquipRow, HeatPumpsSlice } from "../types";
import { IndoorEquipRowModal } from "./IndoorEquipRowModal";

type ModalState = { mode: "add" | "edit"; row: HeatPumpIndoorEquipRow } | null;

export function IndoorEquipTable({
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
    sort: [{ fieldKey: "model_number", direction: "asc" }],
    hiddenColumns: indoorEquipDefaultHiddenColumns,
  }));
  const [modal, setModal] = useState<ModalState>(null);
  const patchMutation = useHeatPumpPatchMutation(projectId);
  const rows = useMemo(() => sortedIndoorEquip(slice.indoor_equip), [slice.indoor_equip]);
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
  const columns = indoorEquipColumnDefs({
    projectId,
    isEditor: !readOnly,
    assetUrlById,
    onDatasheetChange: (row, next) => replaceIndoorRow({ ...row, datasheet_asset_ids: next }),
  });

  async function addIndoorRow(row: HeatPumpIndoorEquipRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "indoor-equip",
      patch: { op: "add", path: "/-", value: row },
    });
    setModal(null);
  }

  async function replaceIndoorRow(row: HeatPumpIndoorEquipRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "indoor-equip",
      patch: { op: "replace", path: `/${row.id}`, value: row },
    });
    setModal(null);
  }

  async function deleteIndoorRow(row: HeatPumpIndoorEquipRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "indoor-equip",
      patch: { op: "remove", path: `/${row.id}` },
    });
    setModal(null);
  }

  async function handleWrite(op: WriteOp) {
    if (readOnly) return;
    if (op.kind === "cell" || op.kind === "fill") {
      for (const write of op.writes) {
        const row = slice.indoor_equip.find((candidate) => candidate.id === write.rowId);
        if (!row) continue;
        await replaceIndoorRow({
          ...row,
          [write.fieldKey]: coerceCellValue(write.fieldKey, write.value),
        });
      }
      return;
    }
    if (op.kind === "rowDelete") {
      for (const deleted of op.rows) {
        const row = slice.indoor_equip.find((candidate) => candidate.id === deleted.rowId);
        if (row) await deleteIndoorRow(row);
      }
      return;
    }
    if (op.kind === "rowInsert") {
      for (const inserted of op.rows) {
        await addIndoorRow(
          buildEmptyIndoorEquipRow({
            id: inserted.rowId,
            model_number: String(inserted.fieldDefaults.model_number ?? "New model"),
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
        fieldDefs={indoorEquipFieldDefs}
        columnDefs={columns}
        view={view}
        onViewChange={setView}
        onWrite={handleWrite}
        readOnly={readOnly}
        emptyMessage="No indoor heat-pump models defined."
        onRowOpen={(row) => setModal({ mode: "edit", row })}
        sessionKey={`${projectId}:heat-pumps:indoor-equip:${slice.version_id}`}
        generateRowId={() => buildEmptyIndoorEquipRow().id}
        footerAction={
          <button
            type="button"
            onClick={() => setModal({ mode: "add", row: buildEmptyIndoorEquipRow() })}
            disabled={readOnly}
          >
            Add indoor model
          </button>
        }
      />
      {modal ? (
        <IndoorEquipRowModal
          mode={modal.mode}
          row={modal.row}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={modal.mode === "add" ? addIndoorRow : replaceIndoorRow}
          onDelete={modal.mode === "edit" ? () => void deleteIndoorRow(modal.row) : undefined}
        />
      ) : null}
    </>
  );
}

function coerceCellValue(fieldKey: string, value: unknown): unknown {
  if (NUMERIC_FIELDS.has(fieldKey)) return numericValue(value);
  if (value === "") return null;
  return value;
}

const NUMERIC_FIELDS = new Set([
  "nominal_tons",
  "fan_speed_cfm",
  "cooling_btuh",
  "heating_btuh_47f",
  "heating_btuh_17f",
  "heating_cop",
  "seer",
  "eer",
  "hspf",
]);
