import type { ReactNode } from "react";
import { formatDisplayCellValue } from "../lib/rows/format";
import { formatLinkedRecordValue } from "../fields/linkedRecord/display";
import type { DataTableColumnDef, FieldDef, LinkedRecordCellOps } from "../types";
import { AddFieldTailCell } from "./AddFieldTailCell";
import { SingleSelectCell } from "./SingleSelectCell";

// Presentational group-header row. Chevron + left-indent + key (pill
// for single_select) + `(N rows)` count in the first column; per-
// column aggregation cells fan out across the rest, aligned with the
// body.

export type GroupHeaderRowProps<TRow> = {
  depth: number;
  pathKey: string;
  fieldDef: FieldDef;
  groupValue: unknown;
  count: number;
  aggregatedValues: Map<string, string>;
  expanded: boolean;
  visibleColumnDefs: readonly DataTableColumnDef<TRow>[];
  linkedRecordOps?: LinkedRecordCellOps;
  onToggle: (pathKey: string) => void;
  // Row-virtualization plumbing. The body renders only the rows the
  // virtualizer returns; each `<tr>` reports its measured height back
  // via `measureRef` so variable group-header heights settle without a
  // fixed estimate.
  measureRef?: (el: HTMLTableRowElement | null) => void;
  dataIndex?: number;
};

export function GroupHeaderRow<TRow>({
  depth,
  pathKey,
  fieldDef,
  groupValue,
  count,
  aggregatedValues,
  expanded,
  visibleColumnDefs,
  linkedRecordOps,
  onToggle,
  measureRef,
  dataIndex,
}: GroupHeaderRowProps<TRow>) {
  const indent = depth * 8 + 8;
  // First column hosts chevron + key + count; subsequent columns each
  // host their aggregation cell (or empty when not aggregated). The
  // column whose fieldKey matches this group's fieldDef gets its
  // aggregated value too — same alignment as the body.
  return (
    <tr
      ref={measureRef}
      data-index={dataIndex}
      role="row"
      className="data-table-group-row"
      data-group-path={pathKey}
      data-group-depth={depth}
      aria-expanded={expanded}
    >
      <td className="data-table-gutter" aria-hidden />
      {visibleColumnDefs.map((column, index) => {
        if (index === 0) {
          return (
            <td
              key={column.id}
              className="data-table-group-header data-table-frozen"
              style={{ paddingLeft: `${indent}px` }}
            >
              <button
                type="button"
                className="data-table-group-chevron"
                aria-label={`${expanded ? "Collapse" : "Expand"} group ${fieldDef.display_name}`}
                onClick={() => onToggle(pathKey)}
              >
                {expanded ? "▼" : "▶"}
              </button>
              <span className="data-table-group-key">
                {renderGroupKey(groupValue, fieldDef, linkedRecordOps)}
              </span>
              <span className="data-table-group-count">
                ({count} {count === 1 ? "row" : "rows"})
              </span>
            </td>
          );
        }
        return (
          <td
            key={column.id}
            className="data-table-group-aggregation"
            data-field-key={column.fieldKey}
          >
            {aggregatedValues.get(column.fieldKey) ?? ""}
          </td>
        );
      })}
      <AddFieldTailCell variant="td" />
    </tr>
  );
}

function renderGroupKey(
  value: unknown,
  fieldDef: FieldDef,
  linkedRecordOps?: LinkedRecordCellOps,
): ReactNode {
  if (fieldDef.field_type === "single_select") {
    return <SingleSelectCell value={value} fieldDef={fieldDef} />;
  }
  if (value === null || value === undefined || value === "") {
    return <span className="muted-cell">Unassigned</span>;
  }
  if (fieldDef.field_type === "linked_record") {
    const label = formatLinkedRecordValue(value, linkedRecordOps);
    return label || <span className="muted-cell">Unassigned</span>;
  }
  return formatDisplayCellValue(value, fieldDef);
}
