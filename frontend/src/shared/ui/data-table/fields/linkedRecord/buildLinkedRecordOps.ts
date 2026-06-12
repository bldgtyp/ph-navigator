// Consumer-side helper that turns a target-table slice into the
// per-fieldKey `LinkedRecordCellOps` map that `DataTable.linkedRecordOps`
// expects. The data-table library is target-table-agnostic; pages own
// the candidate/resolver wiring and the linked-row open action.
//
// Pages with linked_record fields pointing at multiple target tables
// call this once per target table and merge the resulting Maps.

import type { FieldDef, LinkedRecordCellOps, LinkedRecordCellCandidate } from "../../types";

export type BuildLinkedRecordOpsArgs<TRow> = {
  // All FieldDefs from the consumer's tableSchema. Non-linked_record
  // entries and fields whose `target_table_path` doesn't match are
  // skipped silently.
  fieldDefs: ReadonlyArray<FieldDef>;
  // The target-table identity, e.g. `["pumps"]`. Compared by structural
  // equality against each linked_record field's `target_table_path`.
  targetTablePath: ReadonlyArray<string>;
  // Rows from the target slice.
  targetRows: ReadonlyArray<TRow>;
  // Row-id projector for the target rows (matches what links store).
  getRowId: (row: TRow) => string;
  // Stable user-facing record id (display label on the pill) for a
  // target row. `null` falls back to the raw row-id at render time.
  getRecordId: (row: TRow) => string | null;
  // Optional searchable display name used by the picker's substring
  // filter. Defaults to `null` if omitted.
  getDisplayName?: (row: TRow) => string | null;
  // Linked-row open hook. Consumers commonly show the target row in a
  // modal; when omitted, pills render but no-op on click.
  onPillClick?: (rowId: string) => void;
};

export function buildLinkedRecordOps<TRow>(
  args: BuildLinkedRecordOpsArgs<TRow>,
): ReadonlyMap<string, LinkedRecordCellOps> {
  const {
    fieldDefs,
    targetTablePath,
    targetRows,
    getRowId,
    getRecordId,
    getDisplayName,
    onPillClick,
  } = args;

  const candidates: LinkedRecordCellCandidate[] = targetRows.map((row) => ({
    rowId: getRowId(row),
    recordId: getRecordId(row),
    ...(getDisplayName ? { displayName: getDisplayName(row) } : {}),
  }));

  // Pre-index by rowId so the resolver is O(1) per pill render even on
  // wide target tables.
  const recordIdByRowId = new Map<string, string | null>();
  for (const candidate of candidates) {
    recordIdByRowId.set(candidate.rowId, candidate.recordId);
  }

  const resolve: LinkedRecordCellOps["resolve"] = (rowId) => {
    const recordId = recordIdByRowId.get(rowId);
    return recordId === undefined ? null : { recordId };
  };

  const ops: LinkedRecordCellOps = onPillClick
    ? { candidates, resolve, onPillClick }
    : { candidates, resolve };

  const entries: Array<[string, LinkedRecordCellOps]> = [];
  for (const field of fieldDefs) {
    if (field.field_type !== "linked_record") continue;
    const path = field.linked_record_config?.target_table_path;
    if (!path || !pathsEqual(path, targetTablePath)) continue;
    entries.push([field.field_key, ops]);
  }
  return new Map(entries);
}

function pathsEqual(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
