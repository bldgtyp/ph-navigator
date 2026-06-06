import { useMemo } from "react";
import {
  tableFieldDefsToFieldDefs,
  type DataTableColumnDef,
  type FieldDef,
  type FieldOption,
  type TableFieldDef,
  type TableFieldRenderOverlay,
} from "../../../shared/ui/data-table";

type SliceWithSchema = {
  field_defs?: TableFieldDef[];
  single_select_options: Record<string, FieldOption[]>;
};

export function useEquipmentTablePreview<TSlice extends SliceWithSchema>({
  slice,
  tableKey,
  fieldOverlay,
  tableFieldDefs,
  columnsForSanitize,
}: {
  slice: TSlice;
  tableKey: string;
  fieldOverlay: (slice: TSlice) => Record<string, TableFieldRenderOverlay>;
  tableFieldDefs: (slice: TSlice) => TableFieldDef[];
  columnsForSanitize: (fieldDefs: readonly FieldDef[]) => DataTableColumnDef<unknown>[];
}) {
  const fieldRenderOverlay = useMemo(() => fieldOverlay(slice), [fieldOverlay, slice]);
  const fieldDefs = useMemo(
    () => slice.field_defs ?? tableFieldDefs(slice),
    [slice, tableFieldDefs],
  );
  const previewSchemaFieldDefs = useMemo(
    () =>
      tableFieldDefsToFieldDefs({
        tableKey,
        fieldDefs,
        fieldOverlay: fieldRenderOverlay,
        singleSelectOptions: slice.single_select_options,
      }),
    [fieldDefs, fieldRenderOverlay, slice.single_select_options, tableKey],
  );
  const columnsForSanitizeResult = useMemo(
    () => columnsForSanitize(previewSchemaFieldDefs),
    [columnsForSanitize, previewSchemaFieldDefs],
  );
  return {
    fieldRenderOverlay,
    fieldDefs,
    columnsForSanitize: columnsForSanitizeResult,
  };
}
