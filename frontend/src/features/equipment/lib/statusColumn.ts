import {
  getCustomValue,
  type DataTableColumnDef,
  type FieldDef,
} from "../../../shared/ui/data-table";
import { STATUS_DISPLAY_NAME, STATUS_FIELD_KEY } from "../types";

type RowWithStatus = {
  custom_values?: Record<string, unknown> | null | undefined;
};

// Shared `Status` single-select column for every in-scope DataTable. The
// value rides in `custom_values.status`; the accessor yields the raw
// option id so the generic single-select cell resolves the colored pill
// from the FieldDef's `<table>.status` option list. One definition keeps
// the column uniform across the in-scope tables (no per-table fork).
export function statusColumn<TRow extends RowWithStatus>(
  fieldDefByKey: ReadonlyMap<string, FieldDef>,
  width = 130,
): DataTableColumnDef<TRow> {
  return {
    id: STATUS_FIELD_KEY,
    fieldKey: STATUS_FIELD_KEY,
    header: fieldDefByKey.get(STATUS_FIELD_KEY)?.display_name ?? STATUS_DISPLAY_NAME,
    accessor: (row) => {
      const value = getCustomValue(row, STATUS_FIELD_KEY);
      return typeof value === "string" ? value : null;
    },
    defaultWidth: width,
  };
}
