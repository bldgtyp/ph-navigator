import { useMemo } from "react";
import { useProjectTableViewState } from "../../table_views/hooks";
import {
  emptyViewState,
  type DataTableColumnDef,
  type FieldDef,
  type SortRule,
  type ViewState,
} from "../../../shared/ui/data-table";

export function useHeatPumpTableViewState<TRow>({
  projectId,
  tableKey,
  isEditor,
  columns,
  fieldDefs,
  sort,
  hiddenColumns = [],
}: {
  projectId: string;
  tableKey: string;
  isEditor: boolean;
  columns: DataTableColumnDef<TRow>[];
  fieldDefs: FieldDef[];
  sort: SortRule[];
  hiddenColumns?: string[];
}) {
  const defaults = useMemo<ViewState>(
    () => ({
      ...emptyViewState(),
      sort,
      hiddenColumns,
    }),
    [hiddenColumns, sort],
  );
  const schemaFingerprint = useMemo(
    () =>
      [
        tableKey,
        ...fieldDefs.map((fieldDef) => `${fieldDef.field_key}:${fieldDef.field_type}`),
        ...columns.map((column) => `${column.id}:${column.fieldKey}`),
      ].join("|"),
    [columns, fieldDefs, tableKey],
  );

  return useProjectTableViewState({
    projectId,
    tableKey,
    defaults,
    enabled: isEditor,
    columns: columns as DataTableColumnDef<unknown>[],
    fieldDefs,
    schemaFingerprint,
  });
}
