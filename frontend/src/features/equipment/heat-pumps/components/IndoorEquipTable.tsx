import { useMemo, useState } from "react";
import {
  DataTable,
  emptyViewState,
  type ViewState,
  type WriteOp,
} from "../../../../shared/ui/data-table";
import { useAssetUrls } from "../../../assets/hooks";
import { useHeatPumpOptionMutation, useHeatPumpPatchMutation } from "../api";
import {
  buildEmptyIndoorEquipRow,
  buildNewHeatPumpOption,
  numericValue,
  sortedIndoorEquip,
  uniqueTagForAdd,
} from "../lib";
import {
  indoorEquipColumnDefs,
  indoorEquipDefaultHiddenColumns,
  indoorEquipFieldDefs,
} from "../indoor-equip-columns";
import type { HeatPumpIndoorEquipRow, HeatPumpOwnedOptionKey, HeatPumpsSlice } from "../types";
import { addRowButton } from "../../routes/equipmentRowActions";
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
    sort: [{ fieldKey: "tag", direction: "asc" }],
    hiddenColumns: indoorEquipDefaultHiddenColumns,
  }));
  const [modal, setModal] = useState<ModalState>(null);
  const patchMutation = useHeatPumpPatchMutation(projectId);
  const optionMutation = useHeatPumpOptionMutation(projectId);
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
  const fieldDefs = useMemo(
    () => indoorEquipFieldDefs(slice.single_select_options),
    [slice.single_select_options],
  );

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
      <DataTable
        rows={rows}
        getRowId={(row) => row.id}
        fieldDefs={fieldDefs}
        columnDefs={columns}
        view={view}
        onViewChange={setView}
        onWrite={handleWrite}
        readOnly={readOnly}
        emptyMessage="No indoor heat-pump models defined."
        onRowOpen={(row) => setModal({ mode: "edit", row })}
        sessionKey={`${projectId}:heat-pumps:indoor-equip:${slice.version_id}`}
        generateRowId={() => buildEmptyIndoorEquipRow().id}
        footerAction={addRowButton("Add indoor model", !readOnly, () =>
          setModal({ mode: "add", row: buildEmptyIndoorEquipRow() }),
        )}
      />
      {modal ? (
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
