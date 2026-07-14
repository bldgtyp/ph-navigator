import type { DataTableColumnDef, FieldDef, LinkedRecordCellOps } from "../../types";
import { linkedRecordIds } from "../../fields/linkedRecord/display";
import { isComputedErrorValue } from "../formula/computedValues";
import { singleSelectOption } from "../rows/format";
import { sanitizeFilename } from "./csv";

export const JSON_MIME_TYPE = "application/json;charset=utf-8";

export type TableToJsonParams<TRow> = {
  rows: readonly TRow[];
  columns: readonly DataTableColumnDef<TRow>[];
  fieldDefByKey: ReadonlyMap<string, FieldDef>;
  linkedRecordOps?: ReadonlyMap<string, LinkedRecordCellOps>;
  tableName: string;
};

export type JsonExport = {
  filename: string;
  content: string;
};

// Serialize the current table view while keeping machine-stable field keys.
// Linked records carry both their persisted row id and the human display name
// used by the grid/CSV; this also covers read-only inverse-link projections.
export function tableToJson<TRow>({
  rows,
  columns,
  fieldDefByKey,
  linkedRecordOps,
  tableName,
}: TableToJsonParams<TRow>): JsonExport {
  // Resolve each column's field def once and reuse it in both the header and
  // per-cell passes (avoids an extra Map lookup for every cell).
  const resolvedDefs = columns.map((column) => fieldDefByKey.get(column.fieldKey));
  const fieldDefs = columns.map(
    (column, index) =>
      resolvedDefs[index] ?? {
        field_key: column.fieldKey,
        field_type: "text",
        display_name: column.header,
      },
  );
  const records = rows.map((row) =>
    Object.fromEntries(
      columns.map((column, index) => [
        column.fieldKey,
        jsonCellValue(row, column, resolvedDefs[index], linkedRecordOps),
      ]),
    ),
  );
  return {
    filename: `${sanitizeFilename(tableName)}.json`,
    content: `${JSON.stringify({ table_name: tableName, field_defs: fieldDefs, records }, null, 2)}\n`,
  };
}

function jsonCellValue<TRow>(
  row: TRow,
  column: DataTableColumnDef<TRow>,
  fieldDef: FieldDef | undefined,
  linkedRecordOps: ReadonlyMap<string, LinkedRecordCellOps> | undefined,
): unknown {
  if (column.linkedRecordCell) {
    const cell = column.linkedRecordCell;
    return cell.getIds(row).map((id) => ({ id, name: cell.resolve(id, row)?.recordId ?? null }));
  }

  const value = column.accessor(row);
  if (fieldDef?.field_type === "linked_record") {
    const ops = linkedRecordOps?.get(column.fieldKey);
    return linkedRecordIds(value).map((id) => ({ id, name: ops?.resolve(id)?.recordId ?? null }));
  }
  if (fieldDef?.field_type === "single_select" && typeof value === "string") {
    return { id: value, label: singleSelectOption(value, fieldDef)?.label ?? null };
  }
  if (isComputedErrorValue(value) || value === undefined) return null;
  return value;
}
