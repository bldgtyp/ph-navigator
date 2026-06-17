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
  const seen = new Set(persistedFieldDefs.map((fieldDef) => fieldDef.field_key));
  const appended = computedFieldDefs.filter((fieldDef) => !seen.has(fieldDef.field_key));
  return [...persistedFieldDefs, ...appended];
}
