import { useMemo, useState } from "react";
import {
  DataTable,
  emptyViewState,
  type ViewState,
  type WriteOp,
} from "../../../../shared/ui/data-table";
import { useAssetUrls } from "../../../assets/hooks";
import { useHeatPumpPatchMutation } from "../api";
import { buildEmptyOutdoorEquipRow, numericValue, sortedOutdoorEquip } from "../lib";
import {
  outdoorEquipColumnDefs,
  outdoorEquipDefaultHiddenColumns,
  outdoorEquipFieldDefs,
} from "../outdoor-equip-columns";
import type { HeatPumpIndoorEquipRow, HeatPumpOutdoorEquipRow, HeatPumpsSlice } from "../types";
import { IndoorEquipCreateModal } from "./IndoorEquipCreateModal";
import { OutdoorEquipRowModal } from "./OutdoorEquipRowModal";

type ModalState =
  | { kind: "outdoor"; mode: "add" | "edit"; row: HeatPumpOutdoorEquipRow }
  | { kind: "indoor-create"; selectForOutdoorRowId: string | null }
  | null;

export function OutdoorEquipTable({
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
    hiddenColumns: outdoorEquipDefaultHiddenColumns,
  }));
  const [modal, setModal] = useState<ModalState>(null);
  const [status, setStatus] = useState<string | null>(null);
  const patchMutation = useHeatPumpPatchMutation(projectId);
  const rows = useMemo(() => sortedOutdoorEquip(slice.outdoor_equip), [slice.outdoor_equip]);
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
  const columns = outdoorEquipColumnDefs({
    projectId,
    isEditor: !readOnly,
    indoorEquip: slice.indoor_equip,
    assetUrlById,
    onDatasheetChange: (row, next) => replaceOutdoorRow({ ...row, datasheet_asset_ids: next }),
  });

  async function addOutdoorRow(row: HeatPumpOutdoorEquipRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "outdoor-equip",
      patch: { op: "add", path: "/-", value: row },
    });
    setModal(null);
  }

  async function replaceOutdoorRow(row: HeatPumpOutdoorEquipRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "outdoor-equip",
      patch: { op: "replace", path: `/${row.id}`, value: row },
    });
    setModal(null);
  }

  async function deleteOutdoorRow(row: HeatPumpOutdoorEquipRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "outdoor-equip",
      patch: { op: "remove", path: `/${row.id}` },
    });
    setModal(null);
  }

  async function addIndoorRow(row: HeatPumpIndoorEquipRow, selectForOutdoorRowId: string | null) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "indoor-equip",
      patch: { op: "add", path: "/-", value: row },
    });
    if (selectForOutdoorRowId) {
      const outdoor = slice.outdoor_equip.find(
        (candidate) => candidate.id === selectForOutdoorRowId,
      );
      if (outdoor) {
        await replaceOutdoorRow({ ...outdoor, paired_indoor_equip_id: row.id });
      }
    }
    setModal(null);
  }

  async function handleWrite(op: WriteOp) {
    if (readOnly) return;
    if (op.kind === "cell" || op.kind === "fill") {
      for (const write of op.writes) {
        const row = slice.outdoor_equip.find((candidate) => candidate.id === write.rowId);
        if (!row) continue;
        await replaceOutdoorRow({
          ...row,
          [write.fieldKey]: coerceCellValue(write.fieldKey, write.value),
        });
      }
      return;
    }
    if (op.kind === "rowDelete") {
      for (const deleted of op.rows) {
        const row = slice.outdoor_equip.find((candidate) => candidate.id === deleted.rowId);
        if (row) await deleteOutdoorRow(row);
      }
      return;
    }
    if (op.kind === "rowInsert") {
      for (const inserted of op.rows) {
        await addOutdoorRow(
          buildEmptyOutdoorEquipRow({
            id: inserted.rowId,
            model_number: String(inserted.fieldDefaults.model_number ?? "New model"),
          }),
        );
      }
    }
  }

  return (
    <>
      {status ? (
        <p className="draft-banner hp-status-banner" role="status">
          {status}
        </p>
      ) : null}
      <DataTable
        rows={rows}
        getRowId={(row) => row.id}
        fieldDefs={outdoorEquipFieldDefs}
        columnDefs={columns}
        view={view}
        onViewChange={setView}
        onWrite={handleWrite}
        readOnly={readOnly}
        emptyMessage="No heat-pump outdoor equipment yet."
        onRowOpen={(row) => setModal({ kind: "outdoor", mode: "edit", row })}
        sessionKey={`${projectId}:heat-pumps:outdoor-equip:${slice.version_id}`}
        generateRowId={() => buildEmptyOutdoorEquipRow().id}
        footerAction={
          <button
            type="button"
            onClick={() =>
              setModal({ kind: "outdoor", mode: "add", row: buildEmptyOutdoorEquipRow() })
            }
            disabled={readOnly}
          >
            Add outdoor equipment
          </button>
        }
        overflowMenuActions={
          <button
            type="button"
            className="data-table-menu-item"
            disabled={rows.length === 0}
            onClick={() => setStatus("Phius export ships in Phase 5.")}
          >
            Export to Phius HP Estimator...
          </button>
        }
      />
      {modal?.kind === "outdoor" ? (
        <OutdoorEquipRowModal
          mode={modal.mode}
          row={modal.row}
          indoorEquip={slice.indoor_equip}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={modal.mode === "add" ? addOutdoorRow : replaceOutdoorRow}
          onDelete={modal.mode === "edit" ? () => void deleteOutdoorRow(modal.row) : undefined}
          onCreateIndoorEquip={() =>
            setModal({ kind: "indoor-create", selectForOutdoorRowId: modal.row.id })
          }
        />
      ) : null}
      {modal?.kind === "indoor-create" ? (
        <IndoorEquipCreateModal
          onCancel={() => setModal(null)}
          onSubmit={(row) => addIndoorRow(row, modal.selectForOutdoorRowId)}
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
  "heating_cap_kbtuh_17f",
  "heating_cap_kbtuh_47f",
  "heating_cop_17f",
  "heating_cop_47f",
  "hspf2",
  "hspf",
  "cooling_cap_kbtuh_95f",
  "eer2",
  "seer2",
  "ieer",
  "eer",
  "seer",
]);
