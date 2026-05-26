import type { DataTableColumnDef, FieldDef, SortRule } from "../../types";
import { fieldDefForColumn } from "../internal/fieldDefForColumn";
import { fieldKeyColumnMap } from "../internal/fieldKeyColumnMap";
import { fieldKeyFieldDefMap } from "../internal/fieldKeyFieldDefMap";
import { formatClipboardCellValue, formatClipboardValue } from "../paste/tsv";
import { singleSelectOption } from "../rows/format";

export function sortRows<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  fieldDefs: FieldDef[],
  sortRules: SortRule[],
): TRow[] {
  if (sortRules.length === 0) return rows;
  const columnsByFieldKey = fieldKeyColumnMap(columns);
  const fieldDefsByKey = fieldKeyFieldDefMap(fieldDefs);
  const sorted = [...rows];
  sorted.sort((left, right) => {
    for (const rule of sortRules) {
      const column = columnsByFieldKey.get(rule.fieldKey);
      if (!column) continue;
      const fieldDef = fieldDefForColumn(column, fieldDefsByKey);
      const result =
        fieldDef?.field_type === "single_select"
          ? compareSingleSelectValues(column.accessor(left), column.accessor(right), fieldDef)
          : formatClipboardValue(column.accessor(left)).localeCompare(
              formatClipboardValue(column.accessor(right)),
              undefined,
              {
                numeric: true,
                sensitivity: "base",
              },
            );
      if (result !== 0) return rule.direction === "asc" ? result : -result;
    }
    return 0;
  });
  return sorted;
}

export function compareSingleSelectValues(
  left: unknown,
  right: unknown,
  fieldDef: FieldDef,
): number {
  const leftRank = optionSortRank(left, fieldDef);
  const rightRank = optionSortRank(right, fieldDef);
  if (leftRank !== rightRank) return leftRank - rightRank;
  return formatClipboardCellValue(left, fieldDef).localeCompare(
    formatClipboardCellValue(right, fieldDef),
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    },
  );
}

export function optionSortRank(value: unknown, fieldDef: FieldDef): number {
  if (value === null || value === undefined || value === "") return Number.POSITIVE_INFINITY;
  const option = singleSelectOption(value, fieldDef);
  // Missing option ids sort before explicit blanks so corrupt refs stay visible.
  return option?.order ?? Number.MAX_SAFE_INTEGER;
}
