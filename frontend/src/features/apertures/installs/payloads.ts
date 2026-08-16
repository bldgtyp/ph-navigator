// Slice payload builders for the Installs library table — the Thermal
// Bridges recipe with install-type columns. The Default row
// (`apit_default`) can never be deleted: the delete builder drops it from
// the requested set (sibling deletes still land) and the server 409 stays
// the authority.
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
import {
  readNumberDefault,
  readStatusDefault,
  readStringDefault,
} from "../../../shared/lib/fieldDefaults";
import { readAttachmentAssetIds } from "../../assets/lib";
import { nextCopySuffix } from "../../equipment/lib";
import { customNumberValue, customTextValue } from "../../equipment/lib/customValueReaders";
import {
  APERTURE_INSTALL_TYPES_STATUS_OPTION_KEY,
  STATUS_DEFAULT_OPTION_ID,
  STATUS_FIELD_KEY,
} from "../../../shared/ui/data-table/status";
import {
  APERTURE_INSTALL_DATASHEET_FIELD_KEY,
  APERTURE_INSTALL_DEFAULT_TYPE_ID,
  APERTURE_INSTALL_PDF_REPORT_FIELD_KEY,
  APERTURE_INSTALL_PHOTO_FIELD_KEY,
  APERTURE_INSTALL_SOURCE_KEY,
  APERTURE_INSTALL_SOURCE_OPTION_KEY,
  type InstallTypeOptionKey,
  type InstallTypeRow,
  type InstallTypesReplacePayload,
  type InstallTypesSlice,
} from "./types";
import {
  INSTALL_TYPE_CUSTOM_VALUE_FIELD_KEYS,
  installTypeOptionListKeyForFieldKey,
} from "./constants";

export function installTypesPayloadFromCellWrites(
  current: InstallTypesSlice,
  writes: { rowId: string; fieldKey: string; value: unknown }[],
  newOptions: Record<string, FieldOption[]>,
  removedOptions: Record<string, string[]> = {},
): InstallTypesReplacePayload {
  const options = cloneInstallTypeOptions(current);
  for (const [fieldKey, removedIds] of Object.entries(removedOptions)) {
    const optionKey = installTypeOptionListKeyForFieldKey(fieldKey);
    if (!optionKey || removedIds.length === 0) continue;
    const remove = new Set(removedIds);
    options[optionKey] = normalizeOptionOrders(
      (options[optionKey] ?? []).filter((option) => !remove.has(option.id)),
    );
  }
  for (const [fieldKey, createdOptions] of Object.entries(newOptions)) {
    const optionKey = installTypeOptionListKeyForFieldKey(fieldKey);
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
  const rows = current.aperture_install_types.map((row) =>
    applyWritesToInstallType(row, writesByRowId.get(row.id) ?? []),
  );
  return {
    aperture_install_types: sortedInstallTypes(rows),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function installTypesPayloadFromRowInsert(
  current: InstallTypesSlice,
  inserts: RowInsertPayload[],
  build: BuildEmptyRow<InstallTypeRow>,
): InstallTypesReplacePayload {
  const built = inserts.map((payload) => {
    const anchorRow = payload.anchorRowId
      ? (current.aperture_install_types.find((row) => row.id === payload.anchorRowId) ?? null)
      : null;
    return normalizeInstallTypeForPayload(
      build({ rowId: payload.rowId, fieldDefaults: payload.fieldDefaults, anchorRow }),
    );
  });
  return {
    aperture_install_types: sortedInstallTypes([...current.aperture_install_types, ...built]),
    single_select_options: cloneInstallTypeOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function installTypesPayloadFromRowDelete(
  current: InstallTypesSlice,
  deletes: RowDeletePayload[],
): InstallTypesReplacePayload {
  // The Default row is never deletable: drop it from the requested set so a
  // multi-row delete that swept it up still removes the other rows. The
  // server 409s if a protected delete slips through anyway.
  const toDelete = new Set(deletes.map((entry) => entry.rowId));
  toDelete.delete(APERTURE_INSTALL_DEFAULT_TYPE_ID);
  return {
    aperture_install_types: current.aperture_install_types.filter((row) => !toDelete.has(row.id)),
    single_select_options: cloneInstallTypeOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function installTypesPayloadFromRowDuplicate(
  current: InstallTypesSlice,
  duplicates: RowDuplicatePayload[],
): InstallTypesReplacePayload {
  const rows = [...current.aperture_install_types];
  const liveTags = new Set(rows.map((row) => customTextValue(row, RECORD_ID_FIELD_KEY)));
  for (const duplicate of duplicates) {
    const source = duplicate.sourceRow as InstallTypeRow;
    const sourceTag = customTextValue(source, RECORD_ID_FIELD_KEY);
    const newTag = nextCopySuffix(sourceTag, liveTags);
    liveTags.add(newTag);
    rows.push(
      normalizeInstallTypeForPayload({
        ...source,
        id: duplicate.rowId,
        pdf_report_asset_ids: [],
        datasheet_asset_ids: [],
        photo_asset_ids: [],
        custom_values: { ...source.custom_values, [RECORD_ID_FIELD_KEY]: newTag },
      }),
    );
  }
  return {
    aperture_install_types: sortedInstallTypes(rows),
    single_select_options: cloneInstallTypeOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function replaceInstallTypeOptionsPayload(
  current: InstallTypesSlice,
  key: InstallTypeOptionKey,
  nextOptions: FieldOption[],
  replacements: Record<string, string | null> = {},
): InstallTypesReplacePayload {
  const options = cloneInstallTypeOptions(current);
  options[key] = normalizeOptionOrders(nextOptions);
  if (key !== APERTURE_INSTALL_SOURCE_OPTION_KEY) {
    return {
      aperture_install_types: current.aperture_install_types,
      single_select_options: options,
      field_defs: [...current.field_defs],
    };
  }
  const nextOptionIds = new Set(options[key].map((option) => option.id));
  const rows = current.aperture_install_types.map((row) => {
    const currentOptionId = customTextValue(row, APERTURE_INSTALL_SOURCE_KEY) || null;
    if (!currentOptionId || nextOptionIds.has(currentOptionId)) return row;
    if (!(currentOptionId in replacements)) {
      throw new Error(`Missing replacement for referenced ${key} option ${currentOptionId}.`);
    }
    return setCustomValue(row, APERTURE_INSTALL_SOURCE_KEY, replacements[currentOptionId] ?? null);
  });
  return {
    aperture_install_types: sortedInstallTypes(rows),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function makeBuildEmptyInstallTypeRow(): BuildEmptyRow<InstallTypeRow> {
  return ({ rowId, fieldDefaults }) =>
    normalizeInstallTypeForPayload({
      id: rowId,
      pdf_report_asset_ids: [],
      datasheet_asset_ids: [],
      photo_asset_ids: [],
      notes: readStringDefault(fieldDefaults.notes, null),
      custom_values: {
        [RECORD_ID_FIELD_KEY]: readStringDefault(fieldDefaults[RECORD_ID_FIELD_KEY], null),
        name: readStringDefault(fieldDefaults.name, null),
        psi_w_mk: readNumberDefault(fieldDefaults.psi_w_mk, null),
        [APERTURE_INSTALL_SOURCE_KEY]: readStringDefault(
          fieldDefaults[APERTURE_INSTALL_SOURCE_KEY],
          null,
        ),
        [STATUS_FIELD_KEY]: readStatusDefault(
          fieldDefaults[STATUS_FIELD_KEY],
          STATUS_DEFAULT_OPTION_ID,
        ),
      },
    });
}

export function validateInstallTypesPayload(payload: InstallTypesReplacePayload): string | null {
  const ids = new Set<string>();
  const sourceIds = new Set(
    payload.single_select_options[APERTURE_INSTALL_SOURCE_OPTION_KEY].map((option) => option.id),
  );
  for (const row of payload.aperture_install_types) {
    if (ids.has(row.id)) return "Install type id already exists in this project.";
    ids.add(row.id);
    const source = customTextValue(row, APERTURE_INSTALL_SOURCE_KEY);
    if (source && !sourceIds.has(source)) {
      return "Install type source option is missing.";
    }
    const psi = customNumberValue(row, "psi_w_mk");
    if (psi !== null && psi < 0) return "Psi-Install must be zero or greater.";
  }
  return null;
}

export function sortedInstallTypes(rows: InstallTypeRow[]): InstallTypeRow[] {
  return rows
    .map((row) => ({
      row,
      // The Default row pins to the top; the rest sort by Tag / Name.
      isDefault: row.id === APERTURE_INSTALL_DEFAULT_TYPE_ID,
      primary: customTextValue(row, RECORD_ID_FIELD_KEY) || customTextValue(row, "name") || row.id,
    }))
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      const primary = a.primary.localeCompare(b.primary, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (primary !== 0) return primary;
      return a.row.id.localeCompare(b.row.id, undefined, { numeric: true, sensitivity: "base" });
    })
    .map(({ row }) => row);
}

function applyWritesToInstallType(
  row: InstallTypeRow,
  writes: { rowId: string; fieldKey: string; value: unknown }[],
): InstallTypeRow {
  if (writes.length === 0) return row;
  let next = row;
  for (const write of writes) {
    next = applyWriteToInstallType(next, write.fieldKey, write.value);
  }
  return normalizeInstallTypeForPayload(next);
}

function applyWriteToInstallType(
  row: InstallTypeRow,
  fieldKey: string,
  value: unknown,
): InstallTypeRow {
  if (fieldKey === "notes" && (value === null || typeof value === "string")) {
    return { ...row, notes: value };
  }
  if (fieldKey === APERTURE_INSTALL_PDF_REPORT_FIELD_KEY) {
    return { ...row, pdf_report_asset_ids: readAttachmentAssetIds(value) };
  }
  if (fieldKey === APERTURE_INSTALL_DATASHEET_FIELD_KEY) {
    return { ...row, datasheet_asset_ids: readAttachmentAssetIds(value) };
  }
  if (fieldKey === APERTURE_INSTALL_PHOTO_FIELD_KEY) {
    return { ...row, photo_asset_ids: readAttachmentAssetIds(value) };
  }
  if (INSTALL_TYPE_CUSTOM_VALUE_FIELD_KEYS.has(fieldKey) || fieldKey.startsWith("cf_")) {
    return setCustomValue(row, fieldKey, value);
  }
  return row;
}

function normalizeInstallTypeForPayload(row: InstallTypeRow): InstallTypeRow {
  const next: InstallTypeRow = {
    ...row,
    pdf_report_asset_ids: readAttachmentAssetIds(row.pdf_report_asset_ids),
    datasheet_asset_ids: readAttachmentAssetIds(row.datasheet_asset_ids),
    photo_asset_ids: readAttachmentAssetIds(row.photo_asset_ids),
    notes: emptyToNull(row.notes),
    custom_values: { ...row.custom_values },
  };
  for (const key of INSTALL_TYPE_CUSTOM_VALUE_FIELD_KEYS) {
    if (!(key in next.custom_values)) next.custom_values[key] = null;
  }
  return next;
}

function cloneInstallTypeOptions(
  current: InstallTypesSlice,
): InstallTypesReplacePayload["single_select_options"] {
  const out: InstallTypesReplacePayload["single_select_options"] = {
    [APERTURE_INSTALL_SOURCE_OPTION_KEY]: [
      ...(current.single_select_options[APERTURE_INSTALL_SOURCE_OPTION_KEY] ?? []),
    ],
    [APERTURE_INSTALL_TYPES_STATUS_OPTION_KEY]: [
      ...(current.single_select_options[APERTURE_INSTALL_TYPES_STATUS_OPTION_KEY] ?? []),
    ],
  };
  for (const [key, list] of Object.entries(current.single_select_options)) {
    if (key in out) continue;
    out[key as InstallTypeOptionKey] = [...list];
  }
  return out;
}

function emptyToNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
