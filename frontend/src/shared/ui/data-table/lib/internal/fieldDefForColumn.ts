import type { DataTableColumnDef, FieldDef } from "../../types";

export function fieldDefForColumn<TRow>(
  column: DataTableColumnDef<TRow> | undefined,
  fieldDefsByKey: Map<string, FieldDef>,
): FieldDef | undefined {
  if (!column) return undefined;
  return fieldDefsByKey.get(column.fieldKey);
}
