import type { DataTableColumnDef } from "../../types";

export function fieldKeyColumnMap<TRow>(
  columns: DataTableColumnDef<TRow>[],
): Map<string, DataTableColumnDef<TRow>> {
  return new Map(columns.map((column) => [column.fieldKey, column]));
}
