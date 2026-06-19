import type {
  HeatPumpIndoorEquipReplacePayload,
  HeatPumpIndoorEquipRow,
  HeatPumpIndoorEquipSlice,
  HeatPumpIndoorUnitsReplacePayload,
  HeatPumpIndoorUnitRow,
  HeatPumpIndoorUnitsSlice,
  HeatPumpOutdoorEquipReplacePayload,
  HeatPumpOutdoorEquipRow,
  HeatPumpOutdoorEquipSlice,
  HeatPumpOutdoorUnitsReplacePayload,
  HeatPumpOutdoorUnitRow,
  HeatPumpOutdoorUnitsSlice,
  HeatPumpOwnedOptionKey,
} from "./types";
import { HEAT_PUMP_OWNED_OPTION_KEYS } from "./types";
import { parseNumberInput } from "../../../lib/units/format";
import { setCustomLink, setCustomValue, type TableFieldDef } from "../../../shared/ui/data-table";
import type {
  BuildEmptyRow,
  CellWrite,
  FieldOption,
  RowDuplicatePayload,
  RowInsertPayload,
  WriteOp,
} from "../../../shared/ui/data-table";
import type { SlicePayloadBuilders } from "../../../shared/ui/data-table/feature";
import { nextCopySuffix } from "../../../shared/lib/copySuffix";
import { firstLinkedId, linkedIds } from "./link-fields";

type HeatPumpPayloadRow = {
  id: string;
  custom_values?: Record<string, unknown> | null;
  custom_links?: Record<string, string[]> | null;
};

export const heatPumpOutdoorEquipPayloadBuilders: SlicePayloadBuilders<
  HeatPumpOutdoorEquipSlice,
  HeatPumpOutdoorEquipRow,
  HeatPumpOutdoorEquipReplacePayload
> = heatPumpLeafPayloadBuilders("outdoor_equip");

export const heatPumpIndoorEquipPayloadBuilders: SlicePayloadBuilders<
  HeatPumpIndoorEquipSlice,
  HeatPumpIndoorEquipRow,
  HeatPumpIndoorEquipReplacePayload
> = heatPumpLeafPayloadBuilders("indoor_equip");

export const heatPumpOutdoorUnitsPayloadBuilders: SlicePayloadBuilders<
  HeatPumpOutdoorUnitsSlice,
  HeatPumpOutdoorUnitRow,
  HeatPumpOutdoorUnitsReplacePayload
> = heatPumpLeafPayloadBuilders("outdoor_units");

export const heatPumpIndoorUnitsPayloadBuilders: SlicePayloadBuilders<
  HeatPumpIndoorUnitsSlice,
  HeatPumpIndoorUnitRow,
  HeatPumpIndoorUnitsReplacePayload
> = heatPumpLeafPayloadBuilders("indoor_units");

function heatPumpLeafPayloadBuilders<
  TKey extends "outdoor_equip" | "indoor_equip" | "outdoor_units" | "indoor_units",
  TRow extends HeatPumpPayloadRow & { tag: string },
  TSlice extends {
    field_defs: TableFieldDef[];
    single_select_options: Record<string, FieldOption[]>;
  } & Record<TKey, TRow[]>,
  TPayload extends Record<TKey, TRow[]> & {
    field_defs?: TableFieldDef[];
    single_select_options: Record<string, FieldOption[]>;
  },
>(rowsKey: TKey): SlicePayloadBuilders<TSlice, TRow, TPayload> {
  return {
    fromCellWrites(slice, writes, newOptions, removedOptions) {
      return heatPumpPayloadFromRows(
        slice,
        rowsKey,
        applyCellWrites(slice[rowsKey], writes, slice.field_defs),
        mergeHeatPumpOptions(slice.single_select_options, newOptions, removedOptions),
      );
    },
    fromRowInsert(slice, rows, build) {
      return heatPumpPayloadFromRows(slice, rowsKey, insertRows(slice[rowsKey], rows, build));
    },
    fromRowDelete(slice, rows) {
      const deletedIds = new Set(rows.map((row) => row.rowId));
      return heatPumpPayloadFromRows(
        slice,
        rowsKey,
        slice[rowsKey].filter((row) => !deletedIds.has(row.id)),
      );
    },
    fromRowDuplicate(slice, rows) {
      return heatPumpPayloadFromRows(slice, rowsKey, duplicateRows(slice[rowsKey], rows));
    },
    validate(payload) {
      const rows = payload[rowsKey];
      const duplicate = firstDuplicateTag(rows);
      return duplicate ? `Tag "${duplicate}" is already used.` : null;
    },
    replaceOptions(slice, optionKey, options, replacements) {
      const fieldKey = heatPumpOptionFieldKey(optionKey);
      const rows = fieldKey
        ? replaceOptionReferences(slice[rowsKey], fieldKey, replacements)
        : slice[rowsKey];
      return heatPumpPayloadFromRows(slice, rowsKey, rows, {
        ...slice.single_select_options,
        [optionKey]: options,
      });
    },
    isLegacyOptionKey(key) {
      return isHeatPumpOwnedOptionKey(key);
    },
  };
}

function heatPumpPayloadFromRows<
  TKey extends string,
  TRow,
  TSlice extends {
    field_defs: TableFieldDef[];
    single_select_options: Record<string, FieldOption[]>;
  },
  TPayload extends Record<TKey, TRow[]> & {
    field_defs?: TableFieldDef[];
    single_select_options: Record<string, FieldOption[]>;
  },
>(
  slice: TSlice,
  rowsKey: TKey,
  rows: TRow[],
  singleSelectOptions = slice.single_select_options,
): TPayload {
  return {
    [rowsKey]: rows,
    field_defs: slice.field_defs,
    single_select_options: singleSelectOptions,
  } as TPayload;
}

function applyCellWrites<TRow extends HeatPumpPayloadRow>(
  rows: TRow[],
  writes: CellWrite[],
  fieldDefs: readonly TableFieldDef[],
): TRow[] {
  const writesByRow = new Map<string, CellWrite[]>();
  for (const write of writes) {
    const rowWrites = writesByRow.get(write.rowId);
    if (rowWrites) {
      rowWrites.push(write);
    } else {
      writesByRow.set(write.rowId, [write]);
    }
  }
  const fieldDefByKey = new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef]));
  return rows.map((row) => {
    const rowWrites = writesByRow.get(row.id);
    if (!rowWrites) return row;
    let next = row;
    for (const write of rowWrites) {
      next = applyCellWrite(next, write, fieldDefByKey.get(write.fieldKey));
    }
    return next;
  });
}

function applyCellWrite<TRow extends HeatPumpPayloadRow>(
  row: TRow,
  write: CellWrite,
  fieldDef: TableFieldDef | undefined,
): TRow {
  if (fieldDef?.origin === "custom") {
    if (fieldDef.field_type === "linked_record") {
      return setCustomLink(row, write.fieldKey, write.value);
    }
    return setCustomValue(row, write.fieldKey, write.value);
  }
  return {
    ...row,
    [write.fieldKey]: heatPumpCellValue(write.fieldKey, write.value),
  };
}

function mergeHeatPumpOptions(
  current: Record<string, FieldOption[]>,
  newOptions: Record<string, FieldOption[]>,
  removedOptions: Record<string, string[]>,
): Record<string, FieldOption[]> {
  const next = { ...current };
  for (const [optionKey, additions] of Object.entries(newOptions)) {
    const existing = next[optionKey] ?? [];
    const existingIds = new Set(existing.map((option) => option.id));
    next[optionKey] = [...existing, ...additions.filter((option) => !existingIds.has(option.id))];
  }
  for (const [optionKey, removedIds] of Object.entries(removedOptions)) {
    const removed = new Set(removedIds);
    next[optionKey] = (next[optionKey] ?? []).filter((option) => !removed.has(option.id));
  }
  return next;
}

function replaceOptionReferences<TRow extends { id: string }>(
  rows: readonly TRow[],
  fieldKey: string,
  replacements: Record<string, string | null>,
): TRow[] {
  return rows.map((row) => {
    const current = (row as Record<string, unknown>)[fieldKey];
    if (typeof current !== "string" || !(current in replacements)) return row;
    return { ...row, [fieldKey]: replacements[current] };
  });
}

function heatPumpOptionFieldKey(optionKey: string): string | null {
  if (!isHeatPumpOwnedOptionKey(optionKey)) return null;
  return optionKey.replace(/^heat_pumps\./, "");
}

function isHeatPumpOwnedOptionKey(key: string): key is HeatPumpOwnedOptionKey {
  return (HEAT_PUMP_OWNED_OPTION_KEYS as readonly string[]).includes(key);
}

function insertRows<TRow extends { id: string }>(
  rows: TRow[],
  inserts: RowInsertPayload[],
  build: BuildEmptyRow<TRow>,
): TRow[] {
  let nextRows = [...rows];
  for (const insert of inserts) {
    const anchorRow = insert.anchorRowId
      ? (nextRows.find((row) => row.id === insert.anchorRowId) ?? null)
      : null;
    const nextRow = build({
      rowId: insert.rowId,
      fieldDefaults: insert.fieldDefaults,
      anchorRow,
    });
    const anchorIndex = insert.anchorRowId
      ? nextRows.findIndex((row) => row.id === insert.anchorRowId)
      : -1;
    const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : nextRows.length;
    nextRows = [...nextRows.slice(0, insertIndex), nextRow, ...nextRows.slice(insertIndex)];
  }
  return nextRows;
}

function duplicateRows<TRow extends { id: string; tag: string }>(
  rows: TRow[],
  duplicates: RowDuplicatePayload[],
): TRow[] {
  let nextRows = [...rows];
  for (const duplicate of duplicates) {
    const source = nextRows.find((row) => row.id === duplicate.sourceRowId);
    if (!source) continue;
    const existingTags = nextRows.map((row) => row.tag);
    const nextTag = nextCopySuffix(source.tag, existingTags);
    const nextRow = { ...source, id: duplicate.rowId, tag: nextTag };
    const anchorIndex = duplicate.anchorRowId
      ? nextRows.findIndex((row) => row.id === duplicate.anchorRowId)
      : nextRows.findIndex((row) => row.id === source.id);
    const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : nextRows.length;
    nextRows = [...nextRows.slice(0, insertIndex), nextRow, ...nextRows.slice(insertIndex)];
  }
  return nextRows;
}

function firstDuplicateTag<TRow extends { id: string; tag: string }>(
  rows: readonly TRow[],
): string | null {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = row.tag.trim().toLocaleLowerCase();
    if (!key) continue;
    if (seen.has(key)) return row.tag.trim();
    seen.add(key);
  }
  return null;
}

function heatPumpCellValue(fieldKey: string, value: unknown): unknown {
  if (HEAT_PUMP_NUMBER_FIELDS.has(fieldKey)) return numericValue(value);
  if (fieldKey === "outdoor_equip_id" || fieldKey === "indoor_equip_id") {
    const next = firstLinkedId(value);
    if (!next) throw new Error("Linked equipment is required.");
    return next;
  }
  if (fieldKey === "outdoor_unit_id" || fieldKey === "linked_erv_unit_id") {
    return firstLinkedId(value);
  }
  if (fieldKey === "paired_indoor_equip_id") return firstLinkedId(value);
  if (fieldKey === "served_room_ids") return linkedIds(value);
  return value === "" ? null : value;
}

const HEAT_PUMP_NUMBER_FIELDS = new Set([
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
  "nominal_tons",
  "fan_speed_cfm",
  "cooling_btuh",
  "heating_btuh_47f",
  "heating_btuh_17f",
  "heating_cop",
]);

export async function insertHeatPumpRow(
  onWrite: (op: WriteOp) => Promise<void>,
  row: { id: string } & Record<string, unknown>,
): Promise<void> {
  await onWrite({
    kind: "rowInsert",
    rows: [{ rowId: row.id, fieldDefaults: row as Record<string, unknown>, anchorRowId: null }],
  });
}

export async function replaceHeatPumpRow(
  onWrite: (op: WriteOp) => Promise<void>,
  row: { id: string } & Record<string, unknown>,
): Promise<void> {
  await onWrite({
    kind: "cell",
    writes: Object.entries(row)
      .filter(([fieldKey]) => fieldKey !== "id")
      .map(([fieldKey, value]) => ({ rowId: row.id, fieldKey, value })),
  });
}

export async function deleteHeatPumpRow(
  onWrite: (op: WriteOp) => Promise<void>,
  row: { id: string },
): Promise<void> {
  await onWrite({
    kind: "rowDelete",
    rows: [{ rowId: row.id, row, anchorRowId: null }],
  });
}

export function numericValue(value: unknown): number | null {
  return parseNumberInput(value);
}
