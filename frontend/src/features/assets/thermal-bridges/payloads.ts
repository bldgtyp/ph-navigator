import {
  RECORD_ID_FIELD_KEY,
  setCustomValue,
  type BuildEmptyRow,
  type FieldOption,
  type RowDeletePayload,
  type RowDuplicatePayload,
  type RowInsertPayload,
} from "../../../shared/ui/data-table";
import { normalizeOptionOrders } from "../../../shared/ui/data-table/lib";
import { readStatusDefault } from "../../../shared/lib/fieldDefaults";
import { readAttachmentAssetIds } from "../lib";
import { nextCopySuffix } from "../../equipment/lib";
import { customNumberValue } from "../../equipment/lib/customValueReaders";
import {
  STATUS_DEFAULT_OPTION_ID,
  STATUS_FIELD_KEY,
  THERMAL_BRIDGE_PDF_REPORT_FIELD_KEY,
  THERMAL_BRIDGE_TYPE_KEY,
  THERMAL_BRIDGE_TYPE_OPTION_KEY,
  type ThermalBridgeOptionKey,
  type ThermalBridgeRow,
  type ThermalBridgesReplacePayload,
  type ThermalBridgesSlice,
} from "../../equipment/types";
import {
  THERMAL_BRIDGE_CUSTOM_VALUE_FIELD_KEYS,
  thermalBridgeOptionListKeyForFieldKey,
} from "./constants";

export function thermalBridgesPayloadFromCellWrites(
  current: ThermalBridgesSlice,
  writes: { rowId: string; fieldKey: string; value: unknown }[],
  newOptions: Record<string, FieldOption[]>,
  removedOptions: Record<string, string[]> = {},
): ThermalBridgesReplacePayload {
  const options = cloneThermalBridgeOptions(current);
  for (const [fieldKey, removedIds] of Object.entries(removedOptions)) {
    const optionKey = thermalBridgeOptionListKeyForFieldKey(fieldKey);
    if (!optionKey || removedIds.length === 0) continue;
    const remove = new Set(removedIds);
    options[optionKey] = normalizeOptionOrders(
      (options[optionKey] ?? []).filter((option) => !remove.has(option.id)),
    );
  }
  for (const [fieldKey, createdOptions] of Object.entries(newOptions)) {
    const optionKey = thermalBridgeOptionListKeyForFieldKey(fieldKey);
    if (!optionKey) continue;
    options[optionKey] = normalizeOptionOrders([...(options[optionKey] ?? []), ...createdOptions]);
  }
  const writesByRowId = writes.reduce((byRowId, write) => {
    const rowWrites = byRowId.get(write.rowId);
    if (rowWrites) {
      rowWrites.push(write);
    } else {
      byRowId.set(write.rowId, [write]);
    }
    return byRowId;
  }, new Map<string, typeof writes>());
  const rows = current.thermal_bridges.map((row) =>
    applyWritesToThermalBridge(row, writesByRowId.get(row.id) ?? []),
  );
  return {
    thermal_bridges: sortedThermalBridges(rows),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function thermalBridgesPayloadFromRowInsert(
  current: ThermalBridgesSlice,
  inserts: RowInsertPayload[],
  build: BuildEmptyRow<ThermalBridgeRow>,
): ThermalBridgesReplacePayload {
  const built = inserts.map((payload) => {
    const anchorRow = payload.anchorRowId
      ? (current.thermal_bridges.find((row) => row.id === payload.anchorRowId) ?? null)
      : null;
    return normalizeThermalBridgeForPayload(
      build({ rowId: payload.rowId, fieldDefaults: payload.fieldDefaults, anchorRow }),
    );
  });
  return {
    thermal_bridges: sortedThermalBridges([...current.thermal_bridges, ...built]),
    single_select_options: cloneThermalBridgeOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function thermalBridgesPayloadFromRowDelete(
  current: ThermalBridgesSlice,
  deletes: RowDeletePayload[],
): ThermalBridgesReplacePayload {
  const toDelete = new Set(deletes.map((entry) => entry.rowId));
  return {
    thermal_bridges: current.thermal_bridges.filter((row) => !toDelete.has(row.id)),
    single_select_options: cloneThermalBridgeOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function thermalBridgesPayloadFromRowDuplicate(
  current: ThermalBridgesSlice,
  duplicates: RowDuplicatePayload[],
): ThermalBridgesReplacePayload {
  const rows = [...current.thermal_bridges];
  const liveTags = new Set(
    rows.map((row) => stringFromCustomValues(row.custom_values, RECORD_ID_FIELD_KEY)),
  );
  for (const duplicate of duplicates) {
    const source = duplicate.sourceRow as ThermalBridgeRow;
    const sourceTag = stringFromCustomValues(source.custom_values, RECORD_ID_FIELD_KEY);
    const newTag = nextCopySuffix(sourceTag, liveTags);
    liveTags.add(newTag);
    rows.push(
      normalizeThermalBridgeForPayload({
        ...source,
        id: duplicate.rowId,
        pdf_report_asset_ids: [...source.pdf_report_asset_ids],
        custom_values: { ...source.custom_values, [RECORD_ID_FIELD_KEY]: newTag },
      }),
    );
  }
  return {
    thermal_bridges: sortedThermalBridges(rows),
    single_select_options: cloneThermalBridgeOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function replaceThermalBridgeOptionsPayload(
  current: ThermalBridgesSlice,
  key: ThermalBridgeOptionKey,
  nextOptions: FieldOption[],
  replacements: Record<string, string | null> = {},
): ThermalBridgesReplacePayload {
  const options = cloneThermalBridgeOptions(current);
  options[key] = normalizeOptionOrders(nextOptions);
  const nextOptionIds = new Set(options[key].map((option) => option.id));
  const removedReferencedOptionIds = new Set(
    current.thermal_bridges
      .map((row) => row.thermal_bridge_type)
      .filter(
        (optionId): optionId is string =>
          optionId !== null && optionId !== undefined && !nextOptionIds.has(optionId),
      ),
  );
  for (const optionId of removedReferencedOptionIds) {
    if (!(optionId in replacements)) {
      throw new Error(`Missing replacement for referenced ${key} option ${optionId}.`);
    }
  }
  const rows = current.thermal_bridges.map((row) => {
    const currentOptionId = row.thermal_bridge_type;
    if (!currentOptionId || !(currentOptionId in replacements)) return row;
    return { ...row, thermal_bridge_type: replacements[currentOptionId] ?? null };
  });
  return {
    thermal_bridges: sortedThermalBridges(rows),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function makeBuildEmptyThermalBridgeRow(): BuildEmptyRow<ThermalBridgeRow> {
  return ({ rowId, fieldDefaults }) =>
    normalizeThermalBridgeForPayload({
      id: rowId,
      thermal_bridge_type: readStringDefault(fieldDefaults[THERMAL_BRIDGE_TYPE_KEY], null),
      pdf_report_asset_ids: [],
      notes: readStringDefault(fieldDefaults.notes, null),
      custom_values: {
        [RECORD_ID_FIELD_KEY]: readStringDefault(fieldDefaults[RECORD_ID_FIELD_KEY], null),
        name: readStringDefault(fieldDefaults.name, null),
        sheet_name: readStringDefault(fieldDefaults.sheet_name, null),
        drawing_number: readStringDefault(fieldDefaults.drawing_number, null),
        quantity: readNumberDefault(fieldDefaults.quantity, null),
        psi_value_w_mk: readNumberDefault(fieldDefaults.psi_value_w_mk, null),
        frsi_value: readNumberDefault(fieldDefaults.frsi_value, null),
        [STATUS_FIELD_KEY]: readStatusDefault(
          fieldDefaults[STATUS_FIELD_KEY],
          STATUS_DEFAULT_OPTION_ID,
        ),
      },
    });
}

export function validateThermalBridgesPayload(
  payload: ThermalBridgesReplacePayload,
): string | null {
  const ids = new Set<string>();
  const typeIds = new Set(
    payload.single_select_options[THERMAL_BRIDGE_TYPE_OPTION_KEY].map((option) => option.id),
  );
  for (const row of payload.thermal_bridges) {
    if (ids.has(row.id)) return "Thermal bridge id already exists in this project.";
    ids.add(row.id);
    if (row.thermal_bridge_type && !typeIds.has(row.thermal_bridge_type)) {
      return "Thermal bridge type option is missing.";
    }
    const psi = customNumberValue(row, "psi_value_w_mk");
    if (psi !== null && psi < 0) return "Psi-Value must be zero or greater.";
    const frsi = customNumberValue(row, "frsi_value");
    if (frsi !== null && (frsi < 0 || frsi > 1)) {
      return "fRSI Value must be between 0 and 1.";
    }
  }
  return null;
}

export function sortedThermalBridges(rows: ThermalBridgeRow[]): ThermalBridgeRow[] {
  return rows
    .map((row) => ({
      row,
      primary: customTextValue(row, RECORD_ID_FIELD_KEY) || customTextValue(row, "name") || row.id,
    }))
    .sort((a, b) => {
      const primary = a.primary.localeCompare(b.primary, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (primary !== 0) return primary;
      return a.row.id.localeCompare(b.row.id, undefined, { numeric: true, sensitivity: "base" });
    })
    .map(({ row }) => row);
}

function applyWritesToThermalBridge(
  row: ThermalBridgeRow,
  writes: { rowId: string; fieldKey: string; value: unknown }[],
): ThermalBridgeRow {
  if (writes.length === 0) return row;
  let next = row;
  for (const write of writes) {
    next = applyWriteToThermalBridge(next, write.fieldKey, write.value);
  }
  return normalizeThermalBridgeForPayload(next);
}

function applyWriteToThermalBridge(
  row: ThermalBridgeRow,
  fieldKey: string,
  value: unknown,
): ThermalBridgeRow {
  if (fieldKey === THERMAL_BRIDGE_TYPE_KEY && isNullableOptionId(value)) {
    return { ...row, thermal_bridge_type: value };
  }
  if (fieldKey === "notes" && (value === null || typeof value === "string")) {
    return { ...row, notes: value };
  }
  if (fieldKey === THERMAL_BRIDGE_PDF_REPORT_FIELD_KEY) {
    return { ...row, pdf_report_asset_ids: readAttachmentAssetIds(value) };
  }
  if (THERMAL_BRIDGE_CUSTOM_VALUE_FIELD_KEYS.has(fieldKey) || fieldKey.startsWith("cf_")) {
    return setCustomValue(row, fieldKey, value);
  }
  return row;
}

function normalizeThermalBridgeForPayload(row: ThermalBridgeRow): ThermalBridgeRow {
  const next: ThermalBridgeRow = {
    ...row,
    thermal_bridge_type: row.thermal_bridge_type ?? null,
    pdf_report_asset_ids: [...row.pdf_report_asset_ids],
    notes: emptyToNull(row.notes),
    custom_values: { ...row.custom_values },
  };
  for (const key of THERMAL_BRIDGE_CUSTOM_VALUE_FIELD_KEYS) {
    if (!(key in next.custom_values)) next.custom_values[key] = null;
  }
  return next;
}

function cloneThermalBridgeOptions(
  current: ThermalBridgesSlice,
): ThermalBridgesReplacePayload["single_select_options"] {
  const out: ThermalBridgesReplacePayload["single_select_options"] = {
    [THERMAL_BRIDGE_TYPE_OPTION_KEY]: [
      ...(current.single_select_options[THERMAL_BRIDGE_TYPE_OPTION_KEY] ?? []),
    ],
  };
  for (const [key, list] of Object.entries(current.single_select_options)) {
    if (key === THERMAL_BRIDGE_TYPE_OPTION_KEY) continue;
    out[key as ThermalBridgeOptionKey] = [...list];
  }
  return out;
}

function customTextValue(row: ThermalBridgeRow, fieldKey: string): string {
  const raw = row.custom_values[fieldKey];
  return typeof raw === "string" ? raw : "";
}

function stringFromCustomValues(values: Record<string, unknown>, key: string): string {
  const raw = values[key];
  return typeof raw === "string" ? raw : "";
}

function emptyToNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isNullableOptionId(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^opt_[A-Za-z0-9_-]+$/.test(value));
}

function readStringDefault(value: unknown, fallback: string | null): string | null {
  return value === null || typeof value === "string" ? value : fallback;
}

function readNumberDefault(value: unknown, fallback: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
