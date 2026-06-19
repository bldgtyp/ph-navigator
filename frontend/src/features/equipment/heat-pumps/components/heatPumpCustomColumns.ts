import type { DataTableColumnDef, FieldDef } from "../../../../shared/ui/data-table";
import {
  customFieldColumnDefs,
  type CustomFieldRow,
} from "../../../../shared/ui/data-table/feature";
import type { TableSchema } from "../../../../shared/ui/data-table";

export function heatPumpColumnsWithCustomFields<TRow extends CustomFieldRow>({
  builtInColumns,
  tableSchema,
  rowsComputed,
}: {
  builtInColumns: DataTableColumnDef<TRow>[];
  tableSchema: TableSchema;
  rowsComputed?: Record<string, Record<string, unknown>>;
}): DataTableColumnDef<TRow>[] {
  const fieldDefByKey = new Map(
    tableSchema.fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef]),
  );
  return [
    ...builtInColumns,
    ...customFieldColumnDefs<TRow>({
      customFields: tableSchema.customFields,
      fieldDefByKey,
      rowsComputed,
    }),
  ];
}

export function appendComputedFieldDefs(
  persistedFieldDefs: readonly FieldDef[],
  computedFieldDefs: readonly FieldDef[],
): FieldDef[] {
  const computedByKey = new Map(
    computedFieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef]),
  );
  const emitted = new Set<string>();
  const merged = persistedFieldDefs.map((fieldDef) => {
    const computed = computedByKey.get(fieldDef.field_key);
    if (!computed) return fieldDef;
    emitted.add(computed.field_key);
    return computed;
  });
  for (const computed of computedFieldDefs) {
    if (!emitted.has(computed.field_key)) merged.push(computed);
  }
  return merged;
}
