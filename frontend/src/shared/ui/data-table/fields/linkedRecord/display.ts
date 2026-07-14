import type { LinkedRecordCellOps } from "../../types";

const EMPTY_LINKED_IDS: readonly string[] = [];

export function linkedRecordIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return EMPTY_LINKED_IDS;
  if (value.every((entry) => typeof entry === "string" && entry.length > 0)) {
    return value as string[];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

// Keep every non-cell DataTable surface on the same label contract as
// LinkedRecordCell: resolved record_id first, raw linked row id only as
// the missing/blank-record fallback.
export function linkedRecordLabel(rowId: string, ops: LinkedRecordCellOps | undefined): string {
  const recordId = ops?.resolve(rowId)?.recordId;
  return linkedRecordLabelFromRecordId(rowId, recordId);
}

export function linkedRecordLabelFromRecordId(
  rowId: string,
  recordId: string | null | undefined,
): string {
  return recordId && recordId.length > 0 ? recordId : rowId;
}

export function formatLinkedRecordValue(
  value: unknown,
  ops: LinkedRecordCellOps | undefined,
): string {
  return linkedRecordIds(value)
    .map((rowId) => linkedRecordLabel(rowId, ops))
    .join(", ");
}
