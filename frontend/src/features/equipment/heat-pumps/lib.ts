// @size-exception: planning/features/data-table-maintenance/phases/phase-00-cleanup-outline.md
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
  HeatPumpSingleSelectOption,
} from "./types";
import { HEAT_PUMP_OWNED_OPTION_KEYS } from "./types";
import { parseNumberInput } from "../../../lib/units/format";
import {
  OPTION_COLOR_PALETTE,
  setCustomLink,
  setCustomValue,
  type TableFieldDef,
} from "../../../shared/ui/data-table";
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

export function buildEmptyOutdoorEquipRow(overrides: Partial<HeatPumpOutdoorEquipRow> = {}) {
  return {
    id: heatPumpId("hpoe"),
    tag: "",
    manufacturer: null,
    model_number: null,
    paired_indoor_equip_id: null,
    system_family: null,
    refrigerant: null,
    heating_cap_kw_17f: null,
    heating_cap_kw_47f: null,
    heating_data_type: null,
    heating_cop_17f: null,
    heating_cop_47f: null,
    hspf: null,
    cooling_cap_kw_95f: null,
    cooling_data_type: null,
    eer: null,
    seer: null,
    ieer: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
    custom_values: {},
    custom_links: {},
    ...overrides,
  } satisfies HeatPumpOutdoorEquipRow;
}

export function buildEmptyIndoorEquipRow(overrides: Partial<HeatPumpIndoorEquipRow> = {}) {
  return {
    id: heatPumpId("hpie"),
    tag: "",
    manufacturer: null,
    model_type: null,
    model_number: null,
    install_type: null,
    nominal_tons: null,
    fan_speed_cfm: null,
    cooling_btuh: null,
    heating_btuh_47f: null,
    heating_btuh_17f: null,
    heating_cop: null,
    seer: null,
    eer: null,
    hspf: null,
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
    custom_values: {},
    custom_links: {},
    ...overrides,
  } satisfies HeatPumpIndoorEquipRow;
}

export function buildEmptyOutdoorUnitRow(overrides: Partial<HeatPumpOutdoorUnitRow> = {}) {
  return {
    id: heatPumpId("hpou"),
    tag: "",
    outdoor_equip_id: "",
    datasheet_asset_ids: [],
    notes: null,
    custom_values: {},
    custom_links: {},
    ...overrides,
  } satisfies HeatPumpOutdoorUnitRow;
}

export function buildEmptyIndoorUnitRow(overrides: Partial<HeatPumpIndoorUnitRow> = {}) {
  return {
    id: heatPumpId("hpiu"),
    tag: "",
    indoor_equip_id: "",
    outdoor_unit_id: null,
    linked_erv_unit_id: null,
    served_room_ids: [],
    datasheet_asset_ids: [],
    notes: null,
    custom_values: {},
    custom_links: {},
    ...overrides,
  } satisfies HeatPumpIndoorUnitRow;
}

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

export function sortedOutdoorEquip(rows: HeatPumpOutdoorEquipRow[]) {
  return sortBy(rows, (row) => row.tag);
}

export function sortedIndoorEquip(rows: HeatPumpIndoorEquipRow[]) {
  return sortBy(rows, (row) => row.tag);
}

export function sortedOutdoorUnits(rows: HeatPumpOutdoorUnitRow[]) {
  return sortBy(rows, (row) => row.tag);
}

export function sortedIndoorUnits(rows: HeatPumpIndoorUnitRow[]) {
  return sortBy(rows, (row) => row.tag);
}

function sortBy<T extends { id: string }>(rows: T[], key: (row: T) => string): T[] {
  return [...rows].sort((a, b) => {
    const primary = key(a).localeCompare(key(b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return primary || a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" });
  });
}

/**
 * Resolves a unique tag inside a table by appending `(2)`, `(3)`, … on collision.
 * Comparison is trim + case-fold so "AHU-1" and "ahu-1 " collide.
 * Used on add only — rename collisions are rejected with an error instead.
 */
export function uniqueTagForAdd(desired: string, existing: readonly { tag: string }[]): string {
  const trimmed = desired.trim();
  const taken = new Set(existing.map((row) => row.tag.trim().toLocaleLowerCase()));
  if (!taken.has(trimmed.toLocaleLowerCase())) return trimmed;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${trimmed} (${suffix})`;
    if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
  }
  return `${trimmed} (${Date.now()})`;
}

/**
 * Returns true when `desired` collides with another row in `existing` (excluding the
 * row being renamed by id). Caller uses this on rename to reject duplicates.
 */
export function tagCollides(
  desired: string,
  existing: readonly { id: string; tag: string }[],
  excludeId: string,
): boolean {
  const target = desired.trim().toLocaleLowerCase();
  return existing.some(
    (row) => row.id !== excludeId && row.tag.trim().toLocaleLowerCase() === target,
  );
}

/**
 * Resolve the human-readable label for an option id from an explicit option
 * list. Returns "" if `id` is null, "" if `options` is empty, or the raw id
 * (without the `opt_` prefix) if the id isn't present in the list — that fallback
 * keeps existing rows readable while the option list is being populated for the
 * first time, and avoids a blank column for catalog-imported rows that
 * reference an option from a different project.
 */
export function optionLabelFromId(
  id: string | null,
  options: readonly HeatPumpSingleSelectOption[],
): string {
  if (!id) return "";
  const hit = options.find((option) => option.id === id);
  if (hit) return hit.label;
  return id.replace(/^opt_/, "");
}

/**
 * Look up an option by case-insensitive trimmed label match. Returns null when
 * the label doesn't match any existing option — callers that want "find or
 * create" should mint a new option and call the options-mutation API instead of
 * slugging the label client-side.
 */
export function findOptionByLabel(
  label: string,
  options: readonly HeatPumpSingleSelectOption[],
): HeatPumpSingleSelectOption | null {
  const target = label.trim().toLocaleLowerCase();
  if (!target) return null;
  return options.find((option) => option.label.trim().toLocaleLowerCase() === target) ?? null;
}

/**
 * Mint a fresh `opt_*` id + cycling color for an option created from the UI.
 * The backend mints its own id when add ops omit one, but we mint here so the
 * optimistic patch payload stays self-consistent.
 */
export function buildNewHeatPumpOption(
  label: string,
  existing: readonly HeatPumpSingleSelectOption[],
): HeatPumpSingleSelectOption {
  const trimmed = label.trim();
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const id = slug ? `opt_${slug}_${randomSuffix(4)}` : `opt_${randomSuffix(8)}`;
  const color = OPTION_COLOR_PALETTE[existing.length % OPTION_COLOR_PALETTE.length] ?? "#3b82f6";
  const order = existing.length === 0 ? 0 : Math.max(...existing.map((option) => option.order)) + 1;
  return { id, label: trimmed, color, order };
}

function randomSuffix(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function numericValue(value: unknown): number | null {
  return parseNumberInput(value);
}

export function outdoorEquipLabel(
  row: HeatPumpOutdoorEquipRow | null | undefined,
  manufacturerOptions: readonly HeatPumpSingleSelectOption[] = [],
): string {
  if (!row) return "";
  return equipLabel(row.tag, row.manufacturer, row.model_number, manufacturerOptions);
}

export function indoorEquipLabel(
  row: HeatPumpIndoorEquipRow | null | undefined,
  manufacturerOptions: readonly HeatPumpSingleSelectOption[] = [],
): string {
  if (!row) return "";
  return equipLabel(row.tag, row.manufacturer, row.model_number, manufacturerOptions);
}

function equipLabel(
  tag: string,
  manufacturerId: string | null,
  modelNumber: string | null,
  manufacturerOptions: readonly HeatPumpSingleSelectOption[],
): string {
  const manufacturer = optionLabelFromId(manufacturerId, manufacturerOptions);
  const model = (modelNumber ?? "").trim();
  const spec = [manufacturer, model].filter(Boolean).join(" ");
  if (!tag) return spec;
  return spec ? `${tag} — ${spec}` : tag;
}

export function outdoorUnitLabel(row: HeatPumpOutdoorUnitRow | null | undefined): string {
  return row?.tag ?? "";
}

export function ventilatorLabel(
  row: { custom_values: Record<string, unknown> } | null | undefined,
): string {
  if (!row) return "";
  const recordId = stringValue(row.custom_values.record_id);
  const name = stringValue(row.custom_values.name);
  if (recordId && name) return `${recordId} — ${name}`;
  return recordId || name || "(unnamed)";
}

export function roomLabel(
  row: { custom_values: Record<string, unknown> } | null | undefined,
): string {
  if (!row) return "";
  const number = stringValue(row.custom_values.number);
  const name = stringValue(row.custom_values.name);
  if (number && name) return `${number} — ${name}`;
  return number || name || "(unnamed)";
}

function stringValue(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function heatPumpId(prefix: "hpoe" | "hpie" | "hpou" | "hpiu"): string {
  return `${prefix}_${ulidSuffix()}`;
}

function ulidSuffix(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let value = BigInt(Date.now());
  for (const byte of bytes.slice(0, 10)) {
    value = (value << 8n) | BigInt(byte);
  }
  let output = "";
  for (let index = 0; index < 26; index += 1) {
    output = alphabet[Number(value & 31n)] + output;
    value >>= 5n;
  }
  return output;
}
