import type { DataTableColumnDef, FieldDef } from "../types";

/**
 * Placeholder column defs (id/fieldKey/header only) for the view-sanitize
 * pass, derived 1:1 from a table's resolved FieldDefs. Tables whose column
 * ids match their field keys can use this directly instead of hand-rolling
 * the identity map per feature.
 */
export function fieldDefsToSanitizeColumns(
  fieldDefs: readonly FieldDef[],
): DataTableColumnDef<unknown>[] {
  return fieldDefs.map((fieldDef) => ({
    id: fieldDef.field_key,
    fieldKey: fieldDef.field_key,
    header: fieldDef.display_name,
    accessor: () => null,
  }));
}
