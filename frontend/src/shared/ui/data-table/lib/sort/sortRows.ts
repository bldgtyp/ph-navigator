import type { DataTableColumnDef, FieldDef, LinkedRecordCellOps, SortRule } from "../../types";
import { formatLinkedRecordValue } from "../../fields/linkedRecord/display";
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
  linkedRecordOps?: ReadonlyMap<string, LinkedRecordCellOps>,
): TRow[] {
  if (sortRules.length === 0) return rows;
  const columnsByFieldKey = fieldKeyColumnMap(columns);
  const fieldDefsByKey = fieldKeyFieldDefMap(fieldDefs);
  const resolvedRules = sortRules.flatMap((rule) => {
    const column = columnsByFieldKey.get(rule.fieldKey);
    if (!column) return [];
    const fieldDef = fieldDefForColumn(column, fieldDefsByKey);
    if (!fieldDef) return [];
    const linkedValues =
      fieldDef.field_type === "linked_record"
        ? new Map(
            rows.map((row) => [
              row,
              formatLinkedRecordValue(
                column.accessor(row),
                linkedRecordOps?.get(fieldDef.field_key),
              ),
            ]),
          )
        : undefined;
    return [{ rule, column, fieldDef, linkedValues }];
  });
  const sorted = [...rows];
  sorted.sort((left, right) => {
    for (const { rule, column, fieldDef, linkedValues } of resolvedRules) {
      const result = compareFieldValues(left, right, column, fieldDef, linkedValues);
      if (result !== 0) return rule.direction === "asc" ? result : -result;
    }
    return 0;
  });
  return sorted;
}

function compareFieldValues<TRow>(
  left: TRow,
  right: TRow,
  column: DataTableColumnDef<TRow>,
  fieldDef: FieldDef,
  linkedValues: ReadonlyMap<TRow, string> | undefined,
): number {
  if (fieldDef.field_type === "single_select") {
    return compareSingleSelectValues(column.accessor(left), column.accessor(right), fieldDef);
  }
  if (linkedValues) {
    return compareDisplayValues(linkedValues.get(left) ?? "", linkedValues.get(right) ?? "");
  }
  return compareDisplayValues(
    formatClipboardValue(column.accessor(left)),
    formatClipboardValue(column.accessor(right)),
  );
}

function compareDisplayValues(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
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
