import { getCustomValue } from "../../shared/ui/data-table/lib/customFieldAccessor";
import { cellKey } from "../../shared/ui/data-table/lib/cellKey";
import type { CellWrite, WriteOp } from "../../shared/ui/data-table/types";

type RetryableOp = Extract<WriteOp, { kind: "cell" | "fill" | "rowInsert" }>;
type RetryableMetadata =
  | Extract<RetryableOp, { kind: "rowInsert" }>
  | {
      op: Extract<RetryableOp, { kind: "cell" | "fill" }>;
      observedBase: CellWrite[];
    };

export function captureObservedBase(
  rows: readonly (Record<string, unknown> & { id: string })[],
  writes: readonly CellWrite[],
): CellWrite[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return writes.map((write) => ({
    ...write,
    value: getCustomValue(byId.get(write.rowId) ?? {}, write.fieldKey),
  }));
}

export function buildCellRetryMetadata(
  rows: readonly (Record<string, unknown> & { id: string })[],
  op: Extract<RetryableOp, { kind: "cell" | "fill" }>,
): RetryableMetadata {
  return { op, observedBase: captureObservedBase(rows, op.writes) };
}

export function canRetryWriteMetadata(
  rows: readonly (Record<string, unknown> & { id: string })[],
  metadata: readonly unknown[],
): boolean {
  const entries = metadata.filter(isRetryableMetadata);
  if (entries.length !== metadata.length) return false;
  const byId = new Map(rows.map((row) => [row.id, row]));
  const availableIds = new Set(byId.keys());
  for (const entry of entries) {
    const op = "op" in entry ? entry.op : entry;
    if (op.kind === "rowInsert") {
      for (const row of op.rows) {
        if (availableIds.has(row.rowId)) return false;
        if (row.anchorRowId !== null && !availableIds.has(row.anchorRowId)) return false;
        availableIds.add(row.rowId);
      }
      continue;
    }
    if (!("op" in entry)) return false;
    const observed = observedBaseByCell(entry.observedBase);
    for (const write of op.writes) {
      const row = byId.get(write.rowId);
      const key = cellKey(write.rowId, write.fieldKey);
      if (
        !row ||
        !observed.has(key) ||
        !sameValue(getCustomValue(row, write.fieldKey), observed.get(key))
      ) {
        return false;
      }
    }
  }
  return true;
}

function isRetryableMetadata(value: unknown): value is RetryableMetadata {
  if (!isRecord(value)) return false;
  if (value.kind === "rowInsert") return Array.isArray(value.rows);
  return (
    isRecord(value.op) &&
    (value.op.kind === "cell" || value.op.kind === "fill") &&
    Array.isArray(value.observedBase)
  );
}

function observedBaseByCell(writes: CellWrite[]): Map<string, unknown> {
  return new Map(writes.map((write) => [cellKey(write.rowId, write.fieldKey), write.value]));
}

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameValue(value, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
