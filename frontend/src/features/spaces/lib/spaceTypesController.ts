import {
  RECORD_ID_FIELD_KEY,
  getCustomLink,
  getCustomValue,
  setCustomLink,
  setCustomValue,
  type BuildEmptyRow,
  type CellWrite,
  type FieldOption,
  type RowDeletePayload,
  type RowDuplicatePayload,
  type RowInsertPayload,
  type TableFieldDef,
} from "../../../shared/ui/data-table";
import { normalizeOptionOrders } from "../../../shared/ui/data-table/lib";
import type {
  RemovedOptionDelta,
  SlicePayloadBuilders,
} from "../../../shared/ui/data-table/feature";
import { nextCopySuffix } from "../../../shared/lib/copySuffix";
import {
  SPACE_TYPE_NAME_FIELD_KEY,
  SPACE_TYPES_TABLE_NAME,
  type InverseLinkField,
  type SpaceTypeRow,
  type SpaceTypesReplacePayload,
  type SpaceTypesSlice,
} from "../types";

type SpaceTypeCellWrite = Pick<CellWrite, "rowId" | "fieldKey" | "value">;

export const spaceTypesPayloadBuilders: SlicePayloadBuilders<
  SpaceTypesSlice,
  SpaceTypeRow,
  SpaceTypesReplacePayload
> = {
  rows: (slice) => slice.space_types,
  fromCellWrites: spaceTypesPayloadFromCellWrites,
  fromRowInsert: spaceTypesPayloadFromRowInsert,
  fromRowDelete: spaceTypesPayloadFromRowDelete,
  fromRowDuplicate: spaceTypesPayloadFromRowDuplicate,
  validate: validateSpaceTypesPayload,
};

export function spaceTypesPayloadFromCellWrites(
  current: SpaceTypesSlice,
  writes: SpaceTypeCellWrite[],
  newOptions: Record<string, FieldOption[]>,
  removedOptions: RemovedOptionDelta = {},
): SpaceTypesReplacePayload {
  const options = cloneSpaceTypeOptions(current);
  for (const [fieldKey, removedIds] of Object.entries(removedOptions)) {
    const optionKey = spaceTypeOptionListKeyForFieldKey(fieldKey);
    if (!optionKey || removedIds.length === 0) continue;
    const remove = new Set(removedIds);
    options[optionKey] = normalizeOptionOrders(
      (options[optionKey] ?? []).filter((option) => !remove.has(option.id)),
    );
  }
  for (const [fieldKey, createdOptions] of Object.entries(newOptions)) {
    const optionKey = spaceTypeOptionListKeyForFieldKey(fieldKey);
    if (!optionKey) continue;
    options[optionKey] = normalizeOptionOrders([...(options[optionKey] ?? []), ...createdOptions]);
  }

  const writesByRowId = writes.reduce((byRowId, write) => {
    const rowWrites = byRowId.get(write.rowId);
    if (rowWrites) rowWrites.push(write);
    else byRowId.set(write.rowId, [write]);
    return byRowId;
  }, new Map<string, SpaceTypeCellWrite[]>());
  const fieldDefByKey = fieldDefsByKey(current.field_defs);
  const rows = current.space_types.map((row) => {
    const rowWrites = writesByRowId.get(row.id);
    return rowWrites ? applyWritesToSpaceType(row, rowWrites, fieldDefByKey) : row;
  });
  return buildPayload(current, rows, options);
}

export function spaceTypesPayloadFromRowInsert(
  current: SpaceTypesSlice,
  inserts: RowInsertPayload[],
  build: BuildEmptyRow<SpaceTypeRow>,
): SpaceTypesReplacePayload {
  const rows = [...current.space_types];
  for (const insert of inserts) {
    const anchorRow = insert.anchorRowId
      ? (rows.find((row) => row.id === insert.anchorRowId) ?? null)
      : null;
    const row = normalizeSpaceTypeForPayload(
      build({ rowId: insert.rowId, fieldDefaults: insert.fieldDefaults, anchorRow }),
      current.field_defs,
    );
    const anchorIndex = insert.anchorRowId
      ? rows.findIndex((candidate) => candidate.id === insert.anchorRowId)
      : -1;
    rows.splice(anchorIndex === -1 ? rows.length : anchorIndex + 1, 0, row);
  }
  return buildPayload(current, rows);
}

export function spaceTypesPayloadFromRowDelete(
  current: SpaceTypesSlice,
  deletes: RowDeletePayload[],
): SpaceTypesReplacePayload {
  const toDelete = new Set(deletes.map((entry) => entry.rowId));
  return buildPayload(
    current,
    current.space_types.filter((row) => !toDelete.has(row.id)),
  );
}

export function spaceTypesPayloadFromRowDuplicate(
  current: SpaceTypesSlice,
  duplicates: RowDuplicatePayload[],
): SpaceTypesReplacePayload {
  const rows = [...current.space_types];
  const liveTags = new Set(rows.map((row) => stringValue(row, RECORD_ID_FIELD_KEY)));
  for (const duplicate of duplicates) {
    const source = duplicate.sourceRow as SpaceTypeRow;
    const sourceTag = stringValue(source, RECORD_ID_FIELD_KEY);
    const nextTag = nextCopySuffix(sourceTag, liveTags);
    liveTags.add(nextTag);
    const clone = normalizeSpaceTypeForPayload(
      {
        ...source,
        id: duplicate.rowId,
        custom_values: {
          ...(source.custom_values ?? {}),
          [RECORD_ID_FIELD_KEY]: nextTag,
        },
        custom_links: { ...(source.custom_links ?? {}) },
      },
      current.field_defs,
    );
    const anchorIndex = duplicate.anchorRowId
      ? rows.findIndex((candidate) => candidate.id === duplicate.anchorRowId)
      : -1;
    rows.splice(anchorIndex === -1 ? rows.length : anchorIndex + 1, 0, clone);
  }
  return buildPayload(current, rows);
}

export function validateSpaceTypesPayload(payload: SpaceTypesReplacePayload): string | null {
  const tags = new Map<string, string>();
  for (const row of payload.space_types) {
    const tag = stringValue(row, RECORD_ID_FIELD_KEY).trim();
    if (!tag && isBlankSpaceType(row)) continue;
    if (!tag) return "Space-Type Tag is required.";
    const tagKey = tag.toLocaleLowerCase();
    const duplicate = tags.get(tagKey);
    if (duplicate) return `Space-Type Tags must be unique: ${duplicate} and ${tag}.`;
    tags.set(tagKey, tag);
  }
  return null;
}

export function spaceTypeColumnStubs(
  fieldDefs: readonly TableFieldDef[],
  inverseLinkFields: readonly InverseLinkField[],
) {
  return [
    ...fieldDefs.map((field) => ({
      id: field.field_key,
      fieldKey: field.field_key,
      header: field.display_name,
      accessor: () => "",
    })),
    ...inverseLinkFields.map((field) => ({
      id: inverseFieldKey(field),
      fieldKey: inverseFieldKey(field),
      header: `${field.source_table_display} ← ${field.source_field_display_name}`,
      accessor: () => "",
    })),
  ];
}

function inverseFieldKey(field: InverseLinkField): string {
  return `inverse:${field.source_key}`;
}

function applyWritesToSpaceType(
  row: SpaceTypeRow,
  writes: SpaceTypeCellWrite[],
  fieldDefByKey: ReadonlyMap<string, TableFieldDef>,
): SpaceTypeRow {
  let next = row;
  for (const write of writes) {
    const fieldDef = fieldDefByKey.get(write.fieldKey);
    if (!fieldDef) continue;
    next =
      fieldDef.field_type === "linked_record"
        ? setCustomLink(next, write.fieldKey, write.value)
        : setCustomValue(next, write.fieldKey, write.value);
  }
  return normalizeSpaceTypeForPayload(next, Array.from(fieldDefByKey.values()));
}

function normalizeSpaceTypeForPayload(
  row: SpaceTypeRow,
  fieldDefs: readonly Pick<TableFieldDef, "field_key" | "field_type">[],
): SpaceTypeRow {
  let next: SpaceTypeRow = {
    id: row.id,
    custom_values: {},
    custom_links: {},
  };
  for (const fieldDef of fieldDefs) {
    if (fieldDef.field_type === "linked_record") {
      const value = getCustomLink(row, fieldDef.field_key);
      if (value.length > 0) next = setCustomLink(next, fieldDef.field_key, value);
      continue;
    }
    const value = getCustomValue(row, fieldDef.field_key);
    if (value !== undefined) next = setCustomValue(next, fieldDef.field_key, value);
  }
  return next;
}

function buildPayload(
  current: SpaceTypesSlice,
  rows: SpaceTypeRow[],
  options = cloneSpaceTypeOptions(current),
): SpaceTypesReplacePayload {
  return {
    space_types: rows,
    field_defs: [...current.field_defs],
    single_select_options: options,
  };
}

function cloneSpaceTypeOptions(current: SpaceTypesSlice): Record<string, FieldOption[]> {
  return Object.fromEntries(
    Object.entries(current.single_select_options).map(([key, options]) => [key, [...options]]),
  );
}

function spaceTypeOptionListKeyForFieldKey(fieldKey: string): string | null {
  return fieldKey.startsWith("cf_") ? `${SPACE_TYPES_TABLE_NAME}.${fieldKey}` : null;
}

function fieldDefsByKey(fieldDefs: readonly TableFieldDef[]): Map<string, TableFieldDef> {
  return new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef]));
}

function stringValue(row: SpaceTypeRow, key: string): string {
  const value =
    key === SPACE_TYPE_NAME_FIELD_KEY ? row.custom_values?.[key] : getCustomValue(row, key);
  return typeof value === "string" ? value : "";
}

function isBlankSpaceType(row: SpaceTypeRow): boolean {
  return Object.values(row.custom_values ?? {}).every(
    (value) => value === null || value === undefined || value === "",
  );
}
