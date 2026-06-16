import { useCallback, useMemo, useState } from "react";
import {
  buildLinkedRecordOps,
  DataTable,
  type LinkedRecordCellOps,
  type WriteOp,
} from "../../../../shared/ui/data-table";
import { useAssetUrls } from "../../../assets/hooks";
import { ventilatorsSliceFeature } from "../../api";
import type { VentilatorRow } from "../../types";
import { useHeatPumpOptionMutation, useHeatPumpPatchMutation } from "../api";
import {
  buildEmptyIndoorEquipRow,
  buildNewHeatPumpOption,
  numericValue,
  sortedIndoorEquip,
  sortedIndoorUnits,
  uniqueTagForAdd,
} from "../lib";
import {
  indoorEquipColumnDefs,
  indoorEquipDefaultHiddenColumns,
  indoorEquipFieldDefs,
} from "../indoor-equip-columns";
import { HEAT_PUMP_LINK_TARGETS, indoorUnitIdsByIndoorEquip } from "../link-fields";
import {
  HEAT_PUMP_INDOOR_EQUIP_TABLE_NAME,
  type HeatPumpIndoorEquipRow,
  type HeatPumpIndoorUnitRow,
  type HeatPumpOwnedOptionKey,
  type HeatPumpsSlice,
} from "../types";
import { useHeatPumpTableViewState } from "../useHeatPumpTableViewState";
import { addRowButton } from "../../routes/equipmentRowActions";
import { IndoorEquipRowModal } from "./IndoorEquipRowModal";
import { IndoorUnitRowModal } from "./IndoorUnitRowModal";

type ModalState =
  | { kind: "equip"; mode: "add" | "edit"; row: HeatPumpIndoorEquipRow }
  | { kind: "unit"; row: HeatPumpIndoorUnitRow }
  | null;

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
  const [modal, setModal] = useState<ModalState>(null);
  const patchMutation = useHeatPumpPatchMutation(projectId);
  const optionMutation = useHeatPumpOptionMutation(projectId);
  const accessMode = isEditor ? "editor" : "viewer";
  const indoorUnitModalOpen = modal?.kind === "unit";
  const ventilatorsQuery = ventilatorsSliceFeature.useSliceQuery(
    projectId,
    slice.version_id,
    accessMode,
    indoorUnitModalOpen,
  );
  const ventilators: VentilatorRow[] = ventilatorsQuery.data?.ventilators ?? [];
  const rows = useMemo(() => sortedIndoorEquip(slice.indoor_equip), [slice.indoor_equip]);
  const indoorUnits = useMemo(() => sortedIndoorUnits(slice.indoor_units), [slice.indoor_units]);
  const incomingIndoorUnitIdsByRowId = useMemo(
    () => indoorUnitIdsByIndoorEquip(indoorUnits),
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
  const openIndoorUnitLink = useCallback(
    (unitId: string) => {
      const row = slice.indoor_units.find((candidate) => candidate.id === unitId);
      if (row) setModal({ kind: "unit", row });
    },
    [slice.indoor_units],
  );
  const fieldDefs = useMemo(
    () => indoorEquipFieldDefs(slice.single_select_options),
    [slice.single_select_options],
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
  const columns = indoorEquipColumnDefs({
    projectId,
    isEditor: !readOnly,
    assetUrlById,
    onDatasheetChange: (row, next) => replaceIndoorRow({ ...row, datasheet_asset_ids: next }),
    indoorUnits,
    incomingIndoorUnitIdsByRowId,
  });
  const tableView = useHeatPumpTableViewState({
    projectId,
    tableKey: HEAT_PUMP_INDOOR_EQUIP_TABLE_NAME,
    isEditor,
    columns,
    fieldDefs,
    sort: [{ fieldKey: "tag", direction: "asc" }],
    hiddenColumns: indoorEquipDefaultHiddenColumns,
  });

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

  async function addIndoorRow(row: HeatPumpIndoorEquipRow) {
    const tag = uniqueTagForAdd(row.tag, slice.indoor_equip);
    await patchMutation.mutateAsync({
      current: slice,
      table: "indoor-equip",
      patch: { op: "add", path: "/-", value: { ...row, tag } },
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

  async function replaceIndoorUnit(row: HeatPumpIndoorUnitRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "indoor-units",
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
      // See OutdoorEquipTable.handleWrite for the same pattern; only cell ops
      // carry the popover's newOptions delta, and each PATCH must use the
      // latest etag to avoid a 409 from the draft-etag check.
      let latest = slice;
      if (op.kind === "cell" && op.newOptions) {
        for (const [fieldKey, created] of Object.entries(op.newOptions)) {
          const optionKey = INDOOR_FIELD_TO_OPTION_KEY[fieldKey];
          if (!optionKey) continue;
          for (const option of created) {
            latest = await optionMutation.mutateAsync({
              current: latest,
              optionKey,
              patch: { op: "add", option },
            });
          }
        }
      }
      for (const write of op.writes) {
        const row = latest.indoor_equip.find((candidate) => candidate.id === write.rowId);
        if (!row) continue;
        const next = await patchMutation.mutateAsync({
          current: latest,
          table: "indoor-equip",
          patch: {
            op: "replace",
            path: `/${row.id}`,
            value: { ...row, [write.fieldKey]: coerceCellValue(write.fieldKey, write.value) },
          },
        });
        latest = next;
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
            tag: String(inserted.fieldDefaults.tag ?? "IE"),
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
          linkedRecordOps={linkedRecordOps}
          emptyMessage="No indoor heat-pump models defined."
          onRowOpen={(row) => setModal({ kind: "equip", mode: "edit", row })}
          sessionKey={`${projectId}:heat-pumps:indoor-equip:${slice.version_id}`}
          generateRowId={() => buildEmptyIndoorEquipRow().id}
          footerAction={addRowButton("Add indoor model", !readOnly, () =>
            setModal({ kind: "equip", mode: "add", row: buildEmptyIndoorEquipRow() }),
          )}
        />
      )}
      {modal?.kind === "equip" ? (
        <IndoorEquipRowModal
          mode={modal.mode}
          row={modal.row}
          existingEquip={slice.indoor_equip}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={modal.mode === "add" ? addIndoorRow : replaceIndoorRow}
          onDelete={modal.mode === "edit" ? () => void deleteIndoorRow(modal.row) : undefined}
          onCreateOption={readOnly ? undefined : createOption}
        />
      ) : null}
      {modal?.kind === "unit" ? (
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
    </>
  );
}

function coerceCellValue(fieldKey: string, value: unknown): unknown {
  if (NUMERIC_FIELDS.has(fieldKey)) return numericValue(value);
  if (value === "") return null;
  return value;
}

const INDOOR_FIELD_TO_OPTION_KEY: Record<string, HeatPumpOwnedOptionKey> = {
  manufacturer: "heat_pumps.manufacturer",
  model_type: "heat_pumps.model_type",
  install_type: "heat_pumps.install_type",
};

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
