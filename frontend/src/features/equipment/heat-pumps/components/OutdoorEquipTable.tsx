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
  buildEmptyOutdoorEquipRow,
  buildNewHeatPumpOption,
  numericValue,
  sortedOutdoorEquip,
  uniqueTagForAdd,
} from "../lib";
import {
  outdoorEquipColumnDefs,
  outdoorEquipDefaultHiddenColumns,
  outdoorEquipFieldDefs,
} from "../outdoor-equip-columns";
import {
  HEAT_PUMP_OWNED_OPTION_KEYS,
  type HeatPumpIndoorEquipRow,
  type HeatPumpOutdoorEquipRow,
  type HeatPumpOwnedOptionKey,
  type HeatPumpsSlice,
} from "../types";
import { addRowButton } from "../../routes/equipmentRowActions";
import { IndoorEquipRowModal } from "./IndoorEquipRowModal";
import { OutdoorEquipRowModal } from "./OutdoorEquipRowModal";
import { PhiusExportDialog } from "./PhiusExportDialog";

type ModalState =
  | { kind: "outdoor"; mode: "add" | "edit"; row: HeatPumpOutdoorEquipRow }
  | {
      kind: "indoor-create";
      row: HeatPumpIndoorEquipRow;
      selectForOutdoorRowId: string | null;
    }
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
  const [view, setView] = useState<ViewState>(() => ({
    ...emptyViewState(),
    sort: [{ fieldKey: "tag", direction: "asc" }],
    hiddenColumns: outdoorEquipDefaultHiddenColumns,
  }));
  const [modal, setModal] = useState<ModalState>(null);
  const [phiusDialogOpen, setPhiusDialogOpen] = useState(false);
  const patchMutation = useHeatPumpPatchMutation(projectId);
  const optionMutation = useHeatPumpOptionMutation(projectId);
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
    assetUrlById,
    onDatasheetChange: (row, next) => replaceOutdoorRow({ ...row, datasheet_asset_ids: next }),
  });
  const fieldDefs = useMemo(
    () =>
      outdoorEquipFieldDefs({
        options: slice.single_select_options,
        indoorEquip: slice.indoor_equip,
      }),
    [slice.single_select_options, slice.indoor_equip],
  );

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

  async function deleteOutdoorRow(row: HeatPumpOutdoorEquipRow) {
    await patchMutation.mutateAsync({
      current: slice,
      table: "outdoor-equip",
      patch: { op: "remove", path: `/${row.id}` },
    });
    setModal(null);
  }

  async function addIndoorRow(row: HeatPumpIndoorEquipRow, selectForOutdoorRowId: string | null) {
    const tag = uniqueTagForAdd(row.tag, slice.indoor_equip);
    await patchMutation.mutateAsync({
      current: slice,
      table: "indoor-equip",
      patch: { op: "add", path: "/-", value: { ...row, tag } },
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
      <DataTable
        rows={rows}
        getRowId={(row) => row.id}
        fieldDefs={fieldDefs}
        columnDefs={columns}
        view={view}
        onViewChange={setView}
        onWrite={handleWrite}
        readOnly={readOnly}
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
          indoorEquip={slice.indoor_equip}
          existingEquip={slice.outdoor_equip}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={modal.mode === "add" ? addOutdoorRow : replaceOutdoorRow}
          onDelete={modal.mode === "edit" ? () => void deleteOutdoorRow(modal.row) : undefined}
          onCreateIndoorEquip={() =>
            setModal({
              kind: "indoor-create",
              row: buildEmptyIndoorEquipRow(),
              selectForOutdoorRowId: modal.row.id,
            })
          }
          onCreateOption={readOnly ? undefined : createOption}
        />
      ) : null}
      {modal?.kind === "indoor-create" ? (
        <IndoorEquipRowModal
          mode="add"
          row={modal.row}
          existingEquip={slice.indoor_equip}
          options={slice.single_select_options}
          readOnly={false}
          onCancel={() => setModal(null)}
          onSubmit={(row) => addIndoorRow(row, modal.selectForOutdoorRowId)}
          onCreateOption={createOption}
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
 * Keys NOT in this map (e.g. `paired_indoor_equip_id`, the `cops`/`hspf2`
 * literal columns) ignore `newOptions` entries — those popovers don't support
 * inline-create.
 */
const OUTDOOR_FIELD_TO_OPTION_KEY: Record<string, (typeof HEAT_PUMP_OWNED_OPTION_KEYS)[number]> = {
  manufacturer: "heat_pumps.manufacturer",
  system_family: "heat_pumps.system_family",
  refrigerant: "heat_pumps.refrigerant",
};

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
