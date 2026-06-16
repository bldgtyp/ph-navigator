import { useCallback, useMemo, useState } from "react";
import {
  buildLinkedRecordOps,
  DataTable,
  type LinkedRecordCellOps,
  type WriteOp,
} from "../../../../shared/ui/data-table";
import { useAssetUrls } from "../../../assets/hooks";
import { useHeatPumpOptionMutation, useHeatPumpPatchMutation } from "../api";
import {
  buildEmptyOutdoorEquipRow,
  buildNewHeatPumpOption,
  indoorEquipLabel,
  numericValue,
  sortedOutdoorEquip,
  sortedOutdoorUnits,
  uniqueTagForAdd,
} from "../lib";
import {
  HEAT_PUMP_LINK_TARGETS,
  indoorEquipIdsByOutdoorEquip,
  outdoorUnitIdsByOutdoorEquip,
} from "../link-fields";
import {
  outdoorEquipColumnDefs,
  outdoorEquipDefaultHiddenColumns,
  outdoorEquipFieldDefs,
} from "../outdoor-equip-columns";
import {
  HEAT_PUMP_OWNED_OPTION_KEYS,
  HEAT_PUMP_OPTION_KEYS,
  HEAT_PUMP_OUTDOOR_EQUIP_TABLE_NAME,
  type HeatPumpOutdoorEquipRow,
  type HeatPumpOutdoorUnitRow,
  type HeatPumpOwnedOptionKey,
  type HeatPumpsSlice,
} from "../types";
import { useHeatPumpTableViewState } from "../useHeatPumpTableViewState";
import { addRowButton } from "../../routes/equipmentRowActions";
import { OutdoorEquipRowModal } from "./OutdoorEquipRowModal";
import { OutdoorUnitRowModal } from "./OutdoorUnitRowModal";
import { PhiusExportDialog } from "./PhiusExportDialog";

type ModalState =
  | { kind: "outdoor"; mode: "add" | "edit"; row: HeatPumpOutdoorEquipRow }
  | { kind: "unit"; row: HeatPumpOutdoorUnitRow }
  | null;

export function OutdoorEquipTable({
  projectId,
  btNumber,
  slice,
  isEditor,
  versionLocked,
}: {
  projectId: string;
  btNumber: string;
  slice: HeatPumpsSlice;
  isEditor: boolean;
  versionLocked: boolean;
}) {
  const [modal, setModal] = useState<ModalState>(null);
  const [phiusDialogOpen, setPhiusDialogOpen] = useState(false);
  const patchMutation = useHeatPumpPatchMutation(projectId);
  const optionMutation = useHeatPumpOptionMutation(projectId);
  const rows = useMemo(() => sortedOutdoorEquip(slice.outdoor_equip), [slice.outdoor_equip]);
  const outdoorUnits = useMemo(
    () => sortedOutdoorUnits(slice.outdoor_units),
    [slice.outdoor_units],
  );
  const incomingOutdoorUnitIdsByRowId = useMemo(
    () => outdoorUnitIdsByOutdoorEquip(outdoorUnits),
    [outdoorUnits],
  );
  const manufacturerOptions = useMemo(
    () => slice.single_select_options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [],
    [slice.single_select_options],
  );
  const indoorEquipById = useMemo(
    () => new Map(slice.indoor_equip.map((row) => [row.id, row])),
    [slice.indoor_equip],
  );
  const pairedIndoorEquipIdsByOutdoorEquip = useMemo(
    () =>
      indoorEquipIdsByOutdoorEquip({
        outdoorUnits,
        indoorUnits: slice.indoor_units,
      }),
    [outdoorUnits, slice.indoor_units],
  );
  const pairedIndoorEquipLabelsByRowId = useMemo(() => {
    const labels = new Map<string, readonly string[]>();
    for (const [outdoorEquipId, indoorEquipIds] of pairedIndoorEquipIdsByOutdoorEquip) {
      labels.set(
        outdoorEquipId,
        indoorEquipIds.map((id) => {
          const equip = indoorEquipById.get(id);
          return equip ? indoorEquipLabel(equip, manufacturerOptions) : id;
        }),
      );
    }
    return labels;
  }, [indoorEquipById, manufacturerOptions, pairedIndoorEquipIdsByOutdoorEquip]);
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
  const openOutdoorUnitLink = useCallback(
    (unitId: string) => {
      const row = slice.outdoor_units.find((candidate) => candidate.id === unitId);
      if (row) setModal({ kind: "unit", row });
    },
    [slice.outdoor_units],
  );
  const columns = useMemo(
    () =>
      outdoorEquipColumnDefs({
        projectId,
        isEditor: !readOnly,
        assetUrlById,
        onDatasheetChange: async (row, next) => {
          await patchMutation.mutateAsync({
            current: slice,
            table: "outdoor-equip",
            patch: {
              op: "replace",
              path: `/${row.id}`,
              value: { ...row, datasheet_asset_ids: next },
            },
          });
        },
        outdoorUnits,
        incomingOutdoorUnitIdsByRowId,
        pairedIndoorEquipLabelsByRowId,
      }),
    [
      assetUrlById,
      incomingOutdoorUnitIdsByRowId,
      outdoorUnits,
      pairedIndoorEquipLabelsByRowId,
      patchMutation,
      projectId,
      readOnly,
      slice,
    ],
  );
  const fieldDefs = useMemo(
    () =>
      outdoorEquipFieldDefs({
        options: slice.single_select_options,
      }),
    [slice.single_select_options],
  );
  const linkedRecordOps = useMemo<ReadonlyMap<string, LinkedRecordCellOps>>(
    () =>
      buildLinkedRecordOps<HeatPumpOutdoorUnitRow>({
        fieldDefs,
        targetTablePath: HEAT_PUMP_LINK_TARGETS.outdoorUnits,
        targetRows: outdoorUnits,
        getRowId: (unit) => unit.id,
        getRecordId: (unit) => unit.tag || unit.id,
        onPillClick: openOutdoorUnitLink,
      }),
    [fieldDefs, openOutdoorUnitLink, outdoorUnits],
  );
  const tableView = useHeatPumpTableViewState({
    projectId,
    tableKey: HEAT_PUMP_OUTDOOR_EQUIP_TABLE_NAME,
    isEditor,
    columns,
    fieldDefs,
    sort: [{ fieldKey: "tag", direction: "asc" }],
    hiddenColumns: outdoorEquipDefaultHiddenColumns,
  });

  /**
   * Persists a new option onto one of the heat-pumps-owned single-select lists.
   * Returns the new option id so the caller (modal `OptionPicker`, or the grid
   * cell-write below) can update the row reference in the same draft cycle.
   */
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

  async function addOutdoorRow(row: HeatPumpOutdoorEquipRow) {
    const tag = uniqueTagForAdd(row.tag, slice.outdoor_equip);
    await patchMutation.mutateAsync({
      current: slice,
      table: "outdoor-equip",
      patch: { op: "add", path: "/-", value: { ...row, tag } },
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

  async function replaceOutdoorUnit(row: HeatPumpOutdoorUnitRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "outdoor-units",
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

  async function handleWrite(op: WriteOp) {
    if (readOnly) return;
    if (op.kind === "cell" || op.kind === "fill") {
      // Each mutation increments the draft etag, so subsequent calls must
      // re-read the freshest slice from the query cache or the next PATCH
      // will fail with a 409 on the If-Match draft etag check.
      let latest = slice;
      // The popover may have minted a new option as part of the same commit
      // (e.g. user typed "Daikin" into an empty Manufacturer cell). Persist
      // those options BEFORE the row write so the row's option reference is
      // always valid against the document. `newOptions` is only set on cell
      // ops — fill ops never produce new options.
      if (op.kind === "cell" && op.newOptions) {
        for (const [fieldKey, created] of Object.entries(op.newOptions)) {
          const optionKey = OUTDOOR_FIELD_TO_OPTION_KEY[fieldKey];
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
        const row = latest.outdoor_equip.find((candidate) => candidate.id === write.rowId);
        if (!row) continue;
        const next = await patchMutation.mutateAsync({
          current: latest,
          table: "outdoor-equip",
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
            tag: String(inserted.fieldDefaults.tag ?? "OE"),
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
          emptyMessage="No heat-pump outdoor equipment yet."
          onRowOpen={(row) => setModal({ kind: "outdoor", mode: "edit", row })}
          sessionKey={`${projectId}:heat-pumps:outdoor-equip:${slice.version_id}`}
          generateRowId={() => buildEmptyOutdoorEquipRow().id}
          footerAction={addRowButton("Add outdoor equipment", !readOnly, () =>
            setModal({ kind: "outdoor", mode: "add", row: buildEmptyOutdoorEquipRow() }),
          )}
          overflowMenuActions={
            <button
              type="button"
              className="data-table-menu-item"
              disabled={rows.length === 0}
              title={rows.length === 0 ? "Add an outdoor heat-pump model first." : undefined}
              onClick={() => setPhiusDialogOpen(true)}
            >
              Export to Phius HP Estimator...
            </button>
          }
        />
      )}
      {phiusDialogOpen ? (
        <PhiusExportDialog
          projectId={projectId}
          btNumber={btNumber}
          onClose={() => setPhiusDialogOpen(false)}
        />
      ) : null}
      {modal?.kind === "outdoor" ? (
        <OutdoorEquipRowModal
          mode={modal.mode}
          row={modal.row}
          existingEquip={slice.outdoor_equip}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={modal.mode === "add" ? addOutdoorRow : replaceOutdoorRow}
          onDelete={modal.mode === "edit" ? () => void deleteOutdoorRow(modal.row) : undefined}
          onCreateOption={readOnly ? undefined : createOption}
        />
      ) : null}
      {modal?.kind === "unit" ? (
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
    </>
  );
}

function coerceCellValue(fieldKey: string, value: unknown): unknown {
  if (NUMERIC_FIELDS.has(fieldKey)) return numericValue(value);
  if (value === "") return null;
  return value;
}

/**
 * Maps an outdoor-equip cell's fieldKey to the option-list key whose `add` op
 * persists a popover-minted option. Used by `handleWrite` to translate the
 * DataTable's `newOptions` payload into a heat-pump options-endpoint write.
 * Keys NOT in this map (e.g. lookup fields and the `cops`/`hspf2` literal
 * columns) ignore `newOptions` entries — those cells don't support inline-
 * create.
 */
const OUTDOOR_FIELD_TO_OPTION_KEY: Record<string, (typeof HEAT_PUMP_OWNED_OPTION_KEYS)[number]> = {
  manufacturer: "heat_pumps.manufacturer",
  system_family: "heat_pumps.system_family",
  refrigerant: "heat_pumps.refrigerant",
};

const NUMERIC_FIELDS = new Set([
  "heating_cap_kw_17f",
  "heating_cap_kw_47f",
  "heating_cop_17f",
  "heating_cop_47f",
  "hspf2",
  "hspf",
  "cooling_cap_kw_95f",
  "eer2",
  "seer2",
  "ieer",
  "eer",
  "seer",
]);
